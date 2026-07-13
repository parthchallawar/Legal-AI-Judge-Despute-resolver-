# Agentic Workflow Upgrade — LangGraph.js Adjudication Engine

## Context

Today `aiService.adjudicateCase()` (`src/lib/ai-service.ts`) is a **fixed linear pipeline**:
`normalize → build context → generate verdict → bias check → done`. Every case walks the
identical path exactly once. There are no loops, no branching, and no way for the system to
say "I need more information," "let me reconsider," or "let's try to settle first." When the
co-judge fails the bias check, the case is stamped `ESCALATED` and dropped on a human — even
when the flaw was a one-line fixable reasoning error. Confidence is hardcoded to `0.9`.

This plan replaces that pipeline with a **stateful LangGraph.js graph** that adds the six
requested capabilities. It is **phased** (confirmed with the user): a synchronous
intelligence-upgrade graph first (features 1, 4, 5, 6), then durable checkpoint/interrupt
infrastructure for the human-in-the-loop features (2, 3). Target runtime is **local /
self-hosted Node**, so the Part A graph runs synchronously inside the verdict route (~5-8 LLM
calls, 30-90s is acceptable).

**Key de-risking decision:** LangGraph nodes are just async functions over shared state. We do
**not** adopt LangChain chat-model classes. Nodes call the **existing** `aiService` LLM
primitives, which already handle OpenRouter/Gemini routing, per-call DB key config, multimodal
base64 evidence, JSON extraction, and error fallbacks. LangGraph is used purely as the
orchestration / state-machine / checkpoint layer.

---

## Dependencies to add

```bash
# Part A
npm i @langchain/langgraph @langchain/core
# Part B (checkpoints / HITL)
npm i @langchain/langgraph-checkpoint-sqlite better-sqlite3
```

---

## Refactor: expose LLM primitives (prerequisite for all phases)

`src/lib/ai-service.ts` — make the reusable primitives callable from graph nodes. Minimal
change, keep all existing behavior:
- Make `callAI`, `extractJson`, and `loadEvidenceAsBase64` **public** (or add thin public
  wrappers). `normalizeClaims` is already public.
- Refactor `generateVerdict` to accept an optional `revision?: { priorVerdict, critique }`
  argument so the reflection loop can reuse the exact same multimodal message-building path for
  revisions instead of duplicating it.
- Keep `adjudicateCase` temporarily for reference; the verdict route stops calling it once the
  graph lands, and it can be deleted at the end of Part A.

---

## New module layout

```
src/lib/agent/
  state.ts          # Annotation.Root state shape + TS types
  graph.ts          # builds/compiles the StateGraph; exports runAdjudication(caseId, models)
  checkpointer.ts   # SqliteSaver singleton (Part B)
  prompts.ts        # prompts for triage, CRAG grading, revision, confidence, mediation, evidence
  nodes/
    triage.ts       # feature 4
    retrieve.ts     # feature 5 (CRAG)
    verdict.ts      # reuses aiService.generateVerdict
    biasCheck.ts    # reuses aiService.checkBias
    revise.ts       # feature 1
    confidence.ts   # feature 6
    mediate.ts      # feature 2 (Part B)
    evidence.ts     # feature 3 (Part B)
    finalize.ts     # writes Verdict + Case.status + AuditLog
```

### Graph state (`state.ts`)
`Annotation.Root` holding: `caseId`, `caseData`, `models {judge, coJudge}`, `analysis`,
`disputeType`, `complexity`, `mediationRecommended`, `ragContext`, `ragGrade`, `ragRetries`,
`verdict {content, reasoning, citations}`, `biasCheck {passed, reasoning}`, `revisionCount`,
`critiques[]`, `confidence`, `confidenceFactors`, `settlement`, `evidenceRequest`,
`finalStatus`.

---

## Phase 0 — Scaffold + port the existing pipeline (no behavior change)

Prove the graph runs **identically** to today before adding intelligence.

1. Build `state.ts`, and `graph.ts` with three nodes wired linearly:
   `normalize` (calls `aiService.normalizeClaims`) → `retrieve` (current RAG: read
   `standard-rules.md` + `ragService.retrieveContext`, exactly as `adjudicateCase` does today)
   → `verdict` (`aiService.generateVerdict`) → `biasCheck` (`aiService.checkBias`) →
   `finalize`.
2. `finalize.ts` reproduces the current write logic from
   `src/app/api/cases/[id]/verdict/route.ts:42-82` (create `Verdict`, set status
   `RESOLVED`/`ESCALATED`, audit log).
3. `graph.ts` exports `runAdjudication(caseId, { judgeModel, coJudgeModel })` that loads the
   case (with `documents`), invokes the compiled graph, and returns the final state.
4. Rewire `POST /api/cases/[id]/verdict` to call `runAdjudication` instead of
   `aiService.adjudicateCase`. Keep the existing request/response contract so
   `AIJudgePanel` (`src/components/case/ai-judge-panel.tsx`) is untouched.

**Checkpoint:** generate a verdict on a test case; confirm identical DB writes and UI.

---

## Phase A — Synchronous intelligence graph (features 4, 5, 1, 6)

All run inside one `graph.invoke()`; no human waiting, no checkpoints yet.

### Feature 4 — Triage / routing (`nodes/triage.ts`)
- New first node after `normalize`. One LLM call (judge model) classifying the dispute into
  `disputeType` (e.g. refund, contract-breach, service-quality, defamation, other),
  `complexity` (low/medium/high), and `mediationRecommended` (boolean, used in Part B).
- Writes `disputeType`/`complexity` into state; persisted onto the `Case` row in `finalize`.
- Conditional edge groundwork: complexity can later raise the confidence bar or route to a
  specialized rule set. For now it feeds the prompt context and confidence scoring.

### Feature 5 — Self-correcting RAG / CRAG (`nodes/retrieve.ts`)
Replaces the single-shot retrieval:
1. Call `ragService.retrieveContext(query)` (unchanged embeddings retriever in
   `src/lib/rag-utils.ts`).
2. **Grade** relevance with one cheap LLM call: is the retrieved policy actually on-point for
   this dispute? Output `ragGrade` + a refined query.
3. If grade is low and `ragRetries < 2`, re-query with the refined query and loop; otherwise
   proceed with best-available context (degrade gracefully to `standard-rules.md` only, never
   block — mirrors the existing "RAG failures return ''" contract).

### Feature 1 — Judge ↔ Co-judge reflection loop (`nodes/revise.ts` + conditional edge)
The highest-value change. After `biasCheck`:
- Conditional edge on `biasCheck.passed`:
  - **passed** → `confidence`
  - **failed & `revisionCount < 2`** → `revise` → back to `biasCheck` (increment
    `revisionCount`, append critique)
  - **failed & `revisionCount >= 2`** → `finalize` as `ESCALATED`
- `revise.ts` calls `aiService.generateVerdict` with the `revision` argument (prior verdict +
  co-judge critique) so most fixable bias failures are corrected instead of escalated.
- `finalize` records `revisionCount` in the audit-log details.

### Feature 6 — Real confidence scoring + escalation (`nodes/confidence.ts`)
Replaces hardcoded `0.9`:
- One LLM call (or a deterministic formula) producing `confidence` (0-1) and
  `confidenceFactors` from: evidence completeness, judge/co-judge agreement, RAG relevance
  grade, and triage complexity.
- Conditional edge: `confidence >= threshold` (e.g. 0.6) → `finalize` as `RESOLVED`;
  otherwise → `finalize` as `ESCALATED_TO_HUMAN`.
- Store the real value in the existing `Verdict.aiConfidence` field (already surfaced by
  `verdict/page.tsx:187`).

**Resulting Part A graph:**
`normalize → triage → retrieve(CRAG loop) → verdict → biasCheck →{revise↺ | confidence} → finalize`

---

## Phase B — Durable HITL: mediation + evidence (features 2, 3)

Introduces the checkpoint/interrupt infrastructure. Both features pause the graph across HTTP
requests, so they require durable checkpoints and resume endpoints.

### Infrastructure (`checkpointer.ts`)
- `SqliteSaver` singleton backed by a **separate** file `graph-checkpoints.sqlite` (kept out of
  Prisma so it never collides with the app schema). `thread_id = caseId`.
- Compile the graph with `{ checkpointer }`. `runAdjudication` passes
  `{ configurable: { thread_id: caseId } }`.
- The verdict route must handle an **interrupted** result: when `graph.invoke` returns with a
  pending interrupt, persist the request (Settlement / EvidenceRequest row), set the
  corresponding case status, and return that to the UI instead of a finished verdict.

### Feature 2 — Mediation-first settlement (`nodes/mediate.ts`)
- Runs after `triage`, gated on `mediationRecommended`.
- Proposes 1-2 concrete compromise options (one LLM call), writes a `Settlement` row
  (status `PENDING`), sets case status `IN_MEDIATION`, then **`interrupt()`s**.
- **Both parties must respond.** Use a store-and-check pattern rather than nested interrupts:
  each party's accept/reject is written to the `Settlement` row via a new endpoint; the graph
  is resumed only once **both** responses are present.
  - Both accept → finalize `RESOLVED_BY_SETTLEMENT` (no verdict needed).
  - Either rejects → resume into the normal adjudication path (`retrieve → verdict → …`).
- New endpoint `POST /api/cases/[id]/settlement` records a party response; when both are in it
  calls `graph.invoke(new Command({ resume }), config)`.

### Feature 3 — Human-in-the-loop evidence (`nodes/evidence.ts`)
- Runs before `verdict`. An LLM call assesses whether evidence is sufficient to decide.
- If insufficient: write an `EvidenceRequest` row (target party + question), set status
  `AWAITING_EVIDENCE`, and **`interrupt()`**.
- New endpoint `POST /api/cases/[id]/evidence` uploads the requested file (reuses
  `POST /api/upload` + `Document` create), marks the request fulfilled, and resumes the graph
  with `Command({ resume })`. Graph continues to `verdict`.
- Cap at one evidence round to avoid indefinite stalling; on timeout/no-response the existing
  path proceeds on available evidence.

---

## Schema changes (`prisma/schema.prisma`)

SQLite + `db push` only (no migrations dir). Additions:
- `Case.disputeType String?`, `Case.complexity String?` (from triage).
- New model `Settlement { id, caseId, proposal, terms(JSON), claimantResponse @default("PENDING"), respondentResponse @default("PENDING"), createdAt }`.
- New model `EvidenceRequest { id, caseId, targetParty, question, status @default("PENDING"), createdAt }`.
- Optional: `Verdict.revisionCount Int?`, `Verdict.passedBiasCheck Boolean?`,
  `Verdict.biasCheckReasoning String?` to persist bias-check results directly instead of
  inferring from status (`verdict/page.tsx:99` currently infers). Recommended for correctness.

Run `npx prisma db push && npx prisma generate` after editing.

---

## Status + UI changes

New `Case.status` values: `IN_MEDIATION`, `AWAITING_EVIDENCE`, `RESOLVED_BY_SETTLEMENT`,
`ESCALATED_TO_HUMAN`. Touch points:
- `src/lib/case-status.ts` — add `STATUS_META` entries (colors/dots) for each. This is the
  central map used by dashboard, admin, case, and verdict pages.
- `src/app/(dashboard)/cases/[id]/page.tsx:103-104` — update the hardcoded `canRespond` /
  `hasVerdict` string checks to account for new terminal/interim statuses.
- `src/app/(dashboard)/dashboard/page.tsx:45` — `resolvedCases` count should include
  `RESOLVED_BY_SETTLEMENT`.
- New UI (Part B): a party-facing panel in `cases/[id]/page.tsx` (extend
  `AIJudgePanel` or a sibling component) to accept/reject a settlement when `IN_MEDIATION`, and
  to upload requested evidence when `AWAITING_EVIDENCE`. These call the two new endpoints and
  `router.refresh()`, matching the existing panel pattern.

---

## Verification (no test framework — manual + scripts)

1. `npx prisma db push && npx prisma generate` after schema edits; `npm run build` to catch
   type errors across nodes/routes.
2. **Phase 0:** file a case, submit a response, generate a verdict; confirm the DB writes and
   the verdict/case pages match pre-change behavior exactly.
3. **Feature 1:** craft a case whose first verdict is biased/fallacious; confirm the audit log
   shows a revision iteration and the case resolves instead of escalating. Verify it still
   escalates after 2 failed revisions.
4. **Feature 5:** log `ragGrade`/`ragRetries`; confirm a re-query fires when the first
   retrieval is off-topic, and that a RAG failure degrades to rules-only without blocking.
5. **Feature 6:** confirm `Verdict.aiConfidence` shows a real varying value and a low-confidence
   case routes to `ESCALATED_TO_HUMAN`.
6. **Feature 4:** confirm `Case.disputeType`/`complexity` are populated and shown.
7. **Feature 2:** as claimant then respondent, accept a settlement → status
   `RESOLVED_BY_SETTLEMENT`, no verdict; reject → adjudication resumes to a verdict. Confirm the
   graph resumes only after both responses.
8. **Feature 3:** trigger an evidence request, upload via the new panel, confirm the graph
   resumes and issues a verdict. Verify the checkpoint survives a `npm run dev` restart
   (durable resume).
9. Add a root `test-agent.ts` (run with `npx tsx test-agent.ts`, mirroring the existing
   `test-config.ts`) that drives `runAdjudication` against a seeded case for quick iteration.

---

## Suggested build order

Phase 0 → Feature 1 → Feature 5 → Feature 6 → Feature 4 (all synchronous, shippable
incrementally) → Part B infrastructure → Feature 2 → Feature 3.

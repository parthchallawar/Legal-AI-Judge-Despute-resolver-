# Full RAG Pipeline Implementation Plan
## (Indexing → Retrieval → Augmentation → Generation)

## Context

The app's current "RAG" in `src/lib/rag-utils.ts` is not real retrieval: it parses only the **first 20 of 162 pages** of `guides/Designing-The-Future-of-Dispute-Resolution...pdf`, splits it into 37 giant blobs (blank-line chunking fails on this PDF's extraction), and scores by literal keyword substring counts. Verified live: a realistic dispute query matched only 2/8 terms and returned the generic Executive Summary regardless of the case.

Decisions already made:
- **No LangChain** — plain TypeScript, no new heavy deps.
- **Embeddings: `gemini-embedding-001`** via the existing `GEMINI_API_KEY` (verified working — returned a 3072-dim vector). Anthropic/OpenRouter have no embeddings endpoint.
- **Task types:** `RETRIEVAL_DOCUMENT` for indexing (one-time), `RETRIEVAL_QUERY` per dispute.
- **Vector store: a JSON file on disk**, loaded into memory at runtime (few hundred chunks — no vector DB needed).
- Use **REST `fetch`** for embedding calls (proven working; the installed `@google/generative-ai` v0.24 SDK doesn't expose `outputDimensionality`).

Constraint that keeps this low-risk: `retrieveContext(query: string): Promise<string>` keeps its exact signature, so `ai-service.ts`'s orchestration is untouched, and **RAG failure must never block a verdict** (current design: errors degrade to `""`).

## Architecture

```
ONE-TIME (npx tsx index-guides.ts)
  PDF (all 162 pages) → clean text → chunk (~1200 chars, 200 overlap, page-tagged)
  → embed batches (RETRIEVAL_DOCUMENT, 768 dims, L2-normalized)
  → src/lib/guidelines/vector-store.json

PER DISPUTE (unchanged call site: aiService.adjudicateCase)
  claimant+respondent text → truncate → embed (RETRIEVAL_QUERY, 768 dims, normalized)
  → dot-product vs all chunks → top 5 ≥ threshold → labeled context string
  → [augmentation] concatenated with standard-rules.md into judge prompt
  → [generation] existing judge verdict + co-judge bias check (unchanged)
```

## Files

### 1. NEW `src/lib/embeddings.ts` — shared embedding helper
Used by both the indexing script and runtime retrieval so doc/query embeddings can never drift apart.

- Exported constants: `EMBEDDING_MODEL = "gemini-embedding-001"`, `EMBEDDING_DIMS = 768`.
- `resolveGeminiKey(): Promise<string>` — mirror `ai-service.ts` logic: read `SystemSettings` row `ai_config`; if its `apiKey` starts with `AIza` use it, else `process.env.GEMINI_API_KEY`. Wrap the Prisma read in try/catch (return env key on failure) so the helper works even if the DB is unavailable.
- `embedTexts(texts: string[], taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[][]>`
  - POST `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=...` with per-request `{ model, content: {parts:[{text}]}, taskType, outputDimensionality: 768 }`.
  - **L2-normalize every returned vector** — Gemini only pre-normalizes the full 3072-dim output; truncated dims come back unnormalized. Skipping this silently breaks cosine ranking.
  - Retry on 429/5xx: 3 attempts, exponential backoff (2s/8s/20s).
- `dot(a, b): number` — similarity (equals cosine since vectors are normalized).

### 2. NEW `index-guides.ts` (project root, consistent with `clear-db.ts`)
One-time indexing script, run with `npx tsx index-guides.ts` (re-run only if the PDF changes).

- **Load `.env` manually** (10-line parser reading `GEMINI_API_KEY`) — tsx does not auto-load `.env`; don't rely on Prisma's side-effect loading.
- Parse the **full PDF**: `new PDFParse({data}); parser.getText()` — no `{first: 20}`.
- Split text on the page markers pdf-parse emits (`-- N of 162 --`, regex `/--\s*(\d+)\s*of\s*\d+\s*--/`) to recover **per-page text**, then strip the markers.
- Clean each page: collapse 3+ newlines, trim; skip pages with < 100 chars (title/blank pages).
- **Chunking:** accumulate paragraphs (fall back to sentence splits for oversized paragraphs) into ~1200-char chunks with ~200-char overlap; each chunk records `{ id, page, text }`. Expected ~250–400 chunks.
- Embed in **batches of 50** with `RETRIEVAL_DOCUMENT`, ~1s delay between batches (free-tier RPM headroom).
- Round embedding floats to 6 decimals (halves file size, no quality impact).
- Write `src/lib/guidelines/vector-store.json`:
  ```json
  { "model": "gemini-embedding-001", "dims": 768, "normalized": true,
    "source": "Designing-The-Future-of-Dispute-Resolution...pdf",
    "createdAt": "...", "chunks": [{ "id": 0, "page": 12, "text": "...", "embedding": [...] }] }
  ```
  (~3–4 MB; committed to the repo so the app works without re-indexing.)
- Log progress and a final summary (pages parsed, chunks created).

### 3. REWRITE `src/lib/rag-utils.ts` — semantic retrieval
Keep the singleton pattern and the exact public API (`ragService.retrieveContext(query)`), so **`ai-service.ts` needs no changes to keep working**.

- Replace `loadPDF()` with `loadStore()`: `fs.readFile(path.join(process.cwd(), "src/lib/guidelines/vector-store.json"))` — a runtime `fs` read, **not** an `import` (avoids Next.js inlining 4 MB into the bundle and lets re-indexing take effect without rebuild). Cache the **promise** (not just the result) so concurrent first requests don't double-load. Validate `model === EMBEDDING_MODEL && dims === EMBEDDING_DIMS`; on mismatch log "re-run npx tsx index-guides.ts" and treat as missing.
- `retrieveContext(query)`:
  1. Guard: empty/`< 20` char query → return `""`.
  2. Truncate query to 6,000 chars (embedding input limit ~2048 tokens; dispute descriptions can be long).
  3. Embed with `RETRIEVAL_QUERY` via `embedTexts` from `src/lib/embeddings.ts`.
  4. Score every chunk with `dot()`; take top 5 with similarity ≥ **0.5**; if none pass, take top 3 regardless (better weak context than none — matches the old fallback spirit).
  5. Format:
     ```
     [Excerpt — ODR Policy Plan for India, p. 42 (relevance 0.71)]
     <chunk text>
     ```
     joined by blank lines.
  6. **Every failure path returns `""` with a `console.error`** — missing store file, key missing, 429 after retries, JSON parse error. The verdict flow must proceed on `standard-rules.md` alone, exactly as today.

### 4. SMALL EDIT `src/lib/ai-service.ts` — augmentation polish (only change here)
In `adjudicateCase` step 2, when `ragContext` is empty, omit the "Additional Policy Guidelines (RAG Retrieved):" section entirely instead of injecting an empty header; when non-empty, add one instruction line: *"When relevant, cite the retrieved policy excerpts by their page number."* Everything else (normalize → verdict → bias check generation flow) is untouched.

### 5. `package.json`
- Add devDependency `"tsx": "^4"` and script `"index:guides": "tsx index-guides.ts"`.

## Bug-avoidance checklist (baked into the steps above)
1. **Normalize truncated embeddings** (768-dim output is NOT pre-normalized) — in `embedTexts`, applied identically to docs and queries.
2. **Model/dims lockstep** — constants live in one file; store header validated at load; mismatch forces re-index instead of silently comparing incompatible vectors.
3. **Task-type pairing** — `RETRIEVAL_DOCUMENT` vs `RETRIEVAL_QUERY` from the same helper.
4. **`.env` loading in the script** — explicit parse, no reliance on Prisma side effects.
5. **Query truncation** before embedding; empty-query guard.
6. **429 handling** — batching + backoff in both indexing and runtime.
7. **Non-fatal by construction** — every RAG error degrades to `""`; verdict generation never 500s because of retrieval.
8. **No `import` of the JSON store** — runtime `fs` read with `path.join(process.cwd(), ...)` (Windows-safe, works in Next.js Node runtime, which these routes already use).
9. **Page-marker cleanup** before chunking so chunks aren't polluted with `-- 57 of 162 --` noise, while still capturing page numbers for citations.

## Verification
1. **Index:** `npx tsx index-guides.ts` → confirm `src/lib/guidelines/vector-store.json` exists, header shows `dims: 768`, chunk count ~250–400, spot-check one chunk's text and that `Math.hypot(...embedding) ≈ 1`.
2. **Retrieval smoke test:** temp script calling `ragService.retrieveContext("consumer paid for goods online, seller failed to deliver, refund refused")` → prints top-5 similarities and page-labeled excerpts; verify scores > 0.5 and content is actually about ODR/consumer disputes (vs. the old Executive Summary constant).
3. **End-to-end:** `npm run dev`, open an existing case with a response, trigger verdict generation (`POST /api/cases/[id]/verdict` via the UI) → verdict returned, server log shows retrieved chunk count; case status updates as before.
4. **Failure mode:** temporarily rename `vector-store.json`, trigger a verdict → still succeeds (context falls back to standard-rules.md only), console shows the warning. Restore the file.

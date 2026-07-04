# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AI-powered Online Dispute Resolution (ODR) platform: parties file disputes, respondents reply, and an LLM "judge" issues a verdict that is audited by a second LLM "co-judge" bias check. Next.js 14 App Router, TypeScript, Prisma + SQLite, NextAuth, Tailwind v4 + shadcn/ui.

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npx prisma db push   # Sync schema to dev.db (no migrations directory — db push only)
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma studio    # Browse the SQLite database
```

There is no test framework configured. Root-level utility scripts are run directly (e.g. `npx tsx clear-db.ts`):
- `clear-db.ts` — deletes all cases, documents, verdicts, audit logs
- `cleanup-cases.ts` — case-data cleanup
- `test-config.ts` — prints the `ai_config` row from SystemSettings

Required env vars (`.env`): `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`.

## Architecture

### Route groups (`src/app`)
- `(marketing)` — public landing/about/contact/terms
- `(auth)` — login and register
- `(dashboard)` — authenticated app: `/dashboard`, `/cases/new`, `/cases/[id]`, `/cases/[id]/verdict`, `/admin`
- `src/app/admin/settings` — admin AI configuration UI (outside the route groups), backed by `/api/admin/settings`

Middleware (`src/middleware.ts`) requires a session token for `/dashboard`, `/cases`, and `/admin`.

### Auth and roles
NextAuth credentials provider (`src/lib/auth.ts`) with bcryptjs and JWT sessions. `id` and `role` are copied onto the token/session via callbacks (types extended in `src/types/next-auth.d.ts`). Roles are plain strings on `User.role`: `PARTY`, `ARBITRATOR`, `ADMIN`. Admin-only API routes check `session.user.role === "ADMIN"` inline.

### Dispute lifecycle
`Case.status` is a plain string (SQLite — no enums). The actual values written by API routes are: `FILED` (case created) → `AWAITING_VERDICT` (respondent submitted) → `RESOLVED` (verdict passed bias check) or `ESCALATED` (failed bias check / AI unavailable), plus `AI_REVIEW` (admin resets a verdict via DELETE). The comment in `prisma/schema.prisma` lists a slightly different set — the route code is the source of truth.

Filing a case (`POST /api/cases`) auto-creates the respondent User with `passwordHash: "placeholder_hash"` if their email isn't registered yet.

### AI adjudication pipeline (`src/lib/ai-service.ts`)
`aiService.adjudicateCase(caseData, judgeModel, coJudgeModel)` — triggered by `POST /api/cases/[id]/verdict` — runs four stages:
1. **Normalize claims** — LLM converts both parties' raw descriptions into structured argument lists (stored as JSON in `Case.analysis`)
2. **Build context** — static rules from `src/lib/guidelines/standard-rules.md` + RAG retrieval
3. **Generate verdict** (judge model) — returns JSON `{content, reasoning, citations}`; uploaded image evidence is base64-embedded into the message
4. **Bias check** (co-judge model) — a failed check sets the case to `ESCALATED` instead of `RESOLVED`

Provider routing in `callAI`: if the configured API key starts with `AIza` it calls Google Gemini directly (`@google/generative-ai`); otherwise it calls the OpenRouter chat-completions API. The key is loaded per-call from the `SystemSettings` row with key `ai_config` (set via the admin settings page), falling back to `OPENROUTER_API_KEY`. Default model is `openai/gpt-5-nano`.

AI failures do not throw to the caller: verdict generation returns a fallback "Manual Arbitration Required" result that escalates the case, and a failed bias-check call passes by default.

### RAG (`src/lib/rag-utils.ts`)
Singleton keyword-scoring retriever (no embeddings) over the policy PDF in `guides/`, parsed with `pdf-parse` (first 20 pages) and cached in memory for the process lifetime.

### Files and data
- Uploads go to `public/uploads/` via `POST /api/upload` and are referenced by URL in the `Document` table
- Every state change writes an `AuditLog` row via nested Prisma creates
- shadcn/ui components live in `src/components/ui` (configured by `components.json`, path alias `@/*` → `src/*`)

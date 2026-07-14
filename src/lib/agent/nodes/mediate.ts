import { interrupt } from "@langchain/langgraph"
import { aiService } from "@/lib/ai-service"
import { prisma } from "@/lib/prisma"
import { AdjudicationStateType } from "../state"
import { mediationPrompt } from "../prompts"

function safeParseTerms(raw: string): string[] {
    try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

// Feature 2 (part 1): propose a settlement. Idempotent: if a fresh graph run (e.g. a restart,
// or an admin/arbitrator action) lands here after mediation already happened for this case, we
// must NOT propose again — that is what caused the reported bug (accept + reject got the case
// stuck, because every retry re-proposed a brand new settlement and looped back into
// IN_MEDIATION forever). Instead we read the outcome from the DB and route accordingly.
export async function mediateProposeNode(state: AdjudicationStateType) {
    const existing = await prisma.settlement.findFirst({
        where: { caseId: state.caseId },
        orderBy: { createdAt: "desc" },
    })

    if (existing) {
        const claimantDone = existing.claimantResponse !== "PENDING"
        const respondentDone = existing.respondentResponse !== "PENDING"

        if (claimantDone && respondentDone) {
            const bothAccepted = existing.claimantResponse === "ACCEPTED" && existing.respondentResponse === "ACCEPTED"
            if (bothAccepted) {
                // Both accepted (possibly on a prior run that crashed before finalizing) —
                // route straight to finalize as a settlement, skip adjudication entirely.
                return {
                    settlement: {
                        proposal: existing.proposal,
                        terms: safeParseTerms(existing.terms),
                        claimantAccepted: true,
                        respondentAccepted: true,
                    },
                }
            }
            // Mediation concluded without full acceptance (a rejection, or an expired
            // non-response) — do not propose again, fall through to real adjudication.
            return {}
        }

        // At least one party hasn't answered yet — reuse the existing proposal instead of
        // creating a duplicate, and pause again waiting for the remaining response(s).
        return {
            settlement: { proposal: existing.proposal, terms: safeParseTerms(existing.terms) },
        }
    }

    if (!state.mediationRecommended) return {}

    try {
        const { system, user } = mediationPrompt(state.caseData, state.analysis)
        const text = await aiService.callAI(
            state.models.judge,
            [
                { role: "system", content: system },
                { role: "user", content: user },
            ],
            0.4
        )
        const parsed = aiService.extractJson(text)
        const proposal: string = parsed.proposal || ""
        const terms: string[] = Array.isArray(parsed.terms) ? parsed.terms : []
        if (!proposal) return {}

        await prisma.settlement.create({
            data: { caseId: state.caseId, proposal, terms: JSON.stringify(terms) },
        })
        await prisma.case.update({
            where: { id: state.caseId },
            data: {
                status: "IN_MEDIATION",
                auditLogs: {
                    create: {
                        action: "SETTLEMENT_PROPOSED",
                        details: `AI mediator proposed a settlement: ${proposal}`,
                    },
                },
            },
        })

        return { settlement: { proposal, terms } }
    } catch (error) {
        console.error("[mediate] proposal failed, skipping mediation:", error)
        return {}
    }
}

// Feature 2 (part 2): pause until BOTH parties respond. The settlement endpoint records each
// party's decision in the Settlement row and only resumes the graph once both are in, passing
// { claimantAccepted, respondentAccepted }. On resume this node re-runs from the top and
// interrupt() returns that payload (it does no DB work, so re-running is safe).
export async function mediateCollectNode(state: AdjudicationStateType) {
    const responses = interrupt({
        type: "SETTLEMENT",
        proposal: state.settlement?.proposal,
        terms: state.settlement?.terms,
    }) as { claimantAccepted?: unknown; respondentAccepted?: unknown } | undefined

    return {
        settlement: {
            proposal: state.settlement?.proposal || "",
            terms: state.settlement?.terms || [],
            claimantAccepted: responses?.claimantAccepted === true,
            respondentAccepted: responses?.respondentAccepted === true,
        },
    }
}

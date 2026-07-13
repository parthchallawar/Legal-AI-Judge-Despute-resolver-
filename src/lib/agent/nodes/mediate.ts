import { interrupt } from "@langchain/langgraph"
import { aiService } from "@/lib/ai-service"
import { prisma } from "@/lib/prisma"
import { AdjudicationStateType } from "../state"
import { mediationPrompt } from "../prompts"

// Feature 2 (part 1): propose a settlement. Runs exactly once (it sits before the interrupt
// checkpoint, so it is never re-executed on resume). If triage did not recommend mediation, or
// proposal generation fails, this is a no-op and the graph falls through to adjudication.
export async function mediateProposeNode(state: AdjudicationStateType) {
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
    }) as { claimantAccepted: boolean; respondentAccepted: boolean }

    return {
        settlement: {
            proposal: state.settlement?.proposal || "",
            terms: state.settlement?.terms || [],
            claimantAccepted: responses.claimantAccepted,
            respondentAccepted: responses.respondentAccepted,
        },
    }
}

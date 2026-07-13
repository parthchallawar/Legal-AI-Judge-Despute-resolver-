import { aiService } from "@/lib/ai-service"
import { prisma } from "@/lib/prisma"
import { AdjudicationStateType, TriageResult } from "../state"
import { triagePrompt } from "../prompts"

// Feature 4: classify the dispute so it can be routed and scored appropriately.
export async function triageNode(state: AdjudicationStateType) {
    const { system, user } = triagePrompt(state.caseData, state.analysis)
    let disputeType = "other"
    let complexity = "medium"
    let mediationRecommended = false
    try {
        const text = await aiService.callAI(
            state.models.judge,
            [
                { role: "system", content: system },
                { role: "user", content: user },
            ],
            0.2
        )
        const parsed = aiService.extractJson(text) as TriageResult
        disputeType = parsed.disputeType || "other"
        complexity = parsed.complexity || "medium"
        mediationRecommended = !!parsed.mediationRecommended
    } catch (error) {
        console.error("[triage] failed, using defaults:", error)
    }

    // Persist the classification immediately so it is visible even while the case is paused in
    // mediation or awaiting evidence (finalize may be many steps away).
    try {
        await prisma.case.update({
            where: { id: state.caseId },
            data: { disputeType, complexity },
        })
    } catch (error) {
        console.error("[triage] failed to persist classification:", error)
    }

    return { disputeType, complexity, mediationRecommended }
}

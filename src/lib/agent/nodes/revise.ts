import { aiService } from "@/lib/ai-service"
import { AdjudicationStateType } from "../state"

// Feature 1: reflection. When the co-judge fails the bias check, regenerate the verdict with the
// critique attached so most fixable flaws are corrected instead of escalated to a human.
export async function reviseNode(state: AdjudicationStateType) {
    const critique = state.biasCheck?.reasoning || "Unspecified bias or fallacy concern."
    const revised = await aiService.generateVerdict(
        state.context,
        { ...state.caseData, analysis: state.analysis },
        state.models.judge,
        {
            priorContent: state.verdict?.content || "",
            priorReasoning: state.verdict?.reasoning || "",
            critique,
        }
    )
    return {
        verdict: revised,
        revisionCount: state.revisionCount + 1,
        critiques: [critique],
    }
}

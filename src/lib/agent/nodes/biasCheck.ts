import { aiService } from "@/lib/ai-service"
import { AdjudicationStateType } from "../state"

// Stage 4: co-judge audits the verdict for bias / logical fallacies.
export async function biasCheckNode(state: AdjudicationStateType) {
    if (!state.verdict || state.verdict.error) {
        return { biasCheck: { passed: false, reasoning: "Bias check skipped: verdict generation failed." } }
    }
    const biasCheck = await aiService.checkBias(
        state.verdict.content,
        state.verdict.reasoning,
        state.models.coJudge
    )
    return { biasCheck }
}

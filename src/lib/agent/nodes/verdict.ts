import { aiService } from "@/lib/ai-service"
import { AdjudicationStateType } from "../state"

// Stage 3: generate the verdict from the assembled context, analysis, and evidence images.
export async function verdictNode(state: AdjudicationStateType) {
    const verdict = await aiService.generateVerdict(
        state.context,
        { ...state.caseData, analysis: state.analysis },
        state.models.judge
    )
    return { verdict }
}

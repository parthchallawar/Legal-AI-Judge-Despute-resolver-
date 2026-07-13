import { aiService } from "@/lib/ai-service"
import { AdjudicationStateType } from "../state"

// Stage 1: convert both parties' raw descriptions into structured argument lists.
export async function normalizeNode(state: AdjudicationStateType) {
    const analysis = await aiService.normalizeClaims(state.caseData, state.models.judge)
    return { analysis }
}

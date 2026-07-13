import { aiService } from "@/lib/ai-service"
import { AdjudicationStateType } from "../state"
import { confidencePrompt } from "../prompts"

// Feature 6: derive a real confidence score from evidence completeness, judge/co-judge
// agreement, retrieval strength, and dispute complexity. Low confidence routes to a human.
export async function confidenceNode(state: AdjudicationStateType) {
    try {
        const { system, user } = confidencePrompt({
            verdict: state.verdict,
            biasCheck: state.biasCheck,
            ragGrade: state.ragGrade,
            complexity: state.complexity,
            caseData: state.caseData,
        })
        const text = await aiService.callAI(
            state.models.coJudge,
            [
                { role: "system", content: system },
                { role: "user", content: user },
            ],
            0.2
        )
        const parsed = aiService.extractJson(text)
        const confidence =
            typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5
        return { confidence, confidenceFactors: parsed.factors || "" }
    } catch (error) {
        console.error("[confidence] assessment failed, defaulting to 0.5:", error)
        return { confidence: 0.5, confidenceFactors: "Confidence assessment unavailable." }
    }
}

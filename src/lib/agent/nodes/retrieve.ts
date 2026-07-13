import fs from "fs/promises"
import path from "path"
import { aiService } from "@/lib/ai-service"
import { ragService } from "@/lib/rag-utils"
import { AdjudicationStateType } from "../state"
import { ragGradePrompt } from "../prompts"

// Feature 5: self-correcting retrieval (CRAG). Retrieve, grade relevance, and re-query with a
// refined query up to MAX_RAG_RETRIES times. Always degrades gracefully to the static rules —
// a RAG failure must never block a verdict.
const MAX_RAG_RETRIES = 2
const GRADE_THRESHOLD = 0.6

export async function retrieveNode(state: AdjudicationStateType) {
    let guidelines = ""
    try {
        const guidelinesPath = path.join(process.cwd(), "src/lib/guidelines/standard-rules.md")
        guidelines = await fs.readFile(guidelinesPath, "utf-8")
    } catch (error) {
        console.error("[retrieve] guidelines read failed:", error)
    }

    let query = `${state.caseData.description} ${state.caseData.respondentDescription || ""}`
    let bestContext = ""
    let bestGrade = 0
    let retries = 0

    for (let attempt = 0; attempt <= MAX_RAG_RETRIES; attempt++) {
        let retrieved = ""
        try {
            retrieved = await ragService.retrieveContext(query)
        } catch (error) {
            console.error("[retrieve] RAG retrieval failed, degrading:", error)
        }

        let grade = retrieved ? 0.5 : 0
        let refinedQuery = query
        try {
            const { system, user } = ragGradePrompt(query, retrieved)
            const text = await aiService.callAI(
                state.models.judge,
                [
                    { role: "system", content: system },
                    { role: "user", content: user },
                ],
                0.2
            )
            const parsed = aiService.extractJson(text)
            if (typeof parsed.grade === "number") grade = parsed.grade
            if (parsed.refinedQuery) refinedQuery = parsed.refinedQuery
        } catch (error) {
            console.error("[retrieve] relevance grading failed:", error)
        }

        if (grade > bestGrade) {
            bestGrade = grade
            bestContext = retrieved
        }

        retries = attempt
        if (grade >= GRADE_THRESHOLD || attempt === MAX_RAG_RETRIES) break
        query = refinedQuery
    }

    const context = `
        Standard Arbitration Rules:
        ${guidelines}
        ${bestContext ? `\n        Additional Policy Guidelines (RAG Retrieved):\n        ${bestContext}\n\n        When relevant, cite the retrieved policy excerpts by their page number.` : ""}
    `

    console.log(`[retrieve] final RAG grade=${bestGrade.toFixed(2)} after ${retries} re-query(ies)`)
    return { context, ragGrade: bestGrade, ragRetries: retries }
}

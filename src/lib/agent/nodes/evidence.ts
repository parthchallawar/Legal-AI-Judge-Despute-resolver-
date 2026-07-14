import { interrupt } from "@langchain/langgraph"
import { aiService } from "@/lib/ai-service"
import { prisma } from "@/lib/prisma"
import { AdjudicationStateType } from "../state"
import { evidenceSufficiencyPrompt } from "../prompts"

// Feature 3 (part 1): decide whether one more piece of evidence would materially change the
// outcome. Idempotent: at most one evidence round per case. If a fresh run lands here after a
// request was already made (fulfilled, cancelled, or still pending), we must NOT ask again —
// re-asking on every retry is exactly what would re-trigger the AWAITING_EVIDENCE loop.
export async function evidenceCheckNode(state: AdjudicationStateType) {
    // If the parties already settled, skip evidence entirely.
    if (state.settlement?.claimantAccepted && state.settlement?.respondentAccepted) return {}

    const existing = await prisma.evidenceRequest.findFirst({
        where: { caseId: state.caseId },
        orderBy: { createdAt: "desc" },
    })
    if (existing) {
        if (existing.status === "PENDING") {
            // Not yet answered — reuse the existing request and pause again instead of asking
            // a second, different question.
            return { evidenceRequest: { targetParty: existing.targetParty as "CLAIMANT" | "RESPONDENT", question: existing.question } }
        }
        // FULFILLED or CANCELLED — the one allotted round already happened, move on.
        return {}
    }

    try {
        const evidenceText = await aiService.loadEvidenceText(state.caseData.documents)
        const { system, user } = evidenceSufficiencyPrompt(state.caseData, state.analysis, evidenceText)
        const text = await aiService.callAI(
            state.models.judge,
            [
                { role: "system", content: system },
                { role: "user", content: user },
            ],
            0.2
        )
        const parsed = aiService.extractJson(text)
        if (parsed.sufficient || !parsed.question) return {}

        const targetParty = parsed.targetParty === "RESPONDENT" ? "RESPONDENT" : "CLAIMANT"
        await prisma.evidenceRequest.create({
            data: { caseId: state.caseId, targetParty, question: parsed.question },
        })
        await prisma.case.update({
            where: { id: state.caseId },
            data: {
                status: "AWAITING_EVIDENCE",
                auditLogs: {
                    create: {
                        action: "EVIDENCE_REQUESTED",
                        details: `AI requested evidence from ${targetParty}: ${parsed.question}`,
                    },
                },
            },
        })

        return { evidenceRequest: { targetParty, question: parsed.question } }
    } catch (error) {
        console.error("[evidence] sufficiency check failed, proceeding on available evidence:", error)
        return {}
    }
}

// Feature 3 (part 2): pause until the requested evidence is uploaded. The evidence endpoint
// creates the Document row and resumes the graph. On resume we re-fetch the case so the fresh
// evidence is included in the verdict.
export async function evidenceCollectNode(state: AdjudicationStateType) {
    interrupt({
        type: "EVIDENCE",
        targetParty: state.evidenceRequest?.targetParty,
        question: state.evidenceRequest?.question,
    })

    const fresh = await prisma.case.findUnique({
        where: { id: state.caseId },
        include: { documents: true },
    })

    return {
        caseData: fresh,
        evidenceRequest: state.evidenceRequest
            ? { ...state.evidenceRequest, fulfilled: true }
            : null,
    }
}

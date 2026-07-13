import { prisma } from "@/lib/prisma"
import { AdjudicationStateType, FinalStatus } from "../state"

// Confidence below this bar sends a verdict to a human arbitrator instead of auto-resolving.
export const CONFIDENCE_THRESHOLD = 0.6

function computeStatus(state: AdjudicationStateType): FinalStatus {
    if (state.settlement?.claimantAccepted && state.settlement?.respondentAccepted) {
        return "RESOLVED_BY_SETTLEMENT"
    }
    if (!state.verdict || state.verdict.error) return "ESCALATED"
    if (!state.biasCheck?.passed) return "ESCALATED"
    if (state.confidence < CONFIDENCE_THRESHOLD) return "ESCALATED_TO_HUMAN"
    return "RESOLVED"
}

const STATUS_ACTION: Record<FinalStatus, string> = {
    RESOLVED: "AI_VERDICT_GENERATED",
    ESCALATED: "CASE_ESCALATED",
    ESCALATED_TO_HUMAN: "CASE_ESCALATED",
    RESOLVED_BY_SETTLEMENT: "SETTLEMENT_ACCEPTED",
}

function buildAuditDetails(state: AdjudicationStateType, status: FinalStatus): string {
    if (status === "RESOLVED_BY_SETTLEMENT") {
        return "Both parties accepted the AI-mediated settlement. Case resolved by agreement."
    }
    const parts: string[] = []
    parts.push(`AI generated a verdict (dispute type: ${state.disputeType || "unknown"}, complexity: ${state.complexity || "unknown"}).`)
    if (state.revisionCount > 0) {
        parts.push(`Verdict was revised ${state.revisionCount} time(s) after co-judge feedback.`)
    }
    parts.push(`Confidence: ${(state.confidence * 100).toFixed(0)}%. ${state.confidenceFactors}`)
    if (status === "ESCALATED") {
        parts.push(`Escalated: ${state.biasCheck?.reasoning || state.verdict?.reasoning || "bias check failed"}.`)
    } else if (status === "ESCALATED_TO_HUMAN") {
        parts.push("Escalated to a human arbitrator due to low confidence.")
    } else {
        parts.push("Bias check passed. Verdict issued.")
    }
    return parts.join(" ")
}

// Persistence stage: write the Verdict, update Case status/metadata, and record an audit log.
export async function finalizeNode(state: AdjudicationStateType) {
    const status = computeStatus(state)
    const settled = status === "RESOLVED_BY_SETTLEMENT"

    const content = settled
        ? "Resolved by mutual settlement"
        : state.verdict?.content || "Verdict Pending: Manual Arbitration Required"
    const reasoning = settled
        ? `${state.settlement?.proposal || ""}\n\nAgreed terms:\n- ${(state.settlement?.terms || []).join("\n- ")}`
        : state.verdict?.reasoning || ""
    const citations = settled ? [] : state.verdict?.citations || []

    await prisma.verdict.create({
        data: {
            caseId: state.caseId,
            content,
            reasoning,
            citations: JSON.stringify(citations),
            aiConfidence: settled ? 1 : state.confidence,
            passedBiasCheck: settled ? true : !!state.biasCheck?.passed,
            biasCheckReasoning: settled ? null : state.biasCheck?.reasoning || null,
            revisionCount: state.revisionCount,
            isHuman: false,
        },
    })

    await prisma.case.update({
        where: { id: state.caseId },
        data: {
            status,
            analysis: JSON.stringify(state.analysis),
            disputeType: state.disputeType || undefined,
            complexity: state.complexity || undefined,
            auditLogs: {
                create: {
                    action: STATUS_ACTION[status],
                    details: buildAuditDetails(state, status),
                },
            },
        },
    })

    return { finalStatus: status }
}

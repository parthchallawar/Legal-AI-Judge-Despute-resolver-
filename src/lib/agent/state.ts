import { Annotation } from "@langchain/langgraph"

// Shared types used across nodes and the API layer.

export interface AdjudicationModels {
    judge: string
    coJudge: string
}

export interface NormalizedAnalysis {
    claimantArguments: any[]
    respondentArguments: any[]
}

export interface VerdictDraft {
    content: string
    reasoning: string
    citations: string[]
    error?: boolean
}

export interface BiasResult {
    passed: boolean
    reasoning: string
}

export interface TriageResult {
    disputeType: string
    complexity: "low" | "medium" | "high"
    mediationRecommended: boolean
    summary: string
}

export interface SettlementState {
    proposal: string
    terms: string[]
    // Filled in when the graph resumes after both parties respond.
    claimantAccepted?: boolean
    respondentAccepted?: boolean
}

export interface EvidenceRequestState {
    targetParty: "CLAIMANT" | "RESPONDENT"
    question: string
    // Filled in when the graph resumes after the party submits.
    fulfilled?: boolean
}

// Terminal statuses the graph can drive a case into.
export type FinalStatus =
    | "RESOLVED"
    | "ESCALATED"
    | "ESCALATED_TO_HUMAN"
    | "RESOLVED_BY_SETTLEMENT"

/**
 * The LangGraph state. Every node receives the current snapshot and returns a
 * partial update. Reducers below default to "last write wins" for scalars.
 */
export const AdjudicationState = Annotation.Root({
    caseId: Annotation<string>(),
    // Raw case row (title, description, respondentDescription, documents, party ids).
    caseData: Annotation<any>(),
    models: Annotation<AdjudicationModels>(),

    analysis: Annotation<NormalizedAnalysis | null>({
        reducer: (_prev, next) => next,
        default: () => null,
    }),

    // Triage (feature 4)
    disputeType: Annotation<string | null>({ reducer: (_p, n) => n, default: () => null }),
    complexity: Annotation<string | null>({ reducer: (_p, n) => n, default: () => null }),
    mediationRecommended: Annotation<boolean>({ reducer: (_p, n) => n, default: () => false }),

    // Retrieval / CRAG (feature 5)
    context: Annotation<string>({ reducer: (_p, n) => n, default: () => "" }),
    ragGrade: Annotation<number>({ reducer: (_p, n) => n, default: () => 0 }),
    ragRetries: Annotation<number>({ reducer: (_p, n) => n, default: () => 0 }),

    // Verdict + reflection loop (feature 1)
    verdict: Annotation<VerdictDraft | null>({ reducer: (_p, n) => n, default: () => null }),
    biasCheck: Annotation<BiasResult | null>({ reducer: (_p, n) => n, default: () => null }),
    revisionCount: Annotation<number>({ reducer: (_p, n) => n, default: () => 0 }),
    critiques: Annotation<string[]>({
        reducer: (prev, next) => prev.concat(next),
        default: () => [],
    }),

    // Confidence (feature 6)
    confidence: Annotation<number>({ reducer: (_p, n) => n, default: () => 0 }),
    confidenceFactors: Annotation<string>({ reducer: (_p, n) => n, default: () => "" }),

    // HITL (features 2 & 3)
    settlement: Annotation<SettlementState | null>({ reducer: (_p, n) => n, default: () => null }),
    evidenceRequest: Annotation<EvidenceRequestState | null>({ reducer: (_p, n) => n, default: () => null }),

    finalStatus: Annotation<FinalStatus | null>({ reducer: (_p, n) => n, default: () => null }),
})

export type AdjudicationStateType = typeof AdjudicationState.State

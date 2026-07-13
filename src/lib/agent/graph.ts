import { StateGraph, START, END, Command } from "@langchain/langgraph"
import { prisma } from "@/lib/prisma"
import { AdjudicationState, AdjudicationStateType, AdjudicationModels } from "./state"
import { getCheckpointer, clearThread } from "./checkpointer"
import { normalizeNode } from "./nodes/normalize"
import { triageNode } from "./nodes/triage"
import { mediateProposeNode, mediateCollectNode } from "./nodes/mediate"
import { evidenceCheckNode, evidenceCollectNode } from "./nodes/evidence"
import { retrieveNode } from "./nodes/retrieve"
import { verdictNode } from "./nodes/verdict"
import { biasCheckNode } from "./nodes/biasCheck"
import { reviseNode } from "./nodes/revise"
import { confidenceNode } from "./nodes/confidence"
import { finalizeNode } from "./nodes/finalize"

const DEFAULT_MODEL = "openai/gpt-5-nano"
const MAX_REVISIONS = 2

// --- Routing functions -----------------------------------------------------

function afterPropose(state: AdjudicationStateType): "mediateCollect" | "evidenceCheck" {
    return state.settlement ? "mediateCollect" : "evidenceCheck"
}

function afterCollect(state: AdjudicationStateType): "finalize" | "evidenceCheck" {
    if (state.settlement?.claimantAccepted && state.settlement?.respondentAccepted) {
        return "finalize"
    }
    return "evidenceCheck"
}

function afterEvidenceCheck(state: AdjudicationStateType): "evidenceCollect" | "retrieve" {
    return state.evidenceRequest && !state.evidenceRequest.fulfilled ? "evidenceCollect" : "retrieve"
}

function afterVerdict(state: AdjudicationStateType): "biasCheckNode" | "finalize" {
    return state.verdict?.error ? "finalize" : "biasCheckNode"
}

function afterBiasCheck(state: AdjudicationStateType): "revise" | "confidenceNode" | "finalize" {
    if (state.verdict?.error) return "finalize"
    if (state.biasCheck?.passed) return "confidenceNode"
    if (state.revisionCount < MAX_REVISIONS) return "revise"
    return "finalize"
}

// --- Graph -----------------------------------------------------------------

const workflow = new StateGraph(AdjudicationState)
    .addNode("normalize", normalizeNode)
    .addNode("triage", triageNode)
    .addNode("mediatePropose", mediateProposeNode)
    .addNode("mediateCollect", mediateCollectNode)
    .addNode("evidenceCheck", evidenceCheckNode)
    .addNode("evidenceCollect", evidenceCollectNode)
    .addNode("retrieve", retrieveNode)
    .addNode("verdictNode", verdictNode)
    .addNode("biasCheckNode", biasCheckNode)
    .addNode("revise", reviseNode)
    .addNode("confidenceNode", confidenceNode)
    .addNode("finalize", finalizeNode)
    .addEdge(START, "normalize")
    .addEdge("normalize", "triage")
    .addEdge("triage", "mediatePropose")
    .addConditionalEdges("mediatePropose", afterPropose, ["mediateCollect", "evidenceCheck"])
    .addConditionalEdges("mediateCollect", afterCollect, ["finalize", "evidenceCheck"])
    .addConditionalEdges("evidenceCheck", afterEvidenceCheck, ["evidenceCollect", "retrieve"])
    .addEdge("evidenceCollect", "retrieve")
    .addEdge("retrieve", "verdictNode")
    .addConditionalEdges("verdictNode", afterVerdict, ["biasCheckNode", "finalize"])
    .addConditionalEdges("biasCheckNode", afterBiasCheck, ["revise", "confidenceNode", "finalize"])
    .addEdge("revise", "biasCheckNode")
    .addEdge("confidenceNode", "finalize")
    .addEdge("finalize", END)

export const adjudicationGraph = workflow.compile({ checkpointer: getCheckpointer() })

// --- Public runner API -----------------------------------------------------

export interface AdjudicationOutcome {
    interrupted: boolean
    // Set when interrupted: what the platform is waiting on.
    waitingFor?: "SETTLEMENT" | "EVIDENCE"
    status?: string
    payload?: any
}

function normalizeModels(models?: Partial<AdjudicationModels>): AdjudicationModels {
    return {
        judge: models?.judge || DEFAULT_MODEL,
        coJudge: models?.coJudge || DEFAULT_MODEL,
    }
}

function interpret(result: any): AdjudicationOutcome {
    const interrupts = result?.__interrupt__
    if (Array.isArray(interrupts) && interrupts.length > 0) {
        const value = interrupts[0].value || {}
        const waitingFor = value.type === "SETTLEMENT" ? "SETTLEMENT" : "EVIDENCE"
        return {
            interrupted: true,
            waitingFor,
            status: waitingFor === "SETTLEMENT" ? "IN_MEDIATION" : "AWAITING_EVIDENCE",
            payload: value,
        }
    }
    return { interrupted: false, status: result?.finalStatus }
}

/** Start (or restart) adjudication for a case. Runs until completion or an interrupt. */
export async function runAdjudication(
    caseId: string,
    models?: Partial<AdjudicationModels>
): Promise<AdjudicationOutcome> {
    const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        include: { documents: true },
    })
    if (!caseData) throw new Error("Case not found")

    // Guarantee a clean start (important for admin re-runs / resets).
    await clearThread(caseId)

    const config = { configurable: { thread_id: caseId } }
    const result = await adjudicationGraph.invoke(
        { caseId, caseData, models: normalizeModels(models) },
        config
    )
    return interpret(result)
}

/** Resume a paused graph after a party responds (settlement decision or uploaded evidence). */
export async function resumeAdjudication(
    caseId: string,
    resumeValue: any
): Promise<AdjudicationOutcome> {
    const config = { configurable: { thread_id: caseId } }
    const result = await adjudicationGraph.invoke(new Command({ resume: resumeValue }), config)
    return interpret(result)
}

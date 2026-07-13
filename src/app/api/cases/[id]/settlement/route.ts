import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { resumeAdjudication } from "@/lib/agent/graph"

// A party accepts or rejects the AI-mediated settlement. When BOTH parties have responded we
// resume the paused adjudication graph with their combined decision.
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        const { id: caseId } = await params

        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { decision } = await req.json()
        if (decision !== "ACCEPTED" && decision !== "REJECTED") {
            return NextResponse.json({ message: "Invalid decision" }, { status: 400 })
        }

        const caseData = await prisma.case.findUnique({ where: { id: caseId } })
        if (!caseData) {
            return NextResponse.json({ message: "Case not found" }, { status: 404 })
        }

        const isClaimant = caseData.claimantId === session.user.id
        const isRespondent = caseData.respondentId === session.user.id
        if (!isClaimant && !isRespondent) {
            return NextResponse.json({ message: "Only a party to the dispute can respond" }, { status: 403 })
        }

        const settlement = await prisma.settlement.findFirst({
            where: { caseId },
            orderBy: { createdAt: "desc" },
        })
        if (!settlement) {
            return NextResponse.json({ message: "No active settlement" }, { status: 404 })
        }

        // Record this party's decision.
        const updated = await prisma.settlement.update({
            where: { id: settlement.id },
            data: isClaimant ? { claimantResponse: decision } : { respondentResponse: decision },
        })

        await prisma.auditLog.create({
            data: {
                caseId,
                userId: session.user.id,
                action: "SETTLEMENT_RESPONSE",
                details: `${isClaimant ? "Claimant" : "Respondent"} ${decision.toLowerCase()} the settlement.`,
            },
        })

        const bothResponded =
            updated.claimantResponse !== "PENDING" && updated.respondentResponse !== "PENDING"

        if (!bothResponded) {
            return NextResponse.json({
                status: "IN_MEDIATION",
                waiting: true,
                message: "Response recorded. Waiting for the other party.",
            })
        }

        // Both parties have responded — resume the graph with their decisions.
        const outcome = await resumeAdjudication(caseId, {
            claimantAccepted: updated.claimantResponse === "ACCEPTED",
            respondentAccepted: updated.respondentResponse === "ACCEPTED",
        })

        return NextResponse.json({
            status: outcome.status,
            interrupted: outcome.interrupted,
            waitingFor: outcome.waitingFor,
            payload: outcome.payload,
        })
    } catch (error) {
        console.error("[settlement] failed:", error)
        return NextResponse.json({ message: "Something went wrong" }, { status: 500 })
    }
}

export const dynamic = "force-dynamic"

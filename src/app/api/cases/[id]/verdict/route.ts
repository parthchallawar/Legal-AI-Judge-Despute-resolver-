import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { runAdjudication, resumeAdjudication, getPendingInterrupt, NoPendingInterruptError } from "@/lib/agent/graph"
import { clearThread } from "@/lib/agent/checkpointer"

function outcomeResponse(outcome: Awaited<ReturnType<typeof runAdjudication>>) {
    return NextResponse.json({
        status: outcome.status,
        interrupted: outcome.interrupted,
        waitingFor: outcome.waitingFor,
        payload: outcome.payload,
    })
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        const { id } = await params

        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const caseId = id
        const caseData = await prisma.case.findUnique({
            where: { id: caseId },
            select: { id: true },
        })

        if (!caseData) {
            return NextResponse.json({ message: "Case not found" }, { status: 404 })
        }

        const { judgeModel, coJudgeModel, force } = await req.json().catch(() => ({}))

        if (force && !(session.user.role === "ADMIN" || session.user.role === "ARBITRATOR")) {
            return NextResponse.json({ message: "Only an arbitrator can force adjudication to proceed" }, { status: 403 })
        }

        // Ground-truth check: is this case's graph actually paused waiting on a human right
        // now? DB status alone can be orphaned (e.g. a crashed resume), so we ask the durable
        // checkpoint directly instead of trusting Case.status.
        const pending = await getPendingInterrupt(caseId)

        if (pending?.node === "mediateCollect") {
            const settlement = await prisma.settlement.findFirst({
                where: { caseId },
                orderBy: { createdAt: "desc" },
            })
            const claimantResponse = settlement?.claimantResponse ?? "PENDING"
            const respondentResponse = settlement?.respondentResponse ?? "PENDING"
            const bothResponded = claimantResponse !== "PENDING" && respondentResponse !== "PENDING"

            if (bothResponded) {
                // Both parties have answered but the graph never got resumed (e.g. the request
                // that recorded the second response crashed before resuming). This is the
                // self-healing retry path — pick up exactly where it left off.
                try {
                    const outcome = await resumeAdjudication(caseId, {
                        claimantAccepted: claimantResponse === "ACCEPTED",
                        respondentAccepted: respondentResponse === "ACCEPTED",
                    })
                    return outcomeResponse(outcome)
                } catch (error) {
                    if (error instanceof NoPendingInterruptError) {
                        return NextResponse.json(
                            { message: "This case was already resumed elsewhere — refresh the page." },
                            { status: 409 }
                        )
                    }
                    throw error
                }
            }

            if (force) {
                // Arbitrator ends mediation before both parties answered. Treat non-responders
                // as having rejected (standard ODR deadline handling) and proceed.
                if (settlement) {
                    await prisma.settlement.update({
                        where: { id: settlement.id },
                        data: {
                            claimantResponse: claimantResponse === "PENDING" ? "EXPIRED" : claimantResponse,
                            respondentResponse: respondentResponse === "PENDING" ? "EXPIRED" : respondentResponse,
                        },
                    })
                    await prisma.auditLog.create({
                        data: {
                            caseId,
                            userId: session.user.id,
                            action: "MEDIATION_EXPIRED",
                            details: "Arbitrator ended mediation before both parties responded; non-response is treated as rejection.",
                        },
                    })
                }
                try {
                    const outcome = await resumeAdjudication(caseId, {
                        claimantAccepted: claimantResponse === "ACCEPTED",
                        respondentAccepted: respondentResponse === "ACCEPTED",
                    })
                    return outcomeResponse(outcome)
                } catch (error) {
                    if (error instanceof NoPendingInterruptError) {
                        return NextResponse.json(
                            { message: "This case was already resumed elsewhere — refresh the page." },
                            { status: 409 }
                        )
                    }
                    throw error
                }
            }

            const recorded = [claimantResponse, respondentResponse].filter((r) => r !== "PENDING").length
            return NextResponse.json(
                { message: `Waiting for settlement responses (${recorded}/2 recorded).` },
                { status: 409 }
            )
        }

        if (pending?.node === "evidenceCollect") {
            if (!force) {
                const request = await prisma.evidenceRequest.findFirst({
                    where: { caseId, status: "PENDING" },
                    orderBy: { createdAt: "desc" },
                })
                return NextResponse.json(
                    { message: `Waiting for requested evidence from ${request?.targetParty ?? "a party"}.` },
                    { status: 409 }
                )
            }

            // Arbitrator proceeds without the requested evidence.
            const request = await prisma.evidenceRequest.findFirst({
                where: { caseId, status: "PENDING" },
                orderBy: { createdAt: "desc" },
            })
            if (request) {
                await prisma.evidenceRequest.update({
                    where: { id: request.id },
                    data: { status: "CANCELLED" },
                })
                await prisma.auditLog.create({
                    data: {
                        caseId,
                        userId: session.user.id,
                        action: "EVIDENCE_CANCELLED",
                        details: `Arbitrator proceeded without the evidence requested from ${request.targetParty}.`,
                    },
                })
            }
            try {
                const outcome = await resumeAdjudication(caseId, { uploaded: false })
                return outcomeResponse(outcome)
            } catch (error) {
                if (error instanceof NoPendingInterruptError) {
                    return NextResponse.json(
                        { message: "This case was already resumed elsewhere — refresh the page." },
                        { status: 409 }
                    )
                }
                throw error
            }
        }

        // No pending interrupt — safe to (re)start adjudication from the top. This is now safe
        // even for a case mid-lifecycle because the mediation/evidence nodes are idempotent:
        // they consult the DB before proposing/asking again instead of repeating themselves.
        const outcome = await runAdjudication(caseId, { judge: judgeModel, coJudge: coJudgeModel })
        return outcomeResponse(outcome)
    } catch (error) {
        console.error("[verdict] adjudication failed:", error)
        return NextResponse.json(
            { message: "Something went wrong" },
            { status: 500 }
        )
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        const { id } = await params

        if (!session || session.user.role !== "ADMIN") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const caseId = id

        // Delete Verdicts and any pending HITL artifacts, and wipe the graph checkpoint so a
        // re-run starts fresh instead of resuming a stale interrupted state.
        await prisma.verdict.deleteMany({ where: { caseId } })
        await prisma.settlement.deleteMany({ where: { caseId } })
        await prisma.evidenceRequest.deleteMany({ where: { caseId } })
        await clearThread(caseId)

        // Reset Case Status
        await prisma.case.update({
            where: { id: caseId },
            data: {
                status: "AI_REVIEW",
                auditLogs: {
                    create: {
                        action: "VERDICT_RESET",
                        userId: session.user.id,
                        details: "Admin reset the verdict for re-evaluation.",
                    },
                },
            },
        })

        return NextResponse.json({ message: "Verdict reset successfully" })
    } catch (error) {
        return NextResponse.json(
            { message: "Something went wrong" },
            { status: 500 }
        )
    }
}

export const dynamic = "force-dynamic"

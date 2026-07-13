import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { runAdjudication } from "@/lib/agent/graph"
import { clearThread } from "@/lib/agent/checkpointer"

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

        const { judgeModel, coJudgeModel } = await req.json().catch(() => ({}))

        // Run the agentic adjudication graph (triage → mediation → CRAG → verdict →
        // reflection loop → confidence → finalize). The graph writes the Verdict, updates the
        // Case status, and records audit logs itself; it may also pause for mediation or an
        // evidence request, in which case it returns interrupted=true.
        const outcome = await runAdjudication(caseId, { judge: judgeModel, coJudge: coJudgeModel })

        return NextResponse.json({
            status: outcome.status,
            interrupted: outcome.interrupted,
            waitingFor: outcome.waitingFor,
            payload: outcome.payload,
        })
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

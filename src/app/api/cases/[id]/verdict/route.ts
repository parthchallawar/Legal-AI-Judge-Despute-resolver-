import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { aiService } from "@/lib/ai-service"

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
            include: { documents: true }
        })

        if (!caseData) {
            return NextResponse.json({ message: "Case not found" }, { status: 404 })
        }

        const { judgeModel, coJudgeModel } = await req.json().catch(() => ({}))

        // Generate Verdict
        const result = await aiService.adjudicateCase(caseData, judgeModel, coJudgeModel)

        if (result.error) {
            return NextResponse.json(
                { message: result.reasoning || "AI Service is currently unavailable." },
                { status: 503 }
            )
        }

        // Save Verdict
        const verdict = await prisma.verdict.create({
            data: {
                caseId,
                content: result.content,
                reasoning: result.reasoning,
                citations: JSON.stringify(result.citations),
                aiConfidence: result.confidence,
                isHuman: false,
            },
        })

        // Update Case Status based on Bias Check
        let newStatus = "AI_REVIEWED"
        let auditAction = "AI_VERDICT_GENERATED"
        let auditDetails = "AI generated a verdict."

        if (!result.passedBiasCheck) {
            newStatus = "ESCALATED"
            auditAction = "CASE_ESCALATED"
            auditDetails = `AI Verdict failed bias check: ${result.biasCheckReasoning}`
        } else {
            // If passed, we might auto-resolve or wait for acceptance. 
            // For demo, let's mark as RESOLVED if it passes, or just leave as AI_REVIEWED
            newStatus = "RESOLVED"
            auditDetails += " Bias check passed. Verdict issued."
        }

        await prisma.case.update({
            where: { id: caseId },
            data: {
                status: newStatus,
                analysis: JSON.stringify(result.analysis),
                auditLogs: {
                    create: {
                        action: auditAction,
                        userId: session.user.id, // Triggered by user
                        details: auditDetails,
                    },
                },
            },
        })

        return NextResponse.json({ verdict, status: newStatus })
    } catch (error) {
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

        // Delete Verdicts
        await prisma.verdict.deleteMany({
            where: { caseId }
        })

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

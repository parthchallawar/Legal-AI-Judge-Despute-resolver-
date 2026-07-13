import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { resumeAdjudication } from "@/lib/agent/graph"

// The targeted party submits the evidence the AI requested. We attach the documents, mark the
// request fulfilled, and resume the paused adjudication graph.
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

        const { documents } = await req.json()
        if (!Array.isArray(documents) || documents.length === 0) {
            return NextResponse.json({ message: "No documents provided" }, { status: 400 })
        }

        const caseData = await prisma.case.findUnique({ where: { id: caseId } })
        if (!caseData) {
            return NextResponse.json({ message: "Case not found" }, { status: 404 })
        }

        const request = await prisma.evidenceRequest.findFirst({
            where: { caseId, status: "PENDING" },
            orderBy: { createdAt: "desc" },
        })
        if (!request) {
            return NextResponse.json({ message: "No pending evidence request" }, { status: 404 })
        }

        // Only the targeted party (or an admin) may supply the requested evidence.
        const isClaimant = caseData.claimantId === session.user.id
        const isRespondent = caseData.respondentId === session.user.id
        const isTarget =
            (request.targetParty === "CLAIMANT" && isClaimant) ||
            (request.targetParty === "RESPONDENT" && isRespondent) ||
            session.user.role === "ADMIN"
        if (!isTarget) {
            return NextResponse.json({ message: "You are not the requested party" }, { status: 403 })
        }

        await Promise.all(
            documents.map((doc: any) =>
                prisma.document.create({
                    data: {
                        url: doc.url,
                        type: "EVIDENCE",
                        caseId,
                        uploaderId: session.user.id,
                    },
                })
            )
        )

        await prisma.evidenceRequest.update({
            where: { id: request.id },
            data: { status: "FULFILLED" },
        })

        await prisma.auditLog.create({
            data: {
                caseId,
                userId: session.user.id,
                action: "EVIDENCE_SUBMITTED",
                details: `Requested evidence submitted by ${request.targetParty}.`,
            },
        })

        // Resume adjudication now that the evidence is available.
        const outcome = await resumeAdjudication(caseId, { uploaded: true })

        return NextResponse.json({
            status: outcome.status,
            interrupted: outcome.interrupted,
            waitingFor: outcome.waitingFor,
            payload: outcome.payload,
        })
    } catch (error) {
        console.error("[evidence] failed:", error)
        return NextResponse.json({ message: "Something went wrong" }, { status: 500 })
    }
}

export const dynamic = "force-dynamic"

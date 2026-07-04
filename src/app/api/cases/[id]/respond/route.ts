import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { AIService } from "@/lib/ai-service"

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
        const { description, documents } = await req.json()

        const caseData = await prisma.case.findUnique({
            where: { id: caseId },
            include: { documents: true }
        })

        if (!caseData) {
            return NextResponse.json({ message: "Case not found" }, { status: 404 })
        }

        // Verify user is the respondent
        if (caseData.respondentId !== session.user.id) {
            return NextResponse.json({ message: "Only the respondent can submit a response" }, { status: 403 })
        }

        // Update Case with Respondent Description first to have it for normalization
        // Actually, we can just construct the object for normalization
        const newDocs = documents?.map((d: any) => ({ ...d, type: "RESPONSE" })) || []
        const caseForNormalization = {
            ...caseData,
            respondentDescription: description,
            documents: [...caseData.documents, ...newDocs]
        }

        const aiService = new AIService()
        const analysis = await aiService.normalizeClaims(caseForNormalization)

        // Update Case
        const updatedCase = await prisma.case.update({
            where: { id: caseId },
            data: {
                respondentDescription: description,
                status: "AWAITING_VERDICT",
                analysis: JSON.stringify(analysis),
                documents: {
                    create: documents?.map((doc: any) => ({
                        url: doc.url,
                        type: "RESPONSE",
                        uploaderId: session.user.id
                    }))
                },
                auditLogs: {
                    create: {
                        action: "RESPONSE_SUBMITTED",
                        userId: session.user.id,
                        details: "Respondent submitted their defense. AI Analysis generated.",
                    }
                }
            },
        })

        return NextResponse.json(updatedCase)
    } catch (error) {
        console.error("Error submitting response:", error)
        return NextResponse.json(
            { message: "Something went wrong" },
            { status: 500 }
        )
    }
}

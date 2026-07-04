import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const createCaseSchema = z.object({
    title: z.string().min(5),
    description: z.string().min(20),
    respondentEmail: z.string().email(),
    respondentName: z.string().optional(),
    additionalDetails: z.string().optional(),
    documents: z.array(z.object({
        url: z.string(),
        name: z.string(),
        type: z.string()
    })).optional()
})

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)

        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const { title, description, respondentEmail, respondentName, additionalDetails, documents } = createCaseSchema.parse(body)

        if (respondentEmail === session.user.email) {
            return NextResponse.json({ message: "You cannot file a dispute against yourself" }, { status: 400 })
        }

        // Find or create respondent
        let respondent = await prisma.user.findUnique({
            where: { email: respondentEmail },
        })

        if (!respondent) {
            respondent = await prisma.user.create({
                data: {
                    email: respondentEmail,
                    passwordHash: "placeholder_hash",
                    name: respondentName || "Pending Respondent",
                    role: "PARTY",
                }
            })
        }

        // Combine description with additional details if present
        const fullDescription = additionalDetails
            ? `${description}\n\nAdditional Details:\n${additionalDetails}`
            : description

        const newCase = await prisma.case.create({
            data: {
                title,
                description: fullDescription,
                claimantId: session.user.id,
                respondentId: respondent.id,
                status: "FILED",
                documents: {
                    create: documents?.map(doc => ({
                        url: doc.url,
                        type: doc.name.toLowerCase().includes("guidelines") ? "GUIDELINES" : "EVIDENCE",
                        uploaderId: session.user.id
                    }))
                },
                auditLogs: {
                    create: {
                        action: "CASE_FILED",
                        userId: session.user.id,
                        details: `Case filed against ${respondentEmail}`,
                    }
                }
            },
        })

        return NextResponse.json(newCase, { status: 201 })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ message: (error as any).errors }, { status: 400 })
        }
        return NextResponse.json(
            { message: "Something went wrong" },
            { status: 500 }
        )
    }
}

export const dynamic = "force-dynamic"

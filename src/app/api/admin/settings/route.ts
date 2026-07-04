import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
    try {
        const session = await getServerSession(authOptions)

        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const settings = await prisma.systemSettings.findUnique({
            where: { key: "ai_config" }
        })

        if (!settings) {
            return NextResponse.json({})
        }

        const config = JSON.parse(settings.value)

        // Non-admin users only need model choices for arbitrator UI.
        if (session.user.role !== "ADMIN") {
            return NextResponse.json({
                judgeModel: config.judgeModel,
                coJudgeModel: config.coJudgeModel,
                availableModels: config.availableModels,
            })
        }

        return NextResponse.json(config)
    } catch (error) {
        return NextResponse.json({ message: "Failed to fetch settings" }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)

        if (!session || session.user.role !== "ADMIN") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()

        // Basic validation
        if (!body.provider || !body.apiKey) {
            return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
        }

        await prisma.systemSettings.upsert({
            where: { key: "ai_config" },
            update: { value: JSON.stringify(body) },
            create: { key: "ai_config", value: JSON.stringify(body) }
        })

        return NextResponse.json({ message: "Settings saved" })
    } catch (error) {
        return NextResponse.json({ message: "Failed to save settings" }, { status: 500 })
    }
}

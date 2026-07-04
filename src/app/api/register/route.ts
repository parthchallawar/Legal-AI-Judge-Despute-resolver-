import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"
import { NextResponse } from "next/server"
import { z } from "zod"

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(1),
    role: z.enum(["PARTY", "ARBITRATOR", "ADMIN"]),
})

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { email, password, name, role } = registerSchema.parse(body)

        const existingUser = await prisma.user.findUnique({
            where: { email },
        })

        if (existingUser) {
            return NextResponse.json(
                { message: "User already exists" },
                { status: 400 }
            )
        }

        const passwordHash = await hash(password, 10)

        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                name,
                role,
            },
        })

        return NextResponse.json(
            { user: { id: user.id, email: user.email, name: user.name, role: user.role } },
            { status: 201 }
        )
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

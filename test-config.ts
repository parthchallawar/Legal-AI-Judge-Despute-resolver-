import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function test() {
    try {
        console.log("Testing Prisma Connection...")
        const settings = await prisma.systemSettings.findUnique({
            where: { key: "ai_config" }
        })
        console.log("Settings found:", settings)
        if (settings) {
            console.log("Parsed Value:", JSON.parse(settings.value))
        } else {
            console.log("No settings found for key 'ai_config'")
        }
    } catch (error) {
        console.error("Prisma Error:", error)
    } finally {
        await prisma.$disconnect()
    }
}

test()

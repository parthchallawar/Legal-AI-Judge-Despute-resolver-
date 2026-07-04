import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function clearDatabase() {
    try {
        console.log("Starting database cleanup...")

        // Delete related records first
        console.log("Deleting Documents...")
        await prisma.document.deleteMany({})

        console.log("Deleting Verdicts...")
        await prisma.verdict.deleteMany({})

        console.log("Deleting AuditLogs...")
        await prisma.auditLog.deleteMany({})

        // Delete Cases
        console.log("Deleting Cases...")
        const { count } = await prisma.case.deleteMany({})

        console.log(`Database cleanup complete. Deleted ${count} cases and all related data.`)

    } catch (error) {
        console.error("Cleanup failed:", error)
    } finally {
        await prisma.$disconnect()
    }
}

clearDatabase()

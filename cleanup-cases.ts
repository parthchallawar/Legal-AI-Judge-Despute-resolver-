import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function cleanup() {
    try {
        console.log("Starting cleanup...")
        const allCases = await prisma.case.findMany({
            include: { documents: true }
        })

        console.log(`Found ${allCases.length} total cases.`)

        // Group by title
        const casesByTitle: Record<string, typeof allCases> = {}
        for (const c of allCases) {
            if (!casesByTitle[c.title]) {
                casesByTitle[c.title] = []
            }
            casesByTitle[c.title].push(c)
        }

        let deletedCount = 0
        let updatedCount = 0

        for (const title in casesByTitle) {
            const cases = casesByTitle[title]

            // Sort by number of documents (desc), then createdAt (desc)
            cases.sort((a, b) => {
                if (b.documents.length !== a.documents.length) {
                    return b.documents.length - a.documents.length
                }
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            })

            // Keep the first one
            const caseToKeep = cases[0]
            const casesToDelete = cases.slice(1)

            // Delete duplicates
            for (const c of casesToDelete) {
                console.log(`Deleting duplicate case: ${c.id} (${c.title})`)
                // Delete related records first if necessary (Cascading usually handles this but good to be safe or aware)
                // Prisma schema doesn't show explicit cascade delete on relations in the snippet, 
                // but usually we delete the case.
                // Let's try deleting the case directly.
                await prisma.document.deleteMany({ where: { caseId: c.id } })
                await prisma.verdict.deleteMany({ where: { caseId: c.id } })
                await prisma.auditLog.deleteMany({ where: { caseId: c.id } })
                await prisma.case.delete({ where: { id: c.id } })
                deletedCount++
            }

            // Update status of the kept case
            if (caseToKeep.status !== "AI_REVIEW") {
                console.log(`Updating status for case: ${caseToKeep.id} (${caseToKeep.title}) to AI_REVIEW`)
                await prisma.case.update({
                    where: { id: caseToKeep.id },
                    data: { status: "AI_REVIEW" }
                })
                updatedCount++
            }
        }

        console.log(`Cleanup complete. Deleted ${deletedCount} duplicates. Updated ${updatedCount} cases to AI_REVIEW.`)

    } catch (error) {
        console.error("Cleanup failed:", error)
    } finally {
        await prisma.$disconnect()
    }
}

cleanup()

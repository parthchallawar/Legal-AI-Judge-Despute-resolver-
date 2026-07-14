/**
 * Read-only diagnostic: finds cases stuck in IN_MEDIATION / AWAITING_EVIDENCE, and confirms
 * getPendingInterrupt() correctly reads the durable checkpoint for each. No LLM calls.
 *
 *   npx tsx qa-diagnose-stuck.ts
 */
import { prisma } from "./src/lib/prisma"
import { getPendingInterrupt } from "./src/lib/agent/graph"

async function main() {
    const stuckCases = await prisma.case.findMany({
        where: { status: { in: ["IN_MEDIATION", "AWAITING_EVIDENCE"] } },
        include: {
            settlements: { orderBy: { createdAt: "desc" }, take: 1 },
            evidenceRequests: { orderBy: { createdAt: "desc" }, take: 1 },
        },
    })

    console.log(`Found ${stuckCases.length} case(s) with status IN_MEDIATION/AWAITING_EVIDENCE.\n`)

    for (const c of stuckCases) {
        console.log(`--- ${c.id} — "${c.title}" ---`)
        console.log(`  DB status: ${c.status}`)
        if (c.settlements[0]) {
            const s = c.settlements[0]
            console.log(`  Settlement: claimant=${s.claimantResponse} respondent=${s.respondentResponse}`)
        }
        if (c.evidenceRequests[0]) {
            const e = c.evidenceRequests[0]
            console.log(`  EvidenceRequest: target=${e.targetParty} status=${e.status}`)
        }

        const pending = await getPendingInterrupt(c.id)
        console.log(`  getPendingInterrupt() -> ${pending ? pending.node : "null"}`)

        if (pending?.node === "mediateCollect" && c.settlements[0]) {
            const s = c.settlements[0]
            const bothResponded = s.claimantResponse !== "PENDING" && s.respondentResponse !== "PENDING"
            console.log(`  Route decision: ${bothResponded ? "RESUME (both responded — this is the stuck-case fix)" : "409 waiting"}`)
        }
        console.log()
    }

    // Also verify a never-run case reports no pending interrupt.
    const freshCase = await prisma.case.findFirst({ where: { status: "FILED" } })
    if (freshCase) {
        const pending = await getPendingInterrupt(freshCase.id)
        console.log(`Control check — fresh/never-adjudicated case ${freshCase.id}: getPendingInterrupt() -> ${pending ? pending.node : "null"} (expect null)`)
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())

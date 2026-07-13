/**
 * Manual harness for the agentic adjudication graph.
 *
 *   npx tsx test-agent.ts            # runs against the most recent case that has a respondent reply
 *   npx tsx test-agent.ts <caseId>   # runs against a specific case
 *
 * Prints the outcome (final status, or what the graph paused on). Requires a working AI key in
 * Admin Settings / .env, and a case that already has a respondent response.
 */
import { prisma } from "./src/lib/prisma"
import { runAdjudication } from "./src/lib/agent/graph"

async function main() {
    const argId = process.argv[2]

    const caseRow = argId
        ? await prisma.case.findUnique({ where: { id: argId } })
        : await prisma.case.findFirst({
              where: { respondentDescription: { not: null } },
              orderBy: { createdAt: "desc" },
          })

    if (!caseRow) {
        console.error("No suitable case found. Pass a caseId, or file + respond to a case first.")
        process.exit(1)
    }

    console.log(`\n=== Adjudicating case ${caseRow.id} — "${caseRow.title}" ===\n`)
    const outcome = await runAdjudication(caseRow.id)

    console.log("\n=== Outcome ===")
    console.log(JSON.stringify(outcome, null, 2))

    const updated = await prisma.case.findUnique({
        where: { id: caseRow.id },
        include: { verdicts: { orderBy: { createdAt: "desc" }, take: 1 }, settlements: true, evidenceRequests: true },
    })
    console.log("\n=== Case after run ===")
    console.log("status:", updated?.status)
    console.log("disputeType:", updated?.disputeType, "| complexity:", updated?.complexity)
    const v = updated?.verdicts[0]
    if (v) {
        console.log("verdict:", v.content)
        console.log("confidence:", v.aiConfidence, "| passedBiasCheck:", v.passedBiasCheck, "| revisions:", v.revisionCount)
    }
    if (updated?.settlements.length) console.log("settlements:", updated.settlements.length)
    if (updated?.evidenceRequests.length) console.log("evidenceRequests:", updated.evidenceRequests.length)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())

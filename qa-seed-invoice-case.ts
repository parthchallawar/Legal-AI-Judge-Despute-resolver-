/**
 * One-off QA seed: a second test case built around a real invoice already sitting in
 * public/uploads (Amazon.in tax invoice for a Dell Vostro 3480 laptop), used as the attached
 * evidence document. Both claimant and respondent descriptions are pre-filled and the case is
 * left at AWAITING_VERDICT, so you can log in as the QA arbitrator and generate a verdict
 * immediately to see whether the model actually reasons from the invoice's details.
 *
 * Reuses the qa.claimant / qa.respondent / qa.arbitrator accounts from qa-seed.ts — run that
 * first if you haven't already.
 *
 *   npx tsx qa-seed-invoice-case.ts
 */
import fs from "fs"
import path from "path"
import { prisma } from "./src/lib/prisma"

const EXISTING_INVOICE_URL = "/uploads/1764770635892_screenshot.png"

async function main() {
    const localPath = path.join(process.cwd(), "public", EXISTING_INVOICE_URL.replace(/^\//, ""))
    if (!fs.existsSync(localPath)) {
        throw new Error(`Expected invoice file not found at ${localPath}`)
    }

    const claimant = await prisma.user.findUnique({ where: { email: "qa.claimant@test.local" } })
    const respondent = await prisma.user.findUnique({ where: { email: "qa.respondent@test.local" } })
    if (!claimant || !respondent) {
        throw new Error("qa.claimant@test.local / qa.respondent@test.local not found — run qa-seed.ts first.")
    }

    const title = "Refund Denied for Defective Dell Vostro 3480 Laptop (Liquid Damage Dispute)"

    const description = `I purchased a Dell Vostro 3480 (Intel Core i3 8th Gen, 4GB/1TB, Windows 10 Home) via Amazon.in, sold by Appario Retail Private Ltd, Order #407-6400628-4985965, dated 06.08.2019, for ₹30,990 (Invoice MAA4-631658, attached). Within the first month of normal office use, the laptop began randomly shutting down and the battery stopped holding charge beyond ~20 minutes. I raised a warranty service request and shipped the unit to the seller for inspection as instructed. The seller's inspection report claims they found "liquid damage" on the motherboard and has refused both a warranty repair and a refund on that basis. The laptop was never exposed to any liquid — it was used exclusively at a desk in an office environment. I am attaching the original tax invoice as proof of purchase and am requesting either a full refund of ₹30,990 or a replacement unit, as this is a manufacturing defect that surfaced well within the standard 1-year warranty period, not damage caused by me.`

    const respondentDescription = `We received the Dell Vostro 3480 (Order #407-6400628-4985965) from the customer for warranty inspection following their complaint. Our authorized service technician's inspection found visible corrosion and liquid residue on internal components, consistent with liquid exposure — a condition that is explicitly excluded from manufacturer warranty coverage under the terms the customer accepted at checkout. The invoice terms state that goods are non-returnable except for verified manufacturing defects, and our technical assessment determined this is not a manufacturing defect. We have offered the customer a paid out-of-warranty repair estimate, which was declined. We maintain this is accidental/customer-caused damage and does not qualify for a refund or free replacement under our stated policy.`

    const existing = await prisma.case.findFirst({ where: { title, claimantId: claimant.id } })
    if (existing) {
        console.log("Invoice case already exists, reusing:", existing.id)
        console.log("Case URL: http://localhost:3000/cases/" + existing.id)
        return
    }

    const newCase = await prisma.case.create({
        data: {
            title,
            description,
            respondentDescription,
            claimantId: claimant.id,
            respondentId: respondent.id,
            status: "AWAITING_VERDICT",
            documents: {
                create: [
                    { url: EXISTING_INVOICE_URL, type: "EVIDENCE", uploaderId: claimant.id },
                ],
            },
            auditLogs: {
                create: [
                    { action: "CASE_FILED", userId: claimant.id, details: `Case filed against ${respondent.email}` },
                    { action: "RESPONSE_SUBMITTED", userId: respondent.id, details: "Respondent submitted their defense." },
                ],
            },
        },
    })

    console.log("\n=== INVOICE TEST CASE READY ===")
    console.log("Case URL: http://localhost:3000/cases/" + newCase.id)
    console.log("Status: AWAITING_VERDICT — log in as qa.arbitrator@test.local (password Test1234!) and click 'Generate AI verdict'")
    console.log("Evidence attached: " + EXISTING_INVOICE_URL + " (the invoice you pointed to)")
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())

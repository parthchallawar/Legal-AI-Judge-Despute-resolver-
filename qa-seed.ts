/**
 * One-off QA seed script: creates test accounts + a sample dispute case with real evidence
 * images, so the app can be exercised manually end-to-end (file -> respond -> verdict ->
 * mediation/evidence). Safe to re-run (idempotent on accounts; skips if the case exists).
 *
 *   npx tsx qa-seed.ts
 */
import fs from "fs"
import path from "path"
import zlib from "zlib"
import { hash } from "bcryptjs"
import { prisma } from "./src/lib/prisma"

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")

// --- minimal valid PNG encoder (striped solid colors — enough to be a real, viewable image) ---
function crc32(buf: Buffer): number {
    let c: number
    const table: number[] = []
    for (let n = 0; n < 256; n++) {
        c = n
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        table[n] = c
    }
    let crc = 0xffffffff
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
    return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length, 0)
    const typeBuf = Buffer.from(type, "ascii")
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
    return Buffer.concat([len, typeBuf, data, crcBuf])
}

function makePng(width: number, height: number, colors: [number, number, number][]): Buffer {
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    const ihdrData = Buffer.alloc(13)
    ihdrData.writeUInt32BE(width, 0)
    ihdrData.writeUInt32BE(height, 4)
    ihdrData.writeUInt8(8, 8) // bit depth
    ihdrData.writeUInt8(2, 9) // color type RGB
    ihdrData.writeUInt8(0, 10)
    ihdrData.writeUInt8(0, 11)
    ihdrData.writeUInt8(0, 12)
    const ihdr = chunk("IHDR", ihdrData)

    const stripeHeight = Math.ceil(height / colors.length)
    const raw = Buffer.alloc((width * 3 + 1) * height)
    let offset = 0
    for (let y = 0; y < height; y++) {
        raw[offset++] = 0 // filter type: none
        const [r, g, b] = colors[Math.min(colors.length - 1, Math.floor(y / stripeHeight))]
        for (let x = 0; x < width; x++) {
            raw[offset++] = r
            raw[offset++] = g
            raw[offset++] = b
        }
    }
    const idat = chunk("IDAT", zlib.deflateSync(raw))
    const iend = chunk("IEND", Buffer.alloc(0))
    return Buffer.concat([sig, ihdr, idat, iend])
}

async function main() {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true })

    // --- 1. Test accounts (idempotent) ---
    const PASSWORD = "Test1234!"
    const passwordHash = await hash(PASSWORD, 10)

    const accounts = [
        { email: "qa.claimant@test.local", name: "Aarav Mehta (QA Claimant)", role: "PARTY" },
        { email: "qa.respondent@test.local", name: "TechZone Electronics (QA Respondent)", role: "PARTY" },
        { email: "qa.arbitrator@test.local", name: "QA Arbitrator", role: "ARBITRATOR" },
    ]

    for (const acc of accounts) {
        const existing = await prisma.user.findUnique({ where: { email: acc.email } })
        if (existing) {
            await prisma.user.update({ where: { email: acc.email }, data: { passwordHash, name: acc.name, role: acc.role } })
        } else {
            await prisma.user.create({ data: { ...acc, passwordHash } })
        }
    }
    const claimant = await prisma.user.findUniqueOrThrow({ where: { email: "qa.claimant@test.local" } })
    const respondent = await prisma.user.findUniqueOrThrow({ where: { email: "qa.respondent@test.local" } })

    // --- 2. Evidence images ("proofs") ---
    const stamp = Date.now()
    const laptopPhoto = makePng(480, 320, [
        [40, 40, 45], [90, 90, 95], [180, 40, 40], [40, 40, 45],
    ]) // dark laptop body with a red "cracked screen" stripe
    const receiptImg = makePng(400, 560, [
        [250, 250, 245], [235, 235, 230], [250, 250, 245], [235, 235, 230], [250, 250, 245],
    ]) // pale receipt-like stripes

    const laptopFilename = `${stamp}_cracked_screen_photo.png`
    const receiptFilename = `${stamp}_purchase_receipt.png`
    fs.writeFileSync(path.join(UPLOAD_DIR, laptopFilename), laptopPhoto)
    fs.writeFileSync(path.join(UPLOAD_DIR, receiptFilename), receiptImg)

    // --- 3. The case itself (left at FILED — respondent has not answered yet) ---
    const title = "Cracked Screen on Delivered Laptop — Refund Refused"
    const description = `I purchased a laptop (Order #TZ-88213) from TechZone Electronics on 2026-06-28 for ₹68,000, paid in full via UPI. The package arrived on 2026-07-02. When I opened the box, the laptop screen was already cracked across the top-left corner — visible in the attached photo. I contacted the seller the same day with photos and my receipt, requesting a replacement or full refund under their stated 7-day return policy. TechZone's support team responded on 2026-07-05 stating the damage "looks like user mishandling" and refused a refund, despite the box showing no external damage and me reporting the issue within hours of delivery. I have not used the laptop even once. I am requesting a full refund of ₹68,000 or a replacement unit, plus return shipping to be covered by the seller since the defect was present on arrival.`

    const existingCase = await prisma.case.findFirst({ where: { title, claimantId: claimant.id } })
    if (existingCase) {
        console.log("QA case already exists, reusing:", existingCase.id)
        printSummary(existingCase.id, accounts, PASSWORD)
        return
    }

    const newCase = await prisma.case.create({
        data: {
            title,
            description,
            claimantId: claimant.id,
            respondentId: respondent.id,
            status: "FILED",
            documents: {
                create: [
                    { url: `/uploads/${laptopFilename}`, type: "EVIDENCE", uploaderId: claimant.id },
                    { url: `/uploads/${receiptFilename}`, type: "EVIDENCE", uploaderId: claimant.id },
                ],
            },
            auditLogs: {
                create: {
                    action: "CASE_FILED",
                    userId: claimant.id,
                    details: `Case filed against ${respondent.email}`,
                },
            },
        },
    })

    printSummary(newCase.id, accounts, PASSWORD)
}

function printSummary(caseId: string, accounts: { email: string; role: string }[], password: string) {
    console.log("\n=== QA TEST DATA READY ===")
    console.log("Case URL:  http://localhost:3000/cases/" + caseId)
    console.log("\nAccounts (all password: " + password + ")")
    for (const a of accounts) console.log(`  ${a.role.padEnd(11)} ${a.email}`)
    console.log("\nCASE_ID=" + caseId)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())

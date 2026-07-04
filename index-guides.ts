import fs from "fs/promises"
import fsSync from "fs"
import path from "path"

// tsx does not auto-load .env, and we can't rely on Prisma's side effect here
// since this script runs standalone before any Prisma client is constructed.
function loadEnvFile() {
    const envPath = path.join(process.cwd(), ".env")
    if (!fsSync.existsSync(envPath)) return
    const content = fsSync.readFileSync(envPath, "utf-8")
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith("#")) continue
        const eq = trimmed.indexOf("=")
        if (eq === -1) continue
        const key = trimmed.slice(0, eq).trim()
        let value = trimmed.slice(eq + 1).trim()
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1)
        }
        if (!(key in process.env)) {
            process.env[key] = value
        }
    }
}

loadEnvFile()

import { embedTexts, EMBEDDING_MODEL, EMBEDDING_DIMS } from "./src/lib/embeddings"

const SOURCE_PDF = "Designing-The-Future-of-Dispute-Resolution-The-ODR-Policy-Plan-for-India.pdf"
const OUTPUT_PATH = path.join(process.cwd(), "src/lib/guidelines/vector-store.json")
// Progress checkpoint: written after every batch so a quota failure or interruption
// can resume from where it left off instead of re-embedding everything. Kept separate
// from OUTPUT_PATH so rag-utils.ts never picks up an incomplete store mid-run.
const CHECKPOINT_PATH = path.join(process.cwd(), "src/lib/guidelines/vector-store.checkpoint.json")

const CHUNK_SIZE = 1200
const CHUNK_OVERLAP = 200
const BATCH_SIZE = 50
// Free-tier embedding quota is 100 requests/minute, and a batch of 50 texts = 50 requests,
// so two consecutive batches without a pause can blow the per-minute window.
const BATCH_DELAY_MS = 65000

interface PageText {
    page: number
    text: string
}

interface Chunk {
    id: number
    page: number
    text: string
}

interface EmbeddedChunk extends Chunk {
    embedding: number[]
}

interface Checkpoint {
    model: string
    dims: number
    normalized: boolean
    source: string
    createdAt: string
    chunks: EmbeddedChunk[]
}

async function loadCheckpoint(): Promise<Map<number, EmbeddedChunk>> {
    const cache = new Map<number, EmbeddedChunk>()
    try {
        const raw = await fs.readFile(CHECKPOINT_PATH, "utf-8")
        const checkpoint: Checkpoint = JSON.parse(raw)
        if (checkpoint.model === EMBEDDING_MODEL && checkpoint.dims === EMBEDDING_DIMS) {
            for (const chunk of checkpoint.chunks) {
                cache.set(chunk.id, chunk)
            }
        }
    } catch {
        // No checkpoint yet, or it's unreadable/stale — start fresh.
    }
    return cache
}

async function writeCheckpoint(embeddedChunks: EmbeddedChunk[]): Promise<void> {
    const checkpoint: Checkpoint = {
        model: EMBEDDING_MODEL,
        dims: EMBEDDING_DIMS,
        normalized: true,
        source: SOURCE_PDF,
        createdAt: new Date().toISOString(),
        chunks: embeddedChunks,
    }
    await fs.writeFile(CHECKPOINT_PATH, JSON.stringify(checkpoint), "utf-8")
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function parsePdfIntoPages(): Promise<PageText[]> {
    const pdfPath = path.join(process.cwd(), "guides", SOURCE_PDF)
    const dataBuffer = await fs.readFile(pdfPath)

    const { PDFParse } = await import("pdf-parse")
    const parser = new PDFParse({ data: dataBuffer })
    const parsed = await parser.getText()
    await parser.destroy()

    const fullText = parsed.text || ""

    // pdf-parse emits page markers like "-- 57 of 162 --" between pages.
    const markerRegex = /--\s*(\d+)\s*of\s*\d+\s*--/g
    const pages: PageText[] = []

    const matches = [...fullText.matchAll(markerRegex)]
    for (let i = 0; i < matches.length; i++) {
        const match = matches[i]
        const pageNum = parseInt(match[1], 10)
        const start = match.index! + match[0].length
        const end = i + 1 < matches.length ? matches[i + 1].index! : fullText.length
        const rawPageText = fullText.slice(start, end)
        const cleaned = cleanPageText(rawPageText)
        if (cleaned.length >= 100) {
            pages.push({ page: pageNum, text: cleaned })
        }
    }

    return pages
}

function cleanPageText(raw: string): string {
    return raw
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

function splitIntoSentences(text: string): string[] {
    return text.split(/(?<=[.!?])\s+/).filter(s => s.length > 0)
}

function chunkPage(page: PageText, startId: number): Chunk[] {
    const chunks: Chunk[] = []
    const paragraphs = page.text.split(/\n\s*\n/).filter(p => p.trim().length > 0)

    let current = ""
    let id = startId

    const pushCurrent = () => {
        if (current.trim().length > 0) {
            chunks.push({ id: id++, page: page.page, text: current.trim() })
        }
    }

    const appendWithOverlap = (piece: string) => {
        if (current.length === 0) {
            current = piece
            return
        }
        if (current.length + piece.length + 1 <= CHUNK_SIZE) {
            current += "\n\n" + piece
        } else {
            pushCurrent()
            const overlapText = current.slice(-CHUNK_OVERLAP)
            current = overlapText + "\n\n" + piece
        }
    }

    for (const paragraph of paragraphs) {
        if (paragraph.length > CHUNK_SIZE) {
            // Oversized paragraph: fall back to sentence-level splitting.
            const sentences = splitIntoSentences(paragraph)
            for (const sentence of sentences) {
                appendWithOverlap(sentence)
            }
        } else {
            appendWithOverlap(paragraph)
        }
    }
    pushCurrent()

    return chunks
}

async function main() {
    console.log("Parsing PDF (all pages)...")
    const pages = await parsePdfIntoPages()
    console.log(`Parsed ${pages.length} pages with content.`)

    let chunks: Chunk[] = []
    for (const page of pages) {
        const pageChunks = chunkPage(page, chunks.length)
        chunks = chunks.concat(pageChunks)
    }
    console.log(`Created ${chunks.length} chunks.`)

    const cache = await loadCheckpoint()

    // A chunk is reusable from the checkpoint only if its id AND text still match —
    // if the PDF or chunking logic changed, stale cached chunks are dropped and re-embedded.
    const embeddedChunks: EmbeddedChunk[] = []
    const pending: Chunk[] = []
    for (const chunk of chunks) {
        const cached = cache.get(chunk.id)
        if (cached && cached.text === chunk.text) {
            embeddedChunks.push(cached)
        } else {
            pending.push(chunk)
        }
    }

    if (embeddedChunks.length > 0) {
        console.log(`Resuming from checkpoint: ${embeddedChunks.length}/${chunks.length} chunks already embedded, ${pending.length} remaining.`)
    }

    const totalBatches = Math.ceil(pending.length / BATCH_SIZE)
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        const batch = pending.slice(i, i + BATCH_SIZE)
        console.log(`Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${totalBatches} (${batch.length} chunks)...`)

        const embeddings = await embedTexts(batch.map(c => c.text), "RETRIEVAL_DOCUMENT")

        for (let j = 0; j < batch.length; j++) {
            embeddedChunks.push({
                ...batch[j],
                embedding: embeddings[j].map(v => Math.round(v * 1e6) / 1e6),
            })
        }

        // Checkpoint after every batch so a quota failure or interruption can resume
        // from here instead of re-embedding chunks we already paid for.
        await writeCheckpoint(embeddedChunks)

        if (i + BATCH_SIZE < pending.length) {
            await sleep(BATCH_DELAY_MS)
        }
    }

    // embeddedChunks may be in cache-then-pending order (not original chunk order) —
    // sort by id so the final store's chunk order matches the source document.
    embeddedChunks.sort((a, b) => a.id - b.id)

    const store = {
        model: EMBEDDING_MODEL,
        dims: EMBEDDING_DIMS,
        normalized: true,
        source: SOURCE_PDF,
        createdAt: new Date().toISOString(),
        chunks: embeddedChunks,
    }

    await fs.writeFile(OUTPUT_PATH, JSON.stringify(store), "utf-8")
    await fs.rm(CHECKPOINT_PATH, { force: true })

    console.log("Indexing complete.")
    console.log(`Pages parsed: ${pages.length}`)
    console.log(`Chunks created: ${embeddedChunks.length}`)
    console.log(`Output written to: ${OUTPUT_PATH}`)
}

main().catch(error => {
    console.error("Indexing failed (progress has been checkpointed — re-run this script to resume):", error)
    process.exit(1)
})

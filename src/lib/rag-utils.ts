import fs from "fs/promises"
import path from "path"
import { embedTexts, dot, EMBEDDING_MODEL, EMBEDDING_DIMS } from "./embeddings"

interface StoredChunk {
    id: number
    page: number
    text: string
    embedding: number[]
}

interface VectorStore {
    model: string
    dims: number
    normalized: boolean
    source: string
    createdAt: string
    chunks: StoredChunk[]
}

const SIMILARITY_THRESHOLD = 0.5
const TOP_K = 5
const FALLBACK_TOP_K = 3
const MAX_QUERY_CHARS = 6000
const MIN_QUERY_CHARS = 20

export class RAGService {
    private static instance: RAGService
    private storePromise: Promise<VectorStore | null> | null = null

    private constructor() { }

    public static getInstance(): RAGService {
        if (!RAGService.instance) {
            RAGService.instance = new RAGService()
        }
        return RAGService.instance
    }

    private loadStore(): Promise<VectorStore | null> {
        if (!this.storePromise) {
            this.storePromise = this.loadStoreFromDisk()
        }
        return this.storePromise
    }

    private async loadStoreFromDisk(): Promise<VectorStore | null> {
        try {
            const storePath = path.join(process.cwd(), "src/lib/guidelines/vector-store.json")
            const raw = await fs.readFile(storePath, "utf-8")
            const store: VectorStore = JSON.parse(raw)

            if (store.model !== EMBEDDING_MODEL || store.dims !== EMBEDDING_DIMS) {
                console.error(
                    `RAG vector store model/dims mismatch (found ${store.model}/${store.dims}, expected ${EMBEDDING_MODEL}/${EMBEDDING_DIMS}). Re-run "npx tsx index-guides.ts".`
                )
                return null
            }

            return store
        } catch (error) {
            console.error('RAG vector store missing or unreadable. Re-run "npx tsx index-guides.ts".', error)
            return null
        }
    }

    public async retrieveContext(query: string): Promise<string> {
        try {
            if (!query || query.trim().length < MIN_QUERY_CHARS) {
                return ""
            }

            const store = await this.loadStore()
            if (!store || store.chunks.length === 0) {
                return ""
            }

            const truncatedQuery = query.slice(0, MAX_QUERY_CHARS)
            const [queryEmbedding] = await embedTexts([truncatedQuery], "RETRIEVAL_QUERY")

            const scored = store.chunks.map(chunk => ({
                chunk,
                score: dot(queryEmbedding, chunk.embedding),
            }))
            scored.sort((a, b) => b.score - a.score)

            let selected = scored.filter(s => s.score >= SIMILARITY_THRESHOLD).slice(0, TOP_K)
            if (selected.length === 0) {
                selected = scored.slice(0, FALLBACK_TOP_K)
            }

            return selected
                .map(({ chunk, score }) =>
                    `[Excerpt — ODR Policy Plan for India, p. ${chunk.page} (relevance ${score.toFixed(2)})]\n${chunk.text}`
                )
                .join("\n\n")
        } catch (error) {
            console.error("RAG retrieveContext failed, degrading to no additional context:", error)
            return ""
        }
    }
}

export const ragService = RAGService.getInstance()

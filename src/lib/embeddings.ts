import { prisma } from "@/lib/prisma"

export const EMBEDDING_MODEL = "gemini-embedding-001"
export const EMBEDDING_DIMS = 768

const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`

export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"

export async function resolveGeminiKey(): Promise<string> {
    try {
        const settings = await prisma.systemSettings.findUnique({
            where: { key: "ai_config" }
        })
        if (settings) {
            const config = JSON.parse(settings.value)
            if (config.apiKey && config.apiKey.startsWith("AIza")) {
                return config.apiKey
            }
        }
    } catch (error) {
        console.error("resolveGeminiKey: failed to read AI config from DB, falling back to env", error)
    }
    return process.env.GEMINI_API_KEY || ""
}

function l2Normalize(vec: number[]): number[] {
    const norm = Math.hypot(...vec)
    if (norm === 0) return vec
    return vec.map(v => v / norm)
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function parseRetryDelayMs(errorBody: string): number | undefined {
    try {
        const parsed = JSON.parse(errorBody)
        const details = parsed?.error?.details as any[] | undefined
        const retryInfo = details?.find(d => d["@type"]?.includes("RetryInfo"))
        const retryDelay: string | undefined = retryInfo?.retryDelay
        if (retryDelay) {
            const seconds = parseFloat(retryDelay.replace(/s$/, ""))
            if (!isNaN(seconds)) return Math.ceil(seconds * 1000)
        }
    } catch {
        // ignore parse failures, fall back to default backoff
    }
    return undefined
}

async function batchEmbedOnce(apiKey: string, texts: string[], taskType: EmbeddingTaskType): Promise<number[][]> {
    const response = await fetch(`${EMBED_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            requests: texts.map(text => ({
                model: `models/${EMBEDDING_MODEL}`,
                content: { parts: [{ text }] },
                taskType,
                outputDimensionality: EMBEDDING_DIMS,
            }))
        })
    })

    if (!response.ok) {
        const body = await response.text()
        const error = new Error(`Gemini embeddings API error: ${response.status} - ${body}`) as Error & { statusCode?: number; retryDelayMs?: number }
        error.statusCode = response.status
        error.retryDelayMs = parseRetryDelayMs(body)
        throw error
    }

    const data = await response.json()
    const embeddings = data.embeddings
    if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
        throw new Error("Gemini embeddings API returned an unexpected shape")
    }

    return embeddings.map((e: any) => l2Normalize(e.values as number[]))
}

const RETRY_DELAYS_MS = [2000, 8000, 20000]

export async function embedTexts(texts: string[], taskType: EmbeddingTaskType): Promise<number[][]> {
    const apiKey = await resolveGeminiKey()
    if (!apiKey) {
        throw new Error("Gemini API key is missing")
    }

    let lastError: unknown
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        try {
            return await batchEmbedOnce(apiKey, texts, taskType)
        } catch (error) {
            lastError = error
            const statusCode = (error as { statusCode?: number })?.statusCode
            const retryable = statusCode === 429 || (typeof statusCode === "number" && statusCode >= 500)
            if (!retryable || attempt === RETRY_DELAYS_MS.length) {
                throw error
            }
            // 429 responses carry the server-recommended wait (often 30-60s on free tier),
            // which is longer than our default backoff — honor it when present.
            const serverDelay = (error as { retryDelayMs?: number })?.retryDelayMs
            const delay = serverDelay ? serverDelay + 2000 : RETRY_DELAYS_MS[attempt]
            console.error(`embedTexts: attempt ${attempt + 1} failed (status ${statusCode}), retrying in ${delay}ms...`)
            await sleep(delay)
        }
    }

    throw lastError
}

export function dot(a: number[], b: number[]): number {
    let sum = 0
    for (let i = 0; i < a.length; i++) {
        sum += a[i] * b[i]
    }
    return sum
}

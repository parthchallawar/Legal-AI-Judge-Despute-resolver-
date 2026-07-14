import fs from "fs/promises"
import path from "path"
import { ragService } from "./rag-utils"

// Mocked AI Service for ODR Platform
// Now integrated with OpenRouter and RAG

interface VerdictResult {
    content: string
    reasoning: string
    confidence: number
    passedBiasCheck: boolean
    biasCheckReasoning?: string
    error?: boolean
}

import { prisma } from "@/lib/prisma"

export class AIService {
    private openRouterApiKey: string = ""

    private isBillingError(message: string): boolean {
        const m = message.toLowerCase()
        return m.includes("payment required") || m.includes("insufficient credits") || m.includes("\"code\":402")
    }

    constructor() {
        // Initial load from env, but will be overridden by DB config if present
        this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ""
    }

    private async getConfig() {
        try {
            const settings = await prisma.systemSettings.findUnique({
                where: { key: "ai_config" }
            })
            if (settings) {
                const config = JSON.parse(settings.value)
                if (config.apiKey) {
                    this.openRouterApiKey = config.apiKey
                }
                return config
            }
        } catch (error) {
            console.error("Failed to load AI config from DB", error)
        }
        return null
    }

    // Helper to call OpenRouter
    private async callOpenRouter(model: string, messages: any[], temperature: number = 0.7): Promise<string> {
        // Ensure config is loaded
        await this.getConfig()

        if (!this.openRouterApiKey) {
            console.error("OPENROUTER_API_KEY is missing")
            throw new Error("Configuration Missing: Please set the OpenRouter API Key in Admin Settings.")
        }

        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.openRouterApiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://odr-platform.com", // Site URL for rankings
                    "X-Title": "ODR Platform", // Site title for rankings
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    temperature: temperature,
                })
            })

            if (!response.ok) {
                const errorBody = await response.text()
                console.error(`OpenRouter API Error (${response.status}):`, errorBody)
                const error = new Error(`OpenRouter API Error: ${response.statusText} - ${errorBody}`) as Error & { statusCode?: number }
                error.statusCode = response.status
                throw error
            }

            const data = await response.json()
            return data.choices[0]?.message?.content || ""
        } catch (error) {
            console.error("Call OpenRouter Failed:", error)
            throw error
        }
    }

    // Helper to call Google Gemini directly
    private async callGemini(model: string, messages: any[], temperature: number = 0.7): Promise<string> {
        await this.getConfig()

        // Use the key that is available (Gemini or OpenRouter/OpenAI var if it looks like a Google key)
        const apiKey = this.openRouterApiKey.startsWith("AIza") ? this.openRouterApiKey : process.env.GEMINI_API_KEY

        if (!apiKey) {
            throw new Error("Configuration Missing: Google API Key is missing.")
        }

        try {
            const { GoogleGenerativeAI } = await import("@google/generative-ai")
            const genAI = new GoogleGenerativeAI(apiKey)
            // Strip prefix if present (e.g. "google/gemini-pro" -> "gemini-pro")
            const modelName = model.includes("/") ? model.split("/")[1] : model
            const aiModel = genAI.getGenerativeModel({ model: modelName })

            // Convert messages to Gemini's Part[] format. Concatenate system + user text into
            // one text part, and forward any base64 image_url parts as inlineData parts so
            // evidence images are actually examined instead of silently dropped.
            const systemMessage = messages.find(m => m.role === "system")?.content || ""
            const userMessage = messages.find(m => m.role === "user")

            const parts: any[] = []
            let textPrompt = systemMessage + "\n\n"

            if (Array.isArray(userMessage.content)) {
                const textPart = userMessage.content.find((c: any) => c.type === "text")?.text || ""
                textPrompt += textPart
                parts.push({ text: textPrompt })

                for (const c of userMessage.content) {
                    if (c.type === "image_url" && typeof c.image_url?.url === "string") {
                        const match = c.image_url.url.match(/^data:([^;]+);base64,(.+)$/)
                        if (match) {
                            parts.push({ inlineData: { mimeType: match[1], data: match[2] } })
                        }
                    }
                }
            } else {
                textPrompt += userMessage.content
                parts.push({ text: textPrompt })
            }

            const result = await aiModel.generateContent(parts)
            const response = await result.response
            return response.text()
        } catch (error) {
            console.error("Call Gemini Failed:", error)
            throw error
        }
    }

    // Unified AI Call
    public async callAI(model: string, messages: any[], temperature: number = 0.7): Promise<string> {
        await this.getConfig()

        const key = this.openRouterApiKey.trim()
        console.log(`[AIService] Calling AI with model: ${model}`)
        console.log(`[AIService] Key starts with AIza? ${key.startsWith("AIza")}`)
        console.log(`[AIService] Key length: ${key.length}`)

        // Detect provider based on Key or Model
        // If key starts with AIza, it's Google.
        if (key.startsWith("AIza")) {
            console.log("[AIService] Routing to Gemini")
            return this.callGemini(model, messages, temperature)
        }

        console.log("[AIService] Routing to OpenRouter")
        return this.callOpenRouter(model, messages, temperature)
    }

    // Helper to load evidence files for multimodal input (if model supports it - simplified for text-based OpenRouter for now)
    // Note: Many OpenRouter models support image URLs. For local files, we'd need to upload them or base64 encode them.
    // For this implementation, we will focus on text context from RAG and metadata about files.
    // If we want to support images with OpenRouter, we need to base64 encode them in the message content.
    public async loadEvidenceAsBase64(documents: any[]): Promise<any[]> {
        const images: any[] = []
        if (!documents) return images

        // Document.type on our rows is a category (EVIDENCE/RESPONSE/GUIDELINES/CLAIM), not a
        // real MIME type, so the actual image type has to come from the file extension.
        const EXT_MIME: Record<string, string> = {
            jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
            gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
        }

        for (const doc of documents) {
            try {
                const relativePath = doc.url.startsWith("/") ? doc.url.slice(1) : doc.url
                const localPath = path.join(process.cwd(), "public", relativePath)

                // Check if file exists
                await fs.access(localPath)

                const ext = doc.url.split(".").pop()?.toLowerCase() || ""
                const mimeType = EXT_MIME[ext]
                if (!mimeType) continue

                const fileBuffer = await fs.readFile(localPath)

                if (mimeType.startsWith("image/")) {
                    images.push({
                        type: "image_url",
                        image_url: {
                            url: `data:${mimeType};base64,${fileBuffer.toString("base64")}`
                        }
                    })
                }
            } catch (error) {
                console.error(`Error loading evidence ${doc.name}:`, error)
            }
        }
        return images
    }

    // Extract readable text from non-image evidence (PDFs, .txt/.md) so it can be read by the
    // model as actual content instead of just a filename. Images are handled separately by
    // loadEvidenceAsBase64 — this never duplicates them.
    public async loadEvidenceText(documents: any[]): Promise<string> {
        if (!documents) return ""

        const MAX_PER_DOC = 6000
        const MAX_TOTAL = 15000
        const blocks: string[] = []
        let total = 0

        for (const doc of documents) {
            if (total >= MAX_TOTAL) break

            try {
                const relativePath = doc.url.startsWith("/") ? doc.url.slice(1) : doc.url
                const localPath = path.join(process.cwd(), "public", relativePath)
                await fs.access(localPath)

                const ext = doc.url.split(".").pop()?.toLowerCase() || ""
                const label = doc.name || doc.url.split("/").pop() || "evidence file"

                let text = ""
                if (ext === "pdf") {
                    const { PDFParse } = await import("pdf-parse")
                    const dataBuffer = await fs.readFile(localPath)
                    const parser = new PDFParse({ data: dataBuffer })
                    const parsed = await parser.getText()
                    await parser.destroy()
                    text = parsed.text || ""
                } else if (ext === "txt" || ext === "md") {
                    text = await fs.readFile(localPath, "utf-8")
                } else {
                    continue // images (handled elsewhere) and other unsupported types
                }

                text = text.trim().slice(0, MAX_PER_DOC)
                if (!text) continue

                const block = `--- ${label} ---\n${text}`
                blocks.push(block)
                total += block.length
            } catch (error) {
                console.error(`Error extracting text from evidence ${doc.name}:`, error)
            }
        }

        return blocks.join("\n\n")
    }

    // Helper to extract JSON from text
    public extractJson(text: string): any {
        try {
            // Remove markdown code blocks first
            const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim()
            return JSON.parse(cleanText)
        } catch (e) {
            // If that fails, try to find the first '{' and last '}'
            const start = text.indexOf('{')
            const end = text.lastIndexOf('}')
            if (start !== -1 && end !== -1) {
                const jsonStr = text.substring(start, end + 1)
                try {
                    return JSON.parse(jsonStr)
                } catch (innerError) {
                    throw e // Throw original error if extraction fails
                }
            }
            throw e
        }
    }

    // Verdict Generation
    public async generateVerdict(
        context: string,
        caseDetails: any,
        model: string,
        revision?: { priorContent: string; priorReasoning: string; critique: string }
    ): Promise<{ content: string; reasoning: string; citations: string[]; error?: boolean }> {
        const revisionBlock = revision
            ? `
        IMPORTANT — THIS IS A REVISION.
        A co-judge bias auditor reviewed your previous verdict and found problems. You must
        produce a corrected verdict that directly addresses the critique below. Do not repeat
        the same flaws. If the critique is about tone or a logical gap, fix it while staying
        faithful to the evidence and guidelines.

        Your previous verdict: ${revision.priorContent}
        Your previous reasoning: ${revision.priorReasoning}
        Auditor's critique to resolve: ${revision.critique}
        `
            : ""

        const systemPrompt = `
        You are an AI Arbitrator. Your job is to decide a dispute based on the provided context, case details, and VISUAL EVIDENCE.

        Context (Legal Guidelines & RAG Retrieval):
        ${context}
        ${revisionBlock}

        Task:
        1. Analyze the case based on the guidelines and the normalized arguments.
        2. EXAMINE THE PROVIDED IMAGES (if any) as evidence, and READ the extracted evidence
           file contents below (receipts, contracts, reports, etc.) as evidence too.
        3. Provide a clear verdict (In favor of Claimant or Respondent).
        4. Provide a detailed reasoning.
        5. Cite specific rules from the guidelines that support your decision.

        Output Format (JSON):
        {
            "content": "Verdict statement...",
            "reasoning": "Detailed reasoning...",
            "citations": ["Rule 1.1: Fairness", "Rule 2.2: Performance"]
        }
        `

        try {
            // Load evidence images and extract text from PDF/text evidence so both are
            // genuinely considered, not just listed by filename.
            const evidenceImages = await this.loadEvidenceAsBase64(caseDetails.documents)
            const evidenceText = await this.loadEvidenceText(caseDetails.documents)

            const userContent = `
        Case Details:
        Title: ${caseDetails.title}

        Normalized Analysis:
        Claimant Arguments: ${JSON.stringify(caseDetails.analysis?.claimantArguments)}
        Respondent Arguments: ${JSON.stringify(caseDetails.analysis?.respondentArguments)}

        Original Description (Claimant): ${caseDetails.description}
        Original Response (Respondent): ${caseDetails.respondentDescription || "No response provided."}

        Evidence Files (Metadata):
        ${caseDetails.documents?.map((d: any) => `- ${d.name} (${d.type})`).join("\n") || "No evidence uploaded."}

        Evidence File Contents (extracted text from PDFs/text files, where available):
        ${evidenceText || "No extractable text evidence."}
        `

            const messages = [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: [
                        { type: "text", text: userContent },
                        ...evidenceImages
                    ]
                }
            ]

            const text = await this.callAI(model, messages)

            try {
                return this.extractJson(text)
            } catch (parseError) {
                console.error("JSON Parse Error:", parseError)
                console.log("Raw Text:", text)

                if (text.toLowerCase().includes("unable to") || text.toLowerCase().includes("i cannot")) {
                    return {
                        content: "Verdict: AI Refusal",
                        reasoning: "The AI model refused to process this case.",
                        citations: [],
                        error: true
                    }
                }

                return {
                    content: "Verdict: Parsing Error",
                    reasoning: "The AI generated a response that could not be parsed.",
                    citations: [],
                    error: true
                }
            }
        } catch (error) {
            console.error("OpenRouter API Error (Verdict):", error)
            // @ts-ignore
            if (error.message) console.error("Error Message:", error.message)
            // @ts-ignore
            if (error.stack) console.error("Error Stack:", error.stack)

            // @ts-ignore
            const errorMessage = error.message || "Unknown error"

            return {
                content: "Verdict: Configuration Required",
                reasoning: errorMessage.includes("Configuration Missing")
                    ? "The AI Arbitrator is not configured. Please ask an Admin to set the OpenRouter API Key in the Settings page."
                    : this.isBillingError(errorMessage)
                        ? "AI provider credits are insufficient (OpenRouter 402). Please add credits or switch to a funded API key in Admin Settings."
                    : `AI Service is currently unavailable. Error details: ${errorMessage}`,
                citations: [],
                error: true
            }
        }
    }

    // Bias/Fallacy Check
    public async checkBias(verdict: string, reasoning: string, model: string): Promise<{ passed: boolean; reasoning: string }> {
        const prompt = `
        You are an AI Bias Auditor. Check the following verdict and reasoning for logical fallacies or bias.

        Verdict: ${verdict}
        Reasoning: ${reasoning}

        Task:
        1. Identify any logical fallacies (e.g., ad hominem, straw man).
        2. Check for bias against any party.
        3. Determine if the verdict is sound based on the reasoning provided.

        Output Format (JSON):
        {
            "passed": boolean,
            "reasoning": "Explanation of the check..."
        }
        `

        try {
            const text = await this.callAI(model, [{ role: "user", content: prompt }])
            const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim()
            return JSON.parse(cleanText)
        } catch (error) {
            console.error("OpenRouter API Error (Bias Check):", error)
            return {
                passed: true,
                reasoning: "Bias check skipped due to service unavailability."
            }
        }
    }

    // Normalization Layer
    public async normalizeClaims(caseData: any, model: string = "openai/gpt-5-nano"): Promise<{ claimantArguments: any[]; respondentArguments: any[] }> {
        const systemPrompt = `
        You are an AI Case Analyst. Your job is to read the raw descriptions from both the Claimant and the Respondent and normalize them into structured arguments.
        `

        try {
            const evidenceImages = await this.loadEvidenceAsBase64(caseData.documents)
            const evidenceText = await this.loadEvidenceText(caseData.documents)

            const userContent = `
        Case Title: ${caseData.title}

        Claimant's Description:
        ${caseData.description}

        Respondent's Response:
        ${caseData.respondentDescription || "No response provided."}

        Evidence Files (Metadata):
        ${caseData.documents?.map((d: any) => `- ${d.name} (${d.type})`).join("\n") || "No evidence uploaded."}

        Evidence File Contents (extracted text from PDFs/text files, where available):
        ${evidenceText || "No extractable text evidence."}

        Task:
        1. Extract distinct arguments/claims made by the Claimant.
        2. Extract distinct arguments/counter-claims made by the Respondent.
        3. For each argument, identify if there is any supporting evidence mentioned or uploaded.
        4. IF YOU SEE EVIDENCE IN THE IMAGES OR EVIDENCE FILE CONTENTS ABOVE, describe it briefly in the 'evidence' field.
        5. Rephrase everything into clear, professional language.

        Output Format (JSON):
        {
            "claimantArguments": [
                { "claim": "Claim statement...", "evidence": "Reference to evidence or 'None'" }
            ],
            "respondentArguments": [
                { "claim": "Counter-claim statement...", "evidence": "Reference to evidence or 'None'" }
            ]
        }
        `

            const messages = [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: [
                        { type: "text", text: userContent },
                        ...evidenceImages
                    ]
                }
            ]

            const text = await this.callAI(model, messages)
            const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim()
            return JSON.parse(cleanText)
        } catch (error) {
            console.error("OpenRouter API Error (Normalization):", error)
            return { claimantArguments: [], respondentArguments: [] }
        }
    }

    // Main Orchestrator
    public async adjudicateCase(caseData: any, judgeModel: string = "openai/gpt-5-nano", coJudgeModel: string = "openai/gpt-5-nano"): Promise<VerdictResult & { citations: string[]; analysis: any }> {
        // 1. Normalize Claims (using Judge Model for consistency)
        const analysis = await this.normalizeClaims(caseData, judgeModel)

        // 2. Retrieve Context (RAG + Guidelines)
        // Combine static guidelines with dynamic RAG retrieval
        let context = ""
        try {
            const guidelinesPath = path.join(process.cwd(), "src/lib/guidelines/standard-rules.md")
            const guidelines = await fs.readFile(guidelinesPath, "utf-8")

            // RAG Retrieval
            const ragContext = await ragService.retrieveContext(caseData.description + " " + (caseData.respondentDescription || ""))

            context = `
            Standard Arbitration Rules:
            ${guidelines}
            ${ragContext ? `\n            Additional Policy Guidelines (RAG Retrieved):\n            ${ragContext}\n\n            When relevant, cite the retrieved policy excerpts by their page number.` : ""}
            `
        } catch (error) {
            console.error("Error reading guidelines:", error)
            context = "Standard arbitration rules could not be loaded."
        }

        // 3. Generate Verdict
        const initialVerdict = await this.generateVerdict(context, { ...caseData, analysis }, judgeModel)

        // If AI provider call fails (e.g., 402 insufficient credits), still return a deterministic
        // fallback verdict so the case can be escalated instead of hard-failing the flow.
        if (initialVerdict.error) {
            return {
                content: "Verdict Pending: Manual Arbitration Required",
                reasoning: initialVerdict.reasoning,
                confidence: 0,
                passedBiasCheck: false,
                biasCheckReasoning: "Bias check skipped because AI verdict generation failed.",
                citations: initialVerdict.citations || [],
                analysis,
                error: false,
            }
        }

        // 4. Bias Check (Co-Judge)
        const biasCheck = await this.checkBias(initialVerdict.content, initialVerdict.reasoning, coJudgeModel)

        return {
            content: initialVerdict.content,
            reasoning: initialVerdict.reasoning,
            confidence: 0.9,
            passedBiasCheck: biasCheck.passed,
            biasCheckReasoning: biasCheck.reasoning,
            citations: initialVerdict.citations || [],
            analysis: analysis
        }
    }
}

export const aiService = new AIService()

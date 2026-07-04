import fs from "fs"
import path from "path"

function loadEnvFile() {
    const envPath = path.join(process.cwd(), ".env")
    if (!fs.existsSync(envPath)) return
    const content = fs.readFileSync(envPath, "utf-8")
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
        if (!(key in process.env)) process.env[key] = value
    }
}
loadEnvFile()

import { ragService } from "./src/lib/rag-utils"

async function main() {
    const query = "consumer paid for goods online, seller failed to deliver, refund refused"
    const result = await ragService.retrieveContext(query)
    console.log("=== RAG RETRIEVAL RESULT ===")
    console.log(result || "(empty — retrieval failed or no store)")
    console.log("=== LENGTH:", result.length, "===")
}

main().catch(e => {
    console.error(e)
    process.exit(1)
})

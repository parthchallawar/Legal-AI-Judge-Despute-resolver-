import path from "path"
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite"

// Durable checkpoint store for the adjudication graph. Kept in its own SQLite file (separate
// from Prisma's dev.db) so LangGraph's internal tables never collide with the app schema.
// thread_id = caseId, so a paused graph (mediation / evidence) survives server restarts.
let saver: SqliteSaver | null = null

export function getCheckpointer(): SqliteSaver {
    if (!saver) {
        const dbPath = path.join(process.cwd(), "graph-checkpoints.sqlite")
        saver = SqliteSaver.fromConnString(dbPath)
    }
    return saver
}

// Wipe a case's checkpoint history so a fresh adjudication starts from START rather than
// resuming a previous (possibly completed or interrupted) run.
export async function clearThread(caseId: string): Promise<void> {
    try {
        await getCheckpointer().deleteThread(caseId)
    } catch (error) {
        // On a brand-new store the checkpoint tables do not exist yet (they are created lazily
        // on the first graph write), so there is nothing to clear — that case is expected.
        const message = error instanceof Error ? error.message : String(error)
        if (!message.includes("no such table")) {
            console.error(`[checkpointer] clearThread(${caseId}) failed:`, error)
        }
    }
}

export interface StatusMeta {
    badge: string
    dot: string
}

export const STATUS_META: Record<string, StatusMeta> = {
    FILED: { badge: "border-zinc-500/30 bg-zinc-500/15 text-zinc-300", dot: "bg-zinc-400" },
    AWAITING_RESPONSE: { badge: "border-zinc-500/30 bg-zinc-500/15 text-zinc-300", dot: "bg-zinc-400" },
    AWAITING_VERDICT: { badge: "border-sky-500/30 bg-sky-500/15 text-sky-300", dot: "bg-sky-400" },
    AI_REVIEWED: { badge: "border-violet-500/30 bg-violet-500/15 text-violet-300", dot: "bg-violet-400" },
    AI_REVIEW: { badge: "border-zinc-500/30 bg-zinc-500/15 text-zinc-300", dot: "bg-zinc-400" },
    RESOLVED: { badge: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300", dot: "bg-emerald-400" },
    ESCALATED: { badge: "border-amber-500/30 bg-amber-500/15 text-amber-300", dot: "bg-amber-400" },
}

export const DEFAULT_STATUS_META: StatusMeta = {
    badge: "border-zinc-500/30 bg-zinc-500/15 text-zinc-300",
    dot: "bg-zinc-400",
}

export function getStatusMeta(status: string): StatusMeta {
    return STATUS_META[status] ?? DEFAULT_STATUS_META
}

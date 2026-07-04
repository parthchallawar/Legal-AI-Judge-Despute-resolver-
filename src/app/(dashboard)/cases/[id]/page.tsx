import { Fragment } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { AIJudgePanel } from "@/components/case/ai-judge-panel"
import { cn } from "@/lib/utils"
import { getStatusMeta } from "@/lib/case-status"
import {
    FileText,
    ScrollText,
    MessageSquare,
    Gavel,
    AlertTriangle,
    RotateCcw,
    Clock,
    Paperclip,
    Scale,
    ExternalLink,
    Image as ImageIcon,
    File as FileIcon,
} from "lucide-react"

const ACTION_META: Record<string, { icon: typeof FileText; ring: string; icon_color: string }> = {
    CASE_FILED: { icon: FileText, ring: "border-zinc-500/30 bg-zinc-500/15", icon_color: "text-zinc-300" },
    RESPONSE_SUBMITTED: { icon: MessageSquare, ring: "border-sky-500/30 bg-sky-500/15", icon_color: "text-sky-300" },
    AI_VERDICT_GENERATED: { icon: Gavel, ring: "border-violet-500/30 bg-violet-500/15", icon_color: "text-violet-300" },
    CASE_ESCALATED: { icon: AlertTriangle, ring: "border-amber-500/30 bg-amber-500/15", icon_color: "text-amber-300" },
    VERDICT_RESET: { icon: RotateCcw, ring: "border-zinc-500/30 bg-zinc-500/15", icon_color: "text-zinc-300" },
}
const DEFAULT_ACTION_META = { icon: Clock, ring: "border-white/10 bg-white/5", icon_color: "text-muted-foreground" }

function getDocIcon(url: string) {
    const ext = url.split(".").pop()?.toLowerCase() ?? ""
    if (ext === "pdf") return FileText
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return ImageIcon
    return FileIcon
}

function AuditLogDetails({ details }: { details: string }) {
    // Bias-check / AI-generated details often come back as "Intro sentence: - Point one - Point two"
    // rather than actual line breaks, so render dash-separated segments as a bullet list.
    const segments = details.split(/\s+-\s+(?=[A-Z])/)

    if (segments.length <= 1) {
        return <p className="text-xs text-muted-foreground leading-relaxed">{details}</p>
    }

    const [intro, ...points] = segments

    return (
        <div className="text-xs text-muted-foreground leading-relaxed space-y-1.5">
            {intro && <p>{intro}</p>}
            <ul className="list-disc pl-4 space-y-1">
                {points.map((point, i) => (
                    <li key={i}>{point.replace(/\.$/, "")}</li>
                ))}
            </ul>
        </div>
    )
}

export default async function CaseDetailPage({ params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return null
    }

    const caseData = await prisma.case.findUnique({
        where: { id: params.id },
        include: {
            claimant: true,
            respondent: true,
            documents: true,
            verdicts: true,
            auditLogs: {
                orderBy: { timestamp: "desc" },
            },
        },
    })

    if (!caseData) {
        notFound()
    }

    // Access control
    const isParticipant =
        caseData.claimantId === session.user.id ||
        caseData.respondentId === session.user.id ||
        session.user.role === "ADMIN" ||
        session.user.role === "ARBITRATOR"

    if (!isParticipant) {
        return <div className="p-8">Unauthorized access to this case.</div>
    }

    const isRespondent = session.user.id === caseData.respondentId
    const canRespond = isRespondent && (caseData.status === "FILED" || caseData.status === "AWAITING_RESPONSE")
    const hasVerdict = caseData.status === "RESOLVED" || caseData.status === "AI_REVIEWED" || caseData.status === "ESCALATED"
    const statusMeta = getStatusMeta(caseData.status)

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Case File</p>
                    <h2 className="text-3xl font-bold tracking-tight">{caseData.title}</h2>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{caseData.id}</p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge className={cn("gap-1.5 border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide", statusMeta.badge)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", statusMeta.dot)} />
                        {caseData.status.replace(/_/g, " ")}
                    </Badge>
                    {hasVerdict && (
                        <Button asChild variant="gradient">
                            <a href={`/cases/${caseData.id}/verdict`} className="gap-2">
                                <Gavel className="h-4 w-4" />
                                View Verdict
                            </a>
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base">Case Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div>
                            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-sky-400/80">Claimant&apos;s Description</p>
                            <p className="whitespace-pre-wrap border-l-2 border-sky-500/30 pl-3 text-sm leading-relaxed text-muted-foreground">
                                {caseData.description}
                            </p>
                        </div>
                        {caseData.respondentDescription && (
                            <div>
                                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber-400/80">Respondent&apos;s Response</p>
                                <p className="whitespace-pre-wrap border-l-2 border-amber-500/30 pl-3 text-sm leading-relaxed text-muted-foreground">
                                    {caseData.respondentDescription}
                                </p>
                            </div>
                        )}
                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-500/30 bg-sky-500/10 text-sm font-semibold text-sky-300">
                                    {caseData.claimant.name?.[0]?.toUpperCase() || "?"}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">Claimant</p>
                                    <p className="truncate text-sm font-medium">{caseData.claimant.name}</p>
                                    <p className="truncate text-xs text-muted-foreground">{caseData.claimant.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-sm font-semibold text-amber-300">
                                    {caseData.respondent?.name?.[0]?.toUpperCase() || "?"}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">Respondent</p>
                                    <p className="truncate text-sm font-medium">{caseData.respondent?.name || "Pending"}</p>
                                    <p className="truncate text-xs text-muted-foreground">{caseData.respondent?.email}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                        <ScrollText className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base">Timeline & Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="max-h-[320px] overflow-y-auto pr-2">
                            {caseData.auditLogs.map((log: any, idx: number) => {
                                const meta = ACTION_META[log.action] ?? DEFAULT_ACTION_META
                                const Icon = meta.icon
                                const isLast = idx === caseData.auditLogs.length - 1
                                return (
                                    <div key={log.id} className={cn("relative flex gap-3", !isLast && "pb-6")}>
                                        {!isLast && <span className="absolute left-4 top-8 bottom-0 w-px bg-white/10" />}
                                        <span className={cn("relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border", meta.ring)}>
                                            <Icon className={cn("h-3.5 w-3.5", meta.icon_color)} />
                                        </span>
                                        <div className="min-w-0 flex-1 space-y-1 pb-6 pt-0.5 last:pb-0">
                                            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                                <span className="text-sm font-semibold">{log.action.replace(/_/g, " ")}</span>
                                                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                            <AuditLogDetails details={log.details} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* AI Analysis Section */}
            {
                caseData.analysis && (
                    <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/[0.04] to-transparent">
                        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10">
                                <Scale className="h-4 w-4 text-violet-300" />
                            </span>
                            <div className="space-y-1">
                                <CardTitle className="text-base">AI Case Analysis</CardTitle>
                                <CardDescription>Structured breakdown of arguments and claims from both parties.</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {(() => {
                                const analysis = JSON.parse(caseData.analysis)
                                const claimantArgs = analysis.claimantArguments || []
                                const respondentArgs = analysis.respondentArguments || []
                                const rowCount = Math.max(claimantArgs.length, respondentArgs.length)

                                const renderArg = (arg: any, side: "claimant" | "respondent") => (
                                    <div
                                        className={cn(
                                            "h-full rounded-lg border border-l-4 border-white/10 bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.05]",
                                            side === "claimant" ? "border-l-sky-500/50" : "border-l-amber-500/50"
                                        )}
                                    >
                                        <p className="mb-2 text-sm font-medium">{arg.claim}</p>
                                        {arg.evidence && arg.evidence !== "None" && (
                                            <Badge
                                                variant="outline"
                                                className="h-auto w-full max-w-full justify-start gap-1.5 whitespace-normal break-words rounded-md py-1 text-left text-xs"
                                            >
                                                <Paperclip className="h-3 w-3 shrink-0" />
                                                {arg.evidence}
                                            </Badge>
                                        )}
                                    </div>
                                )

                                return (
                                    <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
                                        <div className="flex items-center gap-2 border-b border-sky-500/20 pb-2">
                                            <span className="h-2 w-2 rounded-full bg-sky-400" />
                                            <h4 className="text-sm font-semibold uppercase tracking-wide text-sky-300">Claimant&apos;s Arguments</h4>
                                        </div>
                                        <div className="flex items-center gap-2 border-b border-amber-500/20 pb-2">
                                            <span className="h-2 w-2 rounded-full bg-amber-400" />
                                            <h4 className="text-sm font-semibold uppercase tracking-wide text-amber-300">Respondent&apos;s Arguments</h4>
                                        </div>
                                        {Array.from({ length: rowCount }).map((_, i) => (
                                            <Fragment key={i}>
                                                <div>{claimantArgs[i] ? renderArg(claimantArgs[i], "claimant") : null}</div>
                                                <div>{respondentArgs[i] ? renderArg(respondentArgs[i], "respondent") : null}</div>
                                            </Fragment>
                                        ))}
                                    </div>
                                )
                            })()}
                        </CardContent>
                    </Card>
                )
            }

            {/* Documents Section */}
            <Card>
                <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">Documents & Evidence</CardTitle>
                </CardHeader>
                <CardContent>
                    {caseData.documents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 py-8 text-center">
                            <Paperclip className="h-5 w-5 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {caseData.documents.map((doc: any) => {
                                const DocIcon = getDocIcon(doc.url)
                                return (
                                    <li
                                        key={doc.id}
                                        className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5">
                                                <DocIcon className="h-4 w-4 text-muted-foreground" />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium">{doc.name || doc.url.split("/").pop()}</p>
                                                <Badge variant="outline" className="mt-0.5 text-[10px]">{doc.type}</Badge>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" asChild className="shrink-0 gap-1.5">
                                            <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="h-3.5 w-3.5" />
                                                View
                                            </a>
                                        </Button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </CardContent>
            </Card>

            {/* Respondent Action Panel */}
            {
                canRespond && (
                    <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/[0.05] to-transparent">
                        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
                                <MessageSquare className="h-4 w-4 text-amber-300" />
                            </span>
                            <div className="space-y-1">
                                <CardTitle className="text-base">Submit Your Response</CardTitle>
                                <CardDescription>As the respondent, please provide your side of the story and any supporting evidence.</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <AIJudgePanel
                                caseId={caseData.id}
                                verdicts={caseData.verdicts}
                                status={caseData.status}
                                mode="RESPONDENT" // Pass mode to component
                            />
                        </CardContent>
                    </Card>
                )
            }

            {/* Admin/Arbitrator Action Panel */}
            {
                !canRespond && !hasVerdict && (session.user.role === "ADMIN" || session.user.role === "ARBITRATOR") && (
                    <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/[0.05] to-transparent">
                        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10">
                                <Gavel className="h-4 w-4 text-violet-300" />
                            </span>
                            <div className="space-y-1">
                                <CardTitle className="text-base">Arbitrator Actions</CardTitle>
                                <CardDescription>Review the case and generate a verdict.</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <AIJudgePanel
                                caseId={caseData.id}
                                verdicts={caseData.verdicts}
                                status={caseData.status}
                                mode="ARBITRATOR"
                                userRole={session.user.role}
                            />
                        </CardContent>
                    </Card>
                )
            }
        </div>
    )
}

export const dynamic = "force-dynamic"

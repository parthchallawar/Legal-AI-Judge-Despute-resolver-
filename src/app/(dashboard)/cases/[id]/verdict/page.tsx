import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { getStatusMeta } from "@/lib/case-status"
import { ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck, Scale, Gauge, CalendarClock } from "lucide-react"

// Highlights decision-critical terms (confidence/percentages, human review, bias, escalation,
// money amounts) inline within verdict/reasoning text, so they're scannable without reading
// every sentence in full.
const HIGHLIGHT_PATTERN = new RegExp(
    [
        "\\d{1,3}(?:\\.\\d+)?\\s?%",                 // percentages, e.g. "54%"
        "[₹$]\\s?[\\d,]+(?:\\.\\d+)?",                // money amounts, e.g. "₹30,990"
        "confidence",
        "human\\s+(?:review|arbitrator)",
        "bias(?:ed)?(?:\\s+check)?",
        "escalated",
    ].join("|"),
    "gi"
)

function highlightClass(match: string): string {
    if (/%$/.test(match)) return "bg-violet-500/15 text-violet-200"
    if (/^[₹$]/.test(match)) return "bg-emerald-500/15 text-emerald-200"
    if (/confidence/i.test(match)) return "bg-violet-500/15 text-violet-200"
    return "bg-amber-500/15 text-amber-200" // human review/arbitrator, bias, escalated
}

function HighlightedText({ text }: { text: string }) {
    if (!text) return null
    const nodes: React.ReactNode[] = []
    let lastIndex = 0
    let key = 0

    for (const match of text.matchAll(HIGHLIGHT_PATTERN)) {
        const idx = match.index ?? 0
        if (idx > lastIndex) nodes.push(text.slice(lastIndex, idx))
        nodes.push(
            <span key={key++} className={cn("rounded px-1 py-0.5 font-semibold", highlightClass(match[0]))}>
                {match[0]}
            </span>
        )
        lastIndex = idx + match[0].length
    }
    if (lastIndex < text.length) nodes.push(text.slice(lastIndex))

    return <>{nodes}</>
}

function ReasoningBody({ text }: { text: string }) {
    // The judge model tends to number its reasoning inline, e.g. "(1) First point. (2) Second point."
    // rather than using real line breaks, so split those out into a readable ordered list.
    const matches = [...text.matchAll(/\((\d+)\)\s*/g)]

    if (matches.length < 2) {
        return <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"><HighlightedText text={text} /></p>
    }

    const intro = text.slice(0, matches[0].index).trim()
    const points: string[] = []
    for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index! + matches[i][0].length
        const end = i + 1 < matches.length ? matches[i + 1].index! : text.length
        const point = text.slice(start, end).trim()
        if (point) points.push(point)
    }

    return (
        <div className="space-y-3">
            {intro && <p className="text-sm leading-relaxed text-muted-foreground"><HighlightedText text={intro} /></p>}
            <ol className="space-y-3">
                {points.map((point, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold text-foreground/70">
                            {i + 1}
                        </span>
                        <span><HighlightedText text={point} /></span>
                    </li>
                ))}
            </ol>
        </div>
    )
}

export default async function VerdictPage({ params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/login")
    }

    const caseData = await prisma.case.findUnique({
        where: { id: params.id },
        include: {
            verdicts: {
                orderBy: { createdAt: "desc" },
                take: 1
            },
            claimant: true,
            respondent: true,
            // The escalation/finalize step writes a detailed explanation (confidence %, bias
            // check outcome, etc.) into the audit log — reuse it here instead of duplicating
            // that logic, so the verdict page can explain *why* a case isn't final yet.
            auditLogs: {
                where: { action: { in: ["CASE_ESCALATED", "AI_VERDICT_GENERATED"] } },
                orderBy: { timestamp: "desc" },
                take: 1,
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

    const verdict = caseData.verdicts[0]

    if (!verdict) {
        return (
            <div className="max-w-3xl mx-auto py-12 px-4 text-center">
                <ShieldCheck className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-2xl font-bold mb-2">No Verdict Yet</h2>
                <p className="text-muted-foreground mb-6">The AI Arbitrator has not yet issued a decision for this case.</p>
                <Button asChild>
                    <a href={`/cases/${caseData.id}`}>Return to Case Details</a>
                </Button>
            </div>
        )
    }

    const statusMeta = getStatusMeta(caseData.status)
    // Prefer the stored bias-check result; fall back to inferring from status for old verdicts.
    const passedBiasCheck =
        verdict.passedBiasCheck ?? (caseData.status !== "ESCALATED" && caseData.status !== "ESCALATED_TO_HUMAN")
    const citations: string[] = verdict.citations ? JSON.parse(verdict.citations) : []

    // A case is only truly decided once it's RESOLVED (by AI verdict or by settlement). Every
    // other status is the AI's draft/recommendation pending a human — the page must say so
    // clearly instead of presenting it under a "Final Decision" header, which is what caused
    // confusion when a case reads ESCALATED TO HUMAN but the card still said "Final Decision".
    const isFinal = caseData.status === "RESOLVED" || caseData.status === "RESOLVED_BY_SETTLEMENT"
    const escalationDetails = caseData.auditLogs[0]?.details

    const escalationCopy: Record<string, { title: string; body: string }> = {
        ESCALATED: {
            title: "Not a final decision — escalated for bias/fairness concerns",
            body: "The AI co-judge flagged this verdict for bias or a logical flaw that could not be resolved after revision. A human arbitrator must review the case and issue the actual outcome.",
        },
        ESCALATED_TO_HUMAN: {
            title: "Not a final decision — pending human review",
            body: "The AI arbitrator was not confident enough in this verdict to issue it automatically. What's shown below is its recommendation, not a binding decision, until a human arbitrator reviews it.",
        },
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="mb-8">
                <Button variant="ghost" asChild className="mb-4 gap-1.5 pl-0 hover:bg-transparent hover:pl-0 hover:text-foreground">
                    <a href={`/cases/${caseData.id}`}>
                        <ArrowLeft className="h-4 w-4" />
                        Back to Case
                    </a>
                </Button>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Verdict</p>
                        <h1 className="text-3xl font-bold tracking-tight">Arbitration Verdict</h1>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">{caseData.id}</p>
                    </div>
                    <Badge className={cn("gap-1.5 border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide", statusMeta.badge)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", statusMeta.dot)} />
                        {caseData.status.replace(/_/g, " ")}
                    </Badge>
                </div>
            </div>

            <div className="grid gap-6">
                {!isFinal && escalationCopy[caseData.status] && (
                    <Alert className="border-amber-500/30 bg-amber-500/[0.06]">
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                        <AlertTitle>{escalationCopy[caseData.status].title}</AlertTitle>
                        <AlertDescription className="space-y-1.5">
                            <p><HighlightedText text={escalationCopy[caseData.status].body} /></p>
                            {escalationDetails && (
                                <p className="text-xs text-muted-foreground/80"><HighlightedText text={escalationDetails} /></p>
                            )}
                        </AlertDescription>
                    </Alert>
                )}

                <Card className={cn(
                    "shadow-lg",
                    isFinal
                        ? "border-violet-500/20 bg-gradient-to-br from-violet-500/[0.06] to-transparent"
                        : "border-amber-500/20 bg-gradient-to-br from-amber-500/[0.05] to-transparent"
                )}>
                    <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                        <span className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
                            isFinal ? "border-violet-500/30 bg-violet-500/10" : "border-amber-500/30 bg-amber-500/10"
                        )}>
                            <ShieldCheck className={cn("h-5 w-5", isFinal ? "text-violet-300" : "text-amber-300")} />
                        </span>
                        <CardTitle className="text-xl">
                            {isFinal ? "Final Decision" : "AI Recommendation (Pending Human Review)"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xl font-medium leading-relaxed">
                            <HighlightedText text={verdict.content} />
                        </p>
                    </CardContent>
                </Card>

                {citations.length > 0 && (
                    <Card>
                        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                            <Scale className="h-4 w-4 text-muted-foreground" />
                            <div className="space-y-1">
                                <CardTitle className="text-base">Citations & References</CardTitle>
                                <CardDescription>Specific rules and guidelines used to reach this decision.</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {citations.map((citation, index) => (
                                    <span
                                        key={index}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium"
                                    >
                                        <Scale className="h-3 w-3 text-violet-300" />
                                        {citation}
                                    </span>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        <div className="space-y-1">
                            <CardTitle className="text-base">Detailed Reasoning</CardTitle>
                            <CardDescription>The logic applied by the AI Arbitrator based on the provided evidence and guidelines.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <ReasoningBody text={verdict.reasoning ?? ""} />

                        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-5">
                            <span
                                className={cn(
                                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                                    passedBiasCheck
                                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                        : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                )}
                            >
                                {passedBiasCheck ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                                Bias Check {passedBiasCheck ? "Passed" : "Failed"}
                            </span>
                            {verdict.aiConfidence != null && (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-muted-foreground">
                                    <Gauge className="h-3.5 w-3.5" />
                                    Confidence {(verdict.aiConfidence * 100).toFixed(1)}%
                                </span>
                            )}
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-muted-foreground">
                                <CalendarClock className="h-3.5 w-3.5" />
                                Issued {new Date(verdict.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Alert className="border-amber-500/20 bg-amber-500/[0.04]">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <AlertTitle>Important Note</AlertTitle>
                    <AlertDescription>
                        {isFinal
                            ? "This verdict is generated by an AI system. If you believe there has been a critical error, you may request a human review within 7 days."
                            : "This case has not been finally decided. A human arbitrator will review it and the outcome above may change."}
                    </AlertDescription>
                </Alert>
            </div>
        </div>
    )
}

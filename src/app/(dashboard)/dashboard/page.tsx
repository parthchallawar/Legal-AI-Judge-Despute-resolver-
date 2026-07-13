import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, Briefcase, Activity, CheckCircle2, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getStatusMeta } from "@/lib/case-status"

export default async function DashboardPage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        return null
    }

    const whereClause =
        session.user.role === "ARBITRATOR"
            ? {
                status: {
                    not: "DRAFT",
                },
            }
            : {
                OR: [
                    { claimantId: session.user.id },
                    { respondentId: session.user.id },
                ],
            }

    const cases = await prisma.case.findMany({
        where: whereClause,
        orderBy: {
            updatedAt: "desc",
        },
        include: {
            claimant: true,
            respondent: true,
        },
    })

    const RESOLVED_STATUSES = ["RESOLVED", "RESOLVED_BY_SETTLEMENT"]
    const activeCases = cases.filter((c: any) => !RESOLVED_STATUSES.includes(c.status)).length
    const resolvedCases = cases.filter((c: any) => RESOLVED_STATUSES.includes(c.status)).length

    const stats = [
        { label: "Total Cases", value: cases.length, icon: Briefcase, ring: "border-violet-500/30 bg-violet-500/10", color: "text-violet-300" },
        { label: "Active", value: activeCases, icon: Activity, ring: "border-sky-500/30 bg-sky-500/10", color: "text-sky-300" },
        { label: "Resolved", value: resolvedCases, icon: CheckCircle2, ring: "border-emerald-500/30 bg-emerald-500/10", color: "text-emerald-300" },
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Overview</p>
                    <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                </div>
                {session.user.role === "PARTY" && (
                    <Link href="/cases/new">
                        <Button variant="gradient">
                            <Plus className="mr-2 h-4 w-4" /> New Dispute
                        </Button>
                    </Link>
                )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {stats.map((stat) => (
                    <Card key={stat.label}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                            <span className={cn("flex h-8 w-8 items-center justify-center rounded-full border", stat.ring)}>
                                <stat.icon className={cn("h-4 w-4", stat.color)} />
                            </span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Cases</CardTitle>
                        <CardDescription>
                            You have {cases.length} total case{cases.length === 1 ? "" : "s"}.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {cases.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 py-10 text-center">
                                <Briefcase className="h-5 w-5 text-muted-foreground/40" />
                                <p className="text-sm text-muted-foreground">
                                    {session.user.role === "PARTY" ? "No cases yet — file your first dispute to get started." : "No cases to review yet."}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {cases.map((c: any) => {
                                    const statusMeta = getStatusMeta(c.status)
                                    return (
                                        <Link
                                            href={`/cases/${c.id}`}
                                            key={c.id}
                                            className="group flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
                                        >
                                            <div className="min-w-0 space-y-1">
                                                <p className="truncate font-medium group-hover:underline">{c.title}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {session.user.role === "ARBITRATOR"
                                                        ? `${c.claimant?.name || "Unknown"} vs. ${c.respondent?.name || "Unknown"}`
                                                        : `vs. ${c.claimantId === session.user.id ? c.respondent?.name || "Unknown" : c.claimant.name}`}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2">
                                                <Badge className={cn("gap-1.5 border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide", statusMeta.badge)}>
                                                    <span className={cn("h-1.5 w-1.5 rounded-full", statusMeta.dot)} />
                                                    {c.status.replace(/_/g, " ")}
                                                </Badge>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
                                            </div>
                                        </Link>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export const dynamic = "force-dynamic"

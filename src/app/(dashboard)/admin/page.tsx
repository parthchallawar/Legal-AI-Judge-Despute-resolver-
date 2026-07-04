import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ShieldAlert, Users, FileText, Gavel, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { getStatusMeta } from "@/lib/case-status"

export default async function AdminDashboard() {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
        redirect("/login")
    }

    const users = await prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 20
    })

    const cases = await prisma.case.findMany({
        orderBy: { createdAt: "desc" },
        include: { claimant: true, respondent: true },
        take: 20
    })

    const stats = {
        totalUsers: await prisma.user.count(),
        totalCases: await prisma.case.count(),
        pendingCases: await prisma.case.count({ where: { status: "FILED" } }),
        resolvedCases: await prisma.case.count({ where: { status: "RESOLVED" } })
    }

    const statCards = [
        { label: "Total Users", value: stats.totalUsers, icon: Users, ring: "border-sky-500/30 bg-sky-500/10", color: "text-sky-300" },
        { label: "Total Cases", value: stats.totalCases, icon: FileText, ring: "border-violet-500/30 bg-violet-500/10", color: "text-violet-300" },
        { label: "Pending Cases", value: stats.pendingCases, icon: ShieldAlert, ring: "border-amber-500/30 bg-amber-500/10", color: "text-amber-300" },
        { label: "Resolved Cases", value: stats.resolvedCases, icon: Gavel, ring: "border-emerald-500/30 bg-emerald-500/10", color: "text-emerald-300" },
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Admin</p>
                    <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
                    <p className="text-muted-foreground">System overview and management.</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat) => (
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

            <Tabs defaultValue="cases" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="cases">Recent Cases</TabsTrigger>
                    <TabsTrigger value="users">Recent Users</TabsTrigger>
                </TabsList>
                <TabsContent value="cases" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Cases</CardTitle>
                            <CardDescription>Latest disputes filed in the system.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {cases.map((c) => {
                                    const statusMeta = getStatusMeta(c.status)
                                    return (
                                        <a
                                            key={c.id}
                                            href={`/cases/${c.id}`}
                                            className="group flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate font-medium group-hover:underline">{c.title}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {c.claimant.name} vs {c.respondent?.name || "Pending"}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2">
                                                <Badge className={cn("gap-1.5 border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide", statusMeta.badge)}>
                                                    <span className={cn("h-1.5 w-1.5 rounded-full", statusMeta.dot)} />
                                                    {c.status.replace(/_/g, " ")}
                                                </Badge>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
                                            </div>
                                        </a>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="users" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Users</CardTitle>
                            <CardDescription>Newest members of the platform.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {users.map((u) => (
                                    <div key={u.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-foreground/70">
                                                {u.name?.[0]?.toUpperCase() || "?"}
                                            </div>
                                            <div>
                                                <p className="font-medium">{u.name || "No Name"}</p>
                                                <p className="text-sm text-muted-foreground">{u.email}</p>
                                            </div>
                                        </div>
                                        <Badge
                                            className={cn(
                                                "border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                                                u.role === "ADMIN"
                                                    ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
                                                    : "border-white/10 bg-white/5 text-muted-foreground"
                                            )}
                                        >
                                            {u.role}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"

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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                {session.user.role === "PARTY" && (
                    <Link href="/cases/new">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> New Dispute
                        </Button>
                    </Link>
                )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{cases.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {cases.filter((c: any) => c.status !== "RESOLVED").length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Resolved</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {cases.filter((c: any) => c.status === "RESOLVED").length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Cases</CardTitle>
                        <CardDescription>
                            You have {cases.length} total cases.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {cases.length === 0 ? (
                                <div className="text-center text-muted-foreground">No cases found.</div>
                            ) : (
                                cases.map((c: any) => (
                                    <div key={c.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                        <div className="space-y-1">
                                            <Link href={`/cases/${c.id}`} className="font-medium hover:underline">
                                                {c.title}
                                            </Link>
                                            <p className="text-sm text-muted-foreground">
                                                {session.user.role === "ARBITRATOR"
                                                    ? `${c.claimant?.name || "Unknown"} vs. ${c.respondent?.name || "Unknown"}`
                                                    : `vs. ${c.claimantId === session.user.id ? c.respondent?.name || "Unknown" : c.claimant.name}`}
                                            </p>
                                        </div>
                                        <Badge variant={c.status === "RESOLVED" ? "secondary" : "default"}>
                                            {c.status}
                                        </Badge>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export const dynamic = "force-dynamic"

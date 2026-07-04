import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ShieldAlert, Users, FileText, Gavel } from "lucide-react"

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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
                    <p className="text-muted-foreground">System overview and management.</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalUsers}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalCases}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Cases</CardTitle>
                        <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.pendingCases}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Resolved Cases</CardTitle>
                        <Gavel className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.resolvedCases}</div>
                    </CardContent>
                </Card>
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
                            <div className="space-y-4">
                                {cases.map((c) => (
                                    <div key={c.id} className="flex items-center justify-between p-4 border rounded-lg">
                                        <div>
                                            <p className="font-medium">{c.title}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {c.claimant.name} vs {c.respondent?.name || "Pending"}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline">{c.status}</Badge>
                                            <Button variant="ghost" size="sm" asChild>
                                                <a href={`/cases/${c.id}`}>View</a>
                                            </Button>
                                        </div>
                                    </div>
                                ))}
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
                            <div className="space-y-4">
                                {users.map((u) => (
                                    <div key={u.id} className="flex items-center justify-between p-4 border rounded-lg">
                                        <div>
                                            <p className="font-medium">{u.name || "No Name"}</p>
                                            <p className="text-sm text-muted-foreground">{u.email}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={u.role === "ADMIN" ? "destructive" : "secondary"}>
                                                {u.role}
                                            </Badge>
                                        </div>
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

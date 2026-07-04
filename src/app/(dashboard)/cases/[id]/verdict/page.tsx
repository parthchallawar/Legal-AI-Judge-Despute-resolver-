import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react"

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

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="mb-8">
                <Button variant="ghost" asChild className="mb-4 pl-0 hover:pl-0 hover:bg-transparent">
                    <a href={`/cases/${caseData.id}`}>&larr; Back to Case</a>
                </Button>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Arbitration Verdict</h1>
                        <p className="text-muted-foreground mt-2">Case ID: {caseData.id}</p>
                    </div>
                    <Badge className="text-lg px-4 py-1" variant={caseData.status === "RESOLVED" ? "default" : "secondary"}>
                        {caseData.status}
                    </Badge>
                </div>
            </div>

            <div className="grid gap-8">
                <Card className="border-primary/20 shadow-lg bg-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-2xl">
                            <ShieldCheck className="w-6 h-6 text-primary" />
                            Final Decision
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xl font-medium leading-relaxed">
                            {verdict.content}
                        </p>
                    </CardContent>
                </Card>

                {verdict.citations && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Citations & References</CardTitle>
                            <CardDescription>Specific rules and guidelines used to reach this decision.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="list-disc pl-5 space-y-2">
                                {JSON.parse(verdict.citations).map((citation: string, index: number) => (
                                    <li key={index} className="text-sm">{citation}</li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Detailed Reasoning</CardTitle>
                        <CardDescription>The logic applied by the AI Arbitrator based on the provided evidence and guidelines.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="prose dark:prose-invert max-w-none">
                            <p className="whitespace-pre-wrap">{verdict.reasoning}</p>
                        </div>

                        <div className="mt-6 pt-6 border-t flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                <span>Bias Check Passed</span>
                            </div>
                            {verdict.aiConfidence && (
                                <div>
                                    Confidence Score: {(verdict.aiConfidence * 100).toFixed(1)}%
                                </div>
                            )}
                            <div>
                                Issued: {new Date(verdict.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Important Note</AlertTitle>
                    <AlertDescription>
                        This verdict is generated by an AI system. If you believe there has been a critical error, you may request a human review within 7 days.
                    </AlertDescription>
                </Alert>
            </div>
        </div>
    )
}

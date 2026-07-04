import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { AIJudgePanel } from "@/components/case/ai-judge-panel"

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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{caseData.title}</h2>
                    <p className="text-muted-foreground">Case ID: {caseData.id}</p>
                </div>
                <div className="flex items-center gap-4">
                    <Badge className="text-lg px-4 py-1">{caseData.status}</Badge>
                    {hasVerdict && (
                        <Button asChild variant="default">
                            <a href={`/cases/${caseData.id}/verdict`}>View Verdict</a>
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Case Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <h4 className="font-semibold">Description (Claimant)</h4>
                            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{caseData.description}</p>
                        </div>
                        {caseData.respondentDescription && (
                            <>
                                <Separator />
                                <div>
                                    <h4 className="font-semibold">Response (Respondent)</h4>
                                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{caseData.respondentDescription}</p>
                                </div>
                            </>
                        )}
                        <Separator />
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h4 className="font-semibold">Claimant</h4>
                                <p className="text-sm">{caseData.claimant.name}</p>
                                <p className="text-xs text-muted-foreground">{caseData.claimant.email}</p>
                            </div>
                            <div>
                                <h4 className="font-semibold">Respondent</h4>
                                <p className="text-sm">{caseData.respondent?.name || "Pending"}</p>
                                <p className="text-xs text-muted-foreground">{caseData.respondent?.email}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Timeline & Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                            {caseData.auditLogs.map((log: any) => (
                                <div key={log.id} className="flex flex-col space-y-1 border-l-2 border-gray-200 pl-4 pb-4 last:pb-0">
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </span>
                                    <span className="font-medium text-sm">{log.action}</span>
                                    <span className="text-xs text-gray-500">{log.details}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>



            {/* AI Analysis Section */}
            {
                caseData.analysis && (
                    <Card className="border-indigo-500/20 bg-indigo-50/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="text-indigo-600 dark:text-indigo-400">AI Case Analysis</span>
                            </CardTitle>
                            <CardDescription>Structured breakdown of arguments and claims from both parties.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-lg border-b pb-2">Claimant's Arguments</h4>
                                    {JSON.parse(caseData.analysis).claimantArguments?.map((arg: any, i: number) => (
                                        <div key={i} className="bg-background p-4 rounded-lg border shadow-sm">
                                            <p className="text-sm font-medium mb-2">{arg.claim}</p>
                                            {arg.evidence && arg.evidence !== "None" && (
                                                <Badge variant="outline" className="text-xs">
                                                    Evidence: {arg.evidence}
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-lg border-b pb-2">Respondent's Arguments</h4>
                                    {JSON.parse(caseData.analysis).respondentArguments?.map((arg: any, i: number) => (
                                        <div key={i} className="bg-background p-4 rounded-lg border shadow-sm">
                                            <p className="text-sm font-medium mb-2">{arg.claim}</p>
                                            {arg.evidence && arg.evidence !== "None" && (
                                                <Badge variant="outline" className="text-xs">
                                                    Evidence: {arg.evidence}
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )
            }

            {/* Documents Section */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Documents & Evidence</CardTitle>
                </CardHeader>
                <CardContent>
                    {caseData.documents.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                    ) : (
                        <ul className="space-y-2">
                            {caseData.documents.map((doc: any) => (
                                <li key={doc.id} className="flex items-center justify-between p-2 border rounded bg-muted/20">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">{doc.name || doc.url}</span>
                                        <Badge variant="outline" className="text-xs">{doc.type}</Badge>
                                    </div>
                                    <Button variant="ghost" size="sm" asChild>
                                        <a href={doc.url} target="_blank" rel="noopener noreferrer">View</a>
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            {/* Respondent Action Panel */}
            {
                canRespond && (
                    <Card className="border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/10">
                        <CardHeader>
                            <CardTitle>Submit Your Response</CardTitle>
                            <CardDescription>As the respondent, please provide your side of the story and any supporting evidence.</CardDescription>
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
                    <Card className="border-purple-500/20 bg-purple-50/50 dark:bg-purple-950/10">
                        <CardHeader>
                            <CardTitle>Arbitrator Actions</CardTitle>
                            <CardDescription>Review the case and generate a verdict.</CardDescription>
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
        </div >
    )
}

export const dynamic = "force-dynamic"

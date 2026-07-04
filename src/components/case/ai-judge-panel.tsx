"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Loader2, Bot, Settings2 } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface Verdict {
    id: string
    content: string
    reasoning: string | null
    aiConfidence: number | null
    isHuman: boolean
    createdAt: Date
}

interface AIJudgePanelProps {
    caseId: string
    verdicts: Verdict[]
    status: string
    mode?: "RESPONDENT" | "ARBITRATOR" | "VIEW"
    userRole?: string
}

export function AIJudgePanel({ caseId, verdicts, status, mode = "VIEW", userRole }: AIJudgePanelProps) {
    const defaultModels = [
        { id: "openai/gpt-5-nano", name: "GPT-5 Nano" },
        { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
    ]

    const [isLoading, setIsLoading] = useState(false)
    const [description, setDescription] = useState("")
    const [file, setFile] = useState<File | null>(null)
    const [judgeModel, setJudgeModel] = useState("openai/gpt-5-nano")
    const [coJudgeModel, setCoJudgeModel] = useState("openai/gpt-5-nano")
    const [availableModels, setAvailableModels] = useState<{ id: string, name: string }[]>(defaultModels)
    const [isConfigOpen, setIsConfigOpen] = useState(false)
    const router = useRouter()

    useEffect(() => {
        const fetchModels = async () => {
            try {
                const res = await fetch("/api/admin/settings")
                if (res.ok) {
                    const data = await res.json()
                    if (data.availableModels && typeof data.availableModels === "string") {
                        const ids = data.availableModels
                            .split(",")
                            .map((m: string) => m.trim())
                            .filter(Boolean)

                        const uniqueIds: string[] = Array.from(new Set<string>(ids))
                        const models = uniqueIds.map((id: string) => ({ id, name: id }))
                        setAvailableModels(models)

                        // Set defaults if configured
                        if (data.judgeModel) setJudgeModel(data.judgeModel)
                        if (data.coJudgeModel) setCoJudgeModel(data.coJudgeModel)
                    } else {
                        setAvailableModels(defaultModels)
                    }
                } else {
                    setAvailableModels(defaultModels)
                }
            } catch (error) {
                console.error("Failed to load models", error)
                setAvailableModels(defaultModels)
            }
        }
        fetchModels()
    }, [])

    const handleGenerateVerdict = async () => {
        setIsLoading(true)
        try {
            const response = await fetch(`/api/cases/${caseId}/verdict`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ judgeModel, coJudgeModel }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.message || "Failed to generate verdict")
            }

            toast.success("AI Verdict generated")
            router.refresh()
        } catch (error) {
            // @ts-ignore
            toast.error(error.message || "Something went wrong")
        } finally {
            setIsLoading(false)
        }
    }

    const handleResetVerdict = async () => {
        if (!confirm("Are you sure you want to reset this verdict? This action cannot be undone.")) return

        setIsLoading(true)
        try {
            const res = await fetch(`/api/cases/${caseId}/verdict`, {
                method: "DELETE",
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.message || "Failed to reset verdict")
            }

            toast.success("Verdict reset successfully")
            router.refresh()
        } catch (error) {
            // @ts-ignore
            toast.error(error.message || "Something went wrong")
        } finally {
            setIsLoading(false)
        }
    }

    const handleSubmitResponse = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            let documents = []
            if (file) {
                const formData = new FormData()
                formData.append("file", file)
                const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
                if (!uploadRes.ok) throw new Error("Upload failed")
                const upload = await uploadRes.json()
                documents.push({ url: upload.url, name: upload.name })
            }

            const res = await fetch(`/api/cases/${caseId}/respond`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description, documents }),
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.message || "Failed to submit response")
            }

            toast.success("Response submitted successfully")
            router.refresh()
        } catch (error) {
            // @ts-ignore
            toast.error(error.message || "Something went wrong")
        } finally {
            setIsLoading(false)
        }
    }

    if (mode === "RESPONDENT") {
        return (
            <form onSubmit={handleSubmitResponse} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Your Defense / Response</label>
                    <textarea
                        className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Explain your side of the story..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Evidence (Optional)</label>
                    <input
                        type="file"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                </div>
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                        </>
                    ) : (
                        "Submit Response"
                    )}
                </Button>
            </form>
        )
    }

    if (mode === "ARBITRATOR") {
        return (
            <div className="flex flex-col items-center justify-center p-6 space-y-4">
                <Bot className="h-12 w-12 text-primary/80" />
                <div className="text-center">
                    <h3 className="text-lg font-medium">Ready to Adjudicate?</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                        Generate an AI verdict based on the claims, response, and evidence provided.
                    </p>
                </div>

                <Collapsible
                    open={isConfigOpen}
                    onOpenChange={setIsConfigOpen}
                    className="w-full max-w-xs space-y-2"
                >
                    <div className="flex items-center justify-center">
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-full flex items-center gap-2">
                                <Settings2 className="h-4 w-4" />
                                Configure Models
                            </Button>
                        </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="space-y-4 border rounded-md p-4 bg-muted/20">
                        <div className="space-y-2">
                            <Label>Judge Model (Verdict)</Label>
                            <Select value={judgeModel} onValueChange={setJudgeModel}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select judge model" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableModels.map((m) => (
                                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Co-Judge Model (Bias Check)</Label>
                            <Select value={coJudgeModel} onValueChange={setCoJudgeModel}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select co-judge model" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableModels.map((m) => (
                                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CollapsibleContent>
                </Collapsible>

                <Button onClick={handleGenerateVerdict} disabled={isLoading} size="lg">
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Analyzing Case...
                        </>
                    ) : (
                        "Generate AI Verdict"
                    )}
                </Button>

                {userRole === "ADMIN" && verdicts.length > 0 && (
                    <div className="pt-4 border-t w-full flex justify-center">
                        <Button variant="destructive" size="sm" onClick={handleResetVerdict} disabled={isLoading}>
                            Reset Verdict (Admin)
                        </Button>
                    </div>
                )}
            </div>
        )
    }

    // Default View (just showing status or nothing if handled by page)
    return null
}

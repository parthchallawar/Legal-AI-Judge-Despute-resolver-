"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Loader2, Bot, Settings2, Paperclip } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
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

// Stable module-scope constant so it can be safely referenced from effects without re-triggering.
const defaultModels = [
    { id: "openai/gpt-5-nano", name: "GPT-5 Nano" },
    { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
]

export function AIJudgePanel({ caseId, verdicts, status, mode = "VIEW", userRole }: AIJudgePanelProps) {
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
                    <Label>Your defense / response</Label>
                    <Textarea
                        className="min-h-[120px]"
                        placeholder="Explain your side of the story..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                        <Paperclip className="h-3.5 w-3.5" />
                        Evidence (Optional)
                    </Label>
                    <Input
                        type="file"
                        className="cursor-pointer file:text-foreground"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                </div>
                <Button type="submit" variant="gradient" disabled={isLoading}>
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                        </>
                    ) : (
                        "Submit response"
                    )}
                </Button>
            </form>
        )
    }

    if (mode === "ARBITRATOR") {
        return (
            <div className="flex flex-col items-center justify-center space-y-4 p-6">
                <span className="flex h-16 w-16 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10">
                    <Bot className="h-8 w-8 text-violet-300" />
                </span>
                <div className="text-center">
                    <h3 className="text-lg font-medium">Ready to adjudicate?</h3>
                    <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
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
                            <Button variant="ghost" size="sm" className="flex w-full items-center gap-2">
                                <Settings2 className="h-4 w-4" />
                                Configure models
                            </Button>
                        </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="space-y-4 rounded-md border border-white/10 bg-white/[0.02] p-4">
                        <div className="space-y-2">
                            <Label>Judge model (verdict)</Label>
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
                            <Label>Co-judge model (bias check)</Label>
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

                <Button onClick={handleGenerateVerdict} variant="gradient" disabled={isLoading} size="lg">
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Analyzing case...
                        </>
                    ) : (
                        "Generate AI verdict"
                    )}
                </Button>

                {userRole === "ADMIN" && verdicts.length > 0 && (
                    <div className="flex w-full justify-center border-t border-white/10 pt-4">
                        <Button variant="destructive" size="sm" onClick={handleResetVerdict} disabled={isLoading}>
                            Reset verdict (Admin)
                        </Button>
                    </div>
                )}
            </div>
        )
    }

    // Default View (just showing status or nothing if handled by page)
    return null
}

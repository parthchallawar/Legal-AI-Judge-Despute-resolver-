"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Loader2, Check, X, Handshake, Paperclip, Upload } from "lucide-react"

// Feature 2: party accepts/rejects an AI-mediated settlement.
export function SettlementPanel({
    caseId,
    proposal,
    terms,
    myResponse,
    otherPartyResponse,
    otherPartyLabel,
}: {
    caseId: string
    proposal: string
    terms: string[]
    myResponse: string
    otherPartyResponse: string
    otherPartyLabel: "Claimant" | "Respondent"
}) {
    const [isLoading, setIsLoading] = useState<null | "ACCEPTED" | "REJECTED">(null)
    const router = useRouter()

    const respond = async (decision: "ACCEPTED" | "REJECTED") => {
        setIsLoading(decision)
        try {
            const res = await fetch(`/api/cases/${caseId}/settlement`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ decision }),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.message || "Failed to submit response")
            }
            const data = await res.json()
            toast.success(data.waiting ? "Response recorded — waiting for the other party." : "Settlement resolved.")
            router.refresh()
        } catch (error: any) {
            toast.error(error.message || "Something went wrong")
        } finally {
            setIsLoading(null)
        }
    }

    const alreadyResponded = myResponse !== "PENDING"

    return (
        <div className="space-y-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{proposal}</p>
            {terms.length > 0 && (
                <ul className="space-y-1.5">
                    {terms.map((term, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                            <Handshake className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-300" />
                            <span>{term}</span>
                        </li>
                    ))}
                </ul>
            )}
            {alreadyResponded ? (
                <p className="text-sm font-medium text-muted-foreground">
                    You have {myResponse.toLowerCase()} this settlement.{" "}
                    {otherPartyResponse === "PENDING"
                        ? `Waiting for the ${otherPartyLabel.toLowerCase()} to respond.`
                        : `The ${otherPartyLabel.toLowerCase()} has ${otherPartyResponse.toLowerCase()} it too.`}
                </p>
            ) : (
                <div className="flex gap-3 pt-1">
                    <Button variant="gradient" disabled={!!isLoading} onClick={() => respond("ACCEPTED")}>
                        {isLoading === "ACCEPTED" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        Accept settlement
                    </Button>
                    <Button variant="outline" disabled={!!isLoading} onClick={() => respond("REJECTED")}>
                        {isLoading === "REJECTED" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                        Reject &amp; proceed to verdict
                    </Button>
                </div>
            )}
        </div>
    )
}

// Feature 3: targeted party uploads the evidence the AI requested, which resumes adjudication.
export function EvidencePanel({
    caseId,
    question,
}: {
    caseId: string
    question: string
}) {
    const [file, setFile] = useState<File | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!file) {
            toast.error("Please choose a file to upload.")
            return
        }
        setIsLoading(true)
        try {
            const formData = new FormData()
            formData.append("file", file)
            const uploadRes = await fetch("/api/upload", { method: "POST", body: formData })
            if (!uploadRes.ok) throw new Error("Upload failed")
            const upload = await uploadRes.json()

            const res = await fetch(`/api/cases/${caseId}/evidence`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documents: [{ url: upload.url, name: upload.name }] }),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.message || "Failed to submit evidence")
            }
            toast.success("Evidence submitted — the AI is re-evaluating the case.")
            router.refresh()
        } catch (error: any) {
            toast.error(error.message || "Something went wrong")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <form onSubmit={submit} className="space-y-4">
            <div className="rounded-lg border border-sky-500/20 bg-sky-500/[0.04] p-3">
                <p className="text-sm font-medium text-sky-200">The AI arbitrator requested:</p>
                <p className="mt-1 text-sm text-muted-foreground">{question}</p>
            </div>
            <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" />
                    Upload requested evidence
                </Label>
                <Input
                    type="file"
                    className="cursor-pointer file:text-foreground"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
            </div>
            <Button type="submit" variant="gradient" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Submit evidence
            </Button>
        </form>
    )
}

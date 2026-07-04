"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, Settings2 } from "lucide-react"

export default function AdminSettingsPage() {
    const [isLoading, setIsLoading] = useState(false)
    const [config, setConfig] = useState({
        provider: "openrouter",
        apiKey: "",
        judgeModel: "openai/gpt-5-nano",
        coJudgeModel: "openai/gpt-5-nano",
        availableModels: "openai/gpt-5-nano,anthropic/claude-3.5-sonnet"
    })

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch("/api/admin/settings")
                if (res.ok) {
                    const data = await res.json()
                    if (data.provider) {
                        setConfig(data)
                    }
                }
            } catch (error) {
                console.error("Failed to load settings", error)
            }
        }
        fetchSettings()
    }, [])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            const res = await fetch("/api/admin/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            })

            if (!res.ok) throw new Error("Failed to save settings")

            toast.success("Settings saved successfully")
        } catch (error) {
            toast.error("Failed to save settings")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="container mx-auto py-10">
            <div className="mb-8">
                <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Admin</p>
                <h1 className="text-3xl font-bold">System Settings</h1>
            </div>

            <Card className="max-w-2xl">
                <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10">
                        <Settings2 className="h-5 w-5 text-violet-300" />
                    </span>
                    <div className="space-y-1">
                        <CardTitle>AI Configuration</CardTitle>
                        <CardDescription>Configure the AI provider and models for the platform.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="provider">AI Provider</Label>
                            <Input
                                id="provider"
                                value={config.provider}
                                onChange={(e) => setConfig({ ...config, provider: e.target.value })}
                                disabled // Only OpenRouter for now
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="apiKey">API Key (OpenRouter)</Label>
                            <Input
                                id="apiKey"
                                type="password"
                                value={config.apiKey}
                                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                                placeholder="sk-or-..."
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="judgeModel">Default Judge Model</Label>
                                <Input
                                    id="judgeModel"
                                    value={config.judgeModel}
                                    onChange={(e) => setConfig({ ...config, judgeModel: e.target.value })}
                                    placeholder="openai/gpt-5-nano"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="coJudgeModel">Default Co-Judge Model</Label>
                                <Input
                                    id="coJudgeModel"
                                    value={config.coJudgeModel}
                                    onChange={(e) => setConfig({ ...config, coJudgeModel: e.target.value })}
                                    placeholder="openai/gpt-5-nano"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="availableModels">Available Models (Comma Separated)</Label>
                            <Input
                                id="availableModels"
                                value={config.availableModels}
                                onChange={(e) => setConfig({ ...config, availableModels: e.target.value })}
                                placeholder="model1,model2,model3"
                            />
                            <p className="text-xs text-muted-foreground">
                                These models will be available for selection in the Arbitrator UI.
                            </p>
                        </div>

                        <Button type="submit" variant="gradient" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Save configuration"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}

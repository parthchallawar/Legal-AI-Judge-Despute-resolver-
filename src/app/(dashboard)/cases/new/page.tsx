"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

const formSchema = z.object({
    title: z.string().min(5, {
        message: "Title must be at least 5 characters.",
    }),
    description: z.string().min(20, {
        message: "Description must be at least 20 characters.",
    }),
    respondentEmail: z.string().email({
        message: "Please enter a valid email address for the respondent.",
    }),
    respondentName: z.string().optional(),
    additionalDetails: z.string().optional(),
})

export default function NewDisputePage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
    const [guidelinesFile, setGuidelinesFile] = useState<File | null>(null)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            description: "",
            respondentEmail: "",
            respondentName: "",
            additionalDetails: "",
        },
    })

    async function uploadFile(file: File) {
        const formData = new FormData()
        formData.append("file", file)
        const res = await fetch("/api/upload", { method: "POST", body: formData })
        if (!res.ok) throw new Error("Upload failed")
        return await res.json()
    }

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true)
        try {
            const documents = []

            if (evidenceFile) {
                const upload = await uploadFile(evidenceFile)
                documents.push({ url: upload.url, name: upload.name, type: "EVIDENCE" })
            }

            if (guidelinesFile) {
                const upload = await uploadFile(guidelinesFile)
                documents.push({ url: upload.url, name: "Arbitration Guidelines", type: "GUIDELINES" })
            }

            const response = await fetch("/api/cases", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ ...values, documents }),
            })

            if (!response.ok) {
                throw new Error("Failed to create case")
            }

            const data = await response.json()
            toast.success("Dispute filed successfully")
            router.push(`/cases/${data.id}`)
        } catch (error) {
            toast.error("Something went wrong")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">File a New Dispute</h1>
                <p className="text-muted-foreground mt-2">Start the arbitration process by providing the details below.</p>
            </div>

            <Card className="border-border/50 shadow-lg">
                <CardHeader className="bg-muted/30 pb-8 border-b">
                    <CardTitle className="text-xl">Case Information</CardTitle>
                    <CardDescription>
                        Please fill out all required fields accurately to ensure a fair process.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-8">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="md:col-span-2">
                                    <FormField
                                        control={form.control}
                                        name="title"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Dispute Title</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g., Breach of Contract - Project X" className="bg-background" {...field} />
                                                </FormControl>
                                                <FormDescription>A concise title for your case.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="respondentEmail"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Respondent Email</FormLabel>
                                            <FormControl>
                                                <Input placeholder="respondent@example.com" className="bg-background" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="respondentName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Respondent Name (Optional)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="John Doe" className="bg-background" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="md:col-span-2">
                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Description</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="Describe the issue in detail..."
                                                        className="min-h-[150px] bg-background resize-y"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <FormField
                                        control={form.control}
                                        name="additionalDetails"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Additional Details (Optional)</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="Any other relevant information..."
                                                        className="min-h-[100px] bg-background resize-y"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            <div className="rounded-lg border bg-card p-6 shadow-sm">
                                <h3 className="text-lg font-medium mb-4">Supporting Documents</h3>
                                <div className="grid gap-6 md:grid-cols-2">
                                    <FormItem>
                                        <FormLabel>Evidence (Optional)</FormLabel>
                                        <FormControl>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="file"
                                                    className="cursor-pointer bg-background file:text-foreground"
                                                    onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormDescription>Upload screenshots, contracts, etc.</FormDescription>
                                    </FormItem>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button type="submit" size="lg" disabled={isLoading} className="w-full md:w-auto">
                                    {isLoading ? (
                                        <>
                                            <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                            Filing Dispute...
                                        </>
                                    ) : (
                                        "File Dispute"
                                    )}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    )
}

export const dynamic = "force-dynamic"

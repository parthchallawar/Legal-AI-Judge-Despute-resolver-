"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ArrowLeft, Gavel, Users, Scale } from "lucide-react"

const formSchema = z.object({
    name: z.string().min(2, {
        message: "Name must be at least 2 characters.",
    }),
    email: z.string().email({
        message: "Please enter a valid email address.",
    }),
    password: z.string().min(6, {
        message: "Password must be at least 6 characters.",
    }),
    role: z.enum(["PARTY", "ARBITRATOR"]),
})

const roles = [
    { value: "PARTY" as const, label: "Party", desc: "File or respond to disputes", icon: Users },
    { value: "ARBITRATOR" as const, label: "Arbitrator", desc: "Review and decide cases", icon: Scale },
]

export default function RegisterPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
            role: "PARTY",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true)
        try {
            const response = await fetch("/api/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(values),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.message || "Something went wrong")
            }

            toast.success("Account created successfully")
            router.push("/login")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Something went wrong")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-8">
            <Link href="/" className="absolute left-8 top-8 inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-white md:static md:mb-0">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
            </Link>

            <div className="mb-8 flex flex-col items-center space-y-2 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
                    <Gavel className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-white">Create your account</h1>
                <p className="text-muted-foreground">Join the platform to file or arbitrate disputes</p>
            </div>

            <Card className="border-0 bg-white/5 shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl">
                <CardContent className="pt-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-zinc-400">Name</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="John Doe"
                                                {...field}
                                                className="h-11 border-white/5 bg-black/20 transition-all focus:border-indigo-500/50 focus:bg-black/40"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-zinc-400">Email</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="name@example.com"
                                                {...field}
                                                className="h-11 border-white/5 bg-black/20 transition-all focus:border-indigo-500/50 focus:bg-black/40"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-zinc-400">Password</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                {...field}
                                                className="h-11 border-white/5 bg-black/20 transition-all focus:border-indigo-500/50 focus:bg-black/40"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="role"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-zinc-400">I am joining as a...</FormLabel>
                                        <FormControl>
                                            <div className="grid grid-cols-2 gap-3">
                                                {roles.map((role) => (
                                                    <button
                                                        key={role.value}
                                                        type="button"
                                                        onClick={() => field.onChange(role.value)}
                                                        className={cn(
                                                            "flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all",
                                                            field.value === role.value
                                                                ? "border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_20px_rgba(124,58,237,0.15)]"
                                                                : "border-white/5 bg-black/20 hover:border-white/10 hover:bg-black/30"
                                                        )}
                                                    >
                                                        <role.icon className={cn("h-5 w-5", field.value === role.value ? "text-indigo-300" : "text-zinc-500")} />
                                                        <span className={cn("text-sm font-medium", field.value === role.value ? "text-white" : "text-zinc-400")}>
                                                            {role.label}
                                                        </span>
                                                        <span className="text-xs text-zinc-500">{role.desc}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="h-11 w-full text-base" variant="gradient" disabled={isLoading}>
                                {isLoading ? "Creating account..." : "Create account"}
                            </Button>
                        </form>
                    </Form>
                    <div className="mt-6 text-center text-sm text-muted-foreground">
                        Already have an account?{" "}
                        <Link href="/login" className="font-medium text-indigo-400 underline-offset-4 transition-colors hover:text-indigo-300 hover:underline">
                            Sign in
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

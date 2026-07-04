"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
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
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { toast } from "sonner"
import { ArrowLeft, Gavel } from "lucide-react"

const formSchema = z.object({
    email: z.string().email({
        message: "Please enter a valid email address.",
    }),
    password: z.string().min(1, {
        message: "Password is required.",
    }),
})

export default function LoginPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true)
        try {
            const result = await signIn("credentials", {
                email: values.email,
                password: values.password,
                redirect: false,
                callbackUrl: "/dashboard",
            })

            if (result?.error) {
                throw new Error("Invalid email or password")
            }

            toast.success("Logged in successfully")
            router.replace(result?.url || "/dashboard")
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Something went wrong")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-8">
            <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-white transition-colors absolute top-8 left-8 md:static md:mb-0">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
            </Link>

            <div className="flex flex-col items-center space-y-2 text-center mb-8">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4">
                    <Gavel className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-white">Welcome back</h1>
                <p className="text-muted-foreground">Enter your credentials to access your account</p>
            </div>

            <Card className="border-0 bg-white/5 backdrop-blur-2xl shadow-2xl ring-1 ring-white/10">
                <CardContent className="pt-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
                                                className="bg-black/20 border-white/5 focus:border-indigo-500/50 focus:bg-black/40 transition-all h-11"
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
                                                className="bg-black/20 border-white/5 focus:border-indigo-500/50 focus:bg-black/40 transition-all h-11"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full h-11 text-base" variant="gradient" disabled={isLoading}>
                                {isLoading ? "Signing in..." : "Sign in"}
                            </Button>
                        </form>
                    </Form>
                    <div className="mt-6 text-center text-sm text-muted-foreground">
                        Don&apos;t have an account?{" "}
                        <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-medium hover:underline underline-offset-4 transition-colors">
                            Sign up
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

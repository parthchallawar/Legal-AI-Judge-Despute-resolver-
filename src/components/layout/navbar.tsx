"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Gavel } from "lucide-react"

export function Navbar() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/80 backdrop-blur-xl">
            <div className="container flex h-16 items-center">
                <Link href="/" className="mr-8 flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                        <Gavel className="h-4 w-4 text-white" />
                    </div>
                    <span className="hidden bg-gradient-to-r from-white to-white/70 bg-clip-text font-bold text-transparent sm:inline-block">
                        ODR Platform
                    </span>
                </Link>
                <nav className="flex items-center gap-6 text-sm font-medium">
                    <Link
                        href="/about"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                        About
                    </Link>
                    <Link
                        href="/contact"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                        Contact
                    </Link>
                    <Link
                        href="/terms"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                        Terms
                    </Link>
                </nav>
                <div className="ml-auto flex items-center gap-3">
                    <Link href="/login">
                        <Button variant="ghost" size="sm">
                            Log in
                        </Button>
                    </Link>
                    <Link href="/register">
                        <Button variant="gradient" size="sm">Get Started</Button>
                    </Link>
                </div>
            </div>
        </header>
    )
}

"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Scale } from "lucide-react"

export function Navbar() {
    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center">
                <Link href="/" className="mr-6 flex items-center space-x-2">
                    <Scale className="h-6 w-6" />
                    <span className="hidden font-bold sm:inline-block">
                        ODR Platform
                    </span>
                </Link>
                <nav className="flex items-center space-x-6 text-sm font-medium">
                    <Link
                        href="/about"
                        className="transition-colors hover:text-foreground/80 text-foreground/60"
                    >
                        About
                    </Link>
                    <Link
                        href="/contact"
                        className="transition-colors hover:text-foreground/80 text-foreground/60"
                    >
                        Contact
                    </Link>
                    <Link
                        href="/terms"
                        className="transition-colors hover:text-foreground/80 text-foreground/60"
                    >
                        Terms
                    </Link>
                </nav>
                <div className="ml-auto flex items-center space-x-4">
                    <Link href="/login">
                        <Button variant="ghost" size="sm">
                            Log in
                        </Button>
                    </Link>
                    <Link href="/register">
                        <Button size="sm">Get Started</Button>
                    </Link>
                </div>
            </div>
        </header>
    )
}

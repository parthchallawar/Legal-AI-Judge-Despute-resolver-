import Link from "next/link"
import { Gavel } from "lucide-react"

export function Footer() {
    return (
        <footer className="border-t border-white/10 bg-background">
            <div className="container flex flex-col gap-8 py-8 md:flex-row md:py-12">
                <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                            <Gavel className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-bold">ODR Platform</span>
                    </div>
                    <p className="max-w-xs text-sm text-muted-foreground">
                        Fair, fast, and transparent dispute resolution powered by advanced AI and human arbitration.
                    </p>
                </div>
                <div className="grid flex-1 grid-cols-2 gap-12 sm:grid-cols-3">
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium">Platform</h3>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li>
                                <Link href="/features" className="transition-colors hover:text-foreground">
                                    Features
                                </Link>
                            </li>
                            <li>
                                <Link href="/pricing" className="transition-colors hover:text-foreground">
                                    Pricing
                                </Link>
                            </li>
                        </ul>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium">Company</h3>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li>
                                <Link href="/about" className="transition-colors hover:text-foreground">
                                    About Us
                                </Link>
                            </li>
                            <li>
                                <Link href="/contact" className="transition-colors hover:text-foreground">
                                    Contact
                                </Link>
                            </li>
                        </ul>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium">Legal</h3>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li>
                                <Link href="/terms" className="transition-colors hover:text-foreground">
                                    Terms of Service
                                </Link>
                            </li>
                            <li>
                                <Link href="/privacy" className="transition-colors hover:text-foreground">
                                    Privacy Policy
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
            <div className="container border-t border-white/10 py-6">
                <p className="text-center text-sm text-muted-foreground">
                    © {new Date().getFullYear()} ODR Platform. All rights reserved.
                </p>
            </div>
        </footer>
    )
}

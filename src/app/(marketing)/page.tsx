import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Scale, ShieldCheck, Zap, CheckCircle2 } from "lucide-react"

export default function LandingPage() {
    return (
        <div className="flex flex-col min-h-screen">
            {/* Hero Section */}
            <section className="relative space-y-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-32 overflow-hidden">
                <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-background to-background"></div>
                <div className="container mx-auto flex max-w-[64rem] flex-col items-center gap-4 text-center relative z-10">
                    <Link
                        href="/about"
                        className="rounded-full bg-white/5 border border-white/10 px-4 py-1.5 text-sm font-medium hover:bg-white/10 transition-colors backdrop-blur-sm"
                        target="_blank"
                    >
                        <span className="text-indigo-400 mr-2">New</span> Introducing the Future of Arbitration
                    </Link>
                    <h1 className="font-heading text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-indigo-400 drop-shadow-sm">
                        Fair, Fast, and <br /> AI-Powered Resolution
                    </h1>
                    <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
                        Resolve disputes in days, not months. Our platform combines advanced AI analysis with human oversight to deliver legally binding verdicts at a fraction of the cost.
                    </p>
                    <div className="space-x-4 pt-4">
                        <Link href="/register">
                            <Button size="lg" variant="gradient" className="h-12 px-8 text-lg rounded-full">
                                Get Started <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </Link>
                        <Link href="/about">
                            <Button variant="glass" size="lg" className="h-12 px-8 text-lg rounded-full">
                                Learn More
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="container mx-auto space-y-6 py-8 md:py-12 lg:py-24">
                <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
                    <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-5xl font-bold text-white">
                        Features
                    </h2>
                    <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                        Built for modern businesses and individuals who value time and fairness.
                    </p>
                </div>
                <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
                    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-sm hover:bg-white/10 transition-colors">
                        <div className="flex h-[200px] flex-col justify-between rounded-md p-6">
                            <div className="p-3 bg-indigo-500/20 rounded-xl w-fit">
                                <Zap className="h-8 w-8 text-indigo-400" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-bold text-xl text-white">Instant AI Analysis</h3>
                                <p className="text-sm text-muted-foreground">
                                    Get a preliminary verdict in seconds using our advanced legal LLMs.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-sm hover:bg-white/10 transition-colors">
                        <div className="flex h-[200px] flex-col justify-between rounded-md p-6">
                            <div className="p-3 bg-emerald-500/20 rounded-xl w-fit">
                                <ShieldCheck className="h-8 w-8 text-emerald-400" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-bold text-xl text-white">Secure & Private</h3>
                                <p className="text-sm text-muted-foreground">
                                    Your evidence and case details are encrypted and accessible only to parties involved.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-sm hover:bg-white/10 transition-colors">
                        <div className="flex h-[200px] flex-col justify-between rounded-md p-6">
                            <div className="p-3 bg-blue-500/20 rounded-xl w-fit">
                                <Scale className="h-8 w-8 text-blue-400" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-bold text-xl text-white">Human Oversight</h3>
                                <p className="text-sm text-muted-foreground">
                                    Complex cases are escalated to certified arbitrators for final review.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className="container mx-auto py-8 md:py-12 lg:py-24 relative">
                <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center mb-12">
                    <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-5xl font-bold text-white">
                        How It Works
                    </h2>
                    <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                        A simple, transparent process designed to get you results.
                    </p>
                </div>

                <div className="mx-auto grid justify-center gap-8 sm:grid-cols-3 md:max-w-[64rem] relative z-10">
                    {[
                        { title: "File a Dispute", desc: "Submit your claim and upload evidence in minutes.", step: "01" },
                        { title: "Respondent Replies", desc: "The other party is notified and submits their defense.", step: "02" },
                        { title: "Get a Verdict", desc: "Receive an AI-generated or human-reviewed decision.", step: "03" }
                    ].map((item, i) => (
                        <div key={i} className="flex flex-col items-center text-center space-y-4 p-6 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm">
                            <div className="text-4xl font-bold text-white/10 font-heading">{item.step}</div>
                            <h3 className="text-xl font-bold text-white">{item.title}</h3>
                            <p className="text-muted-foreground">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA Section */}
            <section className="container mx-auto py-8 md:py-12 lg:py-24">
                <div className="relative rounded-3xl overflow-hidden border border-white/10 p-8 md:p-16 text-center">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 to-purple-900/50 -z-10"></div>
                    <div className="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4">
                        <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-5xl font-bold text-white">
                            Ready to resolve your dispute?
                        </h2>
                        <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                            Join thousands of users who trust our platform for fair and fast arbitration.
                        </p>
                        <Link href="/register">
                            <Button size="lg" variant="gradient" className="mt-8 h-12 px-8 text-lg rounded-full">
                                Start a Case Now <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    )
}

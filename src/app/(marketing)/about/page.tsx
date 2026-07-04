import { Scale, Zap, ShieldCheck } from "lucide-react"

const principles = [
    {
        icon: Zap,
        title: "Fast",
        desc: "Most cases resolve in days, not the months a traditional court process takes.",
        color: "text-indigo-300",
        ring: "border-indigo-500/30 bg-indigo-500/10",
    },
    {
        icon: Scale,
        title: "Fair",
        desc: "Every verdict is checked by a second AI model for bias before it's issued.",
        color: "text-sky-300",
        ring: "border-sky-500/30 bg-sky-500/10",
    },
    {
        icon: ShieldCheck,
        title: "Transparent",
        desc: "Every decision cites the specific rules and evidence it was based on.",
        color: "text-emerald-300",
        ring: "border-emerald-500/30 bg-emerald-500/10",
    },
]

export default function AboutPage() {
    return (
        <div className="container space-y-16 py-16 md:py-24">
            <section className="mx-auto max-w-3xl space-y-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">About Us</p>
                <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                    Justice shouldn&apos;t take a year to schedule.
                </h1>
                <p className="text-xl text-muted-foreground">
                    We&apos;re on a mission to make dispute resolution accessible, affordable, and transparent for everyone.
                </p>
            </section>

            <section className="grid gap-12 items-start md:grid-cols-2">
                <div className="space-y-4">
                    <h2 className="text-3xl font-bold text-white">Our story</h2>
                    <p className="text-muted-foreground leading-relaxed">
                        Founded in 2024, ODR Platform emerged from a simple observation: the traditional legal system is too slow and expensive for most modern disputes.
                        Whether it&apos;s a freelance contract gone wrong or a consumer complaint, people deserve a better way to find resolution.
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                        By combining cutting-edge AI technology with the wisdom of experienced human arbitrators, we&apos;ve built a system that delivers fair results in days, not years.
                    </p>
                </div>

                <div className="space-y-3">
                    {principles.map((p) => (
                        <div
                            key={p.title}
                            className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
                        >
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${p.ring}`}>
                                <p.icon className={`h-5 w-5 ${p.color}`} />
                            </span>
                            <div>
                                <h3 className="font-semibold text-white">{p.title}</h3>
                                <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    )
}

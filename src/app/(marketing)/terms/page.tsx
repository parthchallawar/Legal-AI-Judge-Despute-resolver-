const sections = [
    {
        title: "Acceptance of Terms",
        body: "By accessing and using the ODR Platform (“Service”), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Service.",
    },
    {
        title: "Description of Service",
        body: "ODR Platform provides online dispute resolution services using a combination of automated software (“AI Judge”) and human arbitrators. We facilitate the resolution of disputes but are not a law firm and do not provide legal advice.",
    },
    {
        title: "User Accounts",
        body: "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate and complete information during registration.",
    },
    {
        title: "Arbitration Process",
        body: "By submitting a dispute, you agree to participate in good faith. Verdicts rendered by our platform may be binding depending on the prior agreement between parties. We reserve the right to decline any case at our discretion.",
    },
    {
        title: "Limitation of Liability",
        body: "To the maximum extent permitted by law, ODR Platform shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the Service.",
    },
]

export default function TermsPage() {
    return (
        <div className="container max-w-3xl space-y-10 py-16 md:py-24">
            <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Legal</p>
                <h1 className="text-4xl font-bold tracking-tight text-white">Terms of Service</h1>
                <p className="text-muted-foreground">Last updated: December 3, 2025</p>
            </div>

            <div className="space-y-8">
                {sections.map((section, i) => (
                    <section key={section.title} className="border-t border-white/10 pt-8 first:border-t-0 first:pt-0">
                        <div className="mb-3 flex items-baseline gap-3">
                            <span className="font-mono text-sm text-indigo-400/70">{String(i + 1).padStart(2, "0")}</span>
                            <h2 className="text-xl font-bold text-white">{section.title}</h2>
                        </div>
                        <p className="leading-relaxed text-muted-foreground">{section.body}</p>
                    </section>
                ))}
            </div>
        </div>
    )
}

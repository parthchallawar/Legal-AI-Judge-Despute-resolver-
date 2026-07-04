export default function TermsPage() {
    return (
        <div className="container max-w-3xl py-12 md:py-24 space-y-8">
            <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
                <p className="text-muted-foreground">Last updated: December 3, 2025</p>
            </div>

            <div className="prose dark:prose-invert max-w-none space-y-6">
                <section>
                    <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
                    <p>
                        By accessing and using the ODR Platform ("Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Service.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-bold mb-4">2. Description of Service</h2>
                    <p>
                        ODR Platform provides online dispute resolution services using a combination of automated software ("AI Judge") and human arbitrators. We facilitate the resolution of disputes but are not a law firm and do not provide legal advice.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-bold mb-4">3. User Accounts</h2>
                    <p>
                        You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate and complete information during registration.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-bold mb-4">4. Arbitration Process</h2>
                    <p>
                        By submitting a dispute, you agree to participate in good faith. Verdicts rendered by our platform may be binding depending on the prior agreement between parties. We reserve the right to decline any case at our discretion.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-bold mb-4">5. Limitation of Liability</h2>
                    <p>
                        To the maximum extent permitted by law, ODR Platform shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the Service.
                    </p>
                </section>
            </div>
        </div>
    )
}

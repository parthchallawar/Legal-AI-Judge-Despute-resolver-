import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AboutPage() {
    return (
        <div className="container py-12 md:py-24 space-y-12">
            <section className="text-center space-y-4 max-w-3xl mx-auto">
                <h1 className="text-4xl font-bold tracking-tight">About Us</h1>
                <p className="text-xl text-muted-foreground">
                    We are on a mission to democratize justice by making dispute resolution accessible, affordable, and transparent for everyone.
                </p>
            </section>

            <section className="grid md:grid-cols-2 gap-12 items-center">
                <div className="space-y-4">
                    <h2 className="text-3xl font-bold">Our Story</h2>
                    <p className="text-muted-foreground">
                        Founded in 2024, ODR Platform emerged from a simple observation: the traditional legal system is too slow and expensive for most modern disputes.
                        Whether it's a freelance contract gone wrong or a consumer complaint, people deserve a better way to find resolution.
                    </p>
                    <p className="text-muted-foreground">
                        By combining cutting-edge AI technology with the wisdom of experienced human arbitrators, we've built a system that delivers fair results in days, not years.
                    </p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-8 h-64 flex items-center justify-center">
                    <span className="text-muted-foreground italic">Office Image Placeholder</span>
                </div>
            </section>
        </div>
    )
}

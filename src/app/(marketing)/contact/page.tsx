import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, MapPin, Phone } from "lucide-react"

const contactPoints = [
    { icon: Mail, label: "Email", value: "support@odrplatform.com" },
    { icon: Phone, label: "Phone", value: "+1 (555) 123-4567" },
    { icon: MapPin, label: "Office", value: "123 Legal Tech Blvd, San Francisco, CA 94105" },
]

export default function ContactPage() {
    return (
        <div className="container py-16 md:py-24">
            <div className="grid gap-12 lg:grid-cols-2">
                <div className="space-y-8">
                    <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Contact</p>
                        <h1 className="mb-4 text-4xl font-bold tracking-tight text-white">Get in touch</h1>
                        <p className="text-xl text-muted-foreground">
                            Have questions about our platform or need support? We&apos;re here to help.
                        </p>
                    </div>

                    <div className="space-y-3">
                        {contactPoints.map(({ icon: Icon, label, value }) => (
                            <div
                                key={label}
                                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                            >
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10">
                                    <Icon className="h-5 w-5 text-indigo-300" />
                                </span>
                                <div>
                                    <h3 className="text-sm font-semibold text-white">{label}</h3>
                                    <p className="text-sm text-muted-foreground">{value}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Send us a message</CardTitle>
                        <CardDescription>
                            Fill out the form below and we&apos;ll get back to you as soon as possible.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="first-name" className="text-sm font-medium">First name</label>
                                    <Input id="first-name" placeholder="John" />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="last-name" className="text-sm font-medium">Last name</label>
                                    <Input id="last-name" placeholder="Doe" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="email" className="text-sm font-medium">Email</label>
                                <Input id="email" type="email" placeholder="john@example.com" />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="message" className="text-sm font-medium">Message</label>
                                <Textarea id="message" placeholder="How can we help you?" className="min-h-[120px]" />
                            </div>
                            <Button type="submit" variant="gradient" className="w-full">Send message</Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

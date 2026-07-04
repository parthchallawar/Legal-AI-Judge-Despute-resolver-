import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, MapPin, Phone } from "lucide-react"

export default function ContactPage() {
    return (
        <div className="container py-12 md:py-24">
            <div className="grid lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight mb-4">Get in Touch</h1>
                        <p className="text-xl text-muted-foreground">
                            Have questions about our platform or need support? We're here to help.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center space-x-4">
                            <Mail className="h-6 w-6 text-indigo-600" />
                            <div>
                                <h3 className="font-semibold">Email</h3>
                                <p className="text-muted-foreground">support@odrplatform.com</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Phone className="h-6 w-6 text-indigo-600" />
                            <div>
                                <h3 className="font-semibold">Phone</h3>
                                <p className="text-muted-foreground">+1 (555) 123-4567</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <MapPin className="h-6 w-6 text-indigo-600" />
                            <div>
                                <h3 className="font-semibold">Office</h3>
                                <p className="text-muted-foreground">123 Legal Tech Blvd, San Francisco, CA 94105</p>
                            </div>
                        </div>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Send us a message</CardTitle>
                        <CardDescription>
                            Fill out the form below and we'll get back to you as soon as possible.
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
                            <Button className="w-full">Send Message</Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

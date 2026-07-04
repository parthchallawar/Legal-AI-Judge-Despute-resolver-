"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, FileText, Gavel, LogOut, PlusCircle } from "lucide-react"

export default function DashboardLayoutContent({
    children,
    session: serverSession,
}: {
    children: React.ReactNode
    session: any
}) {
    const pathname = usePathname()
    const { data: clientSession } = useSession()
    const session = clientSession || serverSession

    const routes = [
        {
            label: "Dashboard",
            icon: LayoutDashboard,
            href: "/dashboard",
            color: "text-sky-400",
        },
        {
            label: "New Dispute",
            icon: PlusCircle,
            href: "/cases/new",
            color: "text-violet-400",
            role: "PARTY",
        },
        {
            label: "Admin Panel",
            icon: Gavel,
            href: "/admin",
            color: "text-orange-400",
            role: "ADMIN",
        },
    ]

    return (
        <div className="h-full relative bg-background min-h-screen">
            <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-[80]">
                <div className="h-full flex flex-col bg-card/30 backdrop-blur-xl border-r border-white/10">
                    <div className="px-6 py-6 flex-1">
                        <Link href="/dashboard" className="flex items-center mb-10 pl-2">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 mr-3 flex items-center justify-center">
                                <Gavel className="h-5 w-5 text-white" />
                            </div>
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                                ODR Platform
                            </h1>
                        </Link>
                        <div className="space-y-2">
                            {routes.map((route) => {
                                if (route.role && session?.user?.role !== route.role && session?.user?.role !== "ADMIN") {
                                    return null
                                }
                                const isActive = pathname === route.href;
                                return (
                                    <Link
                                        key={route.href}
                                        href={route.href}
                                        className={cn(
                                            "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer rounded-xl transition-all duration-200",
                                            isActive
                                                ? "bg-white/10 text-white shadow-lg border border-white/5"
                                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        <div className="flex items-center flex-1">
                                            <route.icon className={cn("h-5 w-5 mr-3 transition-colors", isActive ? route.color : "text-zinc-500 group-hover:text-white")} />
                                            {route.label}
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                    <div className="p-4 m-4 rounded-2xl bg-white/5 border border-white/5">
                        <div className="flex items-center mb-4">
                            <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-lg mr-3 border border-indigo-500/30">
                                {session?.user?.name?.[0] || "U"}
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-medium text-white truncate">{session?.user?.name}</p>
                                <p className="text-xs text-zinc-400 truncate">{session?.user?.email}</p>
                            </div>
                        </div>
                        <Button
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            variant="destructive"
                            className="w-full justify-start bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                        >
                            <LogOut className="h-4 w-4 mr-3" />
                            Logout
                        </Button>
                    </div>
                </div>
            </div>
            <main className="md:pl-72 min-h-screen">
                <div className="p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    )
}

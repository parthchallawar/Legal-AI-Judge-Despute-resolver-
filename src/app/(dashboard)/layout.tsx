import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import DashboardLayoutContent from "./dashboard-layout"

export const dynamic = "force-dynamic"

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await getServerSession(authOptions)
    return <DashboardLayoutContent session={session}>{children}</DashboardLayoutContent>
}

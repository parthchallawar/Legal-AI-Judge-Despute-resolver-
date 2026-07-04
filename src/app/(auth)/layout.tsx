export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
            {/* Subtle, deep gradient for a cleaner look */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-indigo-950/20 to-background"></div>
            <div className="w-full max-w-md space-y-8 p-8 relative z-10">
                {children}
            </div>
        </div>
    )
}

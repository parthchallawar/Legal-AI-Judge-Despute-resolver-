"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface RevealOnScrollProps {
    children: React.ReactNode
    className?: string
    /** Stagger multiple reveals in the same section, e.g. i * 100 (ms). */
    delayMs?: number
    /** Direction the element slides in from. */
    from?: "bottom" | "left" | "right"
}

const FROM_CLASS: Record<NonNullable<RevealOnScrollProps["from"]>, string> = {
    bottom: "slide-in-from-bottom-8",
    left: "slide-in-from-left-8",
    right: "slide-in-from-right-8",
}

// Reveals its children with a fade + slide the first time they scroll into view. Built on the
// project's existing tw-animate-css utilities (already used by dialog/dropdown/select) rather
// than a new animation library, and disconnects the observer after the first reveal so it
// never re-triggers on scroll-up.
export function RevealOnScroll({ children, className, delayMs = 0, from = "bottom" }: RevealOnScrollProps) {
    const ref = useRef<HTMLDivElement>(null)
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true)
                    observer.disconnect()
                }
            },
            { threshold: 0.15, rootMargin: "0px 0px -80px 0px" }
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    return (
        <div
            ref={ref}
            style={visible ? { animationDelay: `${delayMs}ms`, animationFillMode: "backwards" } : undefined}
            className={cn(
                visible
                    ? cn("animate-in fade-in-0 duration-700 ease-out", FROM_CLASS[from])
                    : "opacity-0",
                // Respect reduced-motion preferences: skip the animation, just show the content.
                "motion-reduce:animate-none motion-reduce:opacity-100",
                className
            )}
        >
            {children}
        </div>
    )
}

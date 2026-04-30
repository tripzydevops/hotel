import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--soft-gold)] text-white hover:bg-[var(--soft-gold-bright)]",
        secondary:
          "border-transparent bg-[var(--deep-ocean-lighter)] text-[var(--text-primary)] hover:bg-[var(--deep-ocean-accent)]",
        destructive:
          "border-transparent bg-[var(--alert-red)] text-white hover:bg-[var(--alert-red)]/80",
        outline: "text-[var(--text-primary)] border-[var(--glass-border)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

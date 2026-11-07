import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-emerald-500 text-white shadow-sm shadow-emerald-500/20",
        secondary:
          "border-transparent bg-blue-500 text-white shadow-sm shadow-blue-500/20",
        destructive:
          "border-transparent bg-red-500 text-white shadow-sm shadow-red-500/20",
        success:
          "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
        warning:
          "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        ghost:
          "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        outline: "border-base-300 text-base-content bg-white dark:bg-slate-950",
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

export { Badge }

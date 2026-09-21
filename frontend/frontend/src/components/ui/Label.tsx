import * as React from "react"
import { cn } from "../../lib/utils"

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>

/** @deprecated Utiliser l'équivalent shadcn dans components/shadcn/ — conservé pour compatibilité */
const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  )
)
Label.displayName = "Label"

export { Label }

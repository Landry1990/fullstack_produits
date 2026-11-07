import * as React from "react"
import { cn } from "../../lib/utils"

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>

const Label = ({
  className,
  ref,
  ...props
}: LabelProps & { ref?: React.Ref<HTMLLabelElement> }) => (
  <label
    ref={ref}
    className={cn(
      "text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className
    )}
    {...props}
  />
)
Label.displayName = "Label"

export { Label }

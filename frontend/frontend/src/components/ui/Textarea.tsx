import * as React from "react"
import { cn } from "../../lib/utils"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <div className="w-full">
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-[80px] w-full rounded-lg border border-base-300 bg-base-100 px-4 py-3 text-sm text-base-content shadow-sm transition-all duration-200 placeholder:text-base-content/40 focus:border-primary focus:ring-2 focus:ring-primary/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 resize-none",
          error && "border-red-300 focus:border-red-500 focus:ring-red-100",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-error mt-1 font-medium">{error}</p>}
    </div>
  )
)
Textarea.displayName = "Textarea"

export { Textarea }

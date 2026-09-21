import * as React from "react"
import { cn } from "../../lib/utils"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

/** @deprecated Utiliser l'équivalent shadcn dans components/shadcn/ — conservé pour compatibilité */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <div className="w-full">
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-[80px] w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 shadow-sm transition-all duration-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 resize-none",
          error && "border-red-300 focus:border-red-500 focus:ring-red-100",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
    </div>
  )
)
Textarea.displayName = "Textarea"

export { Textarea }

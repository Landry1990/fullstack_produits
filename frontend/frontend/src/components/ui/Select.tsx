import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Optional label text */
  label?: string;
  /** Optional error message */
  error?: string;
  /** Size variation */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes for the container */
  containerClassName?: string;
  /** Standard React select children */
  children: React.ReactNode;
}

/**
 * Premium Select component with custom caret and matching Input styles.
 *
 * @deprecated Utiliser l'équivalent shadcn dans components/shadcn/ — conservé pour compatibilité
 */
export const Select: React.FC<SelectProps> = ({
  label,
  error,
  size = 'md',
  className = '',
  containerClassName = '',
  children,
  ...props
}) => {
  const sizeClasses = {
    sm: 'h-9 text-xs px-3 pr-8',
    md: 'h-10 text-sm px-4 pr-10',
    lg: 'h-12 text-base px-5 pr-12'
  }[size];

  return (
    <div className={`w-full ${containerClassName}`}>
      {label && (
        <label className="block text-caption font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}
      <div className="relative group">
        <select
          className={`
            w-full rounded-lg border transition-all duration-200 appearance-none outline-none
            ${sizeClasses}
            ${error ? 'border-red-300 text-red-600 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'}
            bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600
            ${className}
          `}
          {...props}
        >
          {children}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-500 group-focus-within:text-emerald-500 transition-colors">
          <ChevronDown size={14} strokeWidth={3} />
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>
      )}
    </div>
  );
};

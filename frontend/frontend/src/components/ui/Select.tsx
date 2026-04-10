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
    <div className={`form-control w-full ${containerClassName}`}>
      {label && (
        <div className="label pt-0 px-1">
          <span className="label-text font-bold text-base-content/60 uppercase text-[10px] tracking-wider">{label}</span>
        </div>
      )}
      <div className="relative group">
        <select
          className={`
            select select-bordered w-full transition-all duration-200 appearance-none
            ${sizeClasses}
            ${error ? 'select-error text-error' : 'focus:select-primary'}
            bg-base-100 border-base-300 hover:border-base-400
            focus:shadow-[0_0_0_4px_rgba(34,197,94,0.1)]
            ${className}
          `}
          {...props}
        >
          {children}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-base-content/30 group-focus-within:text-primary transition-colors">
          <ChevronDown size={14} strokeWidth={3} />
        </div>
      </div>
      {error && (
        <div className="label pb-0 px-1">
          <span className="label-text-alt text-error font-medium">{error}</span>
        </div>
      )}
    </div>
  );
};

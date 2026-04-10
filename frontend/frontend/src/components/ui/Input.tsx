import React from 'react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Optional label text */
  label?: string;
  /** Optional error message */
  error?: string;
  /** Optional icon to display on the left */
  icon?: React.ReactNode;
  /** Size variation */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes for the container */
  containerClassName?: string;
}

/**
 * Premium Input component with refined borders, focus states, and icon support.
 */
export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  size = 'md',
  className = '',
  containerClassName = '',
  ...props
}) => {
  const sizeClasses = {
    sm: 'h-9 text-xs px-3',
    md: 'h-10 text-sm px-4',
    lg: 'h-12 text-base px-5'
  }[size];

  return (
    <div className={`form-control w-full ${containerClassName}`}>
      {label && (
        <div className="label pt-0 px-1">
          <span className="label-text font-bold text-base-content/60 uppercase text-[10px] tracking-wider">{label}</span>
        </div>
      )}
      <div className="relative group">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 group-focus-within:text-primary transition-colors">
            {icon}
          </div>
        )}
        <input
          className={`
            input input-bordered w-full transition-all duration-200
            ${sizeClasses}
            ${icon ? 'pl-10' : ''}
            ${error ? 'input-error text-error' : 'focus:input-primary'}
            bg-base-100 border-base-300 hover:border-base-400
            focus:shadow-[0_0_0_4px_rgba(34,197,94,0.1)]
            placeholder:text-base-content/20
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <div className="label pb-0 px-1">
          <span className="label-text-alt text-error font-medium">{error}</span>
        </div>
      )}
    </div>
  );
};

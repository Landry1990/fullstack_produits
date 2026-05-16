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
    <div className={`w-full ${containerClassName}`}>
      {label && (
        <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}
      <div className="relative group">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors">
            {icon}
          </div>
        )}
        <input
          className={`
            w-full rounded-lg border transition-all duration-200 outline-none
            ${sizeClasses}
            ${icon ? 'pl-10' : ''}
            ${error ? 'border-red-300 text-red-600 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-gray-200 text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50'}
            bg-white hover:border-gray-300
            placeholder:text-gray-300
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>
      )}
    </div>
  );
};

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
 *
 * @deprecated Utiliser l'équivalent shadcn dans components/shadcn/ — conservé pour compatibilité
 */
export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  size = 'md',
  className = '',
  containerClassName = '',
  onChange,
  type,
  ...props
}) => {
  const autoId = React.useId();
  const inputId = props.id ?? autoId;
  const sizeClasses = {
    sm: 'h-9 text-xs px-3',
    md: 'h-10 text-sm px-4',
    lg: 'h-12 text-base px-5'
  }[size];

  const isText = type === 'text';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isText && e.target.value !== e.target.value.toUpperCase()) {
      e.target.value = e.target.value.toUpperCase();
    }
    onChange?.(e);
  };

  return (
    <div className={`w-full ${containerClassName}`}>
      {label && (
        <label htmlFor={inputId} className="block text-caption font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}
      <div className="relative group">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-emerald-500 transition-colors">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          type={type}
          onChange={handleChange}
          className={`
            w-full rounded-lg border transition-all duration-200 outline-none
            ${sizeClasses}
            ${icon ? 'pl-10' : ''}
            ${error ? 'border-red-300 text-red-600 focus:border-red-500 focus:ring-2 focus:ring-red-100' : 'border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'}
            bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600
            placeholder:text-slate-400 dark:placeholder:text-slate-500
            ${isText ? 'uppercase' : ''}
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

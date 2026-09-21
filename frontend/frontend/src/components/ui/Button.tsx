import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

const baseStyles = 'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-300 active:scale-95 disabled:pointer-events-none disabled:text-slate-400 dark:disabled:text-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2';

const variants = {
  primary: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm hover:shadow-md hover:-translate-y-[1px]',
  secondary: 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm hover:shadow-md hover:-translate-y-[1px]',
  outline: 'border-2 border-slate-200 bg-transparent hover:bg-slate-100 text-slate-900 hover:border-slate-300 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-600',
  ghost: 'bg-transparent hover:bg-slate-100 text-slate-900 dark:hover:bg-slate-800 dark:text-slate-100',
  danger: 'bg-red-500 text-white hover:bg-red-400 shadow-sm hover:shadow-red-500/30 hover:-translate-y-[1px]',
  glass: 'glass-panel-pro text-slate-900 hover:bg-white/40 dark:text-slate-100 dark:hover:bg-black/40',
};

const sizes = {
  sm: 'h-8 px-3 text-xs rounded-[0.5rem]',
  md: 'h-10 px-5 text-sm rounded-[0.75rem]',
  lg: 'h-12 px-6 text-base rounded-[1rem]',
};

/** @deprecated Utiliser l'équivalent shadcn dans components/shadcn/ — conservé pour compatibilité */
export const Button: React.FC<ButtonProps> = ({
  className = '',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  children,
  ref,
  ...props
}) => {

  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {!isLoading && leftIcon}
      <span>{children}</span>
      {!isLoading && rightIcon}
    </button>
  );
};

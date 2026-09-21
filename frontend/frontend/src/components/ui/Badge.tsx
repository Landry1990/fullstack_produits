import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'success' | 'warning' | 'error' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  ref?: React.Ref<HTMLSpanElement>;
}

const baseStyles = 'inline-flex items-center justify-center font-bold tracking-wide transition-colors duration-200';

const variants = {
  primary: 'bg-emerald-600 text-white shadow-sm',
  secondary: 'bg-blue-600 text-white shadow-sm',
  accent: 'bg-red-500 text-white shadow-sm',
  ghost: 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100',
  success: 'bg-success-soft text-success-strong dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-warning-soft text-warning-strong dark:bg-amber-900/30 dark:text-amber-400',
  error: 'bg-error-soft text-error-strong dark:bg-red-900/30 dark:text-red-400',
  outline: 'bg-transparent border border-slate-200 text-slate-900 dark:border-slate-700 dark:text-slate-100',
};

const sizes = {
  sm: 'px-2 h-5 text-caption rounded',
  md: 'px-2.5 h-6 text-xs rounded-md',
  lg: 'px-3 h-8 text-sm rounded-lg',
};

/** @deprecated Utiliser l'équivalent shadcn dans components/shadcn/ — conservé pour compatibilité */
export const Badge: React.FC<BadgeProps> = ({ className = '', variant = 'primary', size = 'md', children, ref, ...props }) => {

  return (
    <span
      ref={ref}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

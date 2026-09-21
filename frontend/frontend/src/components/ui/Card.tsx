import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'elevated' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  ref?: React.Ref<HTMLDivElement>;
}

const baseStyles = 'rounded-box overflow-hidden transition-all duration-300';

const variants = {
  default: 'bg-white border border-slate-200 shadow-sm hover:shadow-md dark:bg-slate-900 dark:border-slate-700',
  bordered: 'bg-transparent border-2 border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600',
  glass: 'glass-panel-pro',
  elevated: 'bg-white border border-slate-200 shadow-lg hover:shadow-premium hover:-translate-y-1 dark:bg-slate-900 dark:border-slate-700',
};

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

/** @deprecated Utiliser l'équivalent shadcn dans components/shadcn/ — conservé pour compatibilité */
export const Card: React.FC<CardProps> = ({ className = '', variant = 'default', padding = 'md', children, ref, ...props }) => {

  return (
    <div
      ref={ref}
      className={`${baseStyles} ${variants[variant]} ${paddings[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

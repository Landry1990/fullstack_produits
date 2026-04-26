import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'success' | 'warning' | 'error' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = '', variant = 'primary', size = 'md', children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-bold tracking-wide transition-colors duration-200';
    
    const variants = {
      primary: 'bg-primary text-primary-content shadow-sm',
      secondary: 'bg-secondary text-secondary-content shadow-sm',
      accent: 'bg-accent text-accent-content shadow-sm',
      ghost: 'bg-base-200 text-base-content',
      success: 'bg-[#dcfce7] text-[#14532d] dark:bg-emerald-900/30 dark:text-emerald-400',
      warning: 'bg-[#fef3c7] text-[#78350f] dark:bg-amber-900/30 dark:text-amber-400',
      error: 'bg-[#fee2e2] text-[#7f1d1d] dark:bg-red-900/30 dark:text-red-400',
      outline: 'bg-transparent border border-base-300 text-base-content',
    };

    const sizes = {
      sm: 'px-2 h-5 text-[10px] rounded',
      md: 'px-2.5 h-6 text-xs rounded-md',
      lg: 'px-3 h-8 text-sm rounded-lg',
    };

    return (
      <span
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

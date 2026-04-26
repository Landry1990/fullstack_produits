import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'elevated' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', padding = 'md', children, ...props }, ref) => {
    const baseStyles = 'rounded-box overflow-hidden transition-all duration-300';
    
    const variants = {
      default: 'bg-base-100 border border-base-300 shadow-sm hover:shadow-md',
      bordered: 'bg-transparent border-2 border-base-300 hover:border-base-400',
      glass: 'glass-panel-pro',
      elevated: 'bg-base-100 border border-base-300 shadow-lg hover:shadow-premium hover:-translate-y-1',
    };

    const paddings = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    };

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${paddings[padding]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

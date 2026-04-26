import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-300 active:scale-95 disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';
    
    const variants = {
      primary: 'bg-primary text-primary-content hover:bg-primary/90 shadow-sm hover:shadow-md hover:-translate-y-[1px]',
      secondary: 'bg-secondary text-secondary-content hover:bg-secondary/90 shadow-sm hover:shadow-md hover:-translate-y-[1px]',
      outline: 'border-2 border-base-300 bg-transparent hover:bg-base-200 text-base-content hover:border-base-400',
      ghost: 'bg-transparent hover:bg-base-200 text-base-content',
      danger: 'bg-error text-error-content hover:bg-error/90 shadow-sm hover:shadow-error/30 hover:-translate-y-[1px]',
      glass: 'glass-panel-pro text-base-content hover:bg-white/40 dark:hover:bg-black/40',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs rounded-[0.5rem]',
      md: 'h-10 px-5 text-sm rounded-[0.75rem]',
      lg: 'h-12 px-6 text-base rounded-[1rem]',
    };

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
  }
);

Button.displayName = 'Button';

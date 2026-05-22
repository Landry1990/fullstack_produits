import React from 'react';
import { CheckSquare, Square, MinusSquare } from 'lucide-react';

interface CheckboxProps {
  /** Controlled checked state */
  checked?: boolean;
  /** Whether the checkbox is in an indeterminate state */
  indeterminate?: boolean;
  /** Callback when state changes */
  onChange?: (checked: boolean) => void;
  /** Optional label text */
  label?: string;
  /** Whether the checkbox is disabled */
  disabled?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
  /** Icon color theme */
  color?: 'primary' | 'success' | 'warning' | 'error' | 'base';
  /** Size variation */
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

/**
 * Premium Checkbox component using Lucide icons.
 * Replaces native/DaisyUI checkboxes for a more consistent and polished look.
 */
export const Checkbox: React.FC<CheckboxProps> = ({
  checked = false,
  indeterminate = false,
  onChange,
  label,
  disabled = false,
  className = '',
  color = 'primary',
  size = 'md'
}) => {
  const handleChange = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  const iconSize = {
    xs: 14,
    sm: 18,
    md: 22,
    lg: 28
  }[size];

  // Map theme colors to CSS classes
  const colorClass = {
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
    base: 'text-base-content/40'
  }[color];

  return (
    <div
      className={`inline-flex items-center gap-2 transition-all ${disabled ? 'text-base-content/50 cursor-not-allowed' : 'cursor-pointer active:scale-95'} ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        handleChange(e);
      }}
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleChange(e);
        }
      }}
    >
      <div className="relative flex items-center justify-center shrink-0">
        {indeterminate ? (
          <MinusSquare size={iconSize} className={colorClass} strokeWidth={2.5} />
        ) : checked ? (
          <CheckSquare size={iconSize} className={colorClass} strokeWidth={2.5} />
        ) : (
          <Square size={iconSize} className="text-gray-200 hover:text-base-content/40 transition-colors" strokeWidth={2} />
        )}
      </div>
      {label && <span className="text-sm font-medium select-none text-base-content/70">{label}</span>}
    </div>
  );
};

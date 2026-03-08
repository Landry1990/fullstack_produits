import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface ActionIconProps {
  icon: LucideIcon;
  onClick: (e: React.MouseEvent) => void;
  title?: string;
  variant?: 'success' | 'error' | 'warning' | 'info' | 'primary' | 'secondary' | 'ghost';
  className?: string;
  loading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const ActionIcon: React.FC<ActionIconProps> = ({
  icon: Icon,
  onClick,
  title,
  variant = 'ghost',
  className = '',
  loading = false,
  disabled = false,
  size = 'sm'
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'success': return 'text-success hover:bg-success/10';
      case 'error': return 'text-error hover:bg-error/10';
      case 'warning': return 'text-warning hover:bg-warning/10';
      case 'info': return 'text-info hover:bg-info/10';
      case 'primary': return 'text-primary hover:bg-primary/10';
      case 'secondary': return 'text-secondary hover:bg-secondary/10';
      default: return 'text-base-content/60 hover:text-base-content hover:bg-base-200';
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'lg': return 'p-2';
      case 'md': return 'p-1.5';
      default: return 'p-1';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'lg': return 24;
      case 'md': return 20;
      default: return 18;
    }
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled && !loading) onClick(e);
      }}
      disabled={disabled || loading}
      className={`
        rounded-lg transition-all duration-200 flex items-center justify-center
        ${getSizeClass()}
        ${getVariantClass()}
        ${disabled ? 'opacity-30 cursor-not-allowed' : 'active:scale-95'}
        ${className}
      `}
      title={title}
      type="button"
    >
      {loading ? (
        <span className={`loading loading-spinner loading-xs`} />
      ) : (
        <Icon size={getIconSize()} strokeWidth={2.5} />
      )}
    </button>
  );
};

export default ActionIcon;

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';

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

/** @deprecated Utiliser l'équivalent shadcn dans components/shadcn/ — conservé pour compatibilité */
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
      case 'success': return 'text-green-600 hover:bg-green-500/10 dark:text-green-400';
      case 'error': return 'text-red-600 hover:bg-red-500/10 dark:text-red-400';
      case 'warning': return 'text-amber-500 hover:bg-amber-500/10 dark:text-amber-400';
      case 'info': return 'text-blue-600 hover:bg-blue-500/10 dark:text-blue-400';
      case 'primary': return 'text-emerald-600 hover:bg-emerald-600/10 dark:text-emerald-400';
      case 'secondary': return 'text-blue-600 hover:bg-blue-600/10 dark:text-blue-400';
      default: return 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800';
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
        ${disabled ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'active:scale-95'}
        ${className}
      `}
      title={title}
      type="button"
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Icon size={getIconSize()} strokeWidth={2.5} />
      )}
    </button>
  );
};

export default ActionIcon;

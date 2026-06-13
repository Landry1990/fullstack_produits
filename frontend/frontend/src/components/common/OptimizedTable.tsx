import React from 'react';

interface OptimizedTableProps {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}

/**
 * Tableau optimisé avec scrollbar stylisée
 * Usage: Wrapper autour de <table>
 */
export const OptimizedTable: React.FC<OptimizedTableProps> = ({
  children,
  className = '',
  maxHeight = 'calc(100vh - 200px)',
}) => {
  return (
    <div
      className={`overflow-auto scrollbar-thin scrollbar-thumb-base-300 scrollbar-track-transparent ${className}`}
      style={{
        maxHeight,
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--fallback-bc,oklch(var(--bc)/0.3)) transparent',
      }}
    >
      {children}
    </div>
  );
};

interface OptimizedTableContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container pour un tableau avec header fixe et body scrollable
 */
export const OptimizedTableContainer: React.FC<OptimizedTableContainerProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`flex flex-col overflow-hidden ${className}`}>
      {children}
    </div>
  );
};

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

/**
 * En-tête de page compact et optimisé
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  className = '',
  compact = false,
}) => {
  return (
    <div
      className={`flex items-center justify-between bg-base-100 border-b border-base-200 ${
        compact ? 'px-3 py-2' : 'px-4 py-3'
      } ${className}`}
    >
      <div className="min-w-0">
        <h1 className={`font-semibold text-base-content truncate ${compact ? 'text-base' : 'text-lg'}`}>
          {title}
        </h1>
        {subtitle && (
          <p className={`text-base-content/60 truncate ${compact ? 'text-xs' : 'text-sm'}`}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {actions}
        </div>
      )}
    </div>
  );
};

interface ContentLayoutProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Layout optimisé pour les pages avec tableau
 * Structure: Header (fixe) + Content (scrollable) + Footer (fixe optionnel)
 */
export const ContentLayout: React.FC<ContentLayoutProps> = ({
  children,
  className = '',
  header,
  footer,
}) => {
  return (
    <div className={`flex flex-col h-full overflow-hidden ${className}`}>
      {header && <div className="shrink-0">{header}</div>}
      <div className="flex-1 overflow-hidden min-h-0">{children}</div>
      {footer && <div className="shrink-0">{footer}</div>}
    </div>
  );
};

export default OptimizedTable;

import React from 'react';

interface PageWithTableProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  compact?: boolean;
  noPadding?: boolean;
}

/**
 * Layout optimisé pour les pages avec tableau
 * 
 * Structure :
 * - Header compact (fixe)
 * - Content scrollable avec scrollbar fine
 * - Footer optionnel (fixe)
 * 
 * Usage:
 * <PageWithTable title="Commandes" actions={<Button>Nouveau</Button>}>
 *   <table>...</table>
 * </PageWithTable>
 */
export const PageWithTable: React.FC<PageWithTableProps> = ({
  children,
  title,
  subtitle,
  actions,
  header,
  footer,
  className = '',
  compact = true,
  noPadding = false,
}) => {
  // Header par défaut si title fourni
  const defaultHeader = title ? (
    <div
      className={`flex items-center justify-between bg-base-100 border-b border-base-200 shrink-0 ${
        compact ? 'px-3 py-2' : 'px-4 py-3'
      }`}
    >
      <div className="min-w-0">
        <h1
          className={`font-semibold text-base-content truncate ${
            compact ? 'text-base' : 'text-lg'
          }`}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={`text-base-content/60 truncate ${
              compact ? 'text-xs' : 'text-sm'
            }`}
          >
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
  ) : null;

  return (
    <div className={`flex flex-col h-full overflow-hidden bg-base-100 ${className}`}>
      {/* Header */}
      {header || defaultHeader}

      {/* Content avec scrollbar optimisée */}
      <div
        className={`flex-1 overflow-auto scrollbar-thin ${
          noPadding ? '' : compact ? 'p-2' : 'p-4'
        }`}
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--fallback-bc,oklch(var(--bc)/0.2)) transparent',
        }}
      >
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div
          className={`shrink-0 bg-base-100 border-t border-base-200 ${
            compact ? 'px-3 py-2' : 'px-4 py-3'
          }`}
        >
          {footer}
        </div>
      )}
    </div>
  );
};

/**
 * Wrapper pour un tableau avec header fixe et body scrollable
 */
interface TableContainerProps {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}

export const TableContainer: React.FC<TableContainerProps> = ({
  children,
  className = '',
  maxHeight = 'calc(100vh - 200px)',
}) => {
  return (
    <div
      className={`overflow-auto scrollbar-thin ${className}`}
      style={{
        maxHeight,
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--fallback-bc,oklch(var(--bc)/0.2)) transparent',
      }}
    >
      {children}
    </div>
  );
};

/**
 * Header de tableau compact (utiliser avec thead sticky)
 */
interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export const TableHeader: React.FC<TableHeaderProps> = ({
  children,
  className = '',
  compact = true,
}) => {
  return (
    <thead
      className={`sticky top-0 bg-base-100 z-10 ${className}`}
    >
      <tr
        className={`border-b border-base-200 bg-base-100 ${
          compact ? 'text-xs' : 'text-sm'
        }`}
      >
        {children}
      </tr>
    </thead>
  );
};

/**
 * Cellule de tableau compacte
 */
interface TableCellProps {
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
  align?: 'left' | 'center' | 'right';
  header?: boolean;
}

export const TableCell: React.FC<TableCellProps> = ({
  children,
  className = '',
  compact = true,
  align = 'left',
  header = false,
}) => {
  const baseClasses = `${compact ? 'p-2' : 'p-3'} ${
    align === 'right'
      ? 'text-right'
      : align === 'center'
      ? 'text-center'
      : 'text-left'
  } ${header ? 'font-medium text-base-content/70' : ''} ${className}`;

  if (header) {
    return <th className={baseClasses}>{children}</th>;
  }

  return <td className={baseClasses}>{children}</td>;
};

export default PageWithTable;

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '../shadcn/button';
import { cn } from '../../lib/utils';

interface PaginationControlsProps {
  /** Page courante (1-based) */
  page: number;
  /** Nombre total de pages — active le bouton "dernière page" et borne "suivant" */
  totalPages?: number;
  /** Fallback quand totalPages est inconnu (pagination par curseur/URL DRF) */
  hasNext?: boolean;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  /** 'sm' = h-8 (défaut), 'xs' = h-7 icône compacte pour les tables denses */
  size?: 'sm' | 'xs';
  className?: string;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  page,
  totalPages,
  hasNext,
  onPageChange,
  isLoading = false,
  size = 'sm',
  className,
}) => {
  const { t } = useTranslation(['common']);

  const canPrev = page > 1 && !isLoading;
  const canNext = !isLoading && (totalPages !== undefined ? page < totalPages : hasNext !== false);
  const iconCls = size === 'xs' ? 'size-3.5' : 'size-4';
  const btnCls = size === 'xs' ? 'h-7 w-7' : undefined;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {totalPages !== undefined && (
        <Button
          variant="outline" size="icon"
          className={btnCls}
          onClick={() => onPageChange(1)}
          disabled={!canPrev}
          title={t('common:first_page', { defaultValue: 'Première page' })}
          aria-label={t('common:first_page', { defaultValue: 'Première page' })}
        >
          <ChevronsLeft className={iconCls} />
        </Button>
      )}
      <Button
        variant="outline" size="icon"
        className={btnCls}
        onClick={() => onPageChange(page - 1)}
        disabled={!canPrev}
        title={t('common:previous', { defaultValue: 'Précédent' })}
        aria-label={t('common:previous', { defaultValue: 'Précédent' })}
      >
        <ChevronLeft className={iconCls} />
      </Button>
      <Button
        variant="outline" size="icon"
        className={btnCls}
        onClick={() => onPageChange(page + 1)}
        disabled={!canNext}
        title={t('common:next', { defaultValue: 'Suivant' })}
        aria-label={t('common:next', { defaultValue: 'Suivant' })}
      >
        <ChevronRight className={iconCls} />
      </Button>
      {totalPages !== undefined && (
        <Button
          variant="outline" size="icon"
          className={btnCls}
          onClick={() => onPageChange(totalPages)}
          disabled={!canNext}
          title={t('common:last_page', { defaultValue: 'Dernière page' })}
          aria-label={t('common:last_page', { defaultValue: 'Dernière page' })}
        >
          <ChevronsRight className={iconCls} />
        </Button>
      )}
    </div>
  );
};

export default PaginationControls;

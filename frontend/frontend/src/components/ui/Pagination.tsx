import React from 'react';
import { useTranslation } from 'react-i18next';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPrev: () => void;
  onNext: () => void;
  hasNext?: boolean;
  isLoading?: boolean;
  label?: string;
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  onPrev,
  onNext,
  hasNext,
  isLoading = false,
  label,
  className = ""
}) => {
  const { t } = useTranslation(['common']);

  return (
    <div className={`p-4 border-t border-base-200 flex items-center justify-between bg-base-100/50 ${className}`}>
        <div className="text-sm text-base-content/60">
            {t('common:pagination_info', { 
                defaultValue: `Page ${currentPage} sur ${totalPages} (${totalItems} ${label || t('common:items', { defaultValue: 'éléments' })})`,
                page: currentPage,
                total: totalPages,
                count: totalItems,
                label: label || t('common:items', { defaultValue: 'éléments', count: totalItems })
            })}
        </div>
        <div className="flex gap-2">
            <button 
                className="btn btn-sm btn-outline hover:btn-primary transition-all duration-200"
                onClick={onPrev}
                disabled={currentPage <= 1 || isLoading}
            >
                {t('common:previous', { defaultValue: 'Précédent' })}
            </button>
            <button 
                className="btn btn-sm btn-outline hover:btn-primary transition-all duration-200"
                onClick={onNext}
                disabled={hasNext === false || currentPage >= totalPages || isLoading}
            >
                {t('common:next', { defaultValue: 'Suivant' })}
            </button>
        </div>
    </div>
  );
};

export default Pagination;

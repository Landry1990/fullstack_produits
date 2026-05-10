import React from 'react';
import { MoreVertical, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SelectionHeaderProps {
  selectedCount: number;
  onClear: () => void;
  colSpan: number;
  actions: React.ReactNode;
  children: React.ReactNode;
}

const SelectionHeader: React.FC<SelectionHeaderProps> = ({
  selectedCount,
  onClear,
  colSpan,
  actions,
  children
}) => {
  const { t } = useTranslation(['common']);

  return (
    <th colSpan={colSpan} className="sticky top-0 z-30 bg-base-200 opacity-100 border-b border-base-300 py-3">
      <div className="flex items-center justify-between w-full h-8">
        {selectedCount > 0 ? (
          <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-2 duration-200">
            <div className="dropdown">
              <div tabIndex={0} role="button" className="btn btn-sm btn-primary gap-2">
                <MoreVertical className="size-4" />
                {t('common:actions_title', { defaultValue: 'Actions' })}
                <span className="badge badge-sm bg-primary-focus border-none text-white">{selectedCount}</span>
              </div>
              <ul tabIndex={0} className="dropdown-content z-[50] menu p-2 shadow-2xl bg-base-100 rounded-box w-60 border border-base-200 mt-2">
                {actions}
              </ul>
            </div>
            <button 
              onClick={onClear}
              className="btn btn-sm btn-ghost gap-2 text-base-content/60 hover:text-base-content"
            >
              <X className="size-4" />
              {t('common:actions.cancel', { defaultValue: 'Annuler' })}
            </button>
          </div>
        ) : (
          <div className="size-full flex items-center">
            {children}
          </div>
        )}
      </div>
    </th>
  );
};

export default SelectionHeader;

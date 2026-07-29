import React from 'react';
import { MoreVertical, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../shadcn/button';
import { Badge } from './Badge';

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
            <div className="relative group">
              <Button variant="default" size="sm" className="gap-2">
                <MoreVertical className="size-4" />
                {t('common:actions_title', { defaultValue: 'Actions' })}
                <Badge variant="primary" size="sm">{selectedCount}</Badge>
              </Button>
              <ul className="absolute z-[50] p-2 shadow-2xl bg-base-100 rounded-xl w-60 border border-base-200 mt-2 hidden group-focus-within:block">
                {actions}
              </ul>
            </div>
            <Button 
              variant="ghost" size="sm"
              onClick={onClear}
              className="text-base-content/60 hover:text-base-content"
            >
              <X className="size-4" />
              {t('common:actions.cancel', { defaultValue: 'Annuler' })}
            </Button>
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

import React from 'react';
import { MoreVertical, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../shadcn/dropdown-menu';
import { Badge } from './Badge';

interface SelectionHeaderProps {
  selectedCount: number;
  onClear: () => void;
  colSpan: number;
  actions: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Header de sélection en masse — le dropdown `actions` attend des primitives
 * shadcn (DropdownMenuItem / DropdownMenuLabel / DropdownMenuSeparator).
 * @deprecated Utiliser l'équivalent shadcn dans components/shadcn/ — conservé pour compatibilité
 */
const SelectionHeader: React.FC<SelectionHeaderProps> = ({
  selectedCount,
  onClear,
  colSpan,
  actions,
  children
}) => {
  const { t } = useTranslation(['common']);

  return (
    <th colSpan={colSpan} className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 opacity-100 border-b border-slate-200 dark:border-slate-700 py-3">
      <div className="flex items-center justify-between w-full h-8">
        {selectedCount > 0 ? (
          <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-2 duration-200">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" size="sm" className="gap-2">
                  <MoreVertical className="size-4" />
                  {t('common:actions_title', { defaultValue: 'Actions' })}
                  <Badge variant="primary" size="sm">{selectedCount}</Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60 rounded-xl p-1.5">
                {actions}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost" size="sm"
              onClick={onClear}
              className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
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

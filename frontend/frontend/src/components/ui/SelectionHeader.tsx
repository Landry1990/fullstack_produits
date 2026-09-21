import React, { useState, useRef, useEffect } from 'react';
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

/** @deprecated Utiliser l'équivalent shadcn dans components/shadcn/ — conservé pour compatibilité */
const SelectionHeader: React.FC<SelectionHeaderProps> = ({
  selectedCount,
  onClear,
  colSpan,
  actions,
  children
}) => {
  const { t } = useTranslation(['common']);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <th colSpan={colSpan} className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 opacity-100 border-b border-slate-200 dark:border-slate-700 py-3">
      <div className="flex items-center justify-between w-full h-8">
        {selectedCount > 0 ? (
          <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-2 duration-200">
            <div ref={containerRef} className="relative">
              <Button variant="default" size="sm" className="gap-2" onClick={() => setIsOpen(prev => !prev)}>
                <MoreVertical className="size-4" />
                {t('common:actions_title', { defaultValue: 'Actions' })}
                <Badge variant="primary" size="sm">{selectedCount}</Badge>
              </Button>
              {isOpen && (
                <ul className="absolute z-[50] p-2 shadow-2xl bg-white dark:bg-slate-900 rounded-xl w-60 border border-slate-200 dark:border-slate-700 mt-2">
                  {actions}
                </ul>
              )}
            </div>
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

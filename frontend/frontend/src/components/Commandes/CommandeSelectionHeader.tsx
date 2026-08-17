import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { TableHead } from '../shadcn/table';

interface CommandeSelectionHeaderProps {
  selectedCount: number;
  onClear: () => void;
  colSpan: number;
  actions: React.ReactNode;
  children: React.ReactNode;
}

const CommandeSelectionHeader: React.FC<CommandeSelectionHeaderProps> = ({
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
    <TableHead colSpan={colSpan} className="sticky top-0 z-30 bg-slate-100 border-b border-slate-200 py-3">
      <div className="flex items-center justify-between w-full h-8">
        {selectedCount > 0 ? (
          <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-2 duration-200">
            <div ref={containerRef} className="relative">
              <Button type="button" variant="default" size="sm" className="gap-2" onClick={() => setIsOpen(prev => !prev)}>
                <MoreVertical className="size-4" />
                {t('common:actions_title')}
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{selectedCount}</Badge>
              </Button>
              {isOpen && (
                <ul className="absolute z-[50] p-2 shadow-2xl bg-white rounded-xl w-60 border border-slate-200 mt-2">
                  {actions}
                </ul>
              )}
            </div>
            <Button 
              type="button"
              variant="ghost" size="sm"
              onClick={onClear}
              className="text-slate-500 hover:text-slate-700"
            >
              <X className="size-4" />
              {t('common:actions.cancel')}
            </Button>
          </div>
        ) : (
          <div className="size-full flex items-center">
            {children}
          </div>
        )}
      </div>
    </TableHead>
  );
};

export default CommandeSelectionHeader;

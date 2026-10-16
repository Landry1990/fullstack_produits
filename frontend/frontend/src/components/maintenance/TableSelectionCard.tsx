import { useTranslation } from 'react-i18next';
import { CheckSquare, Square, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../shadcn/button';
import { Checkbox } from '../shadcn/checkbox';
import { Badge } from '../shadcn/badge';
import type { PurgeTable, TableCategory } from './types';

interface TableSelectionCardProps {
  tableCategories: Record<string, TableCategory>;
  tableMap: Map<string, PurgeTable>;
  selectedTables: Set<string>;
  expandedCategories: Set<string>;
  onToggleTable: (key: string) => void;
  onToggleCategory: (keys: string[]) => void;
  onToggleExpandCategory: (cat: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function TableSelectionCard({
  tableCategories,
  tableMap,
  selectedTables,
  expandedCategories,
  onToggleTable,
  onToggleCategory,
  onToggleExpandCategory,
  onSelectAll,
  onDeselectAll,
}: TableSelectionCardProps) {
  const { t } = useTranslation(['maintenance', 'common']);

  return (
    <div className="bg-white shadow-xl rounded-2xl border border-slate-200">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CheckSquare className="size-5 text-indigo-600" />
            {t('tables_title')}
          </h2>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onSelectAll}>{t('select_all')}</Button>
            <Button variant="ghost" size="sm" onClick={onDeselectAll}>{t('deselect_all')}</Button>
          </div>
        </div>

        <div className="space-y-2">
          {Object.entries(tableCategories).map(([catKey, cat]) => {
            const availableKeys = cat.keys.filter(k => tableMap.has(k));
            if (availableKeys.length === 0) return null;
            const allCatSelected = availableKeys.every(k => selectedTables.has(k));
            const someCatSelected = availableKeys.some(k => selectedTables.has(k));
            const isExpanded = expandedCategories.has(catKey);

            return (
              <div key={catKey} className="border border-slate-200 rounded-lg overflow-hidden">
                {/* Category header */}
                <div
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${someCatSelected ? 'bg-indigo-50' : 'bg-slate-100/50 hover:bg-slate-100'}`}
                  onClick={() => onToggleExpandCategory(catKey)}
                >
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0"
                      onClick={(e) => { e.stopPropagation(); onToggleCategory(availableKeys); }}
                    >
                      {allCatSelected ? (
                        <CheckSquare className="size-4 text-indigo-600" />
                      ) : someCatSelected ? (
                        <CheckSquare className="size-4 text-indigo-600/50" />
                      ) : (
                        <Square className="size-4 text-slate-400" />
                      )}
                    </Button>
                    <span className="font-semibold text-sm">{cat.label}</span>
                    <Badge variant="secondary" className="text-xs">{availableKeys.length}</Badge>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center"
                    onClick={(e) => { e.stopPropagation(); onToggleExpandCategory(catKey); }}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? t('common:hide_header') : t('common:show_header')}
                  >
                    {isExpanded ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
                  </button>
                </div>

                {/* Category items */}
                {isExpanded && (
                  <div className="divide-y divide-slate-200">
                    {availableKeys.map(key => {
                      const table = tableMap.get(key)!;
                      const isSelected = selectedTables.has(key);
                      return (
                        <label
                          key={key}
                          className={`flex items-center gap-3 px-6 py-2.5 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-100/30'}`}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => onToggleTable(key)}
                          />
                            <span className="text-sm flex-1">{t('tables.' + table.key, table.label)}</span>
                          {table.children.length > 0 && (
                            <span className="text-xs text-slate-400">
                              +{table.children.length} {t('common:sub_table', { count: table.children.length })}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, SearchX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../shadcn/card';
import { Badge } from '../shadcn/badge';
import { EmptyState } from '../ui/EmptyState';

interface ShortcutItem {
  key: string;
  label: string;
  group: string;
}

function getShortcuts(t: (key: string, options?: Record<string, unknown>) => string): ShortcutItem[] {
  const items = t('shortcuts.items', { returnObjects: true }) as Record<string, { key: string; label: string }>;
  const groups: Record<string, string> = {
    slash: t('shortcuts.global'),
    esc: t('shortcuts.global'),
    f2: t('shortcuts.billing'),
    f4: t('shortcuts.billing'),
    f9: t('shortcuts.billing'),
    ctrl_s: t('shortcuts.billing'),
    alt_z: t('shortcuts.billing'),
    qty_star: t('shortcuts.billing'),
  };
  return Object.entries(items).map(([id, item]) => ({
    key: item.key,
    label: item.label,
    group: groups[id] || t('shortcuts.global'),
  }));
}

interface HelpShortcutsProps {
  search: string;
}

const HelpShortcuts: React.FC<HelpShortcutsProps> = ({ search }) => {
  const { t } = useTranslation('help');
  const shortcuts = getShortcuts(t);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return shortcuts;
    return shortcuts.filter(
      (s) =>
        s.label.toLowerCase().includes(term) ||
        s.key.toLowerCase().includes(term) ||
        s.group.toLowerCase().includes(term)
    );
  }, [shortcuts, search]);

  const groups = Array.from(new Set(filtered.map((s) => s.group)));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-base-content">{t('shortcuts.title')}</h2>
        <p className="text-sm text-base-content/60">{t('shortcuts.description')}</p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          variant="base"
          className="py-16 opacity-70"
          icon={<SearchX className="size-8" />}
          title={t('search.no_results')}
          description={t('search.try_again')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {groups.map((group) => (
            <Card key={group}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Keyboard className="size-4 text-primary" />
                  {group}
                </CardTitle>
                <CardDescription>{t('shortcuts.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {filtered
                  .filter((s) => s.group === group)
                  .map((s) => (
                    <div
                      key={`${group}-${s.key}`}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-base-200/40 hover:bg-base-200 transition-colors"
                    >
                      <span className="text-sm text-base-content/80">{s.label}</span>
                      <Badge variant="outline" className="font-mono text-xs shrink-0">
                        {s.key}
                      </Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default HelpShortcuts;

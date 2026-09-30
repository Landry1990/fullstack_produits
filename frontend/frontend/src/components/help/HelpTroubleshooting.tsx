import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wrench, SearchX, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../shadcn/card';
import { Badge } from '../shadcn/badge';
import { EmptyState } from '../ui/EmptyState';

interface TroubleshootingItem {
  id: string;
  title: string;
  steps: string[];
}

function getItems(t: (key: string, options?: Record<string, unknown>) => string): TroubleshootingItem[] {
  const items = t('troubleshooting.items', { returnObjects: true }) as Record<string, { title: string; steps: string[] }>;
  return Object.entries(items).map(([id, item]) => ({
    id,
    title: item.title,
    steps: item.steps,
  }));
}

interface HelpTroubleshootingProps {
  search: string;
}

const HelpTroubleshooting: React.FC<HelpTroubleshootingProps> = ({ search }) => {
  const { t } = useTranslation('help');
  const items = getItems(t);
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(term) ||
        item.steps.some((s) => s.toLowerCase().includes(term))
    );
  }, [items, search]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-base-content">{t('troubleshooting.title')}</h2>
        <p className="text-sm text-base-content/60">{t('troubleshooting.description')}</p>
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
          {filtered.map((item) => {
            const isOpen = openId === item.id;
            return (
              <Card key={item.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Wrench className="size-4 text-amber-600 shrink-0" />
                      <CardTitle className="text-base">{item.title}</CardTitle>
                    </div>
                    <button
                      onClick={() => setOpenId(isOpen ? null : item.id)}
                      className="shrink-0 p-1 rounded-md hover:bg-base-200 transition-colors"
                      aria-label={isOpen ? t('guides.collapse') : t('guides.expand')}
                    >
                      {isOpen ? (
                        <ChevronUp className="size-4 text-base-content/50" />
                      ) : (
                        <ChevronDown className="size-4 text-base-content/50" />
                      )}
                    </button>
                  </div>
                  <CardDescription>
                    {isOpen
                      ? t('troubleshooting.description')
                      : t('troubleshooting.steps_count', { count: item.steps.length })}
                  </CardDescription>
                </CardHeader>
                {isOpen && (
                  <CardContent className="space-y-2">
                    {item.steps.map((step, idx) => (
                      <div key={`${item.id}-${idx}`} className="flex items-start gap-3">
                        <Badge variant="outline" className="shrink-0 mt-0.5 font-mono text-[10px]">
                          {idx + 1}
                        </Badge>
                        <p className="text-sm text-base-content/80 leading-snug">{step}</p>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HelpTroubleshooting;

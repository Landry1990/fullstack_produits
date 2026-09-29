import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, SearchX, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../shadcn/card';
import { Badge } from '../shadcn/badge';
import { EmptyState } from '../ui/EmptyState';

interface FaqItem {
  id: string;
  q: string;
  a: string;
}

function getItems(t: (key: string, options?: Record<string, unknown>) => string): FaqItem[] {
  const items = t('faq.items', { returnObjects: true }) as Record<string, { q: string; a: string }>;
  return Object.entries(items).map(([id, item]) => ({ id, q: item.q, a: item.a }));
}

interface HelpFaqProps {
  search: string;
}

const HelpFaq: React.FC<HelpFaqProps> = ({ search }) => {
  const { t } = useTranslation('help');
  const items = getItems(t);
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (item) =>
        item.q.toLowerCase().includes(term) || item.a.toLowerCase().includes(term)
    );
  }, [items, search]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-base-content">{t('faq.title')}</h2>
        <p className="text-sm text-base-content/60">{t('faq.description')}</p>
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
        <div className="space-y-3">
          {filtered.map((item) => {
            const isOpen = openId === item.id;
            return (
              <Card key={item.id} className={isOpen ? 'border-primary/20' : ''}>
                <CardHeader className="pb-0">
                  <button
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                    className="w-full flex items-start justify-between gap-3 text-left py-2"
                  >
                    <div className="flex items-start gap-2">
                      <HelpCircle className="size-4 text-primary shrink-0 mt-0.5" />
                      <CardTitle className="text-base leading-snug">{item.q}</CardTitle>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="size-4 text-base-content/40 shrink-0" />
                    ) : (
                      <ChevronDown className="size-4 text-base-content/40 shrink-0" />
                    )}
                  </button>
                </CardHeader>
                {isOpen && (
                  <CardContent className="pt-3 pl-9">
                    <p className="text-sm text-base-content/80 leading-relaxed">{item.a}</p>
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

export default HelpFaq;

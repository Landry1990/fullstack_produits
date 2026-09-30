import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Clock, CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../shadcn/card';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { EmptyState } from '../ui/EmptyState';

export interface Guide {
  id: string;
  title: string;
  description: string;
  duration: number;
  steps: string[];
}

function getGuides(t: (key: string, options?: Record<string, unknown>) => string): Guide[] {
  const keys = ['sell', 'ticket', 'import', 'stock_alert', 'settings'];
  return keys.map((key) => ({
    id: key,
    title: t(`guides.items.${key}.title`),
    description: t(`guides.items.${key}.description`),
    duration: t(`guides.items.${key}.duration`, { returnObjects: true }) as unknown as number,
    steps: t(`guides.items.${key}.steps`, { returnObjects: true }) as unknown as string[],
  }));
}

interface HelpGuidesProps {
  search: string;
  completed: string[];
  onToggle: (id: string) => void;
}

const HelpGuides: React.FC<HelpGuidesProps> = ({ search, completed, onToggle }) => {
  const { t } = useTranslation('help');
  const [openId, setOpenId] = React.useState<string | null>(null);

  const guides = getGuides(t);
  const completedSet = useMemo(() => new Set(completed), [completed]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return guides;
    return guides.filter(
      (g) =>
        g.title.toLowerCase().includes(term) ||
        g.description.toLowerCase().includes(term) ||
        g.steps.some((s) => s.toLowerCase().includes(term))
    );
  }, [guides, search]);

  const completedCount = completed.length;
  const total = guides.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-base-content">{t('guides.title')}</h2>
          <p className="text-sm text-base-content/60">{t('guides.description')}</p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {completedCount}/{total} {t('guides.completed')}
        </Badge>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          variant="base"
          className="py-16 opacity-70"
          icon={<FileText className="size-8" />}
          title={t('search.no_results')}
          description={t('search.try_again')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((guide) => {
            const isOpen = openId === guide.id;
            const isRead = completedSet.has(guide.id);
            return (
              <Card key={guide.id} className={isRead ? 'border-emerald-200 bg-emerald-50/30' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="size-4 text-primary" />
                        {guide.title}
                        {isRead && <CheckCircle2 className="size-4 text-emerald-600" />}
                      </CardTitle>
                      <CardDescription className="mt-1">{guide.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-base-content/40 shrink-0">
                      <Clock className="size-3" />
                      {guide.duration} {t('guides.estimated_time')}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isOpen && (
                    <ol className="space-y-2">
                      {guide.steps.map((step, idx) => (
                        <li
                          key={`${guide.id}-${idx}`}
                          className="flex items-start gap-2 text-sm text-base-content/80"
                        >
                          <span className="flex-none flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span className="leading-snug">{step}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => setOpenId(isOpen ? null : guide.id)}
                    >
                      {isOpen ? (
                        <>
                          <ChevronUp className="size-3.5 mr-1" /> {t('guides.collapse')}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="size-3.5 mr-1" /> {t('guides.expand')}
                        </>
                      )}
                    </Button>
                    <Button
                      variant={isRead ? 'secondary' : 'default'}
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => onToggle(guide.id)}
                    >
                      {isRead ? (
                        <>
                          <Circle className="size-3.5 mr-1" /> {t('guides.mark_as_unread')}
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-3.5 mr-1" /> {t('guides.mark_as_read')}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HelpGuides;

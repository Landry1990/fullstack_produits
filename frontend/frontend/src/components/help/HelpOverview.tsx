import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen, PlayCircle, FileText, Keyboard, Wrench, HelpCircle,
  ChevronRight, RotateCcw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../shadcn/card';
import { Progress } from '../shadcn/progress';
import { Button } from '../shadcn/button';
import type { TFunction } from 'i18next';

interface SectionCard {
  id: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
}

function getSectionCards(t: TFunction): SectionCard[] {
  return [
    {
      id: 'videos',
      icon: PlayCircle,
      colorClass: 'text-emerald-600',
      bgClass: 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100/60',
    },
    {
      id: 'guides',
      icon: FileText,
      colorClass: 'text-blue-600',
      bgClass: 'bg-blue-50 border-blue-100 hover:bg-blue-100/60',
    },
    {
      id: 'shortcuts',
      icon: Keyboard,
      colorClass: 'text-violet-600',
      bgClass: 'bg-violet-50 border-violet-100 hover:bg-violet-100/60',
    },
    {
      id: 'troubleshooting',
      icon: Wrench,
      colorClass: 'text-amber-600',
      bgClass: 'bg-amber-50 border-amber-100 hover:bg-amber-100/60',
    },
    {
      id: 'faq',
      icon: HelpCircle,
      colorClass: 'text-rose-600',
      bgClass: 'bg-rose-50 border-rose-100 hover:bg-rose-100/60',
    },
  ];
}

interface HelpOverviewProps {
  totalGuides: number;
  completedCount: number;
  onTabChange: (tab: string) => void;
  onResetProgress: () => void;
}

const HelpOverview: React.FC<HelpOverviewProps> = ({
  totalGuides,
  completedCount,
  onTabChange,
  onResetProgress,
}) => {
  const { t } = useTranslation('help');
  const cards = getSectionCards(t);
  const progress = totalGuides > 0 ? Math.round((completedCount / totalGuides) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Welcome + Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <BookOpen className="size-5 text-primary" />
              {t('overview.title')}
            </CardTitle>
            <CardDescription>{t('overview.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-base-content/70">{t('overview.welcome_desc')}</p>
            </div>
            <div className="bg-base-200/50 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-base-content">{t('overview.progress')}</span>
                <span className="text-sm font-bold text-primary">{completedCount}/{totalGuides}</span>
              </div>
              <Progress value={progress} />
              <p className="text-xs text-base-content/50">
                {completedCount === 0 ? t('overview.progress_empty') : t('overview.progress_desc')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/10">
          <CardHeader>
            <CardTitle className="text-lg">{t('overview.welcome')}</CardTitle>
            <CardDescription>{t('overview.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-base-content/70 mb-4">
              {completedCount === 0
                ? t('overview.progress_empty')
                : t('overview.progress_desc')}
            </p>
            <Button variant="outline" size="sm" onClick={onResetProgress} className="w-full">
              <RotateCcw className="size-4 mr-2" />
              {t('guides.mark_as_unread')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick access cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => onTabChange(card.id)}
              className={`text-left rounded-2xl border p-4 transition-all group ${card.bgClass}`}
            >
              <div className="flex items-start justify-between mb-3">
                <Icon className={`size-6 ${card.colorClass}`} />
                <ChevronRight className={`size-4 text-base-content/30 group-hover:${card.colorClass} transition-colors`} />
              </div>
              <h3 className="font-bold text-base-content text-sm mb-1">
                {t(`overview.sections.${card.id}.title`)}
              </h3>
              <p className="text-xs text-base-content/60 leading-snug">
                {t(`overview.sections.${card.id}.desc`)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default HelpOverview;

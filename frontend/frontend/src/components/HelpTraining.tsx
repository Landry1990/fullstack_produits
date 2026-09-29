import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen, Search, LayoutGrid, PlayCircle, FileText,
  Keyboard, Wrench, HelpCircle, X
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './shadcn/tabs';
import { Input } from './shadcn/input';
import { Button } from './shadcn/button';
import HelpOverview from './help/HelpOverview';
import HelpVideos from './help/HelpVideos';
import HelpGuides from './help/HelpGuides';
import HelpShortcuts from './help/HelpShortcuts';
import HelpTroubleshooting from './help/HelpTroubleshooting';
import HelpFaq from './help/HelpFaq';
import { useHelpProgress } from './help/useHelpProgress';

const GUIDE_IDS = ['sell', 'ticket', 'import', 'stock_alert', 'settings'];

const tabConfig = [
  { id: 'overview', icon: LayoutGrid, labelKey: 'tabs.overview' },
  { id: 'videos', icon: PlayCircle, labelKey: 'tabs.videos' },
  { id: 'guides', icon: FileText, labelKey: 'tabs.guides' },
  { id: 'shortcuts', icon: Keyboard, labelKey: 'tabs.shortcuts' },
  { id: 'troubleshooting', icon: Wrench, labelKey: 'tabs.troubleshooting' },
  { id: 'faq', icon: HelpCircle, labelKey: 'tabs.faq' },
];

const HelpTraining = () => {
  const { t } = useTranslation('help');
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');
  const { completed, toggle, isCompleted, reset } = useHelpProgress();

  const completedCount = GUIDE_IDS.filter(isCompleted).length;
  const showSearch = activeTab !== 'overview';

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'overview') setSearch('');
  };

  return (
    <div className="h-full min-h-0 overflow-hidden bg-slate-50 p-2 sm:p-3 lg:p-4">
      <div className="h-full max-w-[1600px] mx-auto flex flex-col gap-3 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <BookOpen className="size-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {t('title')}
              </h1>
              <p className="text-xs font-medium text-slate-500">{t('subtitle')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {showSearch && (
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('search.placeholder')}
                  className="pl-9 pr-8 h-9 text-sm"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-100 text-slate-400"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 min-h-0 flex flex-col">
          <TabsList className="shrink-0 flex flex-wrap h-auto gap-1 p-1 bg-slate-200/60 justify-start">
            {tabConfig.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-1.5 text-xs h-8 px-3"
                >
                  <Icon className="size-3.5" />
                  <span className="hidden sm:inline">{t(tab.labelKey)}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 mt-3">
            <TabsContent value="overview" className="mt-0 h-full">
              <HelpOverview
                totalGuides={GUIDE_IDS.length}
                completedCount={completedCount}
                onTabChange={handleTabChange}
                onResetProgress={reset}
              />
            </TabsContent>

            <TabsContent value="videos" className="mt-0 h-full">
              <HelpVideos search={search} />
            </TabsContent>

            <TabsContent value="guides" className="mt-0 h-full">
              <HelpGuides
                search={search}
                completed={completed}
                onToggle={toggle}
              />
            </TabsContent>

            <TabsContent value="shortcuts" className="mt-0 h-full">
              <HelpShortcuts search={search} />
            </TabsContent>

            <TabsContent value="troubleshooting" className="mt-0 h-full">
              <HelpTroubleshooting search={search} />
            </TabsContent>

            <TabsContent value="faq" className="mt-0 h-full">
              <HelpFaq search={search} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default HelpTraining;

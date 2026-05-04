import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppVersion } from '../hooks/useSystem';

type BadgeType = 'new' | 'fix' | 'improve' | 'perf';

interface VersionMeta {
  version: string;
  badge: BadgeType;
  itemTypes: BadgeType[];
}

const BADGE_STYLES: Record<BadgeType, string> = {
  new:     'bg-emerald-100 text-emerald-800 border-emerald-200',
  fix:     'bg-red-100 text-red-800 border-red-200',
  improve: 'bg-blue-100 text-blue-800 border-blue-200',
  perf:    'bg-purple-100 text-purple-800 border-purple-200',
};

const ITEM_ICONS: Record<BadgeType, string> = {
  new:     '✨',
  fix:     '🐛',
  improve: '📈',
  perf:    '⚡',
};

const BADGE_DOT_ICONS: Record<BadgeType, string> = {
  new: '✨', fix: '🐛', improve: '📈', perf: '⚡',
};

const VERSIONS: VersionMeta[] = [
  { version: '2.9.0', badge: 'new',     itemTypes: ['new', 'new', 'new', 'new', 'new', 'improve', 'improve', 'fix', 'fix', 'fix'] },
  { version: '2.8.0', badge: 'new',     itemTypes: ['new', 'new', 'new', 'new', 'new', 'fix'] },
  { version: '2.7.0', badge: 'new',     itemTypes: ['new', 'new', 'improve', 'fix'] },
  { version: '2.6.0', badge: 'improve', itemTypes: ['new', 'new', 'new', 'improve', 'perf'] },
  { version: '2.5.0', badge: 'new',     itemTypes: ['new', 'new', 'new', 'improve', 'fix'] },
  { version: '2.4.0', badge: 'improve', itemTypes: ['new', 'new', 'improve', 'fix'] },
];

export default function Changelog() {
  const { t } = useTranslation('changelog');
  const { data: versionInfo } = useAppVersion();
  const [filter, setFilter] = useState<string>('all');
  const [expandedVersion, setExpandedVersion] = useState<string | null>('2.9.0');

  const FILTER_OPTIONS = [
    { value: 'all',     label: t('filter_all') },
    { value: 'new',     label: t('filter_new') },
    { value: 'fix',     label: t('filter_fix') },
    { value: 'improve', label: t('filter_improve') },
    { value: 'perf',    label: t('filter_perf') },
  ];

  const filteredVersions = VERSIONS.map((meta) => {
    const allItems = meta.itemTypes.map((type, idx) => ({
      type,
      text: t(`versions.${meta.version}.items.${idx}`),
    }));
    const items = filter === 'all' ? allItems : allItems.filter((i) => i.type === filter);
    return { ...meta, items };
  }).filter((v) => v.items.length > 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-base-content flex items-center gap-2">
            🚀 {t('page_title')}
          </h1>
          <p className="text-sm text-base-content/50 mt-1">{t('page_subtitle')}</p>
          {versionInfo && (
            <div className="flex items-center gap-2 mt-2">
              <span className="badge badge-outline badge-sm font-mono font-black">
                v{versionInfo.version} installée
              </span>
              {versionInfo.commit && (
                <span className="text-[10px] text-base-content/30 font-mono">
                  #{versionInfo.commit}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1.5">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                filter === opt.value
                  ? 'bg-primary text-primary-content border-primary shadow-sm'
                  : 'bg-base-200 text-base-content/60 border-base-300 hover:bg-base-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-[18px] top-4 bottom-4 w-px bg-base-300 hidden sm:block" />

        <div className="space-y-4">
          {filteredVersions.map((entry) => {
            const isExpanded = expandedVersion === entry.version;
            return (
              <div key={entry.version} className="relative flex gap-4">
                {/* Dot */}
                <div className="hidden sm:flex shrink-0 w-9 h-9 rounded-full bg-base-100 border-2 border-base-300 items-center justify-center z-10 mt-1 text-sm">
                  {BADGE_DOT_ICONS[entry.badge]}
                </div>

                {/* Card */}
                <div className="flex-1 bg-base-100 rounded-2xl border border-base-200 shadow-sm overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-base-200/40 transition-colors"
                    onClick={() => setExpandedVersion(isExpanded ? null : entry.version)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-black border ${BADGE_STYLES[entry.badge]}`}>
                        {t(`badge_${entry.badge}`)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-base-content">v{entry.version}</span>
                          <span className="text-xs text-base-content/40 font-medium">
                            {t(`versions.${entry.version}.date`)}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-base-content/70 truncate">
                          {t(`versions.${entry.version}.title`)}
                        </p>
                      </div>
                    </div>
                    <span className={`shrink-0 text-base-content/30 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                      ▾
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-base-200 px-5 py-4 space-y-2">
                      {entry.items.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-sm">
                          <span className="shrink-0 mt-0.5">{ITEM_ICONS[item.type]}</span>
                          <span className="text-base-content/80">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredVersions.length === 0 && (
          <div className="text-center py-16 text-base-content/40 text-sm">
            {t('no_results')}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-base-content/30 pt-4">{t('footer')}</p>
    </div>
  );
}

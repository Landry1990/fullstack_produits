import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOmnisearchOpen } from '../../context/OmnisearchContext';

export default function GlobalSearchTrigger() {
  const { t } = useTranslation('common');
  const { setOpen } = useOmnisearchOpen();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={t('omnisearch.trigger', 'Rechercher dans l’application')}
      className="flex h-8 min-w-8 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-2 text-left text-sm text-slate-500 shadow-sm transition-colors hover:border-emerald-300 hover:bg-white hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 sm:w-64 sm:justify-start sm:px-3 lg:w-80"
    >
      <Search className="size-4 shrink-0 text-slate-400" />
      <span className="hidden min-w-0 flex-1 truncate sm:inline">
        {t('omnisearch.trigger', 'Rechercher dans l’application')}
      </span>
      <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-caption font-bold text-slate-400 lg:inline">
        Ctrl K
      </kbd>
    </button>
  );
}

import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAppPage } from '../../config/appPages';

export default function PageTitle() {
  const { pathname } = useLocation();
  const { t } = useTranslation('sidebar');
  const page = getAppPage(pathname);

  if (!page) return null;

  return (
    <div className="min-w-0 max-w-40 sm:max-w-xs lg:max-w-sm" aria-live="polite">
      <p className="truncate text-caption font-semibold uppercase tracking-wider text-slate-400">
        {t(`categories.${page.category}`)}
      </p>
      <h1 className="truncate text-sm font-bold text-slate-800 sm:text-base">
        {t(page.titleKey)}
      </h1>
    </div>
  );
}

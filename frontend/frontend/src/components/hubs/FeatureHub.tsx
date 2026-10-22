import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { staggerContainer, fadeInUp } from '../../lib/motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { filterNavItemsForUser, groupNavSubMenus } from '../../config/navConfig';
import type { AppPageCategory } from '../../config/appPages';
import { Card } from '../shadcn/card';
import { cn } from '../../lib/utils';

interface FeatureHubProps {
  category: AppPageCategory;
}

/**
 * Page hub : affiche les entrées d'une catégorie de navigation sous forme de
 * tuiles regroupées par sous-section, filtrées par les permissions réelles.
 */
export default function FeatureHub({ category }: FeatureHubProps) {
  const { t } = useTranslation('sidebar');
  const { user } = useAuth();

  const hubPath = `/app/${category}`;

  const sections = useMemo(
    () => filterNavItemsForUser(user).filter(item => item.category === category),
    [user, category]
  );

  const renderTile = (path: string, label: string) => (
    <Link key={path} to={path} className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-2xl">
      <Card className="h-full flex items-center justify-between gap-3 p-4 transition-all hover:border-emerald-400/60 hover:shadow-md group-hover:translate-x-0.5">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{label}</span>
        <ChevronRight className="size-4 shrink-0 text-slate-400 transition-colors group-hover:text-emerald-500" />
      </Card>
    </Link>
  );

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="mx-auto w-full max-w-6xl space-y-8 p-4 sm:p-6"
    >
      <motion.header variants={fadeInUp} className="space-y-1">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 sm:text-2xl">
          {t(`hub.${category}_title`)}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t(`hub.${category}_subtitle`)}
        </p>
      </motion.header>

      {sections.map(item => {
        const groups = item.submenus ? groupNavSubMenus(item.submenus) : null;
        return (
          <motion.section key={item.key} variants={fadeInUp} aria-labelledby={`hub-section-${item.key}`} className="space-y-3">
            <h2
              id={`hub-section-${item.key}`}
              className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              {t(item.labelKey, item.labelFallback ?? '')}
            </h2>
            {groups ? (
              groups.map((grp, gi) => (
                <div key={grp.group ?? gi} className={cn(gi > 0 && 'mt-5')}>
                  {grp.group && (
                    <h3 className="mb-2 text-micro font-semibold uppercase tracking-wider text-emerald-600/80 dark:text-emerald-400/80">
                      {t(`menu_groups.${grp.group}`)}
                    </h3>
                  )}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {grp.items
                      .filter(sub => sub.path !== hubPath)
                      .map(sub => renderTile(sub.path, t(sub.labelKey, sub.labelFallback ?? '')))}
                  </div>
                </div>
              ))
            ) : (
              item.path && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {renderTile(item.path, t(item.labelKey, item.labelFallback ?? ''))}
                </div>
              )
            )}
          </motion.section>
        );
      })}
    </motion.div>
  );
}

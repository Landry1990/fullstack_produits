import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../hooks/useSidebar';
import { useLicence } from '../context/LicenceContext';
import ZenithLogo from './ZenithLogo';
import { useState, useEffect, useMemo, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useReapproStats } from '../hooks/useDashboard';
import { ChevronLeft, ChevronRight, ChevronDown, Menu, X } from 'lucide-react';
import { formatVersion } from '../version';
import { cn } from '../lib/utils';
import { prefetchRoute } from '../utils/routePrefetch';
import { NAV_ITEMS, filterNavItemsForUser, groupNavSubMenus } from '../config/navConfig';
import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer, staggerGrid } from '../lib/motion';

const routePrefetchMap: Record<string, () => Promise<unknown>> = {
  '/app/stock': () => import('./hubs/FeatureHub'),
  '/app/rapports': () => import('./hubs/FeatureHub'),
  '/app/fournisseurs': () => import('./Fournisseurs'),
  '/app/clients': () => import('./Clients'),
  '/app/outils/imc': () => import('./clinical/BMICalculator'),
  '/app/caisse-centralisee': () => import('./CaisseCentralisee'),
  '/app/inventaire': () => import('./Inventaire'),
  '/app/etats-inventaire': () => import('./EtatsInventaire'),
  '/app/organisation': () => import('./Organisation'),
  '/app/vitrine': () => import('./Vitrine'),
  '/app/statistiques-fournisseurs': () => import('./StatistiquesFournisseur'),
  '/app/journal-caisse': () => import('./JournalCaisse'),
  '/app/perimes': () => import('./Perimes'),
  '/app/creances': () => import('./Creances'),
  '/app/avoirs': () => import('./Avoirs'),
  '/app/rapports-mensuels': () => import('./RapportMensuel'),
  '/app/transformations': () => import('./Transformations'),
  '/app/reappro-rayon': () => import('./stock/ReapproRayon'),
  '/app/reappro-history': () => import('./stock/ReapproHistory'),
  '/app/cadencier': () => import('./stock/Cadencier'),
  '/app/journal-audit': () => import('./JournalAudit'),
  '/app/journal-ajustements': () => import('./JournalAjustements'),
  '/app/promis': () => import('./Promis'),
  '/app/stock-analysis': () => import('./StockAnalysis'),
  '/app/historique-clotures': () => import('./HistoriqueClotures'),
  '/app/historique-ventes': () => import('./HistoriqueVentes'),
  '/app/avoirs-clients': () => import('./avoirs-client/ClientCreditsPage'),
  '/app/fidelite': () => import('./loyalty/LoyaltyPage'),
  '/app/recap-client': () => import('./RecapClient'),
  '/app/historique-achats': () => import('./HistoriqueAchats'),
  '/app/telegram-history': () => import('./TelegramHistory'),
  '/app/ordonnancier': () => import('./Ordonnancier'),
  '/app/centre-rapports': () => import('./CentreRapports'),
  '/app/analyse-abc': () => import('./AnalyseABC'),
  '/app/analyse-marges-produit': () => import('./AnalyseMargesProduit'),
  '/app/promotions': () => import('./Promotions/PromotionList'),
  '/app/module-financier': () => import('./ModuleFinancier'),
  '/app/divers/ca': () => import('./divers/GestionDivers'),
  '/app/divers/stock': () => import('./divers/GestionDivers'),
  '/app/classement-vendeurs': () => import('./ClassementVendeurs'),
  '/app/challenges': () => import('./challenges/ChallengesPage'),
  '/app/analyse-temporelle': () => import('./AnalyseTemporelle'),
  '/app/rapport-ug': () => import('./StockUGReportShadcn'),
  '/app/user-sessions': () => import('./UserSessionsShadcn'),
  '/app/guide-financier': () => import('./GuideFinancier'),
  '/app/aide-formation': () => import('./HelpTraining'),
  '/app/utilisateurs': () => import('./users/GestionUtilisateurs'),
  '/app/planning-operateurs': () => import('./PlanningOperateurs'),
  '/app/pharmacy-settings': () => import('./settings/PharmacySettingsForm'),
  '/app/maintenance': () => import('./Maintenance'),
  '/app/corbeille': () => import('./Corbeille'),
  '/app/import-dci': () => import('./ImportDCIPage'),
  '/app/compta/dashboard': () => import('./compta/Comptabilite'),
  '/app/compta/grand-livre': () => import('./compta/Comptabilite'),
  '/app/compta/balance': () => import('./compta/Comptabilite'),
  '/app/compta/resultat': () => import('./compta/Comptabilite'),
  '/app/compta/charges': () => import('./compta/Comptabilite'),
  '/app/compta/plan-comptable': () => import('./compta/Comptabilite'),
  '/app/systeme': () => import('./SystemAdmin'),
};

const prefetchedRoutes = new Set<string>();
function handleRoutePrefetch(path: string) {
  if (prefetchedRoutes.has(path)) return;
  const factory = routePrefetchMap[path];
  if (factory) {
    prefetchedRoutes.add(path);
    prefetchRoute(factory);
  }
}




export default function Sidebar() {
  const { t } = useTranslation(['sidebar', 'common']);
  const { user } = useAuth();
  const { licence } = useLicence();
  const { isOpen, isCollapsed, toggleSidebar, closeSidebar, toggleCollapse } = useSidebar();
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const { data: reapproStats } = useReapproStats();

  // Sur mobile (< lg = 1024px), la sidebar s'affiche en overlay → toujours en mode étendu
  // Le mode collapsé (icônes seules) est une feature desktop uniquement
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const effectiveCollapsed = isMobile ? false : isCollapsed;
  
  const allMenuItems = useMemo(() => NAV_ITEMS.map(item => ({
    ...item,
    label: t(item.labelKey, item.labelFallback ?? ''),
    submenus: item.submenus?.map(sub => ({
      ...sub,
      label: t(sub.labelKey, sub.labelFallback ?? ''),
    })),
  })), [t]);

  // Logic to calculate menuItems based on authentication
  const menuItems = useMemo(() => filterNavItemsForUser(user, allMenuItems), [user, allMenuItems]);

  const categoryOrder = useMemo(() => [
    'accueil',
    'ventes',
    'catalogue',
    'achats',
    'tiers',
    'stock',
    'rapports',
    'parametres',
  ] as const, []);

  type CategoryKey = typeof categoryOrder[number];

  const menuGroups = useMemo(() => {
    const grouped = menuItems.reduce((acc, item) => {
      const cat = (item.category || 'parametres') as CategoryKey;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<CategoryKey, typeof menuItems>);

    return categoryOrder.reduce<{ category: CategoryKey; items: typeof menuItems }[]>((acc, cat) => {
      if (grouped[cat]?.length > 0) {
        acc.push({ category: cat, items: grouped[cat] });
      }
      return acc;
    }, []);
  }, [menuItems, categoryOrder]);



  // Effect to automatically handle expansion and collapsing
  useEffect(() => {
    // Find if current location belongs to a submenu
    const parent = menuItems.find(item => 
      item.submenus?.some(sub => location.pathname === sub.path)
    );

    if (parent) {
      setOpenMenu(parent.key);
    } else {
      // If we are not in a submenu path, check if we are in a top-level path that is NOT a submenu
      const isTopLevel = menuItems.some(item => !item.submenus && item.path === location.pathname);
      if (isTopLevel) {
        setOpenMenu(null);
      }
    }
  }, [location.pathname, menuItems]);

  const toggleMenu = (key: string) => {
    setOpenMenu(prev => prev === key ? null : key);
  }

  const renderMenuItem = (item: typeof menuItems[number]) => {
    const hasSubmenus = !!item.submenus;
    const isParentOfActive = item.submenus?.some(sub => location.pathname.startsWith(sub.path));
    const isMenuOpen = openMenu === item.key;
    const subGroups = hasSubmenus ? groupNavSubMenus(item.submenus!) : [];

    if (hasSubmenus) {
      return (
        <motion.li variants={fadeInUp} key={item.key}>
          {effectiveCollapsed ? (
            <div className="relative group w-full">
              <button
                type="button"
                className={cn(
                  "flex items-center justify-center w-full h-10 rounded-xl cursor-pointer transition-all",
                  isParentOfActive
                    ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )}
                title={item.label}
                aria-label={item.label}
                aria-haspopup="menu"
              >
                <span className="size-4">{item.icon}</span>
              </button>
              <ul className="absolute left-full top-0 z-[100] p-2 shadow-2xl shadow-black/20 bg-slate-900 border border-slate-700 rounded-2xl w-52 ml-3 invisible group-hover:visible group-focus-within:visible opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-200">
                <li className="px-3 py-2 border-b border-slate-800 mb-1">
                  <span className="text-label font-bold text-emerald-400 uppercase tracking-wider">{item.label}</span>
                </li>
                {subGroups.map((grp, gi) => (
                  <Fragment key={grp.group ?? gi}>
                    {grp.group && (
                      <li aria-hidden="true" className="px-3 pt-2 pb-0.5">
                        <span className="text-micro font-bold uppercase tracking-wider text-slate-500">
                          {t(`menu_groups.${grp.group}`)}
                        </span>
                      </li>
                    )}
                    {grp.items.map((sub) => (
                      <li key={sub.path}>
                        <NavLink to={sub.path} onClick={closeSidebar}
                          onMouseEnter={() => handleRoutePrefetch(sub.path)}
                          className={({ isActive }) => cn(
                            "block rounded-lg text-sm py-2 px-3 transition-all",
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-300 font-semibold border-l-2 border-l-emerald-500'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800 border-l-2 border-l-transparent'
                          )}
                        >
                          {sub.label}
                        </NavLink>
                      </li>
                    ))}
                  </Fragment>
                ))}
              </ul>
            </div>
          ) : (
            <>
              {/* Parent button */}
              <button
                onClick={() => toggleMenu(item.key)}
                aria-expanded={isMenuOpen}
                aria-controls={`sidebar-submenu-${item.key}`}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group",
                  isMenuOpen || isParentOfActive
                    ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )}
              >
                <span className={cn(
                  "size-5 shrink-0 transition-colors",
                  (isMenuOpen || isParentOfActive) && 'text-emerald-400'
                )}>
                  {item.icon}
                </span>
                <span className="flex-1 text-left text-sm font-medium tracking-tight truncate">{item.label}</span>
                <ChevronDown className={cn(
                  "size-4 shrink-0 transition-transform duration-200 text-slate-500",
                  isMenuOpen && 'rotate-180'
                )} />
              </button>

              {/* Submenus with vertical connector */}
              <div className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out",
                isMenuOpen ? 'max-h-[600px] opacity-100 mt-1' : 'max-h-0 opacity-0'
              )}>
                <ul id={`sidebar-submenu-${item.key}`} className="relative ml-4 pl-3 border-l border-slate-700 flex flex-col gap-0.5 py-1">
                  {subGroups.map((grp, gi) => (
                    <Fragment key={grp.group ?? gi}>
                      {grp.group && (
                        <li aria-hidden="true" className="px-2 pt-2 pb-0.5">
                          <span className="text-micro font-bold uppercase tracking-wider text-slate-500">
                            {t(`menu_groups.${grp.group}`)}
                          </span>
                        </li>
                      )}
                      {grp.items.map((sub) => (
                        <li key={sub.path}>
                          <NavLink
                            to={sub.path}
                            onClick={closeSidebar}
                            onMouseEnter={() => handleRoutePrefetch(sub.path)}
                            className={({ isActive }) => cn(
                              "flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-all",
                              isActive
                              ? 'bg-emerald-500/20 text-emerald-300 font-semibold border-l-2 border-l-emerald-500'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800 border-l-2 border-l-transparent'
                            )}
                          >
                            <span className="truncate">{sub.label}</span>
                            {sub.key === 'inventaire_reappro' && reapproStats && reapproStats.product_count > 0 && (
                              <span className="ml-2 shrink-0 bg-red-500 text-white text-caption font-bold px-2 py-0.5 rounded-full">
                                {reapproStats.product_count}
                              </span>
                            )}
                          </NavLink>
                        </li>
                      ))}
                    </Fragment>
                  ))}
                </ul>
              </div>
            </>
          )}
        </motion.li>
      );
    }

    return (
      <motion.li variants={fadeInUp} key={item.path}>
        <NavLink
          to={item.path!}
          end={item.path === '/app'}
          onClick={closeSidebar}
          onMouseEnter={() => item.path && handleRoutePrefetch(item.path)}
          title={effectiveCollapsed ? item.label : undefined}
          className={({ isActive }) => cn(
            "flex items-center rounded-xl transition-all duration-200",
            effectiveCollapsed
              ? 'justify-center w-full h-10'
              : 'gap-3 px-3 py-2.5',
            isActive
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 font-semibold border-l-4 border-l-emerald-300'
              : 'text-slate-400 hover:text-white hover:bg-slate-800 border-l-4 border-l-transparent'
          )}
        >
          <span className={cn("shrink-0", effectiveCollapsed ? 'size-5' : 'size-5')}>{item.icon}</span>
          {!effectiveCollapsed && <span className="text-sm font-medium tracking-tight truncate">{item.label}</span>}
        </NavLink>
      </motion.li>
    );
  };

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={toggleSidebar}
        className="fixed top-3 left-3 z-50 lg:hidden size-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-colors"
        aria-label={t('sidebar:toggle_menu')}
        aria-expanded={isOpen}
      >
        {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "flex flex-col fixed lg:sticky top-0 z-50 transition-all duration-300 ease-in-out",
          "bg-slate-900 border-r border-slate-800",
          effectiveCollapsed ? 'w-[70px]' : 'w-[min(280px,85vw)] lg:w-[260px]',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        style={{ height: '100dvh', minHeight: '100dvh' }}
      >
        {/* ── HEADER ── */}
        <div className={cn(
          "flex items-center gap-3 px-4 py-4 border-b border-white/10",
          effectiveCollapsed && 'justify-center px-3'
        )}>
          <div className="shrink-0">
            <ZenithLogo variant={1} size={effectiveCollapsed ? 26 : 32} />
          </div>
          {!effectiveCollapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-black text-white tracking-widest uppercase leading-none truncate">
                {licence?.pharmacie_nom || 'Zenith'}
              </h1>
              <p className="text-micro font-bold text-primary uppercase tracking-[0.2em] mt-0.5 truncate">
                {licence?.pharmacien_nom || t('app_subtitle')}
              </p>
            </div>
          )}
          {/* Close button mobile */}
          <button
            onClick={closeSidebar}
            className="lg:hidden shrink-0 size-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-all"
            aria-label={t('sidebar:close_menu')}
          >
            <X className="size-5" />
          </button>
          {/* Collapse button desktop */}
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex shrink-0 size-7 rounded-lg bg-white/10 hover:bg-white/20 text-white/50 hover:text-white items-center justify-center transition-all"
            title={effectiveCollapsed ? t('sidebar:expand') : t('sidebar:collapse')}
          >
            {effectiveCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
        </div>

        {/* ── NAV ── */}
        <nav className="flex-1 overflow-y-auto py-2 custom-scrollbar" aria-label={t('sidebar:navigation_label')}>
          {effectiveCollapsed ? (
            <motion.ul className="flex flex-col gap-1 px-2" variants={staggerGrid} initial="hidden" animate="show">
              {menuItems.map((item) => renderMenuItem(item))}
            </motion.ul>
          ) : (
            <motion.div className="px-3" variants={staggerContainer} initial="hidden" animate="show">
              {menuGroups.map((group) => (
                <motion.div variants={fadeInUp} key={group.category}>
                  <h3 className="text-caption font-bold uppercase tracking-wider text-slate-300 px-1 mt-3 mb-2 border-b border-slate-700/50 pb-1">
                    {t(`sidebar:categories.${group.category}`)}
                  </h3>
                  <motion.ul variants={staggerGrid} className="bg-slate-800/50 rounded-xl p-1.5 flex flex-col gap-1">
                    {group.items.map((item) => renderMenuItem(item))}
                  </motion.ul>
                </motion.div>
              ))}
            </motion.div>
          )}
        </nav>

        {/* Footer */}
        <div className="shrink-0 px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-primary shadow-[0_0_6px] shadow-primary/50"></div>
            <span className="text-caption font-semibold text-white/40 uppercase tracking-wider truncate">Zenith OS</span>
            <span className="text-micro text-white/30 font-mono ml-auto" title={formatVersion()}>{formatVersion().split('.').slice(0,2).join('.')}</span>
          </div>
        </div>
      </aside>
    </>
  );
}

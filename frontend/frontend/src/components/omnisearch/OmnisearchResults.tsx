import {
  Zap,
  PlusCircle,
  ShoppingCart,
  BarChart3,
  WalletCards,
  FileText,
  ClipboardList,
  Users,
  LayoutDashboard,
  PackageSearch,
  Store,
  Package,
  AlertTriangle,
  TrendingUp,
  Compass,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '../shadcn/command';
import { Badge } from '../shadcn/badge';
import { ProductResultContent, type SearchResult } from '../common/ProductSearch';
import type { ProduitModel, Client, Facture, Commande, Fournisseur } from '../../types';
import type { AppPage } from '../../config/appPages';
import { formatDate } from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext';

interface Props {
  search: string;
  loading: boolean;
  produits: ProduitModel[];
  clients: Client[];
  factures: Facture[];
  commandes: Commande[];
  fournisseurs: Fournisseur[];
  searchablePages: AppPage[];
  onSelectAction: (action: string) => void;
  onSelectLink: (path: string) => void;
  onSelectProduit: (id: number) => void;
  onSelectClient: (id: number) => void;
  onSelectFacture: (id: number) => void;
  onSelectCommande: (id: number) => void;
  onSelectFournisseur: (id: number) => void;
}

export default function OmnisearchResults({
  search,
  loading,
  produits,
  clients,
  factures,
  commandes,
  fournisseurs,
  searchablePages,
  onSelectAction,
  onSelectLink,
  onSelectProduit,
  onSelectClient,
  onSelectFacture,
  onSelectCommande,
  onSelectFournisseur,
}: Props) {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const allowedMenus = new Set(user?.allowed_menus || []);
  const canAccess = (...permissions: string[]) => Boolean(user?.is_superuser || permissions.some(permission => allowedMenus.has(permission)));

  const itemClass =
    'flex items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-slate-100 text-slate-800 aria-selected:bg-emerald-50 aria-selected:text-emerald-700 transition-all group';
  const itemClassNav =
    'flex items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-slate-100 text-slate-800 aria-selected:bg-emerald-50/60 aria-selected:text-emerald-700 transition-all opacity-80 aria-selected:opacity-100';
  const groupHeadingClass =
    'text-caption font-semibold text-slate-400 pt-4 pb-1 px-3 uppercase tracking-wider';
  const navChip = 'size-7 rounded-lg flex items-center justify-center mr-3 shrink-0 transition-colors';

  const navChipSelected = 'bg-slate-100 text-slate-500 group-aria-selected:bg-emerald-100 group-aria-selected:text-emerald-600';

  const quickActions = [
    { action: 'NEW_SALE', value: 'action-new-sale', icon: Zap, chip: 'bg-emerald-100 text-emerald-600', label: t('omnisearch.actions.new_sale'), desc: t('omnisearch.actions.new_sale_desc'), visible: canAccess('facturation') },
    { action: 'NEW_PRODUCT', value: 'action-new-product', icon: PlusCircle, chip: 'bg-slate-100 text-slate-600', label: t('omnisearch.actions.new_product'), desc: t('omnisearch.actions.new_product_desc'), visible: canAccess('produits') },
    { action: 'NEW_CLIENT', value: 'action-new-client', icon: Users, chip: 'bg-slate-100 text-slate-600', label: t('omnisearch.actions.new_client'), desc: t('omnisearch.actions.new_client_desc'), visible: canAccess('clients') },
    { action: 'NEW_ORDER', value: 'action-new-order', icon: ShoppingCart, chip: 'bg-slate-100 text-slate-600', label: t('omnisearch.actions.new_order'), desc: t('omnisearch.actions.new_order_desc'), visible: canAccess('commandes', 'commandes_loc', 'commandes_dir') },
    { action: 'OPEN_PRODUCTS', value: 'action-open-products', icon: Package, chip: 'bg-slate-100 text-slate-600', label: t('omnisearch.actions.open_products'), desc: t('omnisearch.actions.open_products_desc'), visible: canAccess('produits') },
    { action: 'OPEN_PERIMES', value: 'action-open-perimes', icon: AlertTriangle, chip: 'bg-red-100 text-red-600', label: t('omnisearch.actions.open_perimes'), desc: t('omnisearch.actions.open_perimes_desc'), visible: canAccess('inventaire', 'inventaire_perimes', 'perimes') },
    { action: 'OPEN_CADENCIER', value: 'action-open-cadencier', icon: TrendingUp, chip: 'bg-slate-100 text-slate-600', label: t('omnisearch.actions.open_cadencier'), desc: t('omnisearch.actions.open_cadencier_desc'), visible: canAccess('inventaire', 'inventaire_cadencier') },
  ].filter(action => action.visible);

  const navLinks = [
    { path: '/app/rapports-mensuels', value: 'nav-rapport-mensuel', icon: BarChart3, chip: navChipSelected, label: t('omnisearch.nav.monthly_report'), visible: canAccess('statistiques', 'statistiques_mensuels') },
    { path: '/app/facturation', value: 'nav-facturation', icon: WalletCards, chip: navChipSelected, label: t('omnisearch.nav.billing'), visible: canAccess('facturation') },
    { path: '/app/ventes', value: 'nav-ventes', icon: FileText, chip: navChipSelected, label: t('omnisearch.nav.sales_list'), visible: canAccess('ventes', 'ventes_consultation') },
    { path: '/app/journal-caisse', value: 'nav-journal-caisse', icon: ClipboardList, chip: navChipSelected, label: t('omnisearch.nav.cash_journal'), visible: canAccess('ventes', 'ventes_journal') },
    { path: '/app/clients', value: 'nav-clients', icon: Users, chip: navChipSelected, label: t('omnisearch.nav.clients'), visible: canAccess('clients', 'clients_consultation') },
    { path: '/app/dashboard', value: 'nav-dashboard', icon: LayoutDashboard, chip: navChipSelected, label: t('omnisearch.nav.dashboard'), visible: canAccess('dashboard') },
  ].filter(link => link.visible);

  return (
    <CommandList className="flex-1 overflow-y-auto p-2 cmdk-list">
      <CommandEmpty className="py-8 text-center text-sm text-slate-500 italic">
        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <span className="inline-block w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span>{t('omnisearch.searching', 'Recherche en cours…')}</span>
          </div>
        ) : (
          t('omnisearch.empty', 'Aucun résultat trouvé.')
        )}
      </CommandEmpty>

      {!search && (<>
        <CommandGroup
          heading={t('omnisearch.groups.actions', 'Actions Rapides')}
          className={groupHeadingClass}
        >
          {quickActions.map(({ action, value, icon: Icon, chip, label, desc }) => (
            <CommandItem key={value} value={value} onSelect={() => onSelectAction(action)} className={itemClassNav}>
              <div className={`${navChip} ${chip}`}>
                <Icon className="size-3.5" />
              </div>
              <span className="font-medium">{label}</span>
              <span className="text-caption text-slate-400 truncate ml-2">{desc}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
      </>)}

      {!search && (<>
        <CommandGroup
          heading={t('omnisearch.groups.navigation')}
          className={groupHeadingClass}
        >
          {navLinks.map(({ path, value, icon: Icon, chip, label }) => (
            <CommandItem key={value} value={value} onSelect={() => onSelectLink(path)} className={itemClassNav}>
              <div className={`${navChip} ${chip}`}>
                <Icon className="size-3.5" />
              </div>
              <span className="font-medium">{label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
      </>)}

      {search && searchablePages.length > 0 && (<>
        <CommandGroup
          heading={t('omnisearch.groups.pages', 'Pages et fonctionnalités')}
          className={groupHeadingClass}
        >
          {searchablePages.map((page) => (
            <CommandItem key={page.value} value={page.value} onSelect={() => onSelectLink(page.path)} className={itemClassNav}>
              <div className={`${navChip} ${navChipSelected}`}>
                <Compass className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-medium">{t(`sidebar:${page.titleKey}`)}</span>
                <span className="block text-caption text-slate-400 truncate">
                  {t(`sidebar:categories.${page.category}`)}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
      </>)}

      {search && canAccess('produits') && produits.length > 0 && (<>
        <CommandGroup
          heading={t('omnisearch.groups.products')}
          className={groupHeadingClass}
        >
          {produits.map((prod) => (
            <CommandItem
              key={`prod-${prod.id}`}
              value={`prod-${prod.id}`}
              onSelect={() => onSelectProduit(prod.id!)}
              className={itemClass}
            >
              <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center mr-3 group-aria-selected:bg-emerald-100 transition-colors">
                <PackageSearch className="size-4 text-slate-400 group-aria-selected:text-emerald-700" />
              </div>
              <ProductResultContent
                product={prod as unknown as SearchResult}
                showPrice={false}
                extraMeta={[prod.forme_name, !prod.rayon_name ? prod.groupe_name : null].filter(Boolean).length > 0 ? (
                  <span className="truncate uppercase">
                    {[prod.forme_name, !prod.rayon_name ? prod.groupe_name : null].filter(Boolean).join(' • ')}
                  </span>
                ) : undefined}
              />
              {prod.selling_price !== undefined && (
                <Badge variant="outline" className="ml-2 shrink-0 text-xs font-black tracking-tight group-aria-selected:bg-emerald-600 group-aria-selected:text-white group-aria-selected:border-emerald-600 transition-colors">
                  {Number(prod.selling_price).toLocaleString()} F
                </Badge>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
      </>)}

      {search && canAccess('clients', 'clients_consultation') && clients.length > 0 && (<>
        <CommandGroup
          heading={t('omnisearch.groups.clients')}
          className={groupHeadingClass}
        >
          {clients.map((client) => (
            <CommandItem
              key={`client-${client.id}`}
              value={`client-${client.id}`}
              onSelect={() => onSelectClient(client.id!)}
              className={itemClass}
            >
              <div className="size-8 rounded-full bg-indigo-50 flex items-center justify-center mr-3 group-aria-selected:bg-indigo-100 transition-colors">
                <Users className="size-4 text-indigo-500" />
              </div>
              <div className="flex-1 flex flex-col items-start">
                <span className="font-bold group-aria-selected:text-indigo-500">{client.name}</span>
                <span className="text-caption text-slate-500 font-bold">{client.phone || client.email || t('omnisearch.no_contact', 'Aucun contact')}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
      </>)}

      {search && canAccess('ventes', 'ventes_consultation') && factures.length > 0 && (<>
        <CommandGroup
          heading={t('omnisearch.groups.invoices')}
          className={groupHeadingClass}
        >
          {factures.map((f) => (
            <CommandItem
              key={`facture-${f.id}`}
              value={`facture-${f.id}`}
              onSelect={() => onSelectFacture(f.id)}
              className={itemClass}
            >
              <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center mr-3 group-aria-selected:bg-emerald-100 transition-colors">
                <FileText className="size-4 text-blue-600" />
              </div>
              <div className="flex-1 flex flex-col items-start overflow-hidden">
                <span className="font-bold truncate w-full group-aria-selected:text-emerald-700">{f.numero_facture}</span>
                <span className="text-caption text-slate-500 font-medium uppercase font-mono">
                  {f.client_name || t('passerby_client')} • {formatDate(f.date)}
                </span>
              </div>
              <Badge variant="outline" className="ml-2 shrink-0 text-xs font-black tracking-tight group-aria-selected:bg-emerald-600 group-aria-selected:text-white group-aria-selected:border-emerald-600 transition-colors">
                {Number(f.total_ttc).toLocaleString()} F
              </Badge>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
      </>)}

      {search && canAccess('commandes', 'commandes_loc', 'commandes_dir') && commandes.length > 0 && (<>
        <CommandGroup
          heading={t('omnisearch.groups.procurements')}
          className={groupHeadingClass}
        >
          {commandes.map((o) => (
            <CommandItem
              key={`commande-${o.id}`}
              value={`commande-${o.id}`}
              onSelect={() => onSelectCommande(o.id)}
              className={itemClass}
            >
              <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center mr-3 group-aria-selected:bg-emerald-100 transition-colors">
                <ShoppingCart className="size-4 text-amber-500" />
              </div>
              <div className="flex-1 flex flex-col items-start overflow-hidden">
                <span className="font-bold truncate w-full group-aria-selected:text-emerald-700">{o.fournisseur_nom || t('omnisearch.wholesaler', 'Grossiste')}</span>
                <span className="text-caption text-slate-500 font-medium uppercase">
                  {formatDate(o.date)} • {o.status_display}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
      </>)}

      {search && canAccess('fournisseurs') && fournisseurs.length > 0 && (<>
        <CommandGroup
          heading={t('omnisearch.groups.suppliers')}
          className={groupHeadingClass}
        >
          {fournisseurs.map((s) => (
            <CommandItem
              key={`fournisseur-${s.id}`}
              value={`fournisseur-${s.id}`}
              onSelect={() => onSelectFournisseur(s.id)}
              className={itemClass}
            >
              <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center mr-3 group-aria-selected:bg-emerald-100 transition-colors">
                <Store className="size-4 text-indigo-500" />
              </div>
              <div className="flex-1 flex flex-col items-start overflow-hidden">
                <span className="font-bold truncate w-full group-aria-selected:text-emerald-700">{s.name}</span>
                <span className="text-caption text-slate-500 font-medium uppercase">{s.phone || s.email || t('omnisearch.no_contact', 'Aucun contact')}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </>)}
    </CommandList>
  );
}

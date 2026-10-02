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
import type { ProduitModel, Client, Facture, Commande, Fournisseur } from '../../types';
import { formatDate } from '../../utils/dateUtils';

interface Props {
  search: string;
  loading: boolean;
  produits: ProduitModel[];
  clients: Client[];
  factures: Facture[];
  commandes: Commande[];
  fournisseurs: Fournisseur[];
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
  onSelectAction,
  onSelectLink,
  onSelectProduit,
  onSelectClient,
  onSelectFacture,
  onSelectCommande,
  onSelectFournisseur,
}: Props) {
  const { t } = useTranslation('common');

  const itemClass =
    'flex items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-slate-100 text-slate-800 aria-selected:bg-emerald-50 aria-selected:text-emerald-700 transition-all group';
  const itemClassNav =
    'flex items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-slate-100 text-slate-800 aria-selected:bg-emerald-50/60 aria-selected:text-emerald-700 transition-all opacity-80 aria-selected:opacity-100';
  const tileClass =
    'flex flex-col items-start gap-2.5 p-3 rounded-xl border border-slate-200/80 bg-white cursor-pointer aria-selected:border-emerald-300 aria-selected:bg-emerald-50/70 aria-selected:shadow-sm transition-all';
  const groupHeadingClass =
    'text-caption font-semibold text-slate-400 pt-4 pb-1 px-3 uppercase tracking-wider';
  const chipClass = 'size-8 rounded-lg flex items-center justify-center shrink-0';
  const navChip = 'size-7 rounded-lg flex items-center justify-center mr-3 shrink-0 transition-colors';

  const navChipSelected = 'bg-slate-100 text-slate-500 group-aria-selected:bg-emerald-100 group-aria-selected:text-emerald-600';

  const quickActions = [
    { action: 'NEW_SALE', value: 'action-new-sale', icon: Zap, chip: 'bg-emerald-100 text-emerald-600', label: t('omnisearch.actions.new_sale'), desc: t('omnisearch.actions.new_sale_desc') },
    { action: 'NEW_PRODUCT', value: 'action-new-product', icon: PlusCircle, chip: 'bg-slate-100 text-slate-600', label: t('omnisearch.actions.new_product'), desc: t('omnisearch.actions.new_product_desc') },
    { action: 'NEW_CLIENT', value: 'action-new-client', icon: Users, chip: 'bg-slate-100 text-slate-600', label: t('omnisearch.actions.new_client'), desc: t('omnisearch.actions.new_client_desc') },
    { action: 'NEW_ORDER', value: 'action-new-order', icon: ShoppingCart, chip: 'bg-slate-100 text-slate-600', label: t('omnisearch.actions.new_order'), desc: t('omnisearch.actions.new_order_desc') },
    { action: 'OPEN_PRODUCTS', value: 'action-open-products', icon: Package, chip: 'bg-slate-100 text-slate-600', label: t('omnisearch.actions.open_products'), desc: t('omnisearch.actions.open_products_desc') },
    { action: 'OPEN_PERIMES', value: 'action-open-perimes', icon: AlertTriangle, chip: 'bg-red-100 text-red-600', label: t('omnisearch.actions.open_perimes'), desc: t('omnisearch.actions.open_perimes_desc') },
    { action: 'OPEN_CADENCIER', value: 'action-open-cadencier', icon: TrendingUp, chip: 'bg-slate-100 text-slate-600', label: t('omnisearch.actions.open_cadencier'), desc: t('omnisearch.actions.open_cadencier_desc') },
  ];

  const navLinks = [
    { path: '/app/rapports-mensuels', value: 'nav-rapport-mensuel', icon: BarChart3, chip: navChipSelected, label: t('omnisearch.nav.monthly_report') },
    { path: '/app/facturation', value: 'nav-facturation', icon: WalletCards, chip: navChipSelected, label: t('omnisearch.nav.billing') },
    { path: '/app/ventes', value: 'nav-ventes', icon: FileText, chip: navChipSelected, label: t('omnisearch.nav.sales_list') },
    { path: '/app/journal-caisse', value: 'nav-journal-caisse', icon: ClipboardList, chip: navChipSelected, label: t('omnisearch.nav.cash_journal') },
    { path: '/app/clients', value: 'nav-clients', icon: Users, chip: navChipSelected, label: t('omnisearch.nav.clients') },
    { path: '/app/dashboard', value: 'nav-dashboard', icon: LayoutDashboard, chip: navChipSelected, label: t('omnisearch.nav.dashboard') },
  ];

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
          <div className="grid grid-cols-2 gap-2 px-1 pb-1">
            {quickActions.map(({ action, value, icon: Icon, chip, label, desc }) => (
              <CommandItem key={value} value={value} onSelect={() => onSelectAction(action)} className={tileClass}>
                <div className={`${chipClass} ${chip}`}>
                  <Icon className="size-4" />
                </div>
                <div className="flex flex-col items-start gap-0.5">
                  <span className="text-xs font-bold text-slate-700 leading-tight">{label}</span>
                  <span className="text-caption font-medium text-slate-500 leading-tight">{desc}</span>
                </div>
              </CommandItem>
            ))}
          </div>
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

      {search && produits.length > 0 && (<>
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
              <div className="flex-1 flex flex-col items-start overflow-hidden">
                <span className="font-bold truncate w-full group-aria-selected:text-emerald-700" title={prod.name}>{prod.name}</span>
                <span className="text-caption text-slate-500 font-medium uppercase">
                  {prod.forme_name} • {prod.rayon_name || prod.groupe_name}
                </span>
              </div>
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

      {search && clients.length > 0 && (<>
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

      {search && factures.length > 0 && (<>
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

      {search && commandes.length > 0 && (<>
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

      {search && fournisseurs.length > 0 && (<>
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

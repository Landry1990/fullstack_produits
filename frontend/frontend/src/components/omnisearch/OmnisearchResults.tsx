import { Command } from 'cmdk';
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
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
    'flex items-center px-4 py-3 rounded-xl cursor-pointer hover:bg-slate-100 text-slate-800 aria-selected:bg-blue-50 aria-selected:text-blue-600 transition-all group';
  const itemClassNav =
    'flex items-center px-4 py-3 rounded-xl cursor-pointer hover:bg-slate-100 text-slate-800 aria-selected:bg-blue-50/50 aria-selected:text-blue-600 transition-all opacity-80 aria-selected:opacity-100';

  return (
    <Command.List className="flex-1 overflow-y-auto p-2 cmdk-list">
      <Command.Empty className="py-8 text-center text-sm text-slate-400 italic">
        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <span className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>Recherche en cours…</span>
          </div>
        ) : (
          t('omnisearch.empty', 'Aucun résultat trouvé.')
        )}
      </Command.Empty>

      {!search && (
        <Command.Group
          heading={t('omnisearch.groups.actions', '⚡ Actions Rapides')}
          className="text-[10px] font-black text-slate-400 pt-4 pb-1 px-3 uppercase tracking-[0.15em]"
        >
          <Command.Item onSelect={() => onSelectAction('NEW_SALE')} value="action-new-sale" className={`${itemClass} py-3.5`}>
            <Zap className="size-4 mr-3 text-amber-500 group-aria-selected:scale-110 transition-transform" />
            <span className="font-bold">{t('omnisearch.actions.new_sale')}</span>
          </Command.Item>
          <Command.Item onSelect={() => onSelectAction('NEW_PRODUCT')} value="action-new-product" className={`${itemClass} py-3.5`}>
            <PlusCircle className="size-4 mr-3 text-cyan-500 group-aria-selected:scale-110 transition-transform" />
            <span className="font-bold">{t('omnisearch.actions.new_product')}</span>
          </Command.Item>
          <Command.Item onSelect={() => onSelectAction('NEW_CLIENT')} value="action-new-client" className={`${itemClass} py-3.5`}>
            <PlusCircle className="size-4 mr-3 text-emerald-600 group-aria-selected:scale-110 transition-transform" />
            <span className="font-bold">{t('omnisearch.actions.new_client')}</span>
          </Command.Item>
          <Command.Item onSelect={() => onSelectAction('NEW_ORDER')} value="action-new-order" className={`${itemClass} py-3.5`}>
            <ShoppingCart className="size-4 mr-3 text-indigo-500 group-aria-selected:scale-110 transition-transform" />
            <span className="font-bold">{t('omnisearch.actions.new_order')}</span>
          </Command.Item>
        </Command.Group>
      )}

      {!search && (
        <Command.Group
          heading={t('omnisearch.groups.navigation')}
          className="text-[10px] font-black text-slate-400 pt-4 pb-1 px-3 uppercase tracking-[0.15em]"
        >
          <Command.Item onSelect={() => onSelectLink('/app/rapports-mensuels')} value="nav-rapport-mensuel" className={itemClassNav}>
            <BarChart3 className="size-4 mr-3 text-emerald-500" />
            <span className="font-medium">{t('omnisearch.nav.monthly_report')}</span>
          </Command.Item>
          <Command.Item onSelect={() => onSelectLink('/app/facturation')} value="nav-facturation" className={itemClassNav}>
            <WalletCards className="size-4 mr-3" />
            <span className="font-medium">{t('omnisearch.nav.billing')}</span>
          </Command.Item>
          <Command.Item onSelect={() => onSelectLink('/app/ventes')} value="nav-ventes" className={itemClassNav}>
            <FileText className="size-4 mr-3" />
            <span className="font-medium">{t('omnisearch.nav.sales_list')}</span>
          </Command.Item>
          <Command.Item onSelect={() => onSelectLink('/app/journal-caisse')} value="nav-journal-caisse" className={itemClassNav}>
            <ClipboardList className="size-4 mr-3" />
            <span className="font-medium">{t('omnisearch.nav.cash_journal')}</span>
          </Command.Item>
          <Command.Item onSelect={() => onSelectLink('/app/clients')} value="nav-clients" className={itemClassNav}>
            <Users className="size-4 mr-3" />
            <span className="font-medium">{t('omnisearch.nav.clients')}</span>
          </Command.Item>
          <Command.Item onSelect={() => onSelectLink('/app/dashboard')} value="nav-dashboard" className={itemClassNav}>
            <LayoutDashboard className="size-4 mr-3" />
            <span className="font-medium">{t('omnisearch.nav.dashboard')}</span>
          </Command.Item>
        </Command.Group>
      )}

      {search && produits.length > 0 && (
        <Command.Group
          heading={t('omnisearch.groups.products')}
          className="text-[10px] font-black text-slate-400 pt-4 pb-1 px-3 uppercase tracking-[0.15em]"
        >
          {produits.map((prod) => (
            <Command.Item
              key={`prod-${prod.id}`}
              value={`prod-${prod.id}`}
              onSelect={() => onSelectProduit(prod.id!)}
              className={itemClass}
            >
              <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center mr-3 group-aria-selected:bg-blue-100 transition-colors">
                <PackageSearch className="size-4 text-slate-400 group-aria-selected:text-blue-600" />
              </div>
              <div className="flex-1 flex flex-col items-start overflow-hidden">
                <span className="font-bold truncate w-full group-aria-selected:text-blue-600" title={prod.name}>{prod.name}</span>
                <span className="text-[10px] text-slate-500 font-medium uppercase">
                  {prod.forme_name} • {prod.rayon_name || prod.groupe_name}
                </span>
              </div>
              {prod.selling_price !== undefined && (
                <span className="ml-2 px-3 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-black tracking-tight group-aria-selected:bg-blue-600 group-aria-selected:text-white transition-colors">
                  {Number(prod.selling_price).toLocaleString()} F
                </span>
              )}
            </Command.Item>
          ))}
        </Command.Group>
      )}

      {search && clients.length > 0 && (
        <Command.Group
          heading={t('omnisearch.groups.clients')}
          className="text-[10px] font-black text-slate-400 pt-4 pb-1 px-3 uppercase tracking-[0.15em]"
        >
          {clients.map((client) => (
            <Command.Item
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
                <span className="text-[10px] text-slate-500 font-bold">{client.phone || client.email || 'Aucun contact'}</span>
              </div>
            </Command.Item>
          ))}
        </Command.Group>
      )}

      {search && factures.length > 0 && (
        <Command.Group
          heading={t('omnisearch.groups.invoices')}
          className="text-[10px] font-black text-slate-400 pt-4 pb-1 px-3 uppercase tracking-[0.15em]"
        >
          {factures.map((f) => (
            <Command.Item
              key={`facture-${f.id}`}
              value={`facture-${f.id}`}
              onSelect={() => onSelectFacture(f.id)}
              className={itemClass}
            >
              <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center mr-3 group-aria-selected:bg-blue-100 transition-colors">
                <FileText className="size-4 text-blue-600" />
              </div>
              <div className="flex-1 flex flex-col items-start overflow-hidden">
                <span className="font-bold truncate w-full group-aria-selected:text-blue-600">{f.numero_facture}</span>
                <span className="text-[10px] text-slate-500 font-medium uppercase font-mono">
                  {f.client_name || 'Client de passage'} • {formatDate(f.date)}
                </span>
              </div>
              <span className="ml-2 px-3 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-black tracking-tight group-aria-selected:bg-blue-600 group-aria-selected:text-white transition-colors">
                {Number(f.total_ttc).toLocaleString()} F
              </span>
            </Command.Item>
          ))}
        </Command.Group>
      )}

      {search && commandes.length > 0 && (
        <Command.Group
          heading={t('omnisearch.groups.procurements')}
          className="text-[10px] font-black text-slate-400 pt-4 pb-1 px-3 uppercase tracking-[0.15em]"
        >
          {commandes.map((o) => (
            <Command.Item
              key={`commande-${o.id}`}
              value={`commande-${o.id}`}
              onSelect={() => onSelectCommande(o.id)}
              className={itemClass}
            >
              <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center mr-3 group-aria-selected:bg-blue-100 transition-colors">
                <ShoppingCart className="size-4 text-amber-500" />
              </div>
              <div className="flex-1 flex flex-col items-start overflow-hidden">
                <span className="font-bold truncate w-full group-aria-selected:text-blue-600">{o.fournisseur_nom || 'Grossiste'}</span>
                <span className="text-[10px] text-slate-500 font-medium uppercase">
                  {formatDate(o.date)} • {o.status_display}
                </span>
              </div>
            </Command.Item>
          ))}
        </Command.Group>
      )}

      {search && fournisseurs.length > 0 && (
        <Command.Group
          heading={t('omnisearch.groups.suppliers')}
          className="text-[10px] font-black text-slate-400 pt-4 pb-1 px-3 uppercase tracking-[0.15em]"
        >
          {fournisseurs.map((s) => (
            <Command.Item
              key={`fournisseur-${s.id}`}
              value={`fournisseur-${s.id}`}
              onSelect={() => onSelectFournisseur(s.id)}
              className={itemClass}
            >
              <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center mr-3 group-aria-selected:bg-blue-100 transition-colors">
                <Store className="size-4 text-indigo-500" />
              </div>
              <div className="flex-1 flex flex-col items-start overflow-hidden">
                <span className="font-bold truncate w-full group-aria-selected:text-blue-600">{s.name}</span>
                <span className="text-[10px] text-slate-500 font-medium uppercase">{s.phone || s.email || 'Contact N/A'}</span>
              </div>
            </Command.Item>
          ))}
        </Command.Group>
      )}
    </Command.List>
  );
}

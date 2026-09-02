import {
  PackageSearch,
  Users,
  FileText,
  ShoppingCart,
  Truck,
  LayoutDashboard,
  Zap,
  ShoppingBag,
  Info,
  AlertTriangle,
  Calendar,
  Layers,
  TrendingUp as TrendingIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { Card, CardContent } from '../shadcn/card';
import { Badge } from '../shadcn/badge';
import type { ProduitModel, Client, Facture, Commande, Fournisseur } from '../../types';
import { formatDate } from '../../utils/dateUtils';

interface SelectedItem {
  type: string;
  data?: unknown;
  id?: string;
}

interface ProduitDetail {
  nom?: string;
  prix?: string | number;
  quantite?: number;
}

interface Props {
  selectedItem: SelectedItem | null;
}

export default function OmnisearchPreview({ selectedItem }: Props) {
  const { t } = useTranslation('common');

  if (!selectedItem) {
    return <EmptyPreview t={t} />;
  }

  switch (selectedItem.type) {
    case 'product':
      return <ProductPreview data={selectedItem.data as ProduitModel | undefined} t={t} />;
    case 'client':
      return <ClientPreview data={selectedItem.data as Client | undefined} t={t} />;
    case 'facture':
      return <FacturePreview data={selectedItem.data as Facture | undefined} t={t} />;
    case 'commande':
      return <CommandePreview data={selectedItem.data as Commande | undefined} t={t} />;
    case 'fournisseur':
      return <FournisseurPreview data={selectedItem.data as Fournisseur | undefined} t={t} />;
    default:
      return <EmptyPreview t={t} />;
  }
}

/* ==================== PRODUCT PREVIEW ==================== */
function ProductPreview({ data, t }: { data?: ProduitModel; t: TFunction }) {
  if (!data || !data.name) return <EmptyPreview t={t} />;

  const stock = data.stock || 0;
  const stockAlert = data.stock_alert || 0;
  const isLowStock = stock <= stockAlert;

  return (
    <div className="p-8 space-y-8 h-full flex flex-col">
      <div className="space-y-4">
        <div className="size-20 bg-blue-50 rounded-3xl flex items-center justify-center shadow-inner">
          <PackageSearch className="size-10 text-blue-600" />
        </div>
        <div>
          <h3 className="text-2xl font-black tracking-tighter text-slate-800 leading-tight">{data.name}</h3>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline" className="text-xs font-black">{data.forme_name}</Badge>
            <Badge variant="secondary" className="text-xs font-black">{data.rayon_name}</Badge>
          </div>
        </div>
      </div>

      {data.message_alerte && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex gap-3 items-start animate-pulse">
          <AlertTriangle className="size-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-xs font-bold text-red-500 leading-relaxed">{data.message_alerte}</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 space-y-1">
          <CardContent className="p-0">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <Layers className="size-3" /> {t('omnisearch.preview.stock_rayon')}
            </div>
            <div className={`text-2xl font-black ${isLowStock ? 'text-red-500' : 'text-slate-800'}`}>
              {stock}
            </div>
          </CardContent>
        </Card>
        <Card className="p-4 space-y-1">
          <CardContent className="p-0">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <Layers className="size-3 text-slate-500" /> {t('omnisearch.preview.stock_reserve')}
            </div>
            <div className="text-2xl font-black text-slate-500">{data.stock_reserve || 0}</div>
          </CardContent>
        </Card>
        <Card className="col-span-2 p-4 flex justify-between items-center">
          <CardContent className="p-0 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <Calendar className="size-3" /> {t('omnisearch.preview.expiry')}
            </div>
            <div className="text-sm font-black italic">
              {data.next_expiring_date ? formatDate(data.next_expiring_date as string) : t('omnisearch.preview.expiry_none')}
            </div>
          </CardContent>
          {data.is_perissable && (
            <div className="size-10 rounded-full bg-amber-50 flex items-center justify-center" title={t('omnisearch.preview.perishable')}>
              <Info className="size-5 text-amber-500" />
            </div>
          )}
        </Card>
        <Card className="col-span-2 p-4 space-y-1 bg-indigo-50/50 border-indigo-200">
          <CardContent className="p-0">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-500/40">
              <TrendingIcon className="size-3" /> {t('omnisearch.preview.last_purchase')}
            </div>
            <div className="flex justify-between items-baseline">
              <div className="text-lg font-black text-indigo-500">
                {data.dernier_achat ? formatDate(data.dernier_achat as string) : '-'}
              </div>
              <div className="text-xs font-mono font-bold opacity-60">
                {data.last_purchase_price ? `${Number(data.last_purchase_price).toLocaleString()} F` : ''}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-auto p-4 bg-blue-50/50 rounded-2xl border border-blue-200">
        <p className="text-[10px] font-bold text-blue-500/60 uppercase tracking-tighter italic">{t('omnisearch.preview.manage_product')}</p>
      </div>
    </div>
  );
}

/* ==================== CLIENT PREVIEW ==================== */
function ClientPreview({ data, t }: { data?: Client; t: TFunction }) {
  if (!data || !data.name) return <EmptyPreview t={t} />;

  return (
    <div className="p-8 space-y-8 h-full flex flex-col">
      <div className="space-y-4">
        <div className="size-20 bg-indigo-50 rounded-full flex items-center justify-center shadow-inner">
          <Users className="size-10 text-indigo-500" />
        </div>
        <div>
          <h3 className="text-2xl font-black tracking-tighter text-slate-800 leading-tight">{data.name}</h3>
          <div className="flex gap-2 mt-2">
            <Badge variant="secondary" className="text-[8px] font-black uppercase tracking-widest">{data.client_type}</Badge>
            {data.is_active ? (
              <Badge variant="default" className="text-[8px] font-black">{t('omnisearch.preview.active')}</Badge>
            ) : (
              <Badge variant="outline" className="text-[8px] font-black">{t('omnisearch.preview.inactive')}</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card className="p-5 flex items-center justify-between">
          <CardContent className="p-0 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('omnisearch.preview.loyalty_points')}</span>
            <div className="text-3xl font-black text-indigo-500">{data.points_fidelite || 0}</div>
          </CardContent>
          <div className="p-3 bg-indigo-50 text-indigo-500 rounded-2xl">
            <Zap className="size-6" />
          </div>
        </Card>
        <Card className="p-5 flex items-center justify-between">
          <CardContent className="p-0 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('omnisearch.preview.deposit_balance')}</span>
            <div className="text-3xl font-black text-blue-600">
              {Number(data.solde_depot || 0).toLocaleString()} F
            </div>
          </CardContent>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <ShoppingBag className="size-6" />
          </div>
        </Card>
      </div>

      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t('omnisearch.preview.contact')}</span>
          <p className="text-sm font-bold truncate">{data.phone || '-'}</p>
          <p className="text-xs font-medium opacity-60 truncate">{data.email || ''}</p>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t('omnisearch.preview.address')}</span>
          <p className="text-xs font-bold leading-relaxed">{data.address || '-'}</p>
        </div>
      </div>
    </div>
  );
}

/* ==================== FACTURE PREVIEW ==================== */
function FacturePreview({ data, t }: { data?: Facture; t: TFunction }) {
  if (!data) return <EmptyPreview t={t} />;
  const produitsDetails = (data as Facture & { produits_details?: ProduitDetail[] }).produits_details;

  return (
    <div className="p-8 space-y-8 h-full flex flex-col">
      <div className="space-y-4">
        <div className="size-20 bg-blue-50 rounded-3xl flex items-center justify-center shadow-inner">
          <FileText className="size-10 text-blue-600" />
        </div>
        <div>
          <h3 className="text-2xl font-black tracking-tighter text-slate-800 leading-tight">{data.numero_facture}</h3>
          <p className="text-lg font-bold text-slate-500">{data.client_name || 'Client de passage'}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Card className="col-span-2 p-5 bg-blue-50/50 border-blue-200 flex items-center justify-between">
            <CardContent className="p-0 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-500/40">{t('omnisearch.preview.total_amount')}</span>
              <div className="text-3xl font-black text-blue-600">{Number(data.total_ttc).toLocaleString()} F</div>
            </CardContent>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <TrendingIcon className="size-6" />
            </div>
          </Card>
          <Card className="p-4 space-y-1">
            <CardContent className="p-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('omnisearch.preview.status')}</div>
              <div className="text-sm font-bold uppercase">{data.status_display}</div>
            </CardContent>
          </Card>
          <Card className="p-4 space-y-1">
            <CardContent className="p-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('omnisearch.preview.date')}</div>
              <div className="text-sm font-bold tracking-tight">{formatDate(data.date)}</div>
            </CardContent>
          </Card>
        </div>

        {produitsDetails && produitsDetails.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">
              Produits ({produitsDetails.length})
            </h4>
            <div className="bg-slate-100/50 rounded-2xl overflow-hidden border border-slate-200">
              {produitsDetails.slice(0, 5).map((p: ProduitDetail) => (
                <div key={p.nom} className="px-4 py-3 flex items-center justify-between border-b border-slate-200/50 last:border-0 hover:bg-slate-100/80 transition-colors">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-slate-800 line-clamp-1">{p.nom}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{Number(p.prix).toLocaleString()} F / unité</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded flex items-center gap-1">
                      <span className="text-[10px] font-black">X</span>
                      <span className="text-xs font-black">{p.quantite}</span>
                    </span>
                  </div>
                </div>
              ))}
              {produitsDetails.length > 5 && (
                <div className="px-4 py-2 text-center text-[10px] text-slate-500 font-bold italic">
                  ...et {produitsDetails.length - 5} article(s) supplémentaire(s)
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================== COMMANDE PREVIEW ==================== */
function CommandePreview({ data, t }: { data?: Commande; t: TFunction }) {
  if (!data) return <EmptyPreview t={t} />;
  const produitsDetails = (data as Commande & { produits_details?: ProduitDetail[] }).produits_details;

  return (
    <div className="p-8 space-y-8 h-full flex flex-col">
      <div className="space-y-4">
        <div className="size-20 bg-amber-50 rounded-3xl flex items-center justify-center shadow-inner">
          <ShoppingCart className="size-10 text-amber-500" />
        </div>
        <div>
          <h3 className="text-2xl font-black tracking-tighter text-slate-800 leading-tight">{data.fournisseur_nom || 'Grossiste'}</h3>
          <p className="text-sm font-bold opacity-60 italic">{t('omnisearch.groups.procurements')}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Card className="col-span-2 p-5 bg-amber-50/50 border-amber-200 flex items-center justify-between">
            <CardContent className="p-0 space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-500/40">{t('omnisearch.preview.total_amount')}</span>
              <div className="text-3xl font-black text-amber-500">{Number(data.total || 0).toLocaleString()} F</div>
            </CardContent>
          </Card>
          <Card className="p-4 space-y-1">
            <CardContent className="p-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('omnisearch.preview.status')}</div>
              <div className="text-xs font-bold uppercase">{data.status_display}</div>
            </CardContent>
          </Card>
          <Card className="p-4 space-y-1">
            <CardContent className="p-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('omnisearch.preview.items')}</div>
              <div className="text-xl font-black">{data.items_count || 0}</div>
            </CardContent>
          </Card>
        </div>

        {produitsDetails && produitsDetails.length > 0 && (
          <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200 text-center space-y-1">
            <p className="text-sm font-bold text-amber-600">{produitsDetails.length} article(s)</p>
            <p className="text-[10px] text-slate-500 font-medium italic">Cliquez ou appuyez sur Entrée pour ouvrir le détail</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================== FOURNISSEUR PREVIEW ==================== */
function FournisseurPreview({ data, t }: { data?: Fournisseur; t: TFunction }) {
  if (!data) return <EmptyPreview t={t} />;

  return (
    <div className="p-8 space-y-8 h-full flex flex-col">
      <div className="space-y-4">
        <div className="size-20 bg-indigo-50 rounded-3xl flex items-center justify-center shadow-inner">
          <Truck className="size-10 text-indigo-500" />
        </div>
        <div>
          <h3 className="text-2xl font-black tracking-tighter text-slate-800 leading-tight">{data.name}</h3>
          <div className="flex gap-2 mt-2">
            <Badge variant="secondary" className="text-[8px] font-black uppercase tracking-widest">{t('omnisearch.groups.suppliers')}</Badge>
          </div>
        </div>
      </div>

      <div className="space-y-6 pt-4 border-t border-slate-200">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t('omnisearch.preview.contact')}</span>
          <p className="text-sm font-bold">{data.phone || '-'}</p>
          <p className="text-xs font-medium opacity-60">{data.email || ''}</p>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t('omnisearch.preview.address')}</span>
          <p className="text-sm font-bold leading-relaxed">{data.address || '-'}</p>
        </div>
      </div>
    </div>
  );
}

/* ==================== EMPTY PREVIEW ==================== */
function EmptyPreview({ t }: { t: TFunction }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-300 grayscale scale-95 transition-all">
      <div className="size-24 rounded-full border-4 border-dashed border-slate-500/30 flex items-center justify-center mb-4">
        <LayoutDashboard className="size-12" />
      </div>
      <h4 className="text-lg font-black tracking-tighter uppercase italic">{t('omnisearch.preview.title')}</h4>
      <p className="text-xs font-bold max-w-xs mt-1 italic">{t('omnisearch.preview.subtitle')}</p>
    </div>
  );
}

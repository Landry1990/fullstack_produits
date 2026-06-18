import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../hooks/useConfirm';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { Checkbox } from './ui/Checkbox';
import { Select } from './ui/Select';
import { Card } from './ui/Card';
import {
  Trash2, RotateCcw, AlertTriangle, Package, Users, Truck, Search, X,
  ShoppingCart, CreditCard, Clock, ClipboardList, Receipt, ChevronDown,
  ChevronUp, Filter, Archive, ArrowUpFromLine
} from 'lucide-react';

interface TrashedItem {
  id: number;
  name: string;
  type: 'produit' | 'client' | 'fournisseur' | 'commande' | 'avoir' | 'promis' | 'inventaire' | 'facture' | 'user';
  details: Record<string, any>;
  deleted_at: string | null;
}

interface CorbeilleData {
  total: number;
  items: {
    produits: TrashedItem[];
    clients: TrashedItem[];
    fournisseurs: TrashedItem[];
    commandes: TrashedItem[];
    avoirs: TrashedItem[];
    promis: TrashedItem[];
    inventaires: TrashedItem[];
    factures: TrashedItem[];
    users: TrashedItem[];
  };
}

type TypeKey = 'all' | TrashedItem['type'];

const TYPE_CONFIG: { key: TypeKey; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
  { key: 'all', label: 'Tous', icon: <Archive className="size-3.5" />, color: 'text-slate-600', bg: 'bg-slate-50' },
  { key: 'produit', label: 'Produits', icon: <Package className="size-3.5" />, color: 'text-blue-600', bg: 'bg-blue-50' },
  { key: 'client', label: 'Clients', icon: <Users className="size-3.5" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { key: 'fournisseur', label: 'Fournisseurs', icon: <Truck className="size-3.5" />, color: 'text-amber-600', bg: 'bg-amber-50' },
  { key: 'commande', label: 'Commandes', icon: <ShoppingCart className="size-3.5" />, color: 'text-primary', bg: 'bg-primary/10' },
  { key: 'avoir', label: 'Avoirs', icon: <CreditCard className="size-3.5" />, color: 'text-rose-600', bg: 'bg-rose-50' },
  { key: 'promis', label: 'Promis', icon: <Clock className="size-3.5" />, color: 'text-purple-600', bg: 'bg-purple-50' },
  { key: 'inventaire', label: 'Inventaires', icon: <ClipboardList className="size-3.5" />, color: 'text-teal-600', bg: 'bg-teal-50' },
  { key: 'facture', label: 'Factures', icon: <Receipt className="size-3.5" />, color: 'text-orange-600', bg: 'bg-orange-50' },
  { key: 'user', label: 'Utilisateurs', icon: <Users className="size-3.5" />, color: 'text-slate-500', bg: 'bg-slate-50' },
];

function groupByDate(items: TrashedItem[]) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: Record<string, TrashedItem[]> = { 'Aujourd\'hui': [], 'Hier': [], 'Cette semaine': [], 'Plus ancien': [] };

  items.forEach(item => {
    const d = item.deleted_at ? new Date(item.deleted_at) : new Date();
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) groups["Aujourd'hui"].push(item);
    else if (d.getTime() === yesterday.getTime()) groups["Hier"].push(item);
    else if (d >= weekAgo) groups["Cette semaine"].push(item);
    else groups["Plus ancien"].push(item);
  });

  return Object.entries(groups).filter(([, v]) => v.length > 0);
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export default function Corbeille() {
  const { t } = useTranslation('corbeille');
  const confirm = useConfirm();
  const [data, setData] = useState<CorbeilleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeKey>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('corbeille/');
      setData(res.data);
      setSelectedIds(new Set());
    } catch { toast.error(t('messages.fetch_error')); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const allItems = useMemo(() => {
    if (!data) return [];
    let items: TrashedItem[] = [];
    if (typeFilter === 'all') {
      items = Object.values(data.items).flat();
    } else {
      items = data.items[typeFilter as keyof typeof data.items] || [];
    }
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(q) || i.type.toLowerCase().includes(q));
  }, [data, typeFilter, searchQuery]);

  const grouped = useMemo(() => groupByDate(allItems), [allItems]);

  const toggleSelect = (key: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === allItems.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(allItems.map(i => `${i.type}-${i.id}`)));
  };

  const handleRestore = async (items: { model: string; id: number }[]) => {
    const grouped: Record<string, number[]> = {};
    items.forEach(({ model, id }) => { (grouped[model] ||= []).push(id); });
    setActionLoading(true);
    let restored = 0;
    try {
      for (const [model, ids] of Object.entries(grouped)) {
        const res = await api.post('corbeille/restore/', { model, ids });
        restored += res.data.restored;
      }
      toast.success(t('messages.restore_success', { count: restored }));
      fetchData();
    } catch { toast.error(t('messages.restore_error')); }
    finally { setActionLoading(false); }
  };

  const handlePurge = async (items: { model: string; id: number }[]) => {
    const ok = await confirm({
      title: t('messages.purge_confirm_title'),
      message: t('messages.purge_confirm_body', { count: items.length }),
      variant: 'danger',
      confirmText: t('messages.purge_confirm_btn'),
    });
    if (!ok) return;
    const grouped: Record<string, number[]> = {};
    items.forEach(({ model, id }) => { (grouped[model] ||= []).push(id); });
    setActionLoading(true);
    let deleted = 0;
    try {
      for (const [model, ids] of Object.entries(grouped)) {
        const res = await api.post('corbeille/purge/', { model, ids });
        deleted += res.data.deleted;
      }
      toast.success(t('messages.purge_success', { count: deleted }));
      fetchData();
    } catch (err: any) { toast.error(err.response?.data?.detail || t('messages.purge_error')); }
    finally { setActionLoading(false); }
  };

  const handleEmptyTrash = async () => {
    const ok = await confirm({
      title: t('messages.empty_confirm_title'),
      message: t('messages.empty_confirm_body', { count: data?.total || 0 }),
      variant: 'danger',
      confirmText: t('messages.empty_confirm_btn'),
    });
    if (!ok) return;
    setActionLoading(true);
    try {
      const res = await api.post('corbeille/empty/');
      toast.success(res.data.message);
      if (res.data.errors?.length) res.data.errors.forEach((e: string) => toast.error(e, { duration: 5000 }));
      fetchData();
    } catch { toast.error(t('messages.empty_error')); }
    finally { setActionLoading(false); }
  };

  const selectedItems = useMemo(() => {
    const result: { model: string; id: number }[] = [];
    selectedIds.forEach(key => {
      const [type, idStr] = key.split('-');
      result.push({ model: type, id: parseInt(idStr) });
    });
    return result;
  }, [selectedIds]);

  const typeInfo = TYPE_CONFIG.find(c => c.key === typeFilter) || TYPE_CONFIG[0];

  return (
    <div className="h-full bg-base-200 flex flex-col">
      {/* Header */}
      <div className="bg-base-100 border-b border-base-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center">
              <Trash2 className="size-5 text-error" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-base-content tracking-tight">{t('title')}</h1>
              <p className="text-xs text-base-content/40">{data?.total ?? 0} élément{data && data.total > 1 ? 's' : ''} en suppression</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="p-2 h-9 w-9" onClick={fetchData} disabled={loading} title="Actualiser">
              {loading ? <span className="inline-block size-4 border-2 border-base-300 border-t-primary rounded-full animate-spin" /> : <RotateCcw className="size-4" />}
            </Button>
            {(data?.total ?? 0) > 0 && (
              <Button variant="danger" size="sm" onClick={handleEmptyTrash} disabled={actionLoading}>
                <Trash2 className="size-3.5 mr-1.5" />
                <span className="hidden sm:inline">Vider tout</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-base-100 border-b border-base-200 px-6 py-3 flex items-center gap-3 shrink-0">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground z-10" />
          <Input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-9 text-sm"
          />
          {searchQuery && (
            <Button variant="ghost" size="sm" className="absolute right-0 top-0 h-9 w-8 p-0" onClick={() => setSearchQuery('')}>
              <X className="size-3.5" />
            </Button>
          )}
        </div>

        {/* Type filter */}
        <Select size="sm" value={typeFilter} onChange={e => setTypeFilter(e.target.value as TypeKey)} className="w-40">
          {TYPE_CONFIG.map(c => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </Select>

        {/* Select all */}
        {allItems.length > 0 && (
          <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs font-medium">
            <Checkbox checked={selectedIds.size === allItems.length && allItems.length > 0} className="size-4 mr-1.5" />
            {selectedIds.size > 0 ? `${selectedIds.size} sélectionné${selectedIds.size > 1 ? 's' : ''}` : 'Tout sélectionner'}
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <span className="inline-block size-8 border-2 border-base-300 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {!loading && allItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-base-content/40">
            <div className="w-16 h-16 rounded-2xl bg-base-200 flex items-center justify-center mb-4">
              <Trash2 className="size-7 text-base-content/30" />
            </div>
            <p className="font-semibold text-base-content/60 text-sm">{t('empty_state.title')}</p>
            <p className="text-xs mt-1">{t('empty_state.subtitle')}</p>
          </div>
        )}

        {!loading && grouped.map(([section, items]) => (
          <div key={section} className="mb-6">
            <div className="flex items-center gap-2 mb-3 sticky top-0 bg-base-200 py-1 z-10">
              <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{section}</span>
              <div className="flex-1 h-px bg-base-300" />
              <span className="text-[10px] font-bold text-base-content/30">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map(item => {
                const key = `${item.type}-${item.id}`;
                const isSel = selectedIds.has(key);
                const isExp = expandedId === key;
                const cfg = TYPE_CONFIG.find(c => c.key === item.type) || TYPE_CONFIG[0];
                return (
                  <Card key={key} padding="sm" variant={isSel ? 'elevated' : 'default'}
                    className={`group cursor-pointer transition-all ${isSel ? 'ring-1 ring-primary/20 border-primary/30' : 'hover:border-base-300 hover:shadow-md'}`}
                    onClick={() => toggleSelect(key)}>
                    <div className="flex items-start gap-3">
                      <div className="pt-0.5">
                        <Checkbox checked={isSel} />
                      </div>
                      <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${cfg.bg}`}>
                        <span className={cfg.color}>{cfg.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-base-content truncate">{item.name}</span>
                          <Badge variant="outline" size="sm" className={cfg.color}>{cfg.label}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="size-3" />{formatTime(item.deleted_at)}
                          </span>
                          {item.type === 'produit' && (
                            <span className="text-[10px] text-muted-foreground">Stock: {item.details.stock ?? 0}</span>
                          )}
                          {item.type === 'facture' && (
                            <span className="text-[10px] text-muted-foreground">{item.details.total?.toLocaleString('fr-FR')} FCFA</span>
                          )}
                          {item.type === 'client' && item.details.phone && (
                            <span className="text-[10px] text-muted-foreground">{item.details.phone}</span>
                          )}
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px] text-success border-success/20 hover:bg-success/10 hover:text-success"
                          onClick={e => { e.stopPropagation(); handleRestore([{ model: item.type, id: item.id }]); }}
                          disabled={actionLoading}
                          title="Restaurer">
                          <ArrowUpFromLine className="size-3.5 mr-1" />
                          <span className="hidden sm:inline">Restaurer</span>
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px] text-error border-error/20 hover:bg-error/10 hover:text-error"
                          onClick={e => { e.stopPropagation(); handlePurge([{ model: item.type, id: item.id }]); }}
                          disabled={actionLoading}
                          title="Supprimer définitivement">
                          <Trash2 className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); setExpandedId(isExp ? null : key); }}>
                          {isExp ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </Button>
                      </div>
                    </div>
                    {/* Expanded details */}
                    {isExp && (
                      <div className="mt-3 pt-3 border-t border-base-200/50">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {Object.entries(item.details).map(([k, v]) => {
                            if (v === null || v === undefined || v === '') return null;
                            return (
                              <Card key={k} padding="sm" variant="bordered" className="bg-base-200/50">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/40">{k.replace(/_/g, ' ')}</p>
                                <p className="text-xs text-base-content font-medium truncate">{String(v)}</p>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="shrink-0 bg-base-100 border-t border-base-200 px-6 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-base-content">
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => handleRestore(selectedItems)} disabled={actionLoading}>
              <ArrowUpFromLine className="size-3.5 mr-1.5" />
              Restaurer
            </Button>
            <Button size="sm" variant="danger" onClick={() => handlePurge(selectedItems)} disabled={actionLoading}>
              <Trash2 className="size-3.5 mr-1.5" />
              Supprimer définitivement
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

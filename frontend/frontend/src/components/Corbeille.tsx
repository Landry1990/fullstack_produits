import React, { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../hooks/useConfirm';
import { Trash2, RotateCcw, AlertTriangle, Package, Users, Truck, Search, X, ShoppingCart, CreditCard, Clock, ClipboardList, Receipt } from 'lucide-react';

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

type TabKey = 'all' | 'produits' | 'clients' | 'fournisseurs' | 'commandes' | 'avoirs' | 'promis' | 'inventaires' | 'factures' | 'users';

const TAB_CONFIG_KEYS: { key: TabKey; labelKey: string; icon: React.ReactNode; color: string }[] = [
  { key: 'all', labelKey: 'tabs.all', icon: <Trash2 className="size-4" />, color: 'text-base-content' },
  { key: 'produits', labelKey: 'tabs.produits', icon: <Package className="size-4" />, color: 'text-blue-500' },
  { key: 'clients', labelKey: 'tabs.clients', icon: <Users className="size-4" />, color: 'text-emerald-500' },
  { key: 'fournisseurs', labelKey: 'tabs.fournisseurs', icon: <Truck className="size-4" />, color: 'text-amber-500' },
  { key: 'commandes', labelKey: 'tabs.commandes', icon: <ShoppingCart className="size-4" />, color: 'text-indigo-500' },
  { key: 'avoirs', labelKey: 'tabs.avoirs', icon: <CreditCard className="size-4" />, color: 'text-rose-500' },
  { key: 'promis', labelKey: 'tabs.promis', icon: <Clock className="size-4" />, color: 'text-purple-500' },
  { key: 'inventaires', labelKey: 'tabs.inventaires', icon: <ClipboardList className="size-4" />, color: 'text-teal-500' },
  { key: 'factures', labelKey: 'tabs.factures', icon: <Receipt className="size-4" />, color: 'text-orange-500' },
  { key: 'users', labelKey: 'tabs.users', icon: <Users className="size-4" />, color: 'text-slate-500' },
];

export default function Corbeille() {
  const { t } = useTranslation('corbeille');
  const confirm = useConfirm();
  const [data, setData] = useState<CorbeilleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<{ model: string; id: number }[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('corbeille/');
      setData(res.data);
      setSelectedIds([]);
    } catch (err) {
      toast.error(t('messages.fetch_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Flatten items based on active tab
  const allItems = useMemo(() => {
    if (!data) return [];
    const items: TrashedItem[] = [];
    if (activeTab === 'all' || activeTab === 'produits') items.push(...(data.items.produits || []));
    if (activeTab === 'all' || activeTab === 'clients') items.push(...(data.items.clients || []));
    if (activeTab === 'all' || activeTab === 'fournisseurs') items.push(...(data.items.fournisseurs || []));
    if (activeTab === 'all' || activeTab === 'commandes') items.push(...(data.items.commandes || []));
    if (activeTab === 'all' || activeTab === 'avoirs') items.push(...(data.items.avoirs || []));
    if (activeTab === 'all' || activeTab === 'promis') items.push(...(data.items.promis || []));
    if (activeTab === 'all' || activeTab === 'inventaires') items.push(...(data.items.inventaires || []));
    if (activeTab === 'all' || activeTab === 'factures') items.push(...(data.items.factures || []));
    if (activeTab === 'all' || activeTab === 'users') items.push(...(data.items.users || []));
    return items;
  }, [data, activeTab]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allItems;
    const q = searchQuery.toLowerCase();
    return allItems.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q)
    );
  }, [allItems, searchQuery]);

  const isSelected = (type: string, id: number) =>
    selectedIds.some(s => s.model === type && s.id === id);

  const toggleSelect = (type: string, id: number) => {
    setSelectedIds(prev =>
      isSelected(type, id)
        ? prev.filter(s => !(s.model === type && s.id === id))
        : [...prev, { model: type, id }]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map(item => ({ model: item.type, id: item.id })));
    }
  };

  const handleRestore = async (items: { model: string; id: number }[]) => {
    // Group by model
    const grouped: Record<string, number[]> = {};
    items.forEach(({ model, id }) => {
      if (!grouped[model]) grouped[model] = [];
      grouped[model].push(id);
    });

    setActionLoading(true);
    let totalRestored = 0;
    try {
      for (const [model, ids] of Object.entries(grouped)) {
        const res = await api.post('corbeille/restore/', { model, ids });
        totalRestored += res.data.restored;
      }
      toast.success(t('messages.restore_success', { count: totalRestored }));
      fetchData();
    } catch (err) {
      toast.error(t('messages.restore_error'));
    } finally {
      setActionLoading(false);
    }
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
    items.forEach(({ model, id }) => {
      if (!grouped[model]) grouped[model] = [];
      grouped[model].push(id);
    });

    setActionLoading(true);
    let totalDeleted = 0;
    try {
      for (const [model, ids] of Object.entries(grouped)) {
        const res = await api.post('corbeille/purge/', { model, ids });
        totalDeleted += res.data.deleted;
      }
      toast.success(t('messages.purge_success', { count: totalDeleted }));
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('messages.purge_error'));
    } finally {
      setActionLoading(false);
    }
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
      if (res.data.errors?.length) {
        res.data.errors.forEach((e: string) => toast.error(e, { duration: 5000 }));
      }
      fetchData();
    } catch (err) {
      toast.error(t('messages.empty_error'));
    } finally {
      setActionLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'produit': return <Package className="size-4 text-blue-500" />;
      case 'client': return <Users className="size-4 text-emerald-500" />;
      case 'fournisseur': return <Truck className="size-4 text-amber-500" />;
      case 'commande': return <ShoppingCart className="size-4 text-indigo-500" />;
      case 'avoir': return <CreditCard className="size-4 text-rose-500" />;
      case 'promis': return <Clock className="size-4 text-purple-500" />;
      case 'inventaire': return <ClipboardList className="size-4 text-teal-500" />;
      case 'facture': return <Receipt className="size-4 text-orange-500" />;
      case 'user': return <Users className="size-4 text-slate-500" />;
      default: return <Trash2 className="size-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const config: Record<string, { bg: string; text: string; labelKey: string }> = {
      produit: { bg: 'bg-blue-500/10', text: 'text-primary', labelKey: 'badges.produit' },
      client: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', labelKey: 'badges.client' },
      fournisseur: { bg: 'bg-amber-500/10', text: 'text-amber-600', labelKey: 'badges.fournisseur' },
      commande: { bg: 'bg-indigo-500/10', text: 'text-indigo-600', labelKey: 'badges.commande' },
      avoir: { bg: 'bg-rose-500/10', text: 'text-rose-600', labelKey: 'badges.avoir' },
      promis: { bg: 'bg-purple-500/10', text: 'text-purple-600', labelKey: 'badges.promis' },
      inventaire: { bg: 'bg-teal-500/10', text: 'text-teal-600', labelKey: 'badges.inventaire' },
      facture: { bg: 'bg-orange-500/10', text: 'text-orange-600', labelKey: 'badges.facture' },
      user: { bg: 'bg-slate-500/10', text: 'text-slate-600', labelKey: 'badges.user' },
    };
    const c = config[type] || { bg: 'bg-base-200', text: 'text-base-content', labelKey: type };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${c.bg} ${c.text}`}>
        {t(c.labelKey, { defaultValue: type })}
      </span>
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return '-'; }
  };

  const getDetailString = (item: TrashedItem) => {
    const d = item.details;
    switch (item.type) {
      case 'produit':
        return `Stock: ${d.stock ?? 0} · PV: ${d.selling_price?.toLocaleString('fr-FR') ?? '0'} FCFA${d.cip1 ? ` · CIP: ${d.cip1}` : ''}`;
      case 'client':
        return `${d.phone || ''}${d.email ? ` · ${d.email}` : ''}${d.client_type ? ` · ${d.client_type}` : ''}`;
      case 'fournisseur':
        return `${d.phone || ''}${d.email ? ` · ${d.email}` : ''}`;
      case 'commande':
      case 'avoir':
        return `Fournisseur: ${d.fournisseur || 'Inconnu'} · Statut: ${d.status || 'Inconnu'}${d.total !== undefined ? ` · Total: ${d.total.toLocaleString('fr-FR')} FCFA` : ''}`;
      case 'promis':
        return `Client: ${d.client || 'Inconnu'} · Statut: ${d.status || 'Inconnu'} · Qté: ${d.quantite ?? '-'}`;
      case 'inventaire':
        return `Type: ${d.type || 'Inconnu'} · Statut: ${d.status || 'Inconnu'}`;
      case 'facture':
        return `Client: ${d.client || 'Inconnu'} · Statut: ${d.status || 'Inconnu'}${d.total !== undefined ? ` · Total: ${d.total.toLocaleString('fr-FR')} FCFA` : ''}`;
      case 'user':
        return `${d.first_name || ''} ${d.last_name || ''} ${d.email ? `(${d.email})` : ''}`.trim();
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-base-200/50 p-4 md:p-6 space-y-5 font-sans">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="size-12 bg-red-500/10 rounded-2xl flex items-center justify-center">
            <Trash2 className="size-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-base-content tracking-tight">
              {t('title')}
            </h1>
            <p className="text-base-content/50 text-sm">
              {t('subtitle')}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={fetchData}
              className="btn btn-sm btn-ghost text-base-content/50 hover:text-primary"
              disabled={loading}
            >
              {loading
                ? <span className="loading loading-spinner loading-xs" />
                : <RotateCcw className="size-4" />}
            </button>
            {(data?.total ?? 0) > 0 && (
              <button
                onClick={handleEmptyTrash}
                className="btn btn-sm btn-error text-white gap-1.5 rounded-xl"
                disabled={actionLoading}
              >
                <Trash2 className="size-3.5" />
                {t('actions.empty_trash')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
        {TAB_CONFIG_KEYS.map(tab => {
          const count = tab.key === 'all'
            ? (data?.total ?? 0)
            : (data?.items[tab.key as keyof typeof data.items]?.length ?? 0);
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSelectedIds([]); }}
              className={`flex items-center gap-3 p-4 rounded-2xl border transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-base-100 border-primary/30 shadow-md shadow-primary/5 ring-1 ring-primary/20'
                  : 'bg-base-100/60 border-base-200 hover:bg-base-100 hover:shadow-sm'
              }`}
            >
              <div className={`p-2 rounded-xl ${activeTab === tab.key ? 'bg-primary/10' : 'bg-base-200/80'}`}>
                {tab.icon}
              </div>
              <div className="text-left">
                <p className="text-2xl font-black text-base-content">{count}</p>
                <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">{t(tab.labelKey)}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto bg-base-100 rounded-2xl shadow-sm border border-base-200 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-base-200 flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/30" />
            <input
              type="text"
              placeholder={t('search')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input input-bordered w-full pl-10 pr-8 rounded-xl h-10 text-sm bg-base-200/50 border-base-300 focus:border-primary focus:bg-base-100"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="size-4 text-base-content/30 hover:text-base-content" />
              </button>
            )}
          </div>

          {/* Bulk actions */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in">
              <span className="text-xs font-bold text-base-content/50">
                {t('actions.selected', { count: selectedIds.length })}
              </span>
              <button
                onClick={() => handleRestore(selectedIds)}
                className="btn btn-sm btn-success text-white gap-1 rounded-xl"
                disabled={actionLoading}
              >
                <RotateCcw className="size-3.5" />
                {t('actions.restore')}
              </button>
              <button
                onClick={() => handlePurge(selectedIds)}
                className="btn btn-sm btn-error text-white gap-1 rounded-xl"
                disabled={actionLoading}
              >
                <Trash2 className="size-3.5" />
                {t('actions.delete_permanently')}
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="btn btn-sm btn-ghost text-base-content/50 rounded-xl"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-base-content/40">
            <div className="size-20 rounded-full bg-base-200/80 flex items-center justify-center mb-4">
              <Trash2 className="size-8" />
            </div>
            <p className="font-bold text-lg">{t('empty_state.title')}</p>
            <p className="text-sm mt-1">{t('empty_state.subtitle')}</p>
          </div>
        )}

        {/* Items List */}
        {!loading && filteredItems.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr className="text-[10px] font-black text-base-content/40 uppercase tracking-widest border-b border-base-200">
                  <th className="w-10">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm checkbox-primary"
                      checked={selectedIds.length === filteredItems.length && filteredItems.length > 0}
                      onChange={selectAll}
                    />
                  </th>
                  <th>{t('table.name')}</th>
                  <th>{t('table.type')}</th>
                  <th className="hidden md:table-cell">{t('table.details')}</th>
                  <th className="hidden md:table-cell">{t('table.deleted_at')}</th>
                  <th className="text-right">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr
                    key={`${item.type}-${item.id}`}
                    className={`border-b border-base-200/60 hover:bg-base-200/30 transition-colors ${
                      isSelected(item.type, item.id) ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm checkbox-primary"
                        checked={isSelected(item.type, item.id)}
                        onChange={() => toggleSelect(item.type, item.id)}
                      />
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-base-200/80">{getTypeIcon(item.type)}</div>
                        <span className="font-bold text-sm text-base-content truncate max-w-[250px]">
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td>{getTypeBadge(item.type)}</td>
                    <td className="hidden md:table-cell">
                      <span className="text-xs text-base-content/50 truncate max-w-[300px] inline-block">
                        {getDetailString(item)}
                      </span>
                    </td>
                    <td className="hidden md:table-cell">
                      <span className="text-xs text-base-content/40">{formatDate(item.deleted_at)}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => handleRestore([{ model: item.type, id: item.id }])}
                          className="btn btn-xs btn-ghost text-emerald-600 hover:bg-emerald-50 gap-1 rounded-lg"
                          title={t('actions.restore')}
                          disabled={actionLoading}
                        >
                          <RotateCcw className="size-3.5" />
                          <span className="hidden sm:inline">{t('actions.restore')}</span>
                        </button>
                        <button
                          onClick={() => handlePurge([{ model: item.type, id: item.id }])}
                          className="btn btn-xs btn-ghost text-red-500 hover:bg-red-50 gap-1 rounded-lg"
                          title={t('actions.delete_permanently')}
                          disabled={actionLoading}
                        >
                          <Trash2 className="size-3.5" />
                          <span className="hidden sm:inline">{t('actions.delete_permanently')}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {!loading && filteredItems.length > 0 && (
          <div className="p-3 border-t border-base-200 bg-base-200/30 flex items-center justify-between px-6">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">{t('footer.total')}</span>
              <span className="text-red-500 font-black text-sm">{filteredItems.length}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-base-content/30">
              <AlertTriangle className="size-3" />
              {t('footer.warning')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

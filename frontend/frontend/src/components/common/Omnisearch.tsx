import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search,
  PackageSearch,
  Users,
  LayoutDashboard,
  WalletCards,
  FileText,
  Store,
  Truck,
  Zap,
  PlusCircle,
  ShoppingCart,
  Info,
  AlertTriangle,
  Calendar,
  Layers,
  TrendingUp as TrendingIcon,
  ShoppingBag,
  ClipboardList,
  BarChart3
} from 'lucide-react';
import { useDebounce } from 'use-debounce';

import omnisearchService from '../../services/omnisearchService';
import type { ProduitModel, Client, Facture, Commande, Fournisseur } from '../../types';
import { formatDate } from '../../utils/dateUtils';

export default function Omnisearch() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeValue, setActiveValue] = useState<string | undefined>(undefined);
  const [debouncedSearch] = useDebounce(search, 300);
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  const [produits, setProduits] = useState<ProduitModel[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(false);

  // Toggle au clavier (Ctrl+K ou Cmd+K) + fermeture par Escape
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'KeyK' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Détection des clics extérieurs gérée par cmdk en mode dialog ? cmdk 1.0.0 a un Command.Dialog natif
  // Sinon on construit un overlay

  useEffect(() => {
    async function fetchData() {
      if (!debouncedSearch) {
        setProduits([]);
        setClients([]);
        setFactures([]);
        setCommandes([]);
        setFournisseurs([]);
        return;
      }

      setLoading(true);
      try {
        const results = await omnisearchService.search(debouncedSearch);

        setProduits(results.produits);
        setClients(results.clients);
        setFactures(results.factures);
        setCommandes(results.commandes);
        setFournisseurs(results.fournisseurs);
      } catch (err) {
        console.error('Erreur Omnisearch:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [debouncedSearch]);

  // Synchronisation auto de la sélection pour l'aperçu
  useEffect(() => {
    if (search && (produits.length > 0 || clients.length > 0 || factures.length > 0 || commandes.length > 0 || fournisseurs.length > 0)) {
        // Reset au premier item seulement si l'actuel n'est plus dans le nouveau jeu de résultats
        const isCurrentValid = 
            (activeValue?.startsWith('prod-') && produits.some(p => `prod-${p.id}-${p.name.toLowerCase()}` === activeValue)) ||
            (activeValue?.startsWith('client-') && clients.some(c => `client-${c.id}-${c.name.toLowerCase()}` === activeValue)) ||
            (activeValue?.startsWith('facture-') && factures.some(f => `facture-${f.id}-${(f.numero_facture || '').toLowerCase()}` === activeValue)) ||
            (activeValue?.startsWith('commande-') && commandes.some(o => `commande-${o.id}-${(o.fournisseur_nom || '').toLowerCase()}` === activeValue)) ||
            (activeValue?.startsWith('fournisseur-') && fournisseurs.some(s => `fournisseur-${s.id}-${s.name.toLowerCase()}` === activeValue));
        
        if (!isCurrentValid) {
            if (produits.length > 0) setActiveValue(`prod-${produits[0].id}-${produits[0].name.toLowerCase()}`);
            else if (clients.length > 0) setActiveValue(`client-${clients[0].id}-${clients[0].name.toLowerCase()}`);
            else if (factures.length > 0) setActiveValue(`facture-${factures[0].id}-${(factures[0].numero_facture || '').toLowerCase()}`);
            else if (commandes.length > 0) setActiveValue(`commande-${commandes[0].id}-${(commandes[0].fournisseur_nom || '').toLowerCase()}`);
            else if (fournisseurs.length > 0) setActiveValue(`fournisseur-${fournisseurs[0].id}-${fournisseurs[0].name.toLowerCase()}`);
        }
    }
  }, [produits, clients, factures, commandes, fournisseurs, search, activeValue]);

  const onSelectLink = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const onSelectAction = (action: string) => {
    setOpen(false);
    if (action === 'NEW_SALE') {
        // Pour la facturation, on force le reload si on y est déjà, sinon on navigue
        // Cela permet de réinitialiser complètement l'état du hook (caisse fraîche)
        if (window.location.pathname === '/app/facturation') {
            window.location.reload();
        } else {
            navigate('/app/facturation', { state: { action } });
        }
    } else if (action === 'NEW_PRODUCT') {
        navigate('/app/produits', { state: { action } });
    } else if (action === 'NEW_CLIENT') {
        navigate('/app/clients', { state: { action } });
    } else if (action === 'NEW_ORDER') {
        navigate('/app/commandes', { state: { action } });
    }
  };

  const onSelectProduit = (id: number) => {
    setOpen(false);
    // On redirige vers la liste des d'inventaire / produits, potentiellement avec un filtre. 
    // Ou si l'utilisateur demandait achats/ventes, on va l'emmener vers l'historique associé. 
    // Pour l'instant on redirige vers l'inventaire. Le routeur récupère cet ID si défini, ou bien l'utilisateur cherchera dans la page.
    navigate('/app/produits', { state: { searchProduitId: id } });
  };

  const onSelectClient = (id: number) => {
    setOpen(false);
    navigate('/app/clients', { state: { selectedClientId: id } });
  };

  const onSelectFacture = (id: number) => {
    setOpen(false);
    navigate('/app/ventes', { state: { selectedFactureId: id } });
  };

  const onSelectCommande = (id: number) => {
    setOpen(false);
    navigate('/app/commandes', { state: { selectedCommandeId: id } });
  };

  const onSelectFournisseur = (id: number) => {
    setOpen(false);
    navigate('/app/commandes', { state: { selectedFournisseurId: id } });
  };

  // Helper pour extraire les données de l'item sélectionné
  const getSelectedData = () => {
    if (!activeValue) return null;
    if (activeValue.startsWith('prod-')) {
        const id = parseInt(activeValue.split('-')[1]);
        return { type: 'product', data: produits.find(p => p.id === id) };
    }
    if (activeValue.startsWith('client-')) {
        const id = parseInt(activeValue.split('-')[1]);
        return { type: 'client', data: clients.find(c => c.id === id) };
    }
    if (activeValue.startsWith('facture-')) {
        const id = parseInt(activeValue.split('-')[1]);
        return { type: 'facture', data: factures.find(f => f.id === id) };
    }
    if (activeValue.startsWith('commande-')) {
        const id = parseInt(activeValue.split('-')[1]);
        return { type: 'commande', data: commandes.find(o => o.id === id) };
    }
    if (activeValue.startsWith('fournisseur-')) {
        const id = parseInt(activeValue.split('-')[1]);
        return { type: 'fournisseur', data: fournisseurs.find(s => s.id === id) };
    }
    return { type: 'action', id: activeValue };
  };

  const selectedItem = getSelectedData();


  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-base-300/20 backdrop-blur-xl transition-all duration-500 animate-in fade-in" onClick={() => setOpen(false)}>
      <div 
        className="w-full max-w-5xl bg-base-100 rounded-[2rem] shadow-premium overflow-hidden border border-base-content/5 transition-all duration-500 transform scale-100 opacity-100 animate-in zoom-in-95 slide-in-from-bottom-4"
        onClick={e => e.stopPropagation()}
      >
        <Command 
            label="Command Palette" 
            shouldFilter={false} 
            className="flex flex-col h-full w-full"
            value={activeValue}
            onValueChange={setActiveValue}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false); } }}
        >
          <div className="flex items-center border-b border-base-200 px-6 bg-base-100/50 backdrop-blur-sm">
            <Search className="size-6 text-primary mr-4 opacity-50" />
            <Command.Input 
              value={search} 
              onValueChange={setSearch} 
              autoFocus
              className="flex-1 h-16 bg-transparent outline-none border-none text-base-content placeholder:text-base-content/20 text-xl font-medium"
              placeholder={t('omnisearch.placeholder', 'Rechercher (produits, clients, navigation) …')} 
            />
            {loading && <span className="loading loading-spinner loading-sm text-primary"></span>}
            <div className="ml-4 flex items-center gap-1.5 opacity-30 select-none">
                <kbd className="kbd kbd-xs font-bold">ESC</kbd>
            </div>
          </div>

          <div className="flex min-h-[320px] max-h-[65vh]">
            <div className="w-full md:w-[60%] flex flex-col border-r border-base-200">
                <Command.List className="flex-1 overflow-y-auto p-2 cmdk-list">
                    <Command.Empty className="py-8 text-center text-sm text-base-content/40 italic">
                    {loading ? (
                        <div className="flex flex-col items-center gap-2">
                            <span className="loading loading-ring loading-md text-primary"></span>
                            <span>Recherche en cours…</span>
                        </div>
                    ) : t('omnisearch.empty', 'Aucun résultat trouvé.')}
                    </Command.Empty>

                    {!search && (
                    <Command.Group heading={t('omnisearch.groups.actions', '⚡ Actions Rapides')} className="text-[10px] font-black text-base-content/30 pt-4 pb-1 px-3 uppercase tracking-[0.15em]">
                        <Command.Item onSelect={() => onSelectAction('NEW_SALE')} value="action-new-sale" className="flex items-center px-4 py-3.5 rounded-xl cursor-pointer hover:bg-base-200 text-base-content aria-selected:bg-primary/10 aria-selected:text-primary transition-all group">
                        <Zap className="size-4 mr-3 text-warning group-aria-selected:scale-110 transition-transform" />
                        <span className="font-bold">{t('omnisearch.actions.new_sale')}</span>
                        </Command.Item>
                        <Command.Item onSelect={() => onSelectAction('NEW_PRODUCT')} value="action-new-product" className="flex items-center px-4 py-3.5 rounded-xl cursor-pointer hover:bg-base-200 text-base-content aria-selected:bg-primary/10 aria-selected:text-primary transition-all group">
                        <PlusCircle className="size-4 mr-3 text-info group-aria-selected:scale-110 transition-transform" />
                        <span className="font-bold">{t('omnisearch.actions.new_product')}</span>
                        </Command.Item>
                        <Command.Item onSelect={() => onSelectAction('NEW_CLIENT')} value="action-new-client" className="flex items-center px-4 py-3.5 rounded-xl cursor-pointer hover:bg-base-200 text-base-content aria-selected:bg-primary/10 aria-selected:text-primary transition-all group">
                        <PlusCircle className="size-4 mr-3 text-success group-aria-selected:scale-110 transition-transform" />
                        <span className="font-bold">{t('omnisearch.actions.new_client')}</span>
                        </Command.Item>
                        <Command.Item onSelect={() => onSelectAction('NEW_ORDER')} value="action-new-order" className="flex items-center px-4 py-3.5 rounded-xl cursor-pointer hover:bg-base-200 text-base-content aria-selected:bg-primary/10 aria-selected:text-primary transition-all group">
                        <ShoppingCart className="size-4 mr-3 text-secondary group-aria-selected:scale-110 transition-transform" />
                        <span className="font-bold">{t('omnisearch.actions.new_order')}</span>
                        </Command.Item>
                    </Command.Group>
                    )}

                    {!search && (
                    <Command.Group heading={t('omnisearch.groups.navigation')} className="text-[10px] font-black text-base-content/30 pt-4 pb-1 px-3 uppercase tracking-[0.15em]">
                        <Command.Item onSelect={() => onSelectLink('/app/rapports-mensuels')} value="nav-rapport-mensuel" className="flex items-center px-4 py-3 rounded-xl cursor-pointer hover:bg-base-200 text-base-content aria-selected:bg-primary/5 aria-selected:text-primary transition-all opacity-80 aria-selected:opacity-100">
                        <BarChart3 className="size-4 mr-3 text-emerald-500" />
                        <span className="font-medium">{t('omnisearch.nav.monthly_report')}</span>
                        </Command.Item>
                        <Command.Item onSelect={() => onSelectLink('/app/facturation')} value="nav-facturation" className="flex items-center px-4 py-3 rounded-xl cursor-pointer hover:bg-base-200 text-base-content aria-selected:bg-primary/5 aria-selected:text-primary transition-all opacity-80 aria-selected:opacity-100">
                        <WalletCards className="size-4 mr-3" />
                        <span className="font-medium">{t('omnisearch.nav.billing')}</span>
                        </Command.Item>
                        <Command.Item onSelect={() => onSelectLink('/app/ventes')} value="nav-ventes" className="flex items-center px-4 py-3 rounded-xl cursor-pointer hover:bg-base-200 text-base-content aria-selected:bg-primary/5 aria-selected:text-primary transition-all opacity-80 aria-selected:opacity-100">
                        <FileText className="size-4 mr-3" />
                        <span className="font-medium">{t('omnisearch.nav.sales_list')}</span>
                        </Command.Item>
                        <Command.Item onSelect={() => onSelectLink('/app/journal-caisse')} value="nav-journal-caisse" className="flex items-center px-4 py-3 rounded-xl cursor-pointer hover:bg-base-200 text-base-content aria-selected:bg-primary/5 aria-selected:text-primary transition-all opacity-80 aria-selected:opacity-100">
                        <ClipboardList className="size-4 mr-3" />
                        <span className="font-medium">{t('omnisearch.nav.cash_journal')}</span>
                        </Command.Item>
                        <Command.Item onSelect={() => onSelectLink('/app/clients')} value="nav-clients" className="flex items-center px-4 py-3 rounded-xl cursor-pointer hover:bg-base-200 text-base-content aria-selected:bg-primary/5 aria-selected:text-primary transition-all opacity-80 aria-selected:opacity-100">
                        <Users className="size-4 mr-3" />
                        <span className="font-medium">{t('omnisearch.nav.clients')}</span>
                        </Command.Item>
                        <Command.Item onSelect={() => onSelectLink('/app/dashboard')} value="nav-dashboard" className="flex items-center px-4 py-3 rounded-xl cursor-pointer hover:bg-base-200 text-base-content aria-selected:bg-primary/5 aria-selected:text-primary transition-all opacity-80 aria-selected:opacity-100">
                        <LayoutDashboard className="size-4 mr-3" />
                        <span className="font-medium">{t('omnisearch.nav.dashboard')}</span>
                        </Command.Item>
                    </Command.Group>
                    )}

                    {search && produits.length > 0 && (
                    <Command.Group heading={t('omnisearch.groups.products')} className="text-[10px] font-black text-base-content/30 pt-4 pb-1 px-3 uppercase tracking-[0.15em]">
                        {produits.map((prod) => (
                        <Command.Item 
                            key={`prod-${prod.id}`}
                            value={`prod-${prod.id}-${prod.name.toLowerCase()}`}
                            onSelect={() => onSelectProduit(prod.id!)}
                            className="flex items-center px-4 py-3 rounded-xl cursor-pointer hover:bg-base-200 text-base-content aria-selected:bg-primary/10 aria-selected:text-primary transition-all group"
                        >
                            <div className="size-8 rounded-lg bg-base-200 flex items-center justify-center mr-3 group-aria-selected:bg-primary/20 transition-colors">
                                <PackageSearch className="size-4 text-base-content/40 group-aria-selected:text-primary" />
                            </div>
                            <div className="flex-1 flex flex-col items-start overflow-hidden">
                            <span className="font-bold truncate w-full group-aria-selected:text-primary" title={prod.name}>{prod.name}</span>
                            <span className="text-[10px] text-base-content/50 font-medium uppercase">{prod.forme_name} • {prod.rayon_name || prod.groupe_name}</span>
                            </div>
                            {prod.selling_price !== undefined && (
                            <span className="ml-2 px-3 py-1 bg-base-200 text-base-content rounded-lg text-xs font-black tracking-tight group-aria-selected:bg-primary group-aria-selected:text-white transition-colors">
                                {Number(prod.selling_price).toLocaleString()} F
                            </span>
                            )}
                        </Command.Item>
                        ))}
                    </Command.Group>
                    )}

                    {search && clients.length > 0 && (
                    <Command.Group heading={t('omnisearch.groups.clients')} className="text-[10px] font-black text-base-content/30 pt-4 pb-1 px-3 uppercase tracking-[0.15em]">
                        {clients.map((client) => (
                        <Command.Item 
                            key={`client-${client.id}`}
                            value={`client-${client.id}-${client.name.toLowerCase()}`}
                            onSelect={() => onSelectClient(client.id!)}
                            className="flex items-center px-4 py-3 rounded-xl cursor-pointer hover:bg-base-200 text-base-content aria-selected:bg-primary/10 aria-selected:text-primary transition-all group"
                        >
                            <div className="size-8 rounded-full bg-secondary/10 flex items-center justify-center mr-3 group-aria-selected:bg-secondary/20 transition-colors">
                                <Users className="size-4 text-secondary" />
                            </div>
                            <div className="flex-1 flex flex-col items-start">
                            <span className="font-bold group-aria-selected:text-secondary">{client.name}</span>
                            <span className="text-[10px] text-base-content/50 font-bold">{client.phone || client.email || 'Aucun contact'}</span>
                            </div>
                        </Command.Item>
                        ))}
                    </Command.Group>
                    )}

                    {search && factures.length > 0 && (
                    <Command.Group heading={t('omnisearch.groups.invoices')} className="text-[10px] font-black text-base-content/30 pt-4 pb-1 px-3 uppercase tracking-[0.15em]">
                        {factures.map((f) => (
                        <Command.Item 
                            key={`facture-${f.id}`}
                            value={`facture-${f.id}-${(f.numero_facture || '').toLowerCase()}`}
                            onSelect={() => onSelectFacture(f.id)}
                            className="flex items-center px-4 py-3 rounded-xl cursor-pointer hover:bg-base-200 text-base-content aria-selected:bg-primary/10 aria-selected:text-primary transition-all group"
                        >
                            <div className="size-8 rounded-lg bg-base-200 flex items-center justify-center mr-3 group-aria-selected:bg-primary/20 transition-colors">
                                <FileText className="size-4 text-primary" />
                            </div>
                            <div className="flex-1 flex flex-col items-start overflow-hidden">
                            <span className="font-bold truncate w-full group-aria-selected:text-primary">{f.numero_facture}</span>
                            <span className="text-[10px] text-base-content/50 font-medium uppercase font-mono">{f.client_name || 'Client de passage'} • {formatDate(f.date)}</span>
                            </div>
                            <span className="ml-2 px-3 py-1 bg-base-200 text-base-content rounded-lg text-xs font-black tracking-tight group-aria-selected:bg-primary group-aria-selected:text-white transition-colors">
                                {Number(f.total_ttc).toLocaleString()} F
                            </span>
                        </Command.Item>
                        ))}
                    </Command.Group>
                    )}

                    {search && commandes.length > 0 && (
                    <Command.Group heading={t('omnisearch.groups.procurements')} className="text-[10px] font-black text-base-content/30 pt-4 pb-1 px-3 uppercase tracking-[0.15em]">
                        {commandes.map((o) => (
                        <Command.Item 
                            key={`commande-${o.id}`}
                            value={`commande-${o.id}-${(o.fournisseur_nom || '').toLowerCase()}`}
                            onSelect={() => onSelectCommande(o.id)}
                            className="flex items-center px-4 py-3 rounded-xl cursor-pointer hover:bg-base-200 text-base-content aria-selected:bg-primary/10 aria-selected:text-primary transition-all group"
                        >
                            <div className="size-8 rounded-lg bg-base-200 flex items-center justify-center mr-3 group-aria-selected:bg-primary/20 transition-colors">
                                <ShoppingCart className="size-4 text-warning" />
                            </div>
                            <div className="flex-1 flex flex-col items-start overflow-hidden">
                            <span className="font-bold truncate w-full group-aria-selected:text-primary">{o.fournisseur_nom || 'Grossiste'}</span>
                            <span className="text-[10px] text-base-content/50 font-medium uppercase">{formatDate(o.date)} • {o.status_display}</span>
                            </div>
                        </Command.Item>
                        ))}
                    </Command.Group>
                    )}

                    {search && fournisseurs.length > 0 && (
                    <Command.Group heading={t('omnisearch.groups.suppliers')} className="text-[10px] font-black text-base-content/30 pt-4 pb-1 px-3 uppercase tracking-[0.15em]">
                        {fournisseurs.map((s) => (
                        <Command.Item 
                            key={`fournisseur-${s.id}`}
                            value={`fournisseur-${s.id}-${s.name.toLowerCase()}`}
                            onSelect={() => onSelectFournisseur(s.id)}
                            className="flex items-center px-4 py-3 rounded-xl cursor-pointer hover:bg-base-200 text-base-content aria-selected:bg-primary/10 aria-selected:text-primary transition-all group"
                        >
                            <div className="size-8 rounded-lg bg-base-200 flex items-center justify-center mr-3 group-aria-selected:bg-primary/20 transition-colors">
                                <Store className="size-4 text-secondary" />
                            </div>
                            <div className="flex-1 flex flex-col items-start overflow-hidden">
                            <span className="font-bold truncate w-full group-aria-selected:text-primary">{s.name}</span>
                            <span className="text-[10px] text-base-content/50 font-medium uppercase">{s.phone || s.email || 'Contact N/A'}</span>
                            </div>
                        </Command.Item>
                        ))}
                    </Command.Group>
                    )}
                </Command.List>
            </div>

            {/* PREVIEW PANEL */}
            <div className="hidden md:flex md:w-[40%] bg-base-50/30 flex-col overflow-y-auto animate-in slide-in-from-right-4 duration-300">
                {selectedItem?.type === 'product' && selectedItem.data && (selectedItem.data as ProduitModel).name !== undefined ? (
                    <div className="p-8 space-y-8 h-full flex flex-col">
                        <div className="space-y-4">
                            <div className="size-20 bg-primary/10 rounded-3xl flex items-center justify-center shadow-inner">
                                <PackageSearch className="size-10 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black tracking-tighter text-base-content leading-tight">{(selectedItem.data as ProduitModel).name}</h3>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <span className="badge badge-sm font-black bg-base-200 border-none">{(selectedItem.data as ProduitModel).forme_name}</span>
                                    <span className="badge badge-sm font-black bg-primary/10 text-primary border-none">{(selectedItem.data as ProduitModel).rayon_name}</span>
                                </div>
                            </div>
                        </div>

                        {(selectedItem.data as ProduitModel).message_alerte && (
                            <div className="p-4 bg-error/10 border border-error/20 rounded-2xl flex gap-3 items-start animate-pulse">
                                <AlertTriangle className="size-5 text-error shrink-0 mt-0.5" />
                                <div className="text-xs font-bold text-error leading-relaxed">
                                    {(selectedItem.data as ProduitModel).message_alerte}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-base-100 border border-base-200 rounded-2xl space-y-1">
                                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-base-content/40">
                                    <Layers className="size-3" /> {t('omnisearch.preview.stock_rayon')}
                                </div>
                                <div className={`text-2xl font-black ${((selectedItem.data as ProduitModel).stock || 0) <= ((selectedItem.data as ProduitModel).stock_alert || 0) ? 'text-error' : 'text-base-content'}`}>
                                    {(selectedItem.data as ProduitModel).stock || 0}
                                </div>
                            </div>
                            <div className="p-4 bg-base-100 border border-base-200 rounded-2xl space-y-1">
                                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-base-content/40">
                                    <Layers className="size-3 opacity-50" /> {t('omnisearch.preview.stock_reserve')}
                                </div>
                                <div className="text-2xl font-black text-base-content/60">
                                    {(selectedItem.data as ProduitModel).stock_reserve || 0}
                                </div>
                            </div>
                            <div className="col-span-2 p-4 bg-base-100 border border-base-200 rounded-2xl flex justify-between items-center">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-base-content/40">
                                        <Calendar className="size-3" /> {t('omnisearch.preview.expiry')}
                                    </div>
                                    <div className="text-sm font-black italic">
                                        {(selectedItem.data as ProduitModel).next_expiring_date ? formatDate((selectedItem.data as ProduitModel).next_expiring_date as string) : t('omnisearch.preview.expiry_none')}
                                    </div>
                                </div>
                                {(selectedItem.data as ProduitModel).is_perissable && (
                                    <div className="size-10 rounded-full bg-warning/10 flex items-center justify-center">
                                        <div className="tooltip tooltip-left" data-tip={t('omnisearch.preview.perishable')}>
                                            <Info className="size-5 text-warning" />
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="col-span-2 p-4 bg-secondary/5 border border-secondary/10 rounded-2xl space-y-1">
                                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-secondary/40">
                                    <TrendingIcon className="size-3" /> {t('omnisearch.preview.last_purchase')}
                                </div>
                                <div className="flex justify-between items-baseline">
                                    <div className="text-lg font-black text-secondary">
                                        {(selectedItem.data as ProduitModel).dernier_achat ? formatDate((selectedItem.data as ProduitModel).dernier_achat as string) : '-'}
                                    </div>
                                    <div className="text-xs font-mono font-bold opacity-60">
                                        {(selectedItem.data as ProduitModel).last_purchase_price ? `${Number((selectedItem.data as ProduitModel).last_purchase_price).toLocaleString()} F` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="mt-auto p-4 bg-primary/5 rounded-2xl border border-primary/10">
                            <p className="text-[10px] font-bold text-primary/60 uppercase tracking-tighter italic">{t('omnisearch.preview.manage_product')}</p>
                        </div>
                    </div>
                ) : selectedItem?.type === 'client' && selectedItem.data && (selectedItem.data as Client).name !== undefined ? (
                    <div className="p-8 space-y-8 h-full flex flex-col">
                        <div className="space-y-4">
                            <div className="size-20 bg-secondary/10 rounded-full flex items-center justify-center shadow-inner">
                                <Users className="size-10 text-secondary" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black tracking-tighter text-base-content leading-tight">{(selectedItem.data as Client).name}</h3>
                                <div className="flex gap-2 mt-2">
                                    <span className="badge badge-secondary badge-sm font-black border-none uppercase tracking-widest text-[8px]">{(selectedItem.data as Client).client_type}</span>
                                    {(selectedItem.data as Client).is_active ? (
                                        <span className="badge badge-success badge-sm font-black border-none text-[8px]">{t('omnisearch.preview.active')}</span>
                                    ) : (
                                        <span className="badge badge-ghost badge-sm font-black border-none text-[8px]">{t('omnisearch.preview.inactive')}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="p-5 bg-base-100 border border-base-200 rounded-3xl flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('omnisearch.preview.loyalty_points')}</span>
                                    <div className="text-3xl font-black text-secondary">{(selectedItem.data as Client).points_fidelite || 0}</div>
                                </div>
                                <div className="p-3 bg-secondary/10 text-secondary rounded-2xl">
                                    <Zap className="size-6" />
                                </div>
                            </div>
                            
                            <div className="p-5 bg-base-100 border border-base-200 rounded-3xl flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('omnisearch.preview.deposit_balance')}</span>
                                    <div className="text-3xl font-black text-primary">
                                        {Number((selectedItem.data as Client).solde_depot || 0).toLocaleString()} F
                                    </div>
                                </div>
                                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                                    <ShoppingBag className="size-6" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-base-200">
                            <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-black uppercase tracking-widest text-base-content/30">{t('omnisearch.preview.contact')}</span>
                                <p className="text-sm font-bold truncate">{(selectedItem.data as Client).phone || '-'}</p>
                                <p className="text-xs font-medium opacity-60 truncate">{(selectedItem.data as Client).email || ''}</p>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-black uppercase tracking-widest text-base-content/30">{t('omnisearch.preview.address')}</span>
                                <p className="text-xs font-bold leading-relaxed">{(selectedItem.data as Client).address || '-'}</p>
                            </div>
                        </div>
                    </div>
                ) : selectedItem?.type === 'facture' && selectedItem.data ? (
                    <div className="p-8 space-y-8 h-full flex flex-col">
                        <div className="space-y-4">
                            <div className="size-20 bg-primary/10 rounded-3xl flex items-center justify-center shadow-inner">
                                <FileText className="size-10 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black tracking-tighter text-base-content leading-tight">{(selectedItem.data as Facture).numero_facture}</h3>
                                <p className="text-lg font-bold text-base-content/60">{(selectedItem.data as Facture).client_name || 'Client de passage'}</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 p-5 bg-primary/5 border border-primary/10 rounded-3xl flex items-center justify-between">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/40">{t('omnisearch.preview.total_amount')}</span>
                                        <div className="text-3xl font-black text-primary">{Number((selectedItem.data as Facture).total_ttc).toLocaleString()} F</div>
                                    </div>
                                    <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                                        <TrendingIcon className="size-6" />
                                    </div>
                                </div>
                                
                                <div className="p-4 bg-base-100 border border-base-200 rounded-2xl space-y-1">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('omnisearch.preview.status')}</div>
                                    <div className="text-sm font-bold uppercase">{(selectedItem.data as Facture).status_display}</div>
                                </div>
                                
                                <div className="p-4 bg-base-100 border border-base-200 rounded-2xl space-y-1">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('omnisearch.preview.date')}</div>
                                    <div className="text-sm font-bold tracking-tight">{formatDate((selectedItem.data as Facture).date)}</div>
                                </div>
                            </div>

                            {/* Produits de la vente */}
                            {(selectedItem.data as any).produits_details && (selectedItem.data as any).produits_details.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/30 px-1">Produits ({((selectedItem.data as any).produits_details.length)})</h4>
                                    <div className="bg-base-200/50 rounded-2xl overflow-hidden border border-base-200">
                                        {(selectedItem.data as any).produits_details.map((p: any, idx: number) => (
                                            <div key={idx} className="px-4 py-3 flex items-center justify-between border-b border-base-200/50 last:border-0 hover:bg-base-200/80 transition-colors">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-xs font-bold text-base-content line-clamp-1">{p.nom}</span>
                                                    <span className="text-[10px] font-bold text-base-content/40 uppercase tracking-tight">{Number(p.prix).toLocaleString()} F / unité</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 bg-primary/10 text-primary rounded flex items-center gap-1">
                                                        <span className="text-[10px] font-black">X</span>
                                                        <span className="text-xs font-black">{p.quantite}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : selectedItem?.type === 'commande' && selectedItem.data ? (
                    <div className="p-8 space-y-8 h-full flex flex-col">
                        <div className="space-y-4">
                            <div className="size-20 bg-warning/10 rounded-3xl flex items-center justify-center shadow-inner">
                                <ShoppingCart className="size-10 text-warning" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black tracking-tighter text-base-content leading-tight">{(selectedItem.data as Commande).fournisseur_nom || 'Grossiste'}</h3>
                                <p className="text-sm font-bold opacity-60 italic">{t('omnisearch.groups.procurements')}</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 p-5 bg-warning/5 border border-warning/10 rounded-3xl flex items-center justify-between">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-warning/40">{t('omnisearch.preview.total_amount')}</span>
                                        <div className="text-3xl font-black text-warning">{Number((selectedItem.data as Commande).total || 0).toLocaleString()} F</div>
                                    </div>
                                </div>
                                
                                <div className="p-4 bg-base-100 border border-base-200 rounded-2xl space-y-1">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('omnisearch.preview.status')}</div>
                                    <div className="text-xs font-bold uppercase">{(selectedItem.data as Commande).status_display}</div>
                                </div>
                                
                                <div className="p-4 bg-base-100 border border-base-200 rounded-2xl space-y-1">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{t('omnisearch.preview.items')}</div>
                                    <div className="text-xl font-black">{(selectedItem.data as Commande).items_count || 0}</div>
                                </div>
                            </div>

                            {/* Produits de la commande */}
                            {(selectedItem.data as any).produits_details && (selectedItem.data as any).produits_details.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/30 px-1">Articles ({((selectedItem.data as any).produits_details.length)})</h4>
                                    <div className="bg-base-200/50 rounded-2xl overflow-hidden border border-base-200">
                                        {(selectedItem.data as any).produits_details.map((p: any, idx: number) => (
                                            <div key={idx} className="px-4 py-3 flex items-center justify-between border-b border-base-200/50 last:border-0 hover:bg-base-200/80 transition-colors">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-xs font-bold text-base-content line-clamp-1">{p.nom}</span>
                                                    <span className="text-[10px] font-bold text-base-content/40 uppercase tracking-tight">{Number(p.prix).toLocaleString()} F / unité</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 bg-warning/10 text-warning rounded flex items-center gap-1">
                                                        <span className="text-xs font-black">{p.quantite}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : selectedItem?.type === 'fournisseur' && selectedItem.data ? (
                    <div className="p-8 space-y-8 h-full flex flex-col">
                        <div className="space-y-4">
                            <div className="size-20 bg-secondary/10 rounded-3xl flex items-center justify-center shadow-inner">
                                <Truck className="size-10 text-secondary" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black tracking-tighter text-base-content leading-tight">{(selectedItem.data as Fournisseur).name}</h3>
                                <div className="flex gap-2 mt-2">
                                     <span className="badge badge-secondary badge-sm font-black border-none uppercase tracking-widest text-[8px]">{t('omnisearch.groups.suppliers')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6 pt-4 border-t border-base-200">
                            <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-black uppercase tracking-widest text-base-content/30">{t('omnisearch.preview.contact')}</span>
                                <p className="text-sm font-bold">{(selectedItem.data as Fournisseur).phone || '-'}</p>
                                <p className="text-xs font-medium opacity-60">{(selectedItem.data as Fournisseur).email || ''}</p>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-black uppercase tracking-widest text-base-content/30">{t('omnisearch.preview.address')}</span>
                                <p className="text-sm font-bold leading-relaxed">{(selectedItem.data as Fournisseur).address || '-'}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-20 grayscale scale-95 transition-all">
                        <div className="size-24 rounded-full border-4 border-dashed border-base-content/30 flex items-center justify-center mb-4">
                            <LayoutDashboard className="size-12" />
                        </div>
                        <h4 className="text-lg font-black tracking-tighter uppercase italic">{t('omnisearch.preview.title')}</h4>
                        <p className="text-xs font-bold max-w-xs mt-1 italic">{t('omnisearch.preview.subtitle')}</p>
                    </div>
                )}
            </div>
          </div>
          
          <div className="p-3 bg-base-200/50 border-t border-base-200 text-xs text-base-content/50 flex justify-between items-center rounded-b-xl">
            <span className="flex items-center"><span className="kbd kbd-sm mr-1">↑</span> <span className="kbd kbd-sm mr-2">↓</span> Naviguer</span>
            <span className="flex items-center"><span className="kbd kbd-sm mr-2">↵</span> Sélectionner</span>
            <span>Un raccourci <kbd className="kbd kbd-sm">Ctrl</kbd> + <kbd className="kbd kbd-sm">K</kbd> ferme la fenêtre.</span>
          </div>
        </Command>
      </div>
    </div>
  );
}

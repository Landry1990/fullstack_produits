import { Command } from 'cmdk';
import { Search } from 'lucide-react';

import useOmnisearch from '../../hooks/useOmnisearch';
import OmnisearchResults from '../omnisearch/OmnisearchResults';
import OmnisearchPreview from '../omnisearch/OmnisearchPreview';

export default function Omnisearch() {
  const {
    open,
    setOpen,
    search,
    setSearch,
    activeValue,
    setActiveValue,
    loading,
    selectedItem,
    produits,
    clients,
    factures,
    commandes,
    fournisseurs,
    onSelectLink,
    onSelectAction,
    onSelectProduit,
    onSelectClient,
    onSelectFacture,
    onSelectCommande,
    onSelectFournisseur,
    t,
  } = useOmnisearch();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-300/20 backdrop-blur-xl transition-all duration-500 animate-in fade-in" onClick={() => setOpen(false)}>
      <div 
        className="w-full max-w-5xl bg-white rounded-[2rem] shadow-2xl shadow-slate-900/10 overflow-hidden border border-slate-800/5 transition-all duration-500 transform scale-100 opacity-100 animate-in zoom-in-95 slide-in-from-bottom-4"
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
          <div className="flex items-center border-b border-slate-200 px-6 bg-white/50 backdrop-blur-sm">
            <Search className="size-6 text-slate-500 mr-4" />
            <Command.Input 
              value={search} 
              onValueChange={setSearch} 
              autoFocus
              className="flex-1 h-16 bg-transparent outline-none border-none text-slate-800 placeholder:text-slate-300 text-xl font-medium"
              placeholder={t('omnisearch.placeholder', 'Rechercher (produits, clients, navigation) …')} 
            />
            {loading && <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>}
            <div className="ml-4 flex items-center gap-1.5 text-slate-400 select-none">
                <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono font-bold text-slate-600">ESC</kbd>
            </div>
          </div>

          <div className="flex min-h-[320px] max-h-[65vh]">
            <div className="w-full md:w-[60%] flex flex-col border-r border-slate-200">
              <OmnisearchResults
                search={search}
                loading={loading}
                produits={produits}
                clients={clients}
                factures={factures}
                commandes={commandes}
                fournisseurs={fournisseurs}
                onSelectAction={onSelectAction}
                onSelectLink={onSelectLink}
                onSelectProduit={onSelectProduit}
                onSelectClient={onSelectClient}
                onSelectFacture={onSelectFacture}
                onSelectCommande={onSelectCommande}
                onSelectFournisseur={onSelectFournisseur}
              />
            </div>

            <div className="hidden md:flex md:w-[40%] bg-slate-50/30 flex-col overflow-y-auto animate-in slide-in-from-right-4 duration-300">
              <OmnisearchPreview selectedItem={selectedItem} />
            </div>
          </div>
          
          <div className="p-3 bg-slate-100/50 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center rounded-b-xl">
            <span className="flex items-center"><span className="inline-flex items-center justify-center px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-600 mr-1">↑</span> <span className="inline-flex items-center justify-center px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-600 mr-2">↓</span> Naviguer</span>
            <span className="flex items-center"><span className="inline-flex items-center justify-center px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-600 mr-2">↵</span> Sélectionner</span>
            <span>Un raccourci <kbd className="inline-flex items-center justify-center px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-600">Ctrl</kbd> + <kbd className="inline-flex items-center justify-center px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-600">K</kbd> ferme la fenêtre.</span>
          </div>
        </Command>
      </div>
    </div>
  );
}

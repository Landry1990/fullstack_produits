import useOmnisearch from '../../hooks/useOmnisearch';
import OmnisearchResults from '../omnisearch/OmnisearchResults';
import OmnisearchPreview from '../omnisearch/OmnisearchPreview';
import { Command } from '../shadcn/command';
import { Command as CommandPrimitive } from 'cmdk';
import { Dialog, DialogContent, DialogTitle } from '../shadcn/dialog';
import { Badge } from '../shadcn/badge';
import { Search } from 'lucide-react';

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden border-slate-200 font-sans">
        <DialogTitle className="sr-only">{t('omnisearch.title', 'Recherche globale')}</DialogTitle>
        <Command
          label={t('common:command_palette')}
          shouldFilter={false}
          value={activeValue}
          onValueChange={setActiveValue}
          className="flex flex-col h-full w-full rounded-none bg-white"
        >
          <div className="px-4 pt-4 pb-3">
            <div
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 transition-all focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10"
              cmdk-input-wrapper=""
            >
              <Search className="size-4.5 shrink-0 text-slate-400" />
              <CommandPrimitive.Input
                value={search}
                onValueChange={setSearch}
                autoFocus
                placeholder={t('omnisearch.placeholder', 'Rechercher (produits, clients, navigation) …')}
                className="h-12 w-full bg-transparent text-base text-slate-800 outline-none placeholder:text-slate-400"
              />
              <Badge variant="outline" className="shrink-0 text-[10px] font-bold tracking-wider text-slate-400">
                ESC
              </Badge>
            </div>
          </div>

          <div className="flex min-h-[320px] max-h-[65vh] border-t border-slate-100">
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

            <div className="hidden md:flex md:w-[40%] bg-gradient-to-b from-slate-50 to-indigo-50/40 flex-col overflow-y-auto">
              <OmnisearchPreview selectedItem={selectedItem} />
            </div>
          </div>

          <div className="flex items-center gap-5 border-t border-slate-200 bg-slate-50/80 px-6 py-2.5 text-[10px] font-semibold text-slate-400">
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono shadow-sm">↑↓</kbd>
              {t('omnisearch.hints.navigate', 'Naviguer')}
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono shadow-sm">↵</kbd>
              {t('omnisearch.hints.open', 'Ouvrir')}
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono shadow-sm">esc</kbd>
              {t('omnisearch.hints.close', 'Fermer')}
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

import useOmnisearch from '../../hooks/useOmnisearch';
import OmnisearchResults from '../omnisearch/OmnisearchResults';
import OmnisearchPreview from '../omnisearch/OmnisearchPreview';
import { Command, CommandInput, CommandSeparator } from '../shadcn/command';
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
          <div className="flex items-center border-b border-slate-200 px-6" cmdk-input-wrapper="">
            <Search className="mr-3 size-5 shrink-0 text-slate-400" />
            <CommandInput
              value={search}
              onValueChange={setSearch}
              autoFocus
              placeholder={t('omnisearch.placeholder', 'Rechercher (produits, clients, navigation) …')}
              className="h-16 px-0 text-lg border-0 focus-visible:ring-0"
            />
            <Badge variant="outline" className="ml-3 shrink-0 text-[10px] font-bold tracking-wider text-slate-400">
              ESC
            </Badge>
          </div>

          <CommandSeparator />

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

            <div className="hidden md:flex md:w-[40%] bg-slate-50/50 flex-col overflow-y-auto">
              <OmnisearchPreview selectedItem={selectedItem} />
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

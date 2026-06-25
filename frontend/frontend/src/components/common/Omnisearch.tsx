import useOmnisearch from '../../hooks/useOmnisearch';
import OmnisearchResults from '../omnisearch/OmnisearchResults';
import OmnisearchPreview from '../omnisearch/OmnisearchPreview';
import { Command, CommandInput } from '../shadcn/command';
import { Dialog, DialogContent, DialogTitle } from '../shadcn/dialog';

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
      <DialogContent className="max-w-5xl p-0 overflow-hidden border-base-200">
        <DialogTitle className="sr-only">{t('omnisearch.title', 'Recherche globale')}</DialogTitle>
        <Command
          label="Command Palette"
          shouldFilter={false}
          value={activeValue}
          onValueChange={setActiveValue}
          className="flex flex-col h-full w-full rounded-none"
        >
          <CommandInput
            value={search}
            onValueChange={setSearch}
            autoFocus
            placeholder={t('omnisearch.placeholder', 'Rechercher (produits, clients, navigation) …')}
            className="h-16 px-6 text-lg"
          />

          <div className="flex min-h-[320px] max-h-[65vh]">
            <div className="w-full md:w-[60%] flex flex-col border-r border-base-200">
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

            <div className="hidden md:flex md:w-[40%] bg-base-200/30 flex-col overflow-y-auto">
              <OmnisearchPreview selectedItem={selectedItem} />
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

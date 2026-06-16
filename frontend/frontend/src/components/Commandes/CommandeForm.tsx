import React, { type FormEvent, type RefObject, useState } from 'react';
import type { Commande, Fournisseur, ProduitModel, CommandeProduit } from '../../types';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Search, FileDown, FolderOpen, Plus, RotateCcw, Pause, Play, Check, Save, Package } from 'lucide-react';
import CommandeProductTable from './CommandeProductTable';
import { formatCurrency } from '../../utils/formatters';
import ExportCommandeModal from './ExportCommandeModal';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { ProductSearch, type SearchResult } from '../common/ProductSearch';
import { cn } from '../../lib/utils';

interface FieldConfig {
    name: string;
    editable: boolean;
}

interface CommandeFormProps {
    // View State
    viewMode: 'CREATE' | 'EDIT' | 'DETAILS';
    selectedCommande: Commande | null;
    
    // Form Data
    fournisseurs: Fournisseur[];
    newCommandeFournisseurId: string;
    setNewCommandeFournisseurId: (id: string) => void;
    numeroFacture: string;
    setNumeroFacture: (num: string) => void;
    
    // Direct Orders
    commandeType: 'LOC' | 'DIR';
    tauxChange: string;
    setTauxChange: (val: string) => void;
    fraisCoefficient: string;
    setFraisCoefficient: (val: string) => void;
    
    // Actions
    handleBackToList: () => void;
    handleSaveCommande: (e: FormEvent<HTMLFormElement>) => void;
    
    // CSV / Tools
    handleCsvExport: (wholesaler: 'PRINCIPAL' | 'SECONDAIRE_CIP3') => void;
    handleCsvImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    fileInputRef: RefObject<HTMLInputElement>;
    setIsCreateProduitModalOpen: (isOpen: boolean) => void;
    
    // Search
    searchInputRef: RefObject<HTMLInputElement>;
    fournisseurSelectRef: RefObject<HTMLSelectElement>;
    searchProduitQuery: string;
    setSearchProduitQuery: (q: string) => void;
    handleSearchKeyDown: (e: React.KeyboardEvent) => void;
    filteredProduits: ProduitModel[];
    selectProduct: (p: ProduitModel) => void;
    getItemProps: (index: number) => any;
    
    // Table Props
    commandeProduits: CommandeProduit[];
    produitsList: ProduitModel[];
    selectedRows: Set<number>;
    saving: boolean;
    fieldsConfig: FieldConfig[];
    focusedField: { row: number; field: number } | null;
    
    toggleRowSelection: (index: number) => void;
    toggleAllRows: () => void;
    deleteSelectedRows: () => void;
    openTransferModal: () => void;
    updateCommandeProduitField: (
        index: number, 
        field: 'quantity' | 'unites_gratuites' | 'price' | 'tva' | 'marge' | 'selling_price' | 'lot' | 'date_expiration' | 'prix_euro', 
        value: string | number
    ) => void;
    handleTableFieldKeyDown: (e: React.KeyboardEvent, rowIndex: number, fieldIndex: number) => void;
    onRemoveProduct: (index: number) => void;
    onCreateAvoir?: () => void; // Optional handler for creating credit note
    commandeSortBy?: 'chrono' | 'stock' | 'name' | 'qty';
    onSortProduits?: (sortBy: 'chrono' | 'stock' | 'name' | 'qty') => void;
    onViewProductDetails?: (produitId: number) => void;
    // Actions rapides depuis le formulaire
    onCloture?: () => void;
    onMettreEnAttente?: () => void;
    executingAction?: boolean;
    orderTotals?: {
      totalHT: number;
      totalTVA: number;
      totalBuyTVA: number;
      totalTTC: number;
      totalBuyHT: number;
      totalBuyTTC: number;
      totalMarginValue: number;
      globalMargin: string;
      globalMarginPercent: string;
    };
}

export default function CommandeForm({
    viewMode,
    selectedCommande,
    fournisseurs,
    newCommandeFournisseurId,
    setNewCommandeFournisseurId,
    numeroFacture,
    setNumeroFacture,
    commandeType,
    tauxChange,
    setTauxChange,
    fraisCoefficient,
    setFraisCoefficient,
    handleBackToList,
    handleSaveCommande,
    handleCsvExport,
    handleCsvImport,
    fileInputRef,
    setIsCreateProduitModalOpen,
    searchInputRef,
    fournisseurSelectRef,
    searchProduitQuery,
    setSearchProduitQuery,
    handleSearchKeyDown,
    filteredProduits,
    selectProduct,
    getItemProps,
    
    // Table Props
    commandeProduits,
    produitsList,
    selectedRows,
    saving,
    fieldsConfig,
    focusedField,
    toggleRowSelection,
    toggleAllRows,
    deleteSelectedRows,
    openTransferModal,
    updateCommandeProduitField,
    handleTableFieldKeyDown,
    onRemoveProduct,
    onCreateAvoir,
    commandeSortBy,
    onSortProduits,
    onViewProductDetails,
    onCloture,
    onMettreEnAttente,
    executingAction,
    orderTotals
}: CommandeFormProps) {
    const { t } = useTranslation(['orders', 'common']);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-50">
          <div className="flex items-center justify-between px-4 py-3 shrink-0 bg-white border-b border-slate-200">
             <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBackToList}
                  className="size-9 text-slate-400 hover:text-slate-600"
                  title={t('orders:form.back_to_list')}
                >
                  <ArrowLeft className="size-5" />
                </Button>
                <div>
                  <h3 className="font-bold text-base text-slate-800">
                      {viewMode === 'EDIT' && selectedCommande
                        ? t('orders:form.edit_title', { id: selectedCommande.numero_facture || selectedCommande.id })
                        : t('orders:form.new_title')}
                  </h3>
                  <div className="flex gap-4 text-xs text-slate-400 mt-1">
                    <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-sans border border-slate-200">F2</kbd> {t('orders:form.shortcuts.search')}</span>
                    <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-sans border border-slate-200">F4</kbd> {t('orders:form.shortcuts.provider')}</span>
                    <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-sans border border-slate-200">Ctrl+A</kbd> {t('orders:form.shortcuts.select_all')}</span>
                    <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-sans border border-slate-200">Shift+Entrée</kbd> Détails produit</span>
                  </div>
                </div>
            </div>
          </div>


          <form
            className="flex-1 flex flex-col min-h-0 p-4 overflow-hidden"
            onSubmit={handleSaveCommande}
          >

            {/* Section supérieure compacte */}
            <div className="shrink-0 space-y-2 mb-2">
              <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200">
                <div className="flex flex-wrap items-end gap-2">
                  {/* Fournisseur */}
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('orders:form.provider_label')}</label>
                    <select
                      ref={fournisseurSelectRef}
                      className="w-full bg-slate-100 h-9 rounded-lg border border-slate-200 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 text-sm px-3 outline-none transition-all"
                      value={newCommandeFournisseurId}
                      onChange={(e) => setNewCommandeFournisseurId(e.target.value)}
                    >
                      <option value="" disabled>{t('orders:form.provider_placeholder')}</option>
                      {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>

                  {/* Facture */}
                  <div className="w-28">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{t('orders:form.invoice_label')}</label>
                    <input
                      type="text"
                      placeholder={t('orders:form.invoice_placeholder')}
                      className="w-full bg-slate-100 h-9 rounded-lg border border-slate-200 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 text-sm px-3 outline-none transition-all"
                      value={numeroFacture}
                      onChange={(e) => setNumeroFacture(e.target.value.toUpperCase())}
                    />
                  </div>

                  {/* Recherche produit - Using ProductSearch generic */}
                  <div className="flex-[3] min-w-[300px] relative">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Search className="size-3" /> {t('orders:form.search_placeholder')}
                    </label>
                    <ProductSearch
                      searchQuery={searchProduitQuery}
                      setSearchQuery={setSearchProduitQuery}
                      results={filteredProduits as SearchResult[]}
                      loading={false}
                      modes={['products']}
                      onSelect={(product) => selectProduct(product as ProduitModel)}
                      searchInputRef={searchInputRef}
                      handleKeyDown={handleSearchKeyDown}
                      getItemProps={getItemProps}
                      placeholder={t('orders:form.search_placeholder')}
                    />
                  </div>

                  {/* Paramètres Commande Directe */}
                  {commandeType === 'DIR' && (
                    <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-semibold text-blue-600 uppercase">Taux</span>
                          <input type="number" step="0.001" className="w-24 h-7 rounded-md border border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 px-2 text-sm outline-none" value={tauxChange} onChange={(e) => setTauxChange(e.target.value)} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-semibold text-blue-600 uppercase">Coeff</span>
                          <input type="number" step="0.01" className="w-16 h-7 rounded-md border border-slate-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 px-2 text-sm outline-none" value={fraisCoefficient} onChange={(e) => setFraisCoefficient(e.target.value)} />
                        </div>
                    </div>
                  )}

                  {/* Boutons d'action compacts */}
                  <div className="flex gap-1 pb-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 text-slate-500"
                      onClick={() => {
                        if (commandeProduits.length === 0) {
                          toast(t('orders:messages.csv_empty_order'), { icon: '⚠️' });
                          return;
                        }
                        setIsExportModalOpen(true);
                      }}
                      title={t('orders:form.export_btn')}
                    >
                      <FileDown className="size-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="size-9 text-slate-500" onClick={() => fileInputRef.current?.click()} title={t('orders:import_btn')}>
                      <FolderOpen className="size-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="size-9 text-slate-500" onClick={() => setIsCreateProduitModalOpen(true)} title={t('orders:new_product_btn')}>
                      <Plus className="size-4" />
                    </Button>

                    <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleCsvImport}
                    />

                    {selectedCommande?.status === 'CLOT' && onCreateAvoir && (
                         <Button type="button" variant="ghost" size="icon" className="size-9 text-amber-600 hover:text-amber-700 hover:bg-amber-50" onClick={onCreateAvoir} title={t('orders:messages.create_credit_note_help')}>
                            <RotateCcw className="size-4" />
                         </Button>
                    )}
                  </div>
                </div>

            </div>
            </div>

            {/* Tableau des produits - flex-1 + min-h-0 pour que seul le tableau défile */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <CommandeProductTable
                commandeProduits={commandeProduits}
                produitsList={produitsList}
                selectedRows={selectedRows}
                commandeType={commandeType}
                viewMode={viewMode === 'CREATE' ? 'CREATE' : 'EDIT'}
                selectedCommande={selectedCommande}
                saving={saving}
                fieldsConfig={fieldsConfig}
                focusedField={focusedField}
                toggleRowSelection={toggleRowSelection}
                toggleAllRows={toggleAllRows}
                deleteSelectedRows={deleteSelectedRows}
                openTransferModal={openTransferModal}
                updateCommandeProduitField={updateCommandeProduitField}
                handleTableFieldKeyDown={handleTableFieldKeyDown}
                onRemoveProduct={onRemoveProduct}
                onViewProductDetails={onViewProductDetails}
                commandeSortBy={commandeSortBy}
                onSortProduits={onSortProduits}
            />
            </div>

            <div className="mt-2 flex flex-wrap justify-between items-end gap-4 shrink-0 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-wrap gap-3 items-center">
                    {/* PRIX A HT */}
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] uppercase font-bold text-slate-400 -mb-1">PRIX A HT</span>
                        <span className="text-sm font-bold text-slate-700">{formatCurrency(orderTotals?.totalBuyHT || 0)}</span>
                    </div>

                    {/* TVA A */}
                    <div className="flex flex-col items-end border-l pl-3 border-slate-200">
                        <span className="text-[9px] uppercase font-bold text-slate-400 -mb-1">TVA A</span>
                        <span className="text-sm font-bold text-slate-500">{formatCurrency(orderTotals?.totalBuyTVA || 0)}</span>
                    </div>

                    {/* PRIX A TTC */}
                    <div className="flex flex-col items-end border-l pl-3 border-slate-200">
                        <span className="text-[9px] uppercase font-bold text-slate-400 -mb-1">PRIX A TTC</span>
                        <span className="text-lg font-black leading-none text-slate-800">{formatCurrency(orderTotals?.totalBuyTTC || 0)}</span>
                    </div>

                    {/* PRIX V TTC */}
                    <div className="flex flex-col items-end border-l pl-3 border-slate-200">
                        <span className="text-[9px] uppercase font-bold text-emerald-600 -mb-1">PRIX V TTC</span>
                        <span className="text-lg font-black leading-none text-emerald-600">{formatCurrency(orderTotals?.totalTTC || 0)}</span>
                    </div>

                    {/* MARGE */}
                    <div className="flex flex-col items-end border-l pl-3 border-slate-200">
                        <span className="text-[9px] uppercase font-bold text-slate-400 -mb-1">MARGE</span>
                        <span className={cn("text-sm font-bold", (Number(orderTotals?.globalMargin || 0)) >= 1.34 ? 'text-emerald-600' : 'text-amber-600')}>{formatCurrency(orderTotals?.totalMarginValue || 0)}</span>
                    </div>

                    {/* COEFF */}
                    <div className="flex flex-col items-end border-l pl-3 border-slate-200">
                        <span className="text-[9px] uppercase font-bold text-slate-400 -mb-1">COEFF</span>
                        <div className="flex items-baseline gap-1">
                            <span className={cn("text-sm font-bold", (Number(orderTotals?.globalMargin || 0)) >= 1.34 ? 'text-emerald-600' : 'text-amber-600')}>x{orderTotals?.globalMargin || '1.00'}</span>
                            <span className={cn("text-[10px] font-semibold", (Number(orderTotals?.globalMargin || 0)) >= 1.34 ? 'text-emerald-500' : 'text-amber-500')}>({orderTotals?.globalMarginPercent || '0.00'}%)</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                {/* Mettre en attente - visible uniquement en mode EDIT */}
                {viewMode === 'EDIT' && onMettreEnAttente && selectedCommande?.status !== 'CLOT' && (
                  <Button
                    type="button"
                    variant={selectedCommande?.status === 'ATT' ? 'default' : 'outline'}
                    size="sm"
                    className={cn(
                      "gap-1",
                      selectedCommande?.status === 'ATT' ? 'bg-blue-600 hover:bg-blue-700' : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                    )}
                    onClick={onMettreEnAttente}
                    disabled={saving || executingAction}
                  >
                    {selectedCommande?.status === 'ATT' ? <Play className="size-4" /> : <Pause className="size-4" />}
                    {selectedCommande?.status === 'ATT' ? t('orders:details.resume') : t('orders:details.suspend')}
                  </Button>
                )}
                {/* Clôturer - visible uniquement en mode EDIT */}
                {viewMode === 'EDIT' && onCloture && selectedCommande?.status !== 'CLOT' && (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={onCloture}
                    disabled={saving || executingAction}
                  >
                    <Check className="size-4" /> {t('orders:details.close')}
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                  disabled={saving || !newCommandeFournisseurId}
                >
                  {!saving && <Save className="size-4" />}
                  {saving ? t('orders:form.saving') : t('orders:form.save_btn')}
                </Button>
              </div>
            </div>
          </form>

          {/* Modal d'export */}
          <ExportCommandeModal
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            commande={selectedCommande}
          />
        </div>
    );
}

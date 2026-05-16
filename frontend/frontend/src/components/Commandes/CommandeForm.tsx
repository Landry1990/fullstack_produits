import React, { type FormEvent, type RefObject } from 'react';
import type { Commande, Fournisseur, ProduitModel, CommandeProduit } from '../../types';
import { useTranslation } from 'react-i18next';
import CommandeProductTable from './CommandeProductTable';
import { formatCurrency } from '../../utils/formatters';

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
    handleCsvExport: (wholesaler: 'UBIPHARM' | 'LABOREX') => void;
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
    // Actions rapides depuis le formulaire
    onCloture?: () => void;
    onMettreEnAttente?: () => void;
    executingAction?: boolean;
    orderTotals?: {
      totalHT: number;
      totalTVA: number;
      totalTTC: number;
      totalBuyHT: number;
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
    onCloture,
    onMettreEnAttente,
    executingAction,
    orderTotals
}: CommandeFormProps) {
    const { t } = useTranslation(['orders', 'common']);
 
    const htColor = (orderTotals?.totalTTC || 0) > 0 ? 'text-gray-700' : 'text-gray-300';
    const marginColor = (Number(orderTotals?.globalMargin || 0)) >= 1.34 ? 'text-emerald-600' : 'text-amber-600';
    return (
        <div className="flex flex-col h-full overflow-hidden bg-gray-50">
          <div className="flex items-center justify-between px-4 py-3 shrink-0 bg-white border-b border-gray-100">
             <div className="flex items-center gap-3">
                <button
                  onClick={handleBackToList}
                  className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                  title={t('orders:form.back_to_list')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <div>
                  <h3 className="font-bold text-base text-gray-900">
                      {viewMode === 'EDIT' && selectedCommande
                        ? t('orders:form.edit_title', { id: selectedCommande.numero_facture || selectedCommande.id })
                        : t('orders:form.new_title')}
                  </h3>
                  <div className="flex gap-4 text-xs text-gray-400 mt-1">
                    <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-sans border border-gray-200">F2</kbd> {t('orders:form.shortcuts.search')}</span>
                    <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-sans border border-gray-200">F4</kbd> {t('orders:form.shortcuts.provider')}</span>
                    <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-sans border border-gray-200">Ctrl+A</kbd> {t('orders:form.shortcuts.select_all')}</span>
                  </div>
                </div>
            </div>
          </div>


          <form
            className="flex-1 flex flex-col min-h-0 p-4"
            onSubmit={handleSaveCommande}
          >

            {/* Section supérieure compacte */}
            <div className="shrink-0 space-y-2 mb-2">
              <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                <div className="flex flex-wrap items-end gap-2">
                  {/* Fournisseur */}
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{t('orders:form.provider_label')}</label>
                    <select
                      ref={fournisseurSelectRef}
                      className="select select-bordered select-sm w-full bg-gray-50 h-9 rounded-lg border-gray-200 focus:border-indigo-500 text-sm"
                      value={newCommandeFournisseurId}
                      onChange={(e) => setNewCommandeFournisseurId(e.target.value)}
                    >
                      <option value="" disabled>{t('orders:form.provider_placeholder')}</option>
                      {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>

                  {/* Facture */}
                  <div className="w-28">
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{t('orders:form.invoice_label')}</label>
                    <input
                      type="text"
                      placeholder={t('orders:form.invoice_placeholder')}
                      className="input input-bordered input-sm w-full bg-gray-50 h-9 rounded-lg border-gray-200 focus:border-indigo-500 text-sm"
                      value={numeroFacture}
                      onChange={(e) => setNumeroFacture(e.target.value.toUpperCase())}
                    />
                  </div>

                  {/* Recherche produit */}
                  <div className="flex-[3] min-w-[300px] relative">
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">🔍 {t('orders:form.search_placeholder')}</label>
                    <div className="relative">
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder={t('orders:form.search_placeholder')}
                        className="input input-bordered w-full pl-9 h-9 bg-white rounded-lg border-gray-200 focus:border-indigo-500 text-sm"
                        value={searchProduitQuery}
                        onChange={(e) => setSearchProduitQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                      />
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>

                      {/* Dropdown résultats */}
                      {searchProduitQuery && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 max-h-96 overflow-y-auto z-50">
                          {filteredProduits.length === 0 ? (
                            <div className="text-center py-4 text-gray-400 text-sm">
                              {t('orders:form.no_product_found')}
                            </div>
                          ) : (
                            <div className="p-1 space-y-0.5">
                              {filteredProduits.map((p, idx) => {
                                const itemProps = getItemProps(idx);
                                return (
                                <div
                                  key={p.id}
                                  {...itemProps}
                                  onClick={() => selectProduct(p)}
                                  style={itemProps.style}
                                  className={`
                                    group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all
                                    ${itemProps.className ? 'bg-indigo-50' : 'hover:bg-gray-50'}
                                  `}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold truncate text-sm text-gray-900">{p.name}</div>
                                    <div className="text-[10px] flex gap-2 mt-0.5 text-gray-500">
                                      <span>Stock: {p.stock}</span>
                                      <span>Prix: {p.selling_price} F</span>
                                    </div>
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Paramètres Commande Directe */}
                  {commandeType === 'DIR' && (
                    <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-semibold text-blue-600 uppercase">Taux</span>
                          <input type="number" step="0.001" className="input input-bordered input-xs w-16 h-7 rounded-md border-gray-200 focus:border-blue-400" value={tauxChange} onChange={(e) => setTauxChange(e.target.value)} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-semibold text-blue-600 uppercase">Coeff</span>
                          <input type="number" step="0.01" className="input input-bordered input-xs w-12 h-7 rounded-md border-gray-200 focus:border-blue-400" value={fraisCoefficient} onChange={(e) => setFraisCoefficient(e.target.value)} />
                        </div>
                    </div>
                  )}

                  {/* Boutons d'action compacts */}
                  <div className="flex gap-1 pb-0.5">
                    <div className="dropdown dropdown-end">
                      <div tabIndex={0} role="button" className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer" title={t('orders:form.export_btn')}>
                        📤
                      </div>
                      <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow-xl bg-white rounded-lg w-52 border border-gray-100 mt-1">
                        <li><a onClick={() => handleCsvExport('UBIPHARM')} className="text-sm text-gray-700 hover:bg-gray-50 py-2">{t('orders:form.export_options.ubipharm', 'Ubipharm (CIP1)')}</a></li>
                        <li><a onClick={() => handleCsvExport('LABOREX')} className="text-sm text-gray-700 hover:bg-gray-50 py-2">{t('orders:form.export_options.laborex', 'Laborex (CIP2)')}</a></li>
                      </ul>
                    </div>
                    <button type="button" className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" onClick={() => fileInputRef.current?.click()} title={t('orders:import_btn')}>
                      📂
                    </button>
                    <button type="button" className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" onClick={() => setIsCreateProduitModalOpen(true)} title={t('orders:new_product_btn')}>
                      ➕
                    </button>

                    <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleCsvImport}
                    />

                    {selectedCommande?.status === 'CLOT' && onCreateAvoir && (
                         <button type="button" className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" onClick={onCreateAvoir} title={t('orders:messages.create_credit_note_help')}>
                            🔄
                         </button>
                    )}
                  </div>
                </div>

            </div>
            </div>

            {/* Tableau des produits */}
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
                commandeSortBy={commandeSortBy}
                onSortProduits={onSortProduits}
            />

            <div className="mt-4 flex flex-wrap justify-between items-end gap-4 shrink-0 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex flex-wrap gap-4 items-center">
                    {/* HT (Achat) */}
                    <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('orders:product_table.total_ht', 'HT (ACHAT)')}</span>
                        <span className={`text-sm font-mono font-semibold ${htColor}`}>{formatCurrency(orderTotals?.totalBuyHT || 0)}</span>
                    </div>

                    {/* TVA */}
                    <div className="flex flex-col border-l pl-4 border-gray-200">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('orders:product_table.total_tva', 'TVA (VENTE)')}</span>
                        <span className="text-sm font-mono font-semibold text-gray-500">{formatCurrency(orderTotals?.totalTVA || 0)}</span>
                    </div>

                    {/* TTC (Vente) */}
                    <div className="flex flex-col border-l pl-4 border-gray-200">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('orders:product_table.total_ttc', 'TTC (VENTE)')}</span>
                         <span className="text-base md:text-lg font-mono font-bold text-indigo-600">{formatCurrency(orderTotals?.totalTTC || 0)}</span>
                    </div>

                    {/* Montant Marge */}
                    <div className="flex flex-col border-l pl-4 border-gray-200">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">💰 {t('orders:product_table.info_row.margin_value', 'MONTANT MARGE')}</span>
                        <span className={`text-sm font-mono font-semibold ${marginColor}`}>{formatCurrency(orderTotals?.totalMarginValue || 0)}</span>
                    </div>

                    {/* Coefficient & Pourcentage */}
                    <div className="flex flex-col border-l pl-4 border-gray-200">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">📦 {t('orders:product_table.headers.margin', 'COEFF / %')}</span>
                        <div className="flex items-baseline gap-1">
                            <span className={`text-lg font-mono font-bold ${marginColor}`}>x{orderTotals?.globalMargin || '1.0000'}</span>
                            <span className={`text-[10px] font-semibold ${marginColor}`}>({orderTotals?.globalMarginPercent || '0.00'}%)</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                {/* Mettre en attente - visible uniquement en mode EDIT */}
                {viewMode === 'EDIT' && onMettreEnAttente && selectedCommande?.status !== 'CLOT' && (
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg text-white transition-colors ${selectedCommande?.status === 'ATT' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                    onClick={onMettreEnAttente}
                    disabled={saving || executingAction}
                  >
                    {selectedCommande?.status === 'ATT' ? '▶️' : '⏸️'} {selectedCommande?.status === 'ATT' ? t('orders:details.resume') : t('orders:details.suspend')}
                  </button>
                )}
                {/* Clôturer - visible uniquement en mode EDIT */}
                {viewMode === 'EDIT' && onCloture && selectedCommande?.status !== 'CLOT' && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                    onClick={onCloture}
                    disabled={saving || executingAction}
                  >
                    ✅ {t('orders:details.close')}
                  </button>
                )}
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                  disabled={saving || !newCommandeFournisseurId}
                >
                  {!saving && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>}
                  {saving ? t('orders:form.saving') : t('orders:form.save_btn')}
                </button>
              </div>
            </div>
          </form>
        </div>
    );
}

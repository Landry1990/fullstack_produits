import React, { type FormEvent, type RefObject } from 'react';
import type { Commande, Fournisseur, ProduitModel, CommandeProduit } from '../../types';
import CommandeProductTable from './CommandeProductTable';

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
    lastSaved: Date | null;
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
    lastSaved,
    fieldsConfig,
    focusedField,
    toggleRowSelection,
    toggleAllRows,
    deleteSelectedRows,
    openTransferModal,
    updateCommandeProduitField,
    handleTableFieldKeyDown,
    onRemoveProduct,
    onCreateAvoir
 
}: CommandeFormProps) {
    return (
        <div className="flex flex-col h-[calc(100vh-100px)]">
          <div className="flex items-center justify-between mb-4 shrink-0">
             <div className="flex items-center gap-4">
                <button 
                  onClick={handleBackToList}
                  className="btn btn-circle btn-ghost btn-sm"
                  title="Retour à la liste"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <div>
                  <h3 className="font-bold text-base md:text-lg">
                      {viewMode === 'EDIT' && selectedCommande 
                        ? `Modifier Commande #${selectedCommande.numero_facture || selectedCommande.id}` 
                        : 'Nouvelle Commande'}
                  </h3>
                  <div className="flex gap-4 text-xs text-base-content/50 mt-1">
                    <span className="flex items-center gap-1"><kbd className="kbd kbd-xs font-sans">F2</kbd> Recherche</span>
                    <span className="flex items-center gap-1"><kbd className="kbd kbd-xs font-sans">F4</kbd> Fournisseur</span>
                    <span className="flex items-center gap-1"><kbd className="kbd kbd-xs font-sans">Ctrl+A</kbd> Select All</span>
                  </div>
                </div>
            </div>
          </div>
          
          
          <form 
            className="flex-1 flex flex-col min-h-0" 
            onSubmit={handleSaveCommande}
          > 
 
            {/* Section supérieure : Informations et Recherche */}
            <div className="shrink-0 space-y-4 mb-4">
              {/* Informations de la commande */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-base-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <label className="form-control w-full">
                    <div className="label py-1">
                      <span className="label-text text-xs font-bold text-base-content/50 uppercase tracking-wider">Fournisseur (F4) *</span>
                    </div>
                    <select
                      ref={fournisseurSelectRef}
                      className="select select-bordered w-full select-sm bg-base-50 focus:bg-white"
                      value={newCommandeFournisseurId}
                      onChange={(e) => setNewCommandeFournisseurId(e.target.value)}
                      required
                    >
                      <option value="" disabled>Sélectionnez un fournisseur</option>
                      {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </label>
                  
                  <label className="form-control w-full">
                    <div className="label py-1">
                      <span className="label-text text-xs font-bold text-base-content/50 uppercase tracking-wider">Numéro de facture</span>
                    </div>
                    <input 
                      type="text"
                      placeholder="Ex: FAC-2024-001"
                      className="input input-bordered w-full input-sm bg-base-50 focus:bg-white"
                      value={numeroFacture}
                      onChange={(e) => setNumeroFacture(e.target.value)}
                    />
                  </label>

                  <div className="flex items-end justify-end gap-2">
                    {/* Export Dropdown */}
                    <div className="dropdown dropdown-end">
                      <div tabIndex={0} role="button" className="btn btn-sm btn-ghost border-base-300">
                        📤 Exporter CSV
                      </div>
                      <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52 border border-base-200">
                        <li><a onClick={() => handleCsvExport('UBIPHARM')}>Ubipharm (CIP1)</a></li>
                        <li><a onClick={() => handleCsvExport('LABOREX')}>Laborex (CIP2)</a></li>
                      </ul>
      </div>

                    <input 
                        type="file" 
                        accept=".csv"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleCsvImport}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      📂 Importer CSV
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setIsCreateProduitModalOpen(true)}
                    >
                      + Nouveau produit
                    </button>
                    {/* Bouton Créer Avoir (Visible uniquement si commande clôturée et handler fourni) */}
                    {selectedCommande?.status === 'CLOT' && onCreateAvoir && (
                         <button
                            type="button"
                            className="btn btn-warning btn-sm btn-outline gap-1"
                            onClick={onCreateAvoir}
                            title="Créer un avoir / retour fournisseur à partir de cette commande"
                         >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                            Retour / Avoir
                         </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Champs Spécifiques Commandes Directes */}
              {commandeType === 'DIR' && (
                <div className="bg-blue-50/50 rounded-xl p-4 shadow-sm border border-blue-100 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                      <span className="badge badge-info badge-sm">COMMANDE DIRECTE (IMPORT)</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="form-control w-full">
                      <div className="label py-1">
                        <span className="label-text text-xs font-bold text-base-content/50 uppercase tracking-wider">Taux de Change (XAF/€)</span>
                      </div>
                      <input 
                        type="number"
                        step="0.001"
                        placeholder="655.957"
                        className="input input-bordered w-full input-sm bg-white"
                        value={tauxChange}
                        onChange={(e) => setTauxChange(e.target.value)}
                      />
                    </label>
                    
                    <label className="form-control w-full">
                      <div className="label py-1">
                        <span className="label-text text-xs font-bold text-base-content/50 uppercase tracking-wider">Coefficient (Frais)</span>
                      </div>
                      <input 
                        type="number"
                        step="0.01"
                        placeholder="1.35"
                        className="input input-bordered w-full input-sm bg-white"
                        value={fraisCoefficient}
                        onChange={(e) => setFraisCoefficient(e.target.value)}
                      />
                      <div className="label py-0">
                          <span className="label-text-alt text-xs opacity-60">Prix Revient = (Prix € * Taux) * Coeff</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Recherche produit */}
              <div className="bg-white rounded-xl shadow-sm border border-base-200 p-4 relative">
                <label className="label py-1 mb-2">
                  <span className="label-text text-xs font-bold text-base-content/50 uppercase tracking-wider">Rechercher un produit (F2)</span>
                </label>
                <div className="relative">
                  <input 
                    ref={searchInputRef}
                    type="text" 
                    placeholder="Tapez pour rechercher par nom ou CIP..."
                    className="input input-bordered w-full pl-12 text-base h-12 bg-base-50 focus:bg-white focus:ring-2 focus:ring-primary/20"
                    value={searchProduitQuery}
                      onChange={(e) => setSearchProduitQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                  />
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                
                {/* Dropdown résultats */}
                {searchProduitQuery && (
                  <div className="absolute left-4 right-4 top-full mt-2 bg-white rounded-xl shadow-xl border border-base-200 max-h-96 overflow-y-auto z-50">
                    {filteredProduits.length === 0 ? (
                      <div className="text-center py-8 text-base-content/40 text-sm">
                        Aucun produit trouvé
                      </div>
                    ) : (
                      <div className="p-2 space-y-1">
                        {filteredProduits.map((p, idx) => {
                          const itemProps = getItemProps(idx);
                          return (
                          <div 
                            key={p.id}
                            {...itemProps}
                            onClick={() => selectProduct(p)}
                            style={itemProps.style}
                            className={`
                              group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all
                              ${itemProps.className ? 'shadow-md' : 'hover:bg-base-100'}
                            `}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate text-sm">{p.name}</div>
                              <div className="text-xs flex gap-3 mt-0.5 opacity-80">
                                <span>Stock: {p.stock}</span>
                                <span>Prix: {p.selling_price} F</span>
                                {(p.cip1 || p.cip2 || p.cip3) && (
                                  <span>CIP: {p.cip1 || p.cip2 || p.cip3}</span>
                                )}
                              </div>
                            </div>
                            <div className={`opacity-0 group-hover:opacity-100 ${itemProps.className ? 'opacity-100' : ''}`}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                              </svg>
                            </div>
                          </div>
                        )})}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Tableau des produits */}
            <CommandeProductTable
                commandeProduits={commandeProduits}
                produitsList={produitsList}
                selectedRows={selectedRows}
                commandeType={commandeType} // Pass type to table
                viewMode={viewMode === 'CREATE' ? 'CREATE' : 'EDIT'}
                selectedCommande={selectedCommande}
                saving={saving}
                lastSaved={lastSaved}
                fieldsConfig={fieldsConfig}
                focusedField={focusedField}
                toggleRowSelection={toggleRowSelection}
                toggleAllRows={toggleAllRows}
                deleteSelectedRows={deleteSelectedRows}
                openTransferModal={openTransferModal}
                updateCommandeProduitField={updateCommandeProduitField}
                handleTableFieldKeyDown={handleTableFieldKeyDown}
                onRemoveProduct={onRemoveProduct}
            />
            
            <div className="mt-4 flex justify-between items-center shrink-0">
                <div className="text-sm text-base-content/50">
                    Utilisez <kbd className="kbd kbd-sm font-sans mx-1">Tab</kbd> pour naviguer, <kbd className="kbd kbd-sm font-sans mx-1">Entrée</kbd> pour valider
                </div>
              <button 
                type="submit" 
                className={`btn btn-primary gap-2 ${saving ? 'loading' : ''}`}
                disabled={saving || !newCommandeFournisseurId}
              >
                {!saving && <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>}
                {saving ? 'Enregistrement...' : 'Enregistrer la commande'}
              </button>
            </div>
          </form> 
        </div>
    );
}

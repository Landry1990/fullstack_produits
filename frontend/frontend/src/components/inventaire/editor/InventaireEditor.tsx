import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
    ChevronLeft, Plus, FileText, CheckCircle2, History, 
    Download, Save, Upload
} from 'lucide-react';

import type { Inventaire } from '../../../types';
import { useInventaireEditor } from '../../../hooks/inventaire/useInventaireEditor';
import { useProductSearch } from '../../../hooks/inventaire/useProductSearch';
import { useInventairePDF } from '../../../hooks/inventaire/useInventairePDF';

import { InventaireProductSearch } from './InventaireProductSearch';
import { InventaireAnalysisTab } from './InventaireAnalysisTab';
import { InventaireDataTab } from './InventaireDataTab';

interface InventaireEditorProps {
    viewMode: 'CREATE' | 'EDIT';
    setViewMode: (mode: 'LIST' | 'CREATE' | 'EDIT' | 'AUDIT') => void;
    activeInventaire: Inventaire | null;
    editorLogic: ReturnType<typeof useInventaireEditor>;
}

export const InventaireEditor: React.FC<InventaireEditorProps> = ({
    viewMode,
    setViewMode,
    activeInventaire,
    editorLogic
}) => {
    const { t } = useTranslation();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    
    const [activeTab, setActiveTab] = React.useState<'ENTRY' | 'ANALYSIS'>('ENTRY');

    const {
        lignes, setLignes,
        dateInventaire, setDateInventaire,
        description, setDescription,
        saving, isReadOnly,
        selectedLines, toggleSelectAll, toggleSelectLine,
        handleSaveHeader, handleManualSave,
        handleUpdateQuantity, handleDeleteLine, handleBulkDelete,
        handleOpenValidateModal, handleImportCSV, importing,
        inventoryStats
    } = editorLogic;

    const { generateEtatPDF, generateEcartsPDF } = useInventairePDF({ t });
    
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    
    const searchLogic = useProductSearch(
        `${String(apiBaseUrl).replace(/\/$/, '')}/lignes-inventaire/`,
        activeInventaire?.id,
        setLignes,
        lignes,
        activeInventaire?.inventory_type
    );

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          
          {/* Header Card */}
          <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 flex flex-col overflow-hidden">
            <div className="p-6 border-b border-base-200">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                  <button 
                    className="btn btn-ghost btn-circle rounded-xl hover:bg-base-200" 
                    onClick={() => setViewMode('LIST')}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <div>
                    <h1 className="text-2xl font-bold text-base-content tracking-tight flex items-center gap-2">
                       {viewMode === 'CREATE' ? (
                          <>
                            <Plus className="h-6 w-6 text-primary" />
                            {t('stock.inventaire.detail.title_new')}
                          </>
                       ) : (
                          <>
                            <FileText className="h-6 w-6 text-primary" />
                            {t('stock.inventaire.detail.title_edit', { id: activeInventaire?.id })}
                          </>
                       )}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        {isReadOnly ? (
                            <span className="badge badge-success rounded-full text-[10px] font-bold uppercase tracking-wider gap-1 px-3 border-none">
                                <CheckCircle2 className="h-3 w-3" />
                                {t('stock.inventaire.detail.validated')}
                            </span>
                        ) : (
                            <span className="badge badge-warning rounded-full text-[10px] font-bold uppercase tracking-wider gap-1 px-3 border-none">
                                <History className="h-3 w-3" />
                                {t('common.status.draft', { defaultValue: 'Brouillon' })}
                            </span>
                        )}
                        {activeInventaire?.inventory_type && (
                            <span className="badge badge-info rounded-full text-[10px] font-bold uppercase tracking-wider px-3 border-none text-white">
                                {activeInventaire.inventory_type === 'RESERVE' ? t('stock.inventaire.types.reserve', 'STOCK RÉSERVE') : 
                                 activeInventaire.inventory_type === 'RAYON' ? t('stock.inventaire.types.rayon', 'STOCK RAYON') : t('stock.inventaire.types.global', 'STOCK GLOBAL')}
                            </span>
                        )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-base-200 p-1 rounded-xl border border-base-300 flex">
                      <button 
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'ENTRY' ? 'bg-base-100 shadow-sm text-primary' : 'text-base-content/40 hover:text-base-content'}`}
                        onClick={() => setActiveTab('ENTRY')}
                      >
                        {t('stock.inventaire.detail.tab_entry', { defaultValue: 'Saisie' })}
                      </button>
                      <button 
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'ANALYSIS' ? 'bg-base-100 shadow-sm text-primary' : 'text-base-content/40 hover:text-base-content'}`}
                        onClick={() => setActiveTab('ANALYSIS')}
                      >
                        {t('stock.inventaire.detail.tab_analysis', { defaultValue: 'Analyse' })}
                      </button>
                  </div>

                  <button 
                    className="btn btn-primary rounded-xl px-6 gap-2 shadow-lg shadow-primary/20" 
                    onClick={() => activeInventaire && generateEtatPDF(activeInventaire, lignes)}
                    disabled={!activeInventaire?.id}
                  >
                    <Download className="h-5 w-5" />
                    {t('stock.inventaire.detail.print')}
                  </button>

                  {!isReadOnly && activeInventaire && (
                    <div className="flex gap-2">
                        <input 
                            type="file" 
                            accept=".csv" 
                            className="hidden" 
                            ref={fileInputRef}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    handleImportCSV(file);
                                    e.target.value = ''; // Reset input
                                }
                            }}
                        />
                        <button 
                            className="btn btn-secondary rounded-xl px-4 gap-2 shadow-lg shadow-secondary/20" 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={importing || saving}
                            title={t('stock.inventaire.detail.import_csv_title', 'Importer un fichier CSV (Cip, Quantite)')}
                        >
                            {importing ? <span className="loading loading-spinner loading-sm"></span> : <Upload className="h-5 w-5" />}
                            <span className="hidden sm:inline">{t('common.import', 'Importer')}</span>
                        </button>

                        <button 
                            className="btn btn-info rounded-xl gap-2 shadow-lg shadow-info/20 text-white" 
                            onClick={handleManualSave} 
                            disabled={saving || importing}
                        >
                            {saving ? <span className="loading loading-spinner loading-sm"></span> : <Save className="h-5 w-5" />}
                            {t('common.save')}
                        </button>

                        <button 
                            className="btn btn-success rounded-xl text-white gap-2 shadow-lg shadow-success/20" 
                            onClick={handleOpenValidateModal} 
                            disabled={saving}
                        >
                            {saving ? (
                                <span className="loading loading-spinner"></span>
                            ) : (
                                <CheckCircle2 className="h-5 w-5" />
                            )}
                            {t('stock.inventaire.detail.validate')}
                        </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Header Form Area */}
            <div className="p-6 bg-base-50/50 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">{t('stock.inventaire.detail.date')}</label>
                    <input 
                        type="date" 
                        className="input input-bordered w-full rounded-xl border-base-300 focus:border-primary" 
                        value={dateInventaire} 
                        onChange={e => setDateInventaire(e.target.value)}
                        disabled={isReadOnly}
                        onBlur={handleSaveHeader}
                    />
                </div>
                <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">{t('stock.inventaire.detail.description')}</label>
                    <input 
                        type="text" 
                        className="input input-bordered w-full rounded-xl border-base-300 focus:border-primary" 
                        placeholder={t('stock.inventaire.detail.placeholder_desc')}
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        disabled={isReadOnly}
                        onBlur={handleSaveHeader}
                    />
                </div>
            </div>
          </div>

          {/* Work Area */}
          <div className="grid grid-cols-1 gap-6">
            {activeTab === 'ENTRY' ? (
                <>
                    <InventaireProductSearch searchLogic={searchLogic} isReadOnly={isReadOnly} />
                    <InventaireDataTab 
                        lignes={lignes}
                        isReadOnly={isReadOnly}
                        saving={saving}
                        selectedLines={selectedLines}
                        toggleSelectAll={toggleSelectAll}
                        toggleSelectLine={toggleSelectLine}
                        handleUpdateQuantity={handleUpdateQuantity}
                        handleDeleteLine={handleDeleteLine}
                        handleBulkDelete={handleBulkDelete}
                        onQtyEnter={searchLogic.focusInput}
                    />
                </>
            ) : (
                inventoryStats && activeInventaire && (
                    <InventaireAnalysisTab 
                        inventoryStats={inventoryStats}
                        handlePrintEcartsFrontend={() => activeInventaire && generateEcartsPDF(activeInventaire, lignes)}
                    />
                )
            )}
          </div>
        </div>
    );
};

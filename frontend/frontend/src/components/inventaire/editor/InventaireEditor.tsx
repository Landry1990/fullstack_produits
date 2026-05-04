import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    ChevronLeft, Plus, FileText, CheckCircle2, History, 
    Download, Save, Upload
} from 'lucide-react';
import api from '../../../services/api';
import { toast } from 'react-hot-toast';

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
    const { t } = useTranslation(['stock', 'common']);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    
    const [activeTab, setActiveTab] = React.useState<'ENTRY' | 'ANALYSIS'>('ENTRY');
    const [printGroupBy, setPrintGroupBy] = React.useState<'rayon' | 'forme' | 'groupe'>('rayon');
    const [sendingTelegram, setSendingTelegram] = useState(false);

    const handleSendTelegram = async () => {
        setSendingTelegram(true);
        try {
            await api.post('telegram/rapport-inventaire/', activeInventaire?.id ? { inventaire_id: activeInventaire.id } : {});
            toast.success('Rapport inventaire envoyé sur Telegram !', { icon: '📨' });
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Erreur envoi Telegram');
        } finally {
            setSendingTelegram(false);
        }
    };

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

    const { generateEtatPDF, generateEcartsPDF } = useInventairePDF();
    
    const searchLogic = useProductSearch(
        'lignes-inventaire/',
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
                            {t('inventaire.detail.title_new')}
                          </>
                       ) : (
                          <>
                            <FileText className="h-6 w-6 text-primary" />
                            {t('inventaire.detail.title_edit', { id: activeInventaire?.id })}
                          </>
                       )}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        {isReadOnly ? (
                            <span className="badge badge-success rounded-full text-[10px] font-bold uppercase tracking-wider gap-1 px-3 border-none">
                                <CheckCircle2 className="h-3 w-3" />
                                {t('inventaire.detail.validated')}
                            </span>
                        ) : (
                            <span className="badge badge-warning rounded-full text-[10px] font-bold uppercase tracking-wider gap-1 px-3 border-none">
                                <History className="h-3 w-3" />
                                {t('common:status.draft', { defaultValue: 'Brouillon' })}
                            </span>
                        )}
                        {activeInventaire?.inventory_type && (
                            <span className="badge badge-info rounded-full text-[10px] font-bold uppercase tracking-wider px-3 border-none text-white">
                                {activeInventaire.inventory_type === 'RESERVE' ? t('inventaire.types.reserve', 'STOCK RÉSERVE') : 
                                 activeInventaire.inventory_type === 'RAYON' ? t('inventaire.types.rayon', 'STOCK RAYON') : t('inventaire.types.global', 'STOCK GLOBAL')}
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
                        {t('inventaire.detail.tab_entry', { defaultValue: 'Saisie' })}
                      </button>
                      <button 
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'ANALYSIS' ? 'bg-base-100 shadow-sm text-primary' : 'text-base-content/40 hover:text-base-content'}`}
                        onClick={() => setActiveTab('ANALYSIS')}
                      >
                        {t('inventaire.detail.tab_analysis', { defaultValue: 'Analyse' })}
                      </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <select 
                      value={printGroupBy}
                      onChange={(e) => setPrintGroupBy(e.target.value as any)}
                      className="select select-bordered select-sm rounded-xl text-[10px] font-bold uppercase h-10"
                      title={t('inventaire.detail.print_group_by', 'Regrouper par')}
                    >
                      <option value="rayon">{t('inventaire.detail.group_rayon', 'Par Rayon')}</option>
                      <option value="forme">{t('inventaire.detail.group_forme', 'Par Forme')}</option>
                      <option value="groupe">{t('inventaire.detail.group_groupe', 'Par Groupe')}</option>
                    </select>
                    <button 
                      className="btn btn-primary rounded-xl px-4 gap-2 shadow-lg shadow-primary/20 h-10 min-h-0" 
                      onClick={() => activeInventaire && generateEtatPDF(activeInventaire, printGroupBy)}
                      disabled={!activeInventaire?.id}
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">{t('inventaire.detail.print')}</span>
                    </button>
                    <button
                      className={`btn rounded-xl h-10 min-h-0 px-3 gap-2 text-[#229ED9] border-[#229ED9]/30 hover:bg-[#229ED9]/10 hover:border-[#229ED9] transition-all ${sendingTelegram ? 'loading' : ''}`}
                      onClick={handleSendTelegram}
                      disabled={sendingTelegram || !activeInventaire?.id}
                      title="Envoyer le rapport d'inventaire sur Telegram"
                    >
                      {!sendingTelegram && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.67l-2.93-.918c-.638-.196-.65-.638.136-.943l11.434-4.41c.53-.194.995.131.822.943z"/>
                        </svg>
                      )}
                    </button>
                  </div>

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
                            title={t('inventaire.detail.import_csv_title', 'Importer un fichier CSV (Cip, Quantite)')}
                        >
                            {importing ? <span className="loading loading-spinner loading-sm"></span> : <Upload className="h-5 w-5" />}
                            <span className="hidden sm:inline">{t('common:import', 'Importer')}</span>
                        </button>

                        <button 
                            className="btn btn-info rounded-xl gap-2 shadow-lg shadow-info/20 text-white" 
                            onClick={handleManualSave} 
                            disabled={saving || importing}
                        >
                            {saving ? <span className="loading loading-spinner loading-sm"></span> : <Save className="h-5 w-5" />}
                            {t('common:save')}
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
                            {t('inventaire.detail.validate')}
                        </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Header Form Area */}
            <div className="p-6 bg-base-50/50 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">{t('inventaire.detail.date')}</label>
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
                    <label className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">{t('inventaire.detail.description')}</label>
                    <input 
                        type="text" 
                        className="input input-bordered w-full rounded-xl border-base-300 focus:border-primary" 
                        placeholder={t('inventaire.detail.placeholder_desc')}
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
                        handlePrintEcartsFrontend={() => activeInventaire && generateEcartsPDF(activeInventaire, printGroupBy)}
                        inventaireId={activeInventaire?.id}
                    />
                )
            )}
          </div>
        </div>
    );
};

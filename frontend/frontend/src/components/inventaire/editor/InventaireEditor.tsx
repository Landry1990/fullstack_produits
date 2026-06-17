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
        saving, autoSaving, isReadOnly,
        selectedLines, toggleSelectAll, toggleSelectLine,
        dirtyLineIds,
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
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                  <button
                    className="inline-flex items-center justify-center size-9 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                    onClick={() => setViewMode('LIST')}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                       {viewMode === 'CREATE' ? (
                          <>
                            <Plus className="h-6 w-6 text-emerald-600" />
                            {t('inventaire.detail.title_new')}
                          </>
                       ) : (
                          <>
                            <FileText className="h-6 w-6 text-emerald-600" />
                            {t('inventaire.detail.title_edit', { id: activeInventaire?.id })}
                          </>
                       )}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        {isReadOnly ? (
                            <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600">
                                <CheckCircle2 className="h-3 w-3" />
                                {t('inventaire.detail.validated')}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600">
                                <History className="h-3 w-3" />
                                {t('common:status.draft', { defaultValue: 'Brouillon' })}
                            </span>
                        )}
                        {autoSaving && (
                            <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 animate-pulse">
                                <div className="animate-spin rounded-full size-3 border-b-2 border-slate-400"></div>
                                {t('common:auto_saving', { defaultValue: 'Sauvegarde auto...' })}
                            </span>
                        )}
                        {activeInventaire?.inventory_type && (
                            <span className="inline-flex items-center px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600">
                                {activeInventaire.inventory_type === 'RESERVE' ? t('inventaire.types.reserve', 'STOCK RÉSERVE') :
                                 activeInventaire.inventory_type === 'RAYON' ? t('inventaire.types.rayon', 'STOCK RAYON') : t('inventaire.types.global', 'STOCK GLOBAL')}
                            </span>
                        )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex">
                      <button
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'ENTRY' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                        onClick={() => setActiveTab('ENTRY')}
                      >
                        {t('inventaire.detail.tab_entry', { defaultValue: 'Saisie' })}
                      </button>
                      <button
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'ANALYSIS' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                        onClick={() => setActiveTab('ANALYSIS')}
                      >
                        {t('inventaire.detail.tab_analysis', { defaultValue: 'Analyse' })}
                      </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <select
                      value={printGroupBy}
                      onChange={(e) => setPrintGroupBy(e.target.value as any)}
                      className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-[10px] font-bold uppercase text-slate-700 focus:outline-none focus:border-emerald-500 transition-all"
                      title={t('inventaire.detail.print_group_by', 'Regrouper par')}
                    >
                      <option value="rayon">{t('inventaire.detail.group_rayon', 'Par Rayon')}</option>
                      <option value="forme">{t('inventaire.detail.group_forme', 'Par Forme')}</option>
                      <option value="groupe">{t('inventaire.detail.group_groupe', 'Par Groupe')}</option>
                    </select>
                    <button
                      className="inline-flex items-center justify-center h-10 px-4 rounded-xl gap-2 text-sm font-bold bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-60"
                      onClick={() => activeInventaire && generateEtatPDF(activeInventaire, printGroupBy)}
                      disabled={!activeInventaire?.id}
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">{t('inventaire.detail.print')}</span>
                    </button>
                    <button
                      className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-[#229ED9]/30 text-[#229ED9] hover:bg-[#229ED9]/10 hover:border-[#229ED9] transition-all disabled:opacity-60"
                      onClick={handleSendTelegram}
                      disabled={sendingTelegram || !activeInventaire?.id}
                      title="Envoyer le rapport d'inventaire sur Telegram"
                    >
                      {sendingTelegram
                        ? <div className="animate-spin rounded-full size-4 border-b-2 border-[#229ED9]"></div>
                        : (
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
                                    e.target.value = '';
                                }
                            }}
                        />
                        <button
                            className="inline-flex items-center justify-center h-9 px-4 rounded-xl gap-2 text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-60"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={importing || saving}
                            title={t('inventaire.detail.import_csv_title', 'Importer un fichier CSV (Cip, Quantite)')}
                        >
                            {importing ? <div className="animate-spin rounded-full size-4 border-b-2 border-slate-500"></div> : <Upload className="h-4 w-4" />}
                            <span className="hidden sm:inline">{t('common:import', 'Importer')}</span>
                        </button>

                        <button
                            className="inline-flex items-center justify-center h-9 px-4 rounded-xl gap-2 text-sm font-bold bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors disabled:opacity-60"
                            onClick={handleManualSave}
                            disabled={saving || importing}
                        >
                            {saving ? <div className="animate-spin rounded-full size-4 border-b-2 border-white"></div> : <Save className="h-4 w-4" />}
                            {t('common:save')}
                        </button>

                        <button
                            className="inline-flex items-center justify-center h-9 px-4 rounded-xl gap-2 text-sm font-black bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-60"
                            onClick={handleOpenValidateModal}
                            disabled={saving}
                        >
                            {saving
                                ? <div className="animate-spin rounded-full size-4 border-b-2 border-white"></div>
                                : <CheckCircle2 className="h-4 w-4" />}
                            {t('inventaire.detail.validate')}
                        </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Header Form Area */}
            <div className="p-6 bg-slate-50/50 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t('inventaire.detail.date')}</label>
                    <input
                        type="date"
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400 text-slate-700"
                        value={dateInventaire}
                        onChange={e => setDateInventaire(e.target.value)}
                        disabled={isReadOnly}
                        onBlur={handleSaveHeader}
                    />
                </div>
                <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t('inventaire.detail.description')}</label>
                    <input
                        type="text"
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400 text-slate-700"
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
                        dirtyLineIds={dirtyLineIds}
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

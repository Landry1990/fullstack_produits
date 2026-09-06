import React, { useState } from 'react';
import { useDocumentLock } from '../../../hooks/useDocumentLock';
import { LockBanner } from '../../common/LockBanner';
import { useTranslation } from 'react-i18next';
import { 
    ChevronLeft, Plus, FileText, CheckCircle2, History, 
    Download, Save, Upload, Send, MoreHorizontal
} from 'lucide-react';
import api from '../../../services/api';
import { gooeyToast } from 'goey-toast';

import type { Inventaire } from '../../../types';
import { useInventaireEditor } from '../../../hooks/inventaire/useInventaireEditor';
import { useProductSearch } from '../../../hooks/inventaire/useProductSearch';
import { useInventairePDF } from '../../../hooks/inventaire/useInventairePDF';
import { LocalizedDateInput } from '../../LocalizedDateInput';

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
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);

    const handleSendTelegram = async () => {
        setSendingTelegram(true);
        try {
            await api.post('telegram/rapport-inventaire/', activeInventaire?.id ? { inventaire_id: activeInventaire.id } : {});
            gooeyToast.success(t('inventaire.telegram_report_sent'), { icon: <Send className="h-4 w-4 text-[#229ED9]" /> });
        } catch (err: unknown) {
            const apiError = err as { response?: { data?: { message?: string } } } | undefined;
            gooeyToast.error(apiError?.response?.data?.message || t('common:telegram.send_error'));
        } finally {
            setSendingTelegram(false);
        }
    };

    React.useEffect(() => {
        if (!menuOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen]);

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
        inventoryStats,
        flushPendingChanges, syncLocalOnlyLines, cancelPendingSyncs
    } = editorLogic;

    const { generateEtatPDF, generateEcartsPDF } = useInventairePDF();
    const lock = useDocumentLock('inventaire', activeInventaire?.id);
    const [printing, setPrinting] = useState(false);

    const handlePrintEtat = async () => {
        if (!activeInventaire) return;
        setPrinting(true);
        // Ouvrir la fenêtre AVANT les appels async pour éviter le blocage popup
        const printWindow = window.open('about:blank', '_blank');
        try {
            // Ensure any pending quantity edits and newly-added (local-only) lines
            // are persisted before generating the PDF, otherwise they would be
            // missing from the printed sheet.
            cancelPendingSyncs();
            await flushPendingChanges();
            const ok = await syncLocalOnlyLines();
            if (!ok) {
                gooeyToast.error(t('inventaire.detail.save_error'));
                if (printWindow) printWindow.close();
                return;
            }
            if (printWindow) {
                printWindow.location.href = `/app/printing/${activeInventaire.id}?type=INVENTAIRE_TAKE&group_by=${printGroupBy}`;
            } else {
                generateEtatPDF(activeInventaire, printGroupBy);
            }
        } finally {
            setPrinting(false);
        }
    };
    
    const searchLogic = useProductSearch(
        'lignes-inventaire/',
        activeInventaire?.id,
        setLignes,
        lignes,
        activeInventaire?.inventory_type
    );

    return (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500 flex-1 overflow-hidden">
          
          {/* Verrou pessimiste */}
          {activeInventaire && activeInventaire.status !== 'VALIDEE' && (
            <LockBanner lock={lock} documentLabel={t('inventaire.detail.lock_document_label', { id: activeInventaire?.id })} />
          )}

          {/* Header Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center size-9 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                    onClick={() => setViewMode('LIST')}
                    aria-label={t('inventaire.detail.back')}
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
                                {t('common:status.draft')}
                            </span>
                        )}
                        {autoSaving && (
                            <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 animate-pulse">
                                <div className="animate-spin rounded-full size-3 border-b-2 border-slate-400"></div>
                                {t('common:auto_saving')}
                            </span>
                        )}
                        {activeInventaire?.inventory_type && (
                            <span className="inline-flex items-center px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600">
                                {activeInventaire.inventory_type === 'RESERVE' ? t('inventaire.types.reserve') :
                                 activeInventaire.inventory_type === 'RAYON' ? t('inventaire.types.rayon') : t('inventaire.types.global')}
                            </span>
                        )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex">
                      <button
                        type="button"
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'ENTRY' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                        onClick={() => setActiveTab('ENTRY')}
                      >
                        {t('inventaire.detail.tab_entry')}
                      </button>
                      <button
                        type="button"
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'ANALYSIS' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                        onClick={() => setActiveTab('ANALYSIS')}
                        title={t('inventaire.detail.tab_analysis_tooltip')}
                      >
                        {t('inventaire.detail.tab_analysis')}
                      </button>
                  </div>

                  <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex" role="group" aria-label={t('inventaire.detail.print_group_by')}>
                      {(['rayon', 'forme', 'groupe'] as const).map((g) => (
                          <button
                              key={g}
                              type="button"
                              onClick={() => setPrintGroupBy(g)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${printGroupBy === g ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                              {t(`inventaire.detail.group_${g}`)}
                          </button>
                      ))}
                  </div>

                  <div className="relative" ref={menuRef}>
                      <button
                          type="button"
                          className="inline-flex items-center justify-center h-10 px-4 rounded-xl gap-2 text-sm font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors"
                          onClick={() => setMenuOpen(o => !o)}
                          aria-expanded={menuOpen}
                          aria-haspopup="menu"
                      >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="hidden sm:inline">{t('inventaire.detail.export_share')}</span>
                      </button>
                      {menuOpen && (
                          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 p-1 z-50" role="menu">
                              <button
                                  type="button"
                                  role="menuitem"
                                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                  onClick={() => { handlePrintEtat(); setMenuOpen(false); }}
                                  disabled={!activeInventaire?.id || printing}
                              >
                                  {printing ? <div className="animate-spin rounded-full size-4 border-b-2 border-emerald-600" /> : <Download className="h-4 w-4" />}
                                  {t('inventaire.detail.print')}
                              </button>
                              <button
                                  type="button"
                                  role="menuitem"
                                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                  onClick={() => { handleSendTelegram(); setMenuOpen(false); }}
                                  disabled={sendingTelegram || !activeInventaire?.id}
                              >
                                  {sendingTelegram ? <div className="animate-spin rounded-full size-4 border-b-2 border-[#229ED9]" /> : <Send className="h-4 w-4 text-[#229ED9]" />}
                                  {t('common:telegram.inventory_report')}
                              </button>
                          </div>
                      )}
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
                            type="button"
                            className="inline-flex items-center justify-center h-9 px-4 rounded-xl gap-2 text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-60"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={importing || saving}
                            title={t('inventaire.detail.import_csv_title')}
                        >
                            {importing ? <div className="animate-spin rounded-full size-4 border-b-2 border-slate-500"></div> : <Upload className="h-4 w-4" />}
                            <span className="hidden sm:inline">{t('common:import')}</span>
                        </button>

                        <button
                            type="button"
                            className="inline-flex items-center justify-center h-9 px-4 rounded-xl gap-2 text-sm font-bold bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors disabled:opacity-60"
                            onClick={handleManualSave}
                            disabled={saving || importing}
                        >
                            {saving ? <div className="animate-spin rounded-full size-4 border-b-2 border-white"></div> : <Save className="h-4 w-4" />}
                            {t('common:save')}
                        </button>

                        <button
                            type="button"
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
                    <LocalizedDateInput
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
          <div className="flex flex-col gap-6 flex-1 overflow-hidden min-h-0">
            {activeTab === 'ENTRY' ? (
                <div className="flex flex-col gap-6 flex-1 overflow-hidden min-h-0">
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
                </div>
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

          {/* Bottom action bar */}
          {!isReadOnly && activeInventaire && (
              <div className="shrink-0 p-4 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-end gap-3">
                  <button
                      type="button"
                      className="inline-flex items-center justify-center h-10 px-6 rounded-xl gap-2 text-sm font-black bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-60"
                      onClick={handleOpenValidateModal}
                      disabled={saving}
                  >
                      {saving
                          ? <div className="animate-spin rounded-full size-4 border-b-2 border-white"></div>
                          : <CheckCircle2 className="h-5 w-5" />}
                      {t('inventaire.detail.validate')}
                  </button>
              </div>
          )}
        </div>
    );
};

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, FileSpreadsheet, Loader2, Search, Users } from 'lucide-react';
import PremiumModal from '../../common/PremiumModal';
import { LocalizedDateInput } from '../../LocalizedDateInput';
import { Checkbox } from '../../shadcn/checkbox';
import creanceService from '../../../services/creanceService';
import { formatCurrency } from '../../../utils/formatters';
import { gooeyToast } from 'goey-toast';
import { logger } from '../../../utils/logger';

type Preset = 'month_current' | 'month_previous' | 'tranche_1' | 'tranche_2' | 'tranche_3' | 'all' | 'custom';

interface RelevesExcelModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface SyntheseClient {
    id: number;
    client: string;
    nb_factures: number;
    solde_du: string | number;
}

const fmt = (d: Date) => d.toISOString().slice(0, 10);

const presetRange = (preset: Preset): { debut: string; fin: string } => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    switch (preset) {
        case 'month_current':
            return { debut: fmt(new Date(y, m, 1)), fin: fmt(new Date(y, m + 1, 0)) };
        case 'month_previous':
            return { debut: fmt(new Date(y, m - 1, 1)), fin: fmt(new Date(y, m, 0)) };
        case 'tranche_1':
            return { debut: fmt(new Date(y, m, 1)), fin: fmt(new Date(y, m, 10)) };
        case 'tranche_2':
            return { debut: fmt(new Date(y, m, 11)), fin: fmt(new Date(y, m, 20)) };
        case 'tranche_3':
            return { debut: fmt(new Date(y, m, 21)), fin: fmt(new Date(y, m + 1, 0)) };
        default:
            return { debut: '', fin: '' };
    }
};

export const RelevesExcelModal: React.FC<RelevesExcelModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation(['creances', 'common']);
    const [preset, setPreset] = useState<Preset>('month_current');
    const [dateDebut, setDateDebut] = useState('');
    const [dateFin, setDateFin] = useState('');
    const [clients, setClients] = useState<SyntheseClient[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setPreset('month_current');
            const r = presetRange('month_current');
            setDateDebut(r.debut);
            setDateFin(r.fin);
            setClients([]);
            setSelectedIds(new Set());
            setLoaded(false);
        }
    }, [isOpen]);

    const applyPreset = (p: Preset) => {
        setPreset(p);
        if (p !== 'custom') {
            const r = presetRange(p);
            setDateDebut(r.debut);
            setDateFin(r.fin);
        }
    };

    const loadClients = async () => {
        setLoading(true);
        try {
            const data = await creanceService.getSynthese({
                date_debut: dateDebut || undefined,
                date_fin: dateFin || undefined,
            }) as SyntheseClient[];
            setClients(data);
            setSelectedIds(new Set(data.map(c => c.id)));
            setLoaded(true);
        } catch (err) {
            logger.error('Erreur chargement créanciers:', err);
            gooeyToast.error(t('creances:toasts.error_print_statement'));
        } finally {
            setLoading(false);
        }
    };

    const toggleClient = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const generate = async () => {
        if (selectedIds.size === 0) return;
        setGenerating(true);
        const loadingToast = gooeyToast.info(t('creances:releves_excel.generating'), { duration: Infinity });
        try {
            const blob = await creanceService.exportRelevesExcel({
                client_ids: [...selectedIds],
                date_debut: dateDebut || undefined,
                date_fin: dateFin || undefined,
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `releves_creanciers_${new Date().toISOString().slice(0, 10)}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            setTimeout(() => window.URL.revokeObjectURL(url), 100);
            gooeyToast.success(t('creances:releves_excel.success', { count: selectedIds.size }), { id: loadingToast });
            onClose();
        } catch (err) {
            logger.error('Erreur export relevés:', err);
            gooeyToast.error(t('creances:toasts.excel_export_error'), { id: loadingToast });
        } finally {
            setGenerating(false);
        }
    };

    const presets: { key: Preset; label: string }[] = [
        { key: 'month_current', label: t('creances:releve_modal.preset_month_current') },
        { key: 'month_previous', label: t('creances:releve_modal.preset_month_previous') },
        { key: 'tranche_1', label: t('creances:releve_modal.preset_tranche_1') },
        { key: 'tranche_2', label: t('creances:releve_modal.preset_tranche_2') },
        { key: 'tranche_3', label: t('creances:releve_modal.preset_tranche_3') },
        { key: 'all', label: t('creances:releve_modal.preset_all') },
    ];

    const allSelected = clients.length > 0 && selectedIds.size === clients.length;

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title={t('creances:releves_excel.title')}
            maxWidth="max-w-2xl"
        >
            <div className="space-y-5 p-6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {t('creances:releves_excel.subtitle')}
                </p>

                {/* Presets */}
                <div className="grid grid-cols-3 gap-2">
                    {presets.map(p => (
                        <button
                            key={p.key}
                            onClick={() => applyPreset(p.key)}
                            className={`h-9 rounded-xl border text-caption font-bold uppercase tracking-widest transition-all ${
                                preset === p.key
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm'
                                    : 'bg-white border-slate-200 text-slate-400 hover:text-slate-500'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* Dates + bouton charger */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label htmlFor="releves-excel-debut" className="text-caption font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
                            <Calendar className="size-3" /> {t('creances:filters.start_date')}
                        </label>
                        <LocalizedDateInput
                            id="releves-excel-debut"
                            value={dateDebut}
                            onChange={(e) => { setPreset('custom'); setDateDebut(e.target.value); }}
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all font-mono text-xs font-bold text-slate-700"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="releves-excel-fin" className="text-caption font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
                            <Calendar className="size-3" /> {t('creances:filters.end_date')}
                        </label>
                        <LocalizedDateInput
                            id="releves-excel-fin"
                            value={dateFin}
                            onChange={(e) => { setPreset('custom'); setDateFin(e.target.value); }}
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all font-mono text-xs font-bold text-slate-700"
                        />
                    </div>
                </div>

                <button
                    onClick={loadClients}
                    disabled={loading}
                    className="inline-flex items-center justify-center h-10 w-full rounded-xl bg-slate-700 text-white gap-2 shadow-md transition-all hover:bg-slate-800 font-bold uppercase tracking-widest text-caption disabled:opacity-50"
                >
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                    {t('creances:releves_excel.load')}
                </button>

                {/* Liste des créanciers à cocher */}
                {loaded && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                            <span className="text-caption font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                <Users className="size-3.5" />
                                {t('creances:releves_excel.clients_found', { count: clients.length })}
                            </span>
                            {clients.length > 0 && (
                                <button
                                    onClick={() => setSelectedIds(allSelected ? new Set() : new Set(clients.map(c => c.id)))}
                                    className="text-caption font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700"
                                >
                                    {allSelected ? t('creances:releves_excel.deselect_all') : t('creances:releves_excel.select_all')}
                                </button>
                            )}
                        </div>
                        {clients.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-8">
                                {t('creances:releves_excel.no_clients')}
                            </p>
                        ) : (
                            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                                {clients.map(c => (
                                    <label
                                        key={c.id}
                                        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
                                    >
                                        <Checkbox
                                            checked={selectedIds.has(c.id)}
                                            onCheckedChange={() => toggleClient(c.id)}
                                        />
                                        <span className="flex-1 text-xs font-bold text-slate-700 truncate">{c.client}</span>
                                        <span className="text-caption font-bold text-slate-400">
                                            {t('creances:invoices_count', { count: c.nb_factures })}
                                        </span>
                                        <span className="text-xs font-black text-emerald-600 w-28 text-right">
                                            {formatCurrency(Math.round(Number(c.solde_du)))}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="pt-2 flex gap-3">
                    <button onClick={onClose} className="inline-flex items-center justify-center h-9 flex-1 rounded-lg text-xs font-bold uppercase tracking-widest text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                        {t('creances:payment_modal.cancel')}
                    </button>
                    <button
                        onClick={generate}
                        disabled={generating || selectedIds.size === 0}
                        className="inline-flex items-center justify-center h-9 flex-1 rounded-lg text-xs font-bold uppercase tracking-widest bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors gap-2 disabled:opacity-50"
                    >
                        {generating ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
                        {t('creances:releves_excel.generate', { count: selectedIds.size })}
                    </button>
                </div>
            </div>
        </PremiumModal>
    );
};

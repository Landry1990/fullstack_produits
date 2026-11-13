import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Printer, FileText, List } from 'lucide-react';
import PremiumModal from '../../common/PremiumModal';
import { LocalizedDateInput } from '../../LocalizedDateInput';

type Preset = 'month_current' | 'month_previous' | 'tranche_1' | 'tranche_2' | 'tranche_3' | 'all' | 'custom';

interface RelevePeriodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (dateDebut: string, dateFin: string, includeProducts: boolean) => void;
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

export const RelevePeriodeModal: React.FC<RelevePeriodeModalProps> = ({ isOpen, onClose, onGenerate }) => {
    const { t } = useTranslation(['creances', 'common']);
    const [preset, setPreset] = useState<Preset>('month_current');
    const [dateDebut, setDateDebut] = useState('');
    const [dateFin, setDateFin] = useState('');
    const [includeProducts, setIncludeProducts] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setPreset('month_current');
            const r = presetRange('month_current');
            setDateDebut(r.debut);
            setDateFin(r.fin);
            setIncludeProducts(false);
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

    const presets: { key: Preset; label: string }[] = [
        { key: 'month_current', label: t('creances:releve_modal.preset_month_current') },
        { key: 'month_previous', label: t('creances:releve_modal.preset_month_previous') },
        { key: 'tranche_1', label: t('creances:releve_modal.preset_tranche_1') },
        { key: 'tranche_2', label: t('creances:releve_modal.preset_tranche_2') },
        { key: 'tranche_3', label: t('creances:releve_modal.preset_tranche_3') },
        { key: 'all', label: t('creances:releve_modal.preset_all') },
    ];

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title={t('creances:releve_modal.title')}
            maxWidth="max-w-md"
        >
            <div className="space-y-5 p-6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {t('creances:releve_modal.subtitle')}
                </p>

                {/* Presets */}
                <div className="grid grid-cols-2 gap-2">
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

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label htmlFor="releve-date-debut" className="text-caption font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
                            <Calendar className="size-3" /> {t('creances:filters.start_date')}
                        </label>
                        <LocalizedDateInput
                            id="releve-date-debut"
                            value={dateDebut}
                            onChange={(e) => { setPreset('custom'); setDateDebut(e.target.value); }}
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all font-mono text-xs font-bold text-slate-700"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="releve-date-fin" className="text-caption font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
                            <Calendar className="size-3" /> {t('creances:filters.end_date')}
                        </label>
                        <LocalizedDateInput
                            id="releve-date-fin"
                            value={dateFin}
                            onChange={(e) => { setPreset('custom'); setDateFin(e.target.value); }}
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all font-mono text-xs font-bold text-slate-700"
                        />
                    </div>
                </div>

                {/* Format */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => setIncludeProducts(false)}
                        className={`flex items-center justify-center gap-2 h-10 rounded-xl border text-caption font-bold uppercase tracking-widest transition-all ${
                            !includeProducts
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm'
                                : 'bg-white border-slate-200 text-slate-400 hover:text-slate-500'
                        }`}
                    >
                        <FileText className="size-4" />
                        {t('creances:releve_modal.format_simple')}
                    </button>
                    <button
                        onClick={() => setIncludeProducts(true)}
                        className={`flex items-center justify-center gap-2 h-10 rounded-xl border text-caption font-bold uppercase tracking-widest transition-all ${
                            includeProducts
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm'
                                : 'bg-white border-slate-200 text-slate-400 hover:text-slate-500'
                        }`}
                    >
                        <List className="size-4" />
                        {t('creances:releve_modal.format_detailed')}
                    </button>
                </div>

                <div className="pt-2 flex gap-3">
                    <button onClick={onClose} className="inline-flex items-center justify-center h-9 flex-1 rounded-lg text-xs font-bold uppercase tracking-widest text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                        {t('creances:payment_modal.cancel')}
                    </button>
                    <button
                        onClick={() => { onGenerate(dateDebut, dateFin, includeProducts); onClose(); }}
                        className="inline-flex items-center justify-center h-9 flex-1 rounded-lg text-xs font-bold uppercase tracking-widest bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors gap-2"
                    >
                        <Printer className="size-4" />
                        {t('creances:releve_modal.generate')}
                    </button>
                </div>
            </div>
        </PremiumModal>
    );
};

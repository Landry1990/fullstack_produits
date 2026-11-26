import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, List, Loader2, Wallet } from 'lucide-react';
import api from '../../../services/api';
import PremiumModal from '../../common/PremiumModal';
import { formatCurrency } from '../../../utils/formatters';
import { formatDate } from '../../../utils/dateUtils';

interface FactureRow {
    id: number;
    numero_facture: string;
    date: string;
    ayant_droit?: string | null;
    montant_total: string | number;
    montant_paye: string | number;
    reste_a_payer: string | number;
}

interface ControleFacturesModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientId: string;
    dateDebut: string;
    dateFin: string;
    onGenerate: (factureIds: number[], includeProducts: boolean) => void;
    onTransfer?: (factureIds: number[]) => void;
}

export const ControleFacturesModal: React.FC<ControleFacturesModalProps> = ({
    isOpen,
    onClose,
    clientId,
    dateDebut,
    dateFin,
    onGenerate,
    onTransfer,
}) => {
    const { t } = useTranslation(['creances', 'common']);
    const [rows, setRows] = useState<FactureRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (!isOpen || !clientId) return;
        let cancelled = false;
        setLoading(true);
        setError('');
        setCheckedIds(new Set());
        api.get('creances/releve/', {
            params: {
                client_id: clientId,
                ...(dateDebut ? { date_debut: dateDebut } : {}),
                ...(dateFin ? { date_fin: dateFin } : {}),
            },
        }).then(res => {
            if (!cancelled) setRows(res.data.creances || []);
        }).catch(() => {
            if (!cancelled) setError(t('creances:controle.load_error'));
        }).finally(() => {
            if (!cancelled) setLoading(false);
        });
        return () => { cancelled = true; };
    }, [isOpen, clientId, dateDebut, dateFin, t]);

    const toggle = (id: number) => {
        setCheckedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const allChecked = rows.length > 0 && checkedIds.size === rows.length;
    const toggleAll = () => {
        setCheckedIds(allChecked ? new Set() : new Set(rows.map(r => r.id)));
    };

    const checkedRows = rows.filter(r => checkedIds.has(r.id));
    const totalTtc = checkedRows.reduce((s, r) => s + Number(r.montant_total), 0);
    const totalPaye = checkedRows.reduce((s, r) => s + Number(r.montant_paye), 0);
    const totalReste = checkedRows.reduce((s, r) => s + Number(r.reste_a_payer), 0);
    // Seules les factures encore dues peuvent partir en règlement.
    const payableIds = checkedRows.filter(r => Number(r.reste_a_payer) > 0).map(r => r.id);

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title={t('creances:controle.title')}
            maxWidth="max-w-3xl"
        >
            <div className="space-y-4 p-6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {t('creances:controle.subtitle')}
                </p>

                {loading ? (
                    <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
                        <Loader2 className="size-5 animate-spin" />
                        {t('creances:loading')}
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm font-semibold text-red-700">{error}</div>
                ) : rows.length === 0 ? (
                    <div className="bg-white border border-dashed border-slate-200 rounded-xl p-10 text-center">
                        <p className="text-slate-400 italic text-sm">{t('creances:controle.empty')}</p>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between px-1">
                            <button
                                onClick={toggleAll}
                                className="text-xs font-bold uppercase tracking-widest text-emerald-700 hover:text-emerald-800"
                            >
                                {allChecked ? t('creances:controle.uncheck_all') : t('creances:controle.check_all')}
                            </button>
                            <span className="text-xs font-bold text-slate-500">
                                {t('creances:controle.checked_count', { count: checkedIds.size, total: rows.length })}
                            </span>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto shadow-sm max-h-[50vh] overflow-y-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-slate-50">
                                    <tr className="border-b border-slate-200">
                                        <th className="w-10 px-3 py-3"></th>
                                        <th className="text-micro font-bold uppercase text-slate-400 tracking-widest px-3 py-3">{t('creances:controle.headers.invoice')}</th>
                                        <th className="text-micro font-bold uppercase text-slate-400 tracking-widest px-3 py-3">{t('creances:controle.headers.date')}</th>
                                        <th className="text-micro font-bold uppercase text-slate-400 tracking-widest px-3 py-3">{t('creances:controle.headers.beneficiary')}</th>
                                        <th className="text-micro font-bold uppercase text-slate-400 tracking-widest px-3 py-3 text-right">{t('creances:controle.headers.total')}</th>
                                        <th className="text-micro font-bold uppercase text-slate-400 tracking-widest px-3 py-3 text-right">{t('creances:controle.headers.paid')}</th>
                                        <th className="text-micro font-bold uppercase text-slate-400 tracking-widest px-3 py-3 text-right">{t('creances:controle.headers.remaining')}</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {rows.map(f => (
                                        <tr
                                            key={f.id}
                                            onClick={() => toggle(f.id)}
                                            className={`cursor-pointer border-b border-slate-100 last:border-none transition-colors ${checkedIds.has(f.id) ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}`}
                                        >
                                            <td className="px-3 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={checkedIds.has(f.id)}
                                                    onChange={() => toggle(f.id)}
                                                    onClick={e => e.stopPropagation()}
                                                    className="size-4 rounded accent-emerald-600 cursor-pointer"
                                                    aria-label={f.numero_facture}
                                                />
                                            </td>
                                            <td className="px-3 py-3 font-mono font-bold text-slate-700">{f.numero_facture}</td>
                                            <td className="px-3 py-3 text-slate-500">{formatDate(f.date)}</td>
                                            <td className="px-3 py-3 text-slate-600">{f.ayant_droit || '—'}</td>
                                            <td className="px-3 py-3 text-right font-semibold text-slate-700 tabular-nums">{formatCurrency(Number(f.montant_total))}</td>
                                            <td className="px-3 py-3 text-right text-emerald-600 tabular-nums">{formatCurrency(Number(f.montant_paye))}</td>
                                            <td className="px-3 py-3 text-right font-bold text-amber-600 tabular-nums">{formatCurrency(Number(f.reste_a_payer))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
                            <span className="font-bold text-slate-500 uppercase tracking-widest text-caption">{t('creances:controle.selection_totals')}</span>
                            <div className="flex gap-5 font-bold tabular-nums">
                                <span className="text-slate-700">{formatCurrency(totalTtc)}</span>
                                <span className="text-emerald-600">{formatCurrency(totalPaye)}</span>
                                <span className="text-amber-600">{formatCurrency(totalReste)}</span>
                            </div>
                        </div>

                        <div className="pt-1 flex gap-3">
                            <button
                                onClick={onClose}
                                className="inline-flex items-center justify-center h-9 px-5 rounded-lg text-xs font-bold uppercase tracking-widest text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                            >
                                {t('creances:details_modal.close')}
                            </button>
                            <div className="flex-1" />
                            {onTransfer && (
                                <button
                                    disabled={payableIds.length === 0}
                                    onClick={() => onTransfer(payableIds)}
                                    className="inline-flex items-center justify-center h-9 px-5 rounded-lg text-xs font-bold uppercase tracking-widest bg-blue-600 text-white gap-2 shadow-md shadow-blue-200 hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Wallet className="size-4" />
                                    {t('creances:controle.transfer')}
                                </button>
                            )}
                            <button
                                disabled={checkedIds.size === 0}
                                onClick={() => onGenerate([...checkedIds], false)}
                                className="inline-flex items-center justify-center h-9 px-5 rounded-lg text-xs font-bold uppercase tracking-widest bg-slate-700 text-white gap-2 shadow-md hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <FileText className="size-4" />
                                {t('creances:controle.generate_simple')}
                            </button>
                            <button
                                disabled={checkedIds.size === 0}
                                onClick={() => onGenerate([...checkedIds], true)}
                                className="inline-flex items-center justify-center h-9 px-5 rounded-lg text-xs font-bold uppercase tracking-widest bg-emerald-600 text-white gap-2 shadow-md shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <List className="size-4" />
                                {t('creances:controle.generate_detailed')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </PremiumModal>
    );
};

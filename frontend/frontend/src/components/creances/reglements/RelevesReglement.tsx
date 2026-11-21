import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gooeyToast } from 'goey-toast';
import { AlarmClock, CheckCircle, Clock, FileSpreadsheet, Loader2, MessageCircle, RefreshCw, Wallet } from 'lucide-react';
import creanceService, {
    type ReleveEmis,
    type ReleveStatut,
    type BulkPaiementPayload,
} from '../../../services/creanceService';
import { formatCurrency } from '../../../utils/formatters';
import { useSudo } from '../../../hooks/useSudo';
import { usePermissions } from '../../../hooks/usePermissions';
import { useConfirm } from '../../../hooks/useConfirm';
import { usePharmacySettings } from '../../../hooks/usePharmacySettings';
import { buildRelevePaiementPrintHtml } from '../../../utils/print/relevePaiementPrintHtml';
import { printHtmlInIframe } from '../../../utils/print/printHelpers';
import { logger } from '../../../utils/logger';
import SudoValidationModal from '../../common/SudoValidationModal';
import { BulkPaiementModal } from '../modals/BulkPaiementModal';
import { RelanceModal } from '../modals/RelanceModal';
import { Badge } from '../../shadcn/badge';
import { Button } from '../../shadcn/button';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../shadcn/table';

const STATUS_STYLES: Record<ReleveStatut, string> = {
    EMIS: 'bg-amber-100 text-amber-700 border-amber-200',
    PARTIEL: 'bg-blue-100 text-blue-700 border-blue-200',
    SOLDE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export default function RelevesReglement() {
    const { t, i18n } = useTranslation(['creances', 'common']);
    const confirm = useConfirm();
    const { sudoState, requireSudo, closeSudo } = useSudo();
    const { hasPerm } = usePermissions();
    const canSettle = hasPerm('can_cash_out');
    const { settings: pharmacySettings } = usePharmacySettings();

    const [releves, setReleves] = useState<ReleveEmis[]>([]);
    const [loading, setLoading] = useState(true);
    const [statutFilter, setStatutFilter] = useState<'' | ReleveStatut | 'RETARD'>('');

    // Relance client (SMS/WhatsApp/email) directement depuis un relevé.
    const [relanceClientId, setRelanceClientId] = useState<number | null>(null);

    // Règlement d'un relevé : réutilise la modale de règlement groupé.
    const [releveToSettle, setReleveToSettle] = useState<ReleveEmis | null>(null);
    const [modePaiement, setModePaiement] = useState('especes');
    const [referencePaiement, setReferencePaiement] = useState('');
    const [montantTotalBulk, setMontantTotalBulk] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setReleves(await creanceService.getRelevesEmis());
        } catch (err) {
            logger.error('Erreur chargement relevés:', err);
            gooeyToast.error(t('creances:toasts.error_loading'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => { load(); }, [load]);

    const visibleReleves = useMemo(
        () => {
            if (!statutFilter) return releves;
            if (statutFilter === 'RETARD') {
                return releves.filter(r => r.emis && r.statut !== 'SOLDE' && r.jours_retard > 0);
            }
            return releves.filter(r => r.statut === statutFilter);
        },
        [releves, statutFilter]
    );

    const fmtDate = (iso: string | null) => iso
        ? new Date(iso).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'fr-FR')
        : '—';

    const handleReprint = async (r: ReleveEmis) => {
        const loadingToast = gooeyToast.info(t('creances:toasts.excel_loading'), { duration: Infinity });
        try {
            const blob = await creanceService.exportRelevesExcel({
                client_ids: [r.client_id],
                date_debut: r.date_debut || undefined,
                date_fin: r.date_fin || undefined,
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${r.reference}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            setTimeout(() => window.URL.revokeObjectURL(url), 100);
            gooeyToast.success(t('creances:toasts.excel_export_success'), { id: loadingToast });
        } catch (err) {
            logger.error('Erreur réimpression relevé:', err);
            gooeyToast.error(t('creances:toasts.excel_export_error'), { id: loadingToast });
        }
    };

    const openSettle = (r: ReleveEmis) => {
        setReleveToSettle(r);
        // Règlement back-office : virement par défaut (rien ne passe en caisse).
        setModePaiement('virement');
        setReferencePaiement('');
        // Pré-rempli avec le reste à payer : le cas courant est le règlement
        // total — l'opérateur n'a plus qu'à valider (ou effacer pour partiel).
        setMontantTotalBulk(r.reste);
    };

    const performSettle = useCallback(async (validatorId: number, password: string) => {
        if (!releveToSettle) return;
        const payload: BulkPaiementPayload = {
            facture_ids: releveToSettle.factures_impayees.map(f => f.id),
            mode_paiement: modePaiement,
            reference: referencePaiement,
            releve_id: releveToSettle.id,
            validated_by_id: validatorId,
            sudo_password: password,
        };
        if (montantTotalBulk && parseFloat(montantTotalBulk) > 0) {
            payload.montant_total = parseFloat(montantTotalBulk);
        }
        try {
            const data = await creanceService.bulkPaiement(payload);
            setReleveToSettle(null);
            gooeyToast.success(t('creances:reglements.payment_success'));
            load();
            if (await confirm({
                title: t('common:confirmation'),
                message: t('creances:toasts.confirm_print_bulk_receipt'),
                confirmText: t('common:confirm'),
                variant: 'warning',
            })) {
                const html = buildRelevePaiementPrintHtml({
                    reference: data.releve_reference || releveToSettle.reference,
                    date: new Date().toISOString(),
                    client_name: releveToSettle.client,
                    mode_paiement: modePaiement,
                    total_dettes: data.total_dettes || data.total_amount,
                    montant_regle: data.total_amount,
                    reste_a_payer: data.reste_a_payer || '0.00',
                    paiements: data.paiements || [],
                }, pharmacySettings);
                printHtmlInIframe(html, () => {
                    gooeyToast.error(t('creances:toasts.error_print_statement'));
                });
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { detail?: string } } };
            gooeyToast.error(error.response?.data?.detail || t('common:messages.error_saving'));
            logger.error('Erreur règlement relevé:', err);
            throw err;
        }
    }, [releveToSettle, modePaiement, referencePaiement, montantTotalBulk, load, confirm, pharmacySettings, t]);

    const confirmSettle = () => {
        requireSudo(performSettle, { permission: 'can_cash_out' });
    };

    const resteToSettle = releveToSettle ? Number(releveToSettle.reste) : 0;

    // Statistiques rapides — même vocabulaire visuel que CreancesQuickStats
    const stats = useMemo(() => {
        const open = releves.filter(r => r.emis && r.statut !== 'SOLDE');
        return {
            count: releves.filter(r => r.emis).length,
            reste: open.reduce((sum, r) => sum + Number(r.reste || 0), 0),
            paye: releves.reduce((sum, r) => sum + Number(r.montant_paye || 0), 0),
            retard: open.filter(r => r.jours_retard > 0).length,
        };
    }, [releves]);

    const statCards = [
        {
            label: t('creances:reglements.stats.statements'),
            value: stats.count,
            icon: <FileSpreadsheet className="size-5 text-blue-500" />,
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200',
        },
        {
            label: t('creances:reglements.stats.to_collect'),
            value: `${formatCurrency(Math.round(stats.reste))} ${t('common:currency')}`,
            icon: <Clock className="size-5 text-amber-600" />,
            bgColor: 'bg-amber-50',
            borderColor: 'border-amber-200',
        },
        {
            label: t('creances:reglements.stats.collected'),
            value: `${formatCurrency(Math.round(stats.paye))} ${t('common:currency')}`,
            icon: <CheckCircle className="size-5 text-emerald-600" />,
            bgColor: 'bg-emerald-50',
            borderColor: 'border-emerald-200',
        },
        {
            label: t('creances:reglements.stats.late'),
            value: stats.retard,
            icon: <AlarmClock className="size-5 text-red-500" />,
            bgColor: 'bg-red-50',
            borderColor: 'border-red-200',
        },
    ];

    return (
        <div className="h-full min-h-0 flex flex-col gap-3">
            {/* Carte filtres — même habillage que l'onglet Facturation */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col shrink-0">
                <div className="p-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                        {(['', 'EMIS', 'PARTIEL', 'SOLDE', 'RETARD'] as const).map(s => (
                            <button
                                key={s || 'all'}
                                onClick={() => setStatutFilter(s)}
                                className={`h-8 px-4 rounded-xl text-caption font-bold uppercase tracking-widest transition-all ${
                                    statutFilter === s
                                        ? s === 'RETARD'
                                            ? 'bg-red-600 text-white shadow-sm'
                                            : 'bg-emerald-600 text-white shadow-sm'
                                        : 'bg-white border border-slate-200 text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                {s
                                    ? s === 'RETARD'
                                        ? t('creances:reglements.filter_retard')
                                        : t(`creances:reglements.statut_${s.toLowerCase()}`)
                                    : t('creances:reglements.filter_all')}
                            </button>
                        ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
                        <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
                        {t('creances:reglements.refresh')}
                    </Button>
                </div>
                <p className="text-caption text-slate-400 px-3 pb-3 -mt-1">
                    {t('creances:reglements.help')}
                </p>
            </div>

            {/* Statistiques rapides */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                {statCards.map(stat => (
                    <div
                        key={stat.label}
                        className={`${stat.bgColor} ${stat.borderColor} border p-4 rounded-xl shadow-sm transition-all hover:shadow-md flex items-center gap-4`}
                    >
                        <div className="p-3 bg-white rounded-xl shadow-sm">
                            {stat.icon}
                        </div>
                        <div>
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                {stat.label}
                            </div>
                            <div className="text-xl font-bold text-slate-800 mt-0.5">
                                {stat.value}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto flex-1 min-h-0">
                {loading && releves.length === 0 ? (
                    <div className="flex items-center justify-center h-40 text-slate-400 gap-2">
                        <Loader2 className="size-5 animate-spin" /> {t('creances:loading')}
                    </div>
                ) : visibleReleves.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
                        <p className="text-sm font-bold">{t('creances:reglements.empty')}</p>
                        <p className="text-xs">{t('creances:reglements.empty_hint')}</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('creances:reglements.col_reference')}</TableHead>
                                <TableHead>{t('creances:reglements.col_client')}</TableHead>
                                <TableHead>{t('creances:reglements.col_date')}</TableHead>
                                <TableHead className="text-center">{t('creances:reglements.col_factures')}</TableHead>
                                <TableHead className="text-right">{t('creances:reglements.col_montant_du')}</TableHead>
                                <TableHead className="text-right">{t('creances:reglements.col_paye')}</TableHead>
                                <TableHead className="text-right">{t('creances:reglements.col_reste')}</TableHead>
                                <TableHead className="text-center">{t('creances:reglements.col_statut')}</TableHead>
                                <TableHead className="text-center">{t('creances:reglements.col_actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visibleReleves.map(r => (
                                <TableRow key={r.id}>
                                    <TableCell className="font-mono text-sm font-bold text-slate-700">
                                        {r.reference}
                                        {!r.emis && (
                                            <span className="ml-2 text-caption font-bold uppercase text-slate-400">
                                                {t('creances:reglements.legacy_badge')}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm font-bold text-slate-800">{r.client}</TableCell>
                                    <TableCell className="text-sm text-slate-500">{fmtDate(r.created_at)}</TableCell>
                                    <TableCell className="text-center">
                                        {r.emis && r.nb_factures != null ? (
                                            <span className="px-2 py-1 bg-slate-100 rounded-lg font-mono text-xs font-bold text-slate-500">
                                                {r.nb_factures}
                                            </span>
                                        ) : '—'}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-sm text-slate-800">
                                        {formatCurrency(Math.round(Number(r.montant_du)))}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-sm text-emerald-600">
                                        {formatCurrency(Math.round(Number(r.montant_paye)))}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <span className="bg-amber-50 text-amber-600 px-2.5 py-1 rounded-lg font-bold text-sm shadow-sm border border-amber-200">
                                            {formatCurrency(Math.round(Number(r.reste)))}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <Badge variant="outline" className={STATUS_STYLES[r.statut]}>
                                                {t(`creances:reglements.statut_${r.statut.toLowerCase()}`)}
                                            </Badge>
                                            {r.emis && r.statut !== 'SOLDE' && r.jours_retard > 0 && (
                                                <span className="px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded text-[9px] font-bold uppercase tracking-widest">
                                                    {t('creances:reglements.retard_days', { count: r.jours_retard })}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {r.emis && Number(r.reste) > 0 && canSettle && (
                                                <Button
                                                    size="sm"
                                                    className="h-7 px-3 text-caption font-bold uppercase"
                                                    onClick={() => openSettle(r)}
                                                >
                                                    <Wallet className="size-3.5 mr-1" />
                                                    {t('creances:reglements.regler')}
                                                </Button>
                                            )}
                                            {r.emis && r.statut !== 'SOLDE' && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-2 text-slate-400 hover:text-emerald-600"
                                                    title={t('creances:reglements.relance')}
                                                    onClick={() => setRelanceClientId(r.client_id)}
                                                >
                                                    <MessageCircle className="size-4" />
                                                </Button>
                                            )}
                                            {r.emis && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-2 text-slate-400 hover:text-indigo-600"
                                                    title={t('creances:reglements.reprint')}
                                                    onClick={() => handleReprint(r)}
                                                >
                                                    <FileSpreadsheet className="size-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>

            <BulkPaiementModal
                isOpen={!!releveToSettle}
                onClose={() => setReleveToSettle(null)}
                count={releveToSettle?.factures_impayees.length ?? 0}
                totalAmount={resteToSettle}
                form={{ modePaiement, setModePaiement, referencePaiement, setReferencePaiement, montantTotalBulk, setMontantTotalBulk }}
                onConfirm={confirmSettle}
            />

            <RelanceModal
                isOpen={relanceClientId !== null}
                onClose={() => setRelanceClientId(null)}
                clientId={relanceClientId}
                onSent={load}
            />

            <SudoValidationModal
                isOpen={sudoState.isOpen}
                onClose={closeSudo}
                onValidate={sudoState.onValidate}
                title={sudoState.title}
                message={sudoState.message}
                permission={sudoState.permission}
                forceCurrentUser={sudoState.forceCurrentUser}
                saving={sudoState.isValidating}
            />
        </div>
    );
}

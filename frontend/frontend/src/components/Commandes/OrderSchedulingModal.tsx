import { useState, useEffect } from 'react'
import api from '../../services/api'
import { toast } from 'react-hot-toast'
import { formatPrice } from '../../utils/formatters'
import procurementService from '../../services/procurementService'
import fournisseurService from '../../services/fournisseurService'
import PremiumModal from '../common/PremiumModal'
import { useTranslation } from 'react-i18next'
import { 
    Clock, 
    Settings2,
    Check,
    Search,
    ShoppingCart,
    ChevronLeft,
    Calendar,
    Zap,
    ShieldCheck,
    MessageSquare,
    Info,
    Bell,
    Loader2
} from 'lucide-react'
import type { Fournisseur, ProduitModel, CommandeProduit, OrderSchedule } from '../../types'
import { Button } from '../ui/Button'
import { Input } from '../shadcn/input'
import { Checkbox } from '../shadcn/checkbox'
import { Select } from '../ui/Select'

interface OrderSchedulingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (schedule: OrderSchedule) => void;
    onApplySuggestions: (products: CommandeProduit[], fournisseurId: string) => void;
    fournisseurs: Fournisseur[];
    produitsList: ProduitModel[];
    initialSchedule?: Partial<OrderSchedule>;
}

export default function OrderSchedulingModal({ 
    isOpen, 
    onClose, 
    onSave,
    onApplySuggestions,
    fournisseurs,
    produitsList,
    initialSchedule 
}: OrderSchedulingModalProps) {
    const { t } = useTranslation('orders');

    const [activeTab, setActiveTab] = useState<'plan' | 'gen'>('plan');
    // --- Schedule State ---
    const defaultSchedule: OrderSchedule = {
        fournisseur: 0,
        active_days: [1, 2, 3, 4, 5],
        active_month_days: [],
        frequency_weeks: 1,
        start_date: new Date().toISOString().split('T')[0],
        time: '12:10',
        has_alert_sound: true,
        has_teletransmission: false,
        teletransmission_mode: 'IMMEDIATE',
        needs_financial_reception: true,
        print_copies: 1,
        delivery_time: '',
        auto_reception_delay: 0,
        notify_sms: false,
        notify_whatsapp: false,
        special_code: '',
        comment: '',
        is_active: true,
        min_amount: 0,
        min_items: 0,
        condition_logic: 'AND',
        execution_mode: 'OPTIMISE',
        analysis_period_days: 30,
        delai_couverture_jours: 30
    };

    const [schedule, setSchedule] = useState<OrderSchedule>({
        ...defaultSchedule,
        ...initialSchedule
    });

    useEffect(() => {
        if (isOpen) {
            setSchedule({
                ...defaultSchedule,
                ...initialSchedule
            });
        }
    }, [initialSchedule, isOpen]);

    // --- Paramètres logistiques du fournisseur (éditables dans le modal) ---
    const [logistics, setLogistics] = useState({ delai_livraison: 7, marge_retard: 2 });

    useEffect(() => {
        if (schedule.fournisseur > 0) {
            const f = fournisseurs.find(fx => fx.id === schedule.fournisseur);
            if (f) {
                setLogistics({
                    delai_livraison: f.delai_livraison_jours || 7,
                    marge_retard: f.marge_retard_jours || 2,
                });
            }
        }
    }, [schedule.fournisseur, fournisseurs]);

    // --- Generation Logic State (Manual) ---
    const [suggestionParams, setSuggestionParams] = useState({
        periode: 30,
        mode: 'optimise',
        budgetMax: '',
        dateDebut: new Date().toISOString().split('T')[0],
        dateFin: new Date().toISOString().split('T')[0],
    });
    const [suggestions, setSuggestions] = useState<unknown[]>([]);
    const [totalHt, setTotalHt] = useState<number>(0);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [saving, setSaving] = useState(false);
    const [stepGen, setStepGen] = useState<1 | 2>(1);
    const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());

    const handleSave = async () => {
        // Validation fournisseur
        if (!schedule.fournisseur || schedule.fournisseur === 0) {
            toast.error(t('scheduling.err_select_supplier'));
            return;
        }
        
        // Validation fréquence
        if (!schedule.frequency_weeks || schedule.frequency_weeks < 1) {
            toast.error(t('scheduling.err_frequency_min'));
            return;
        }
        
        // Validation jours actifs
        if (!schedule.active_days || schedule.active_days.length === 0) {
            toast.error(t('scheduling.err_select_day'));
            return;
        }
        
        // Validation format heure HH:MM ou HH:MM:SS
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
        if (!schedule.time || !timeRegex.test(schedule.time)) {
            toast.error(t('scheduling.err_time_format'));
            return;
        }
        // Normaliser en HH:MM (supprimer les secondes si présentes)
        const normalizedTime = schedule.time.split(':').slice(0, 2).join(':');
        
        // Validation date de début >= aujourd'hui
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(schedule.start_date);
        if (startDate < today) {
            toast.error(t('scheduling.err_date_past'));
            return;
        }
        
        // Validation logique conditions si les deux sont définis
        if (schedule.min_amount > 0 && schedule.min_items > 0 && !schedule.condition_logic) {
            toast.error(t('scheduling.err_logic_and_or'));
            return;
        }
        
        try {
            setSaving(true);
            // Nettoyer les données pour l'API
            const cleanedSchedule = {
                ...schedule,
                time: normalizedTime, // HH:MM normalisé
                delivery_time: schedule.delivery_time || null,
                special_code: schedule.special_code?.trim() || '',
                comment: schedule.comment?.trim() || '',
                // S'assurer que les valeurs numériques sont valides
                frequency_weeks: Math.max(1, parseInt(String(schedule.frequency_weeks)) || 1),
                analysis_period_days: Math.max(1, parseInt(String(schedule.analysis_period_days)) || 30),
                delai_couverture_jours: Math.max(1, parseInt(String(schedule.delai_couverture_jours)) || 30),
                min_amount: Math.max(0, parseInt(String(schedule.min_amount)) || 0),
                min_items: Math.max(0, parseInt(String(schedule.min_items)) || 0),
            };

            if (schedule.id) {
                await procurementService.updateSchedule(schedule.id, cleanedSchedule);
                toast.success(t('scheduling.success_updated'));
            } else {
                await procurementService.createSchedule(cleanedSchedule);
                toast.success(t('scheduling.success_created'));
            }

            // Mettre à jour les paramètres logistiques du fournisseur
            if (schedule.fournisseur > 0) {
                try {
                    await fournisseurService.update(schedule.fournisseur, {
                        delai_livraison_jours: logistics.delai_livraison,
                        marge_retard_jours: logistics.marge_retard,
                    });
                } catch (err) {
                    // Ne pas bloquer la sauvegarde du schedule si la mise à jour du fournisseur échoue
                    console.warn('Erreur mise à jour paramètres logistiques:', err);
                }
            }

            onSave(cleanedSchedule);
        } catch (err: unknown) {
            // Gestion d'erreur détaillée
            const errorMsg = err.response?.data?.fournisseur?.[0] 
                || err.response?.data?.active_days?.[0]
                || err.response?.data?.time?.[0]
                || err.response?.data?.detail
                || err.response?.data?.error
                || err.response?.data?.message
                || t('scheduling.err_save');
            toast.error(errorMsg);
        } finally {
            setSaving(false);
        }
    };

    const days = [
        { label: 'L', full: t('scheduling.days.monday'), value: 1 },
        { label: 'M', full: t('scheduling.days.tuesday'), value: 2 },
        { label: 'M', full: t('scheduling.days.wednesday'), value: 3 },
        { label: 'J', full: t('scheduling.days.thursday'), value: 4 },
        { label: 'V', full: t('scheduling.days.friday'), value: 5 },
        { label: 'S', full: t('scheduling.days.saturday'), value: 6 },
        { label: 'D', full: t('scheduling.days.sunday'), value: 0 },
    ];

    const toggleDay = (val: number) => {
        setSchedule(prev => ({
            ...prev,
            active_days: prev.active_days.includes(val)
                ? prev.active_days.filter(d => d !== val)
                : [...prev.active_days, val]
        }));
    };

    const toggleMonthDay = (val: number) => {
        setSchedule(prev => ({
            ...prev,
            active_month_days: prev.active_month_days.includes(val)
                ? prev.active_month_days.filter(d => d !== val)
                : [...prev.active_month_days, val]
        }));
    };

    async function fetchSuggestions() {
        // Validation fournisseur
        if (!schedule.fournisseur || schedule.fournisseur === 0) {
            toast.error(t('scheduling.err_select_supplier_first'));
            return;
        }
        
        // Validation budget numérique
        if (suggestionParams.budgetMax && isNaN(Number(suggestionParams.budgetMax))) {
            toast.error(t('scheduling.err_budget_number'));
            return;
        }
        
        // Validation dates pour mode ventes horaire
        if (suggestionParams.mode === 'ventes_horaire') {
            if (!suggestionParams.dateDebut || !suggestionParams.dateFin) {
                toast.error(t('scheduling.err_dates_required'));
                return;
            }
            if (new Date(suggestionParams.dateDebut) > new Date(suggestionParams.dateFin)) {
                toast.error(t('scheduling.err_date_order'));
                return;
            }
        }
        
        setLoadingSuggestions(true);
        try {
            const payload: unknown = {
                mode: suggestionParams.mode,
                fournisseur_id: schedule.fournisseur,
            };

            if (suggestionParams.mode === 'ventes_horaire') {
                payload.date_debut = suggestionParams.dateDebut;
                payload.date_fin = suggestionParams.dateFin;
            } else {
                payload.periode = Math.max(1, Number(suggestionParams.periode) || 30);
                const budgetVal = suggestionParams.budgetMax ? Number(suggestionParams.budgetMax) : null;
                payload.budget_max = budgetVal && !isNaN(budgetVal) && budgetVal > 0 ? budgetVal : null;
            }
            
            const response = await api.post('generer-suggestions/', payload);
            setSuggestions(response.data.suggestions || []);
            setTotalHt(response.data.total_ht || 0);
            
            const allIndices = new Set(response.data.suggestions.map((_: unknown, i: number) => i));
            setSelectedSuggestions(allIndices as Set<number>);
            setStepGen(2);
        } catch (err: unknown) {
            const errorMsg = err.response?.data?.error 
                || err.response?.data?.detail 
                || err.response?.data?.message 
                || t('scheduling.err_suggestions');
            toast.error(errorMsg);
        } finally {
            setLoadingSuggestions(false);
        }
    }

    function handleApply() {
        const selectedItems = suggestions.filter((_, i) => selectedSuggestions.has(i));
        if (selectedItems.length === 0) {
            toast(t('scheduling.no_selection'), { icon: '⚠️' });
            return;
        }

        const newLines: CommandeProduit[] = selectedItems.map((item: unknown, index) => {
             const realProduct = produitsList.find(p => p.id === item.produit_id);
             let productStub: ProduitModel;
             if (realProduct) productStub = realProduct;
             else {
                 productStub = {
                    id: item.produit_id,
                    name: item.produit_nom,
                    cip1: item.produit_ref,
                    stock: item.stock_actuel,
                    cost_price: String(item.prix_achat),
                    selling_price: String(item.prix_vente || item.prix_achat * 1.3),
                    tva: item.tva || '0',
                    taux_marge: item.taux_marge || '1.3'
                } as unknown;
             }

            return {
                id: Date.now() + index,
                produit: productStub,
                quantity: item.quantite_suggeree,
                price: String(item.prix_achat || productStub.cost_price || 0),
                tva: item.tva || productStub.tva || '0',
                marge: item.taux_marge || productStub.taux_marge || '1.3',
                selling_price: String(item.prix_vente || productStub.selling_price || 0),
            } as unknown;
        });

        onApplySuggestions(newLines, String(schedule.fournisseur));
    }

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title={t('scheduling.title')}
            subtitle={activeTab === 'plan' ? t('scheduling.subtitle_plan') : t('scheduling.subtitle_gen')}
            icon={<Zap className="size-6 text-indigo-600 fill-indigo-600/20" />}
            maxWidth="max-w-4xl"
            footer={
                <div className="flex justify-between items-center w-full">
                    <Button variant="ghost" onClick={onClose}>{t('scheduling.cancel')}</Button>
                    <div className="flex gap-2">
                        {activeTab === 'gen' && stepGen === 2 && (
                            <Button variant="ghost" onClick={() => setStepGen(1)}>
                                <ChevronLeft className="size-4 mr-2" />
                                {t('scheduling.back_params')}
                            </Button>
                        )}
                        {activeTab === 'plan' ? (
                            <Button variant="primary" className="px-10 py-2.5 gap-2" onClick={handleSave} disabled={saving}>
                                {saving ? <Loader2 className="size-4 animate-spin" /> : <><Check className="size-4 mr-2" />{t('scheduling.save_service')}</>}
                            </Button>
                        ) : (
                            stepGen === 1 ? (
                                <Button variant="primary" className="px-10 py-2.5 gap-2" onClick={fetchSuggestions} disabled={loadingSuggestions}>
                                    {loadingSuggestions ? <Loader2 className="size-4 animate-spin" /> : <><Search className="size-4 mr-2" />{t('scheduling.analyze')}</>}
                                </Button>
                            ) : (
                                <Button variant="primary" className="px-10 py-2.5 gap-2" onClick={handleApply} disabled={selectedSuggestions.size === 0}>
                                    <ShoppingCart className="size-4 mr-2" />
                                    {t('scheduling.create_order_count', { count: selectedSuggestions.size })}
                                </Button>
                            )
                        )}
                    </div>
                </div>
            }
        >
            <div className="p-0 flex flex-col bg-white min-h-[520px] h-[520px]">
                {/* Header info */}
                <div className="p-4 border-b border-slate-200 bg-slate-100/50">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex-1 min-w-[250px]">
                            <label className="text-[10px] font-black uppercase tracking-widest text-indigo-600/60 mb-1 block">{t('scheduling.supplier_partner')}</label>
                            <Select 
                                size="sm"
                                className="w-full font-bold text-indigo-600 rounded-xl border-indigo-500/20"
                                value={schedule.fournisseur || ''}
                                onChange={(e) => setSchedule({...schedule, fournisseur: parseInt(e.target.value) || 0})}
                            >
                                <option value="">{t('scheduling.select_supplier_placeholder')}</option>
                                {fournisseurs.map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </Select>
                        </div>
                        <div className="flex items-center gap-4 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{t('scheduling.service_mode')}</span>
                                <div className="flex items-center gap-2">
                                    <div className={`size-2 rounded-full ${schedule.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                                    <span className="text-xs font-black text-slate-800">{schedule.is_active ? t('scheduling.active') : t('scheduling.paused')}</span>
                                </div>
                            </div>
                            <Checkbox 
                                checked={schedule.is_active} 
                                onCheckedChange={(checked) => setSchedule({...schedule, is_active: !!checked})}
                            />
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-4 pt-4">
                    <div className="inline-flex bg-slate-100/50 p-1 rounded-2xl w-fit gap-1">
                        <Button variant="ghost" size="sm" className={`rounded-xl px-8 h-9 ${activeTab === 'plan' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`} onClick={() => setActiveTab('plan')}>
                            <Calendar className="size-3.5 mr-2" /> {t('scheduling.tab_plan')}
                        </Button>
                        <Button variant="ghost" size="sm" className={`rounded-xl px-8 h-9 ${activeTab === 'gen' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`} onClick={() => setActiveTab('gen')}>
                            <Search className="size-3.5 mr-2" /> {t('scheduling.tab_gen')}
                        </Button>
                    </div>
                </div>

                <div className="p-4">
                    {activeTab === 'plan' ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Section 1: Timing */}
                                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                                            <Clock className="size-4" />
                                        </div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{t('scheduling.frequency_timing')}</h3>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">{t('scheduling.activation_days')}</label>
                                            <div className="flex justify-between gap-1">
                                                {days.map(d => (
                                                    <button
                                                        key={d.value}
                                                        onClick={() => toggleDay(d.value)}
                                                        className={`size-9 rounded-full text-xs font-black transition-all flex items-center justify-center border-2 
                                                            ${schedule.active_days.includes(d.value) 
                                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20 scale-110' 
                                                                : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-500/30'}`}
                                                        title={d.full}
                                                    >
                                                        {d.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Jours du mois */}
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block">Jours du mois (optionnel)</label>
                                            <div className="grid grid-cols-7 gap-1">
                                                {(() => {
                                                  const monthDaysSet = new Set(schedule.active_month_days);
                                                  return Array.from({length: 31}, (_, i) => i + 1).map(day => (
                                                    <button
                                                        key={day}
                                                        onClick={() => toggleMonthDay(day)}
                                                        className={`size-7 rounded-lg text-[10px] font-black transition-all flex items-center justify-center border-2
                                                            ${monthDaysSet.has(day)
                                                                ? 'bg-rose-500 border-rose-600 text-white shadow-sm'
                                                                : 'bg-white border-slate-200 text-slate-300 hover:border-rose-400/40'}`}
                                                        title={`${day} du mois`}
                                                    >
                                                        {day}
                                                    </button>
                                                  ));
                                                })()}
                                            </div>
                                            <p className="text-[9px] text-slate-300 mt-1">Si sélectionné, le planning s'exécute aussi ces jours du mois indépendamment du jour de la semaine.</p>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase block">{t('scheduling.every')}</label>
                                                <div className="flex w-full">
                                                    <Input type="number" className="w-full font-bold rounded-r-none" value={schedule.frequency_weeks} onChange={(e) => setSchedule({...schedule, frequency_weeks: parseInt(e.target.value) || 1})}/>
                                                    <span className="bg-slate-100 px-3 flex items-center text-[10px] font-black rounded-r-lg border border-l-0 border-slate-200">{t('scheduling.weeks_short')}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase block">{t('scheduling.hour')}</label>
                                                <Input type="time" className="w-full font-bold rounded-lg" value={schedule.time} onChange={(e) => setSchedule({...schedule, time: e.target.value})}/>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase block">{t('scheduling.start_on')}</label>
                                                <Input type="date" className="w-full font-bold rounded-lg" value={schedule.start_date} onChange={(e) => setSchedule({...schedule, start_date: e.target.value})}/>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Logic & Intelligence */}
                                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                                            <Zap className="size-4" />
                                        </div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{t('scheduling.calculation_intelligence')}</h3>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="grid grid-cols-3 gap-2">
                                            <button 
                                                className={`p-3 rounded-2xl border-2 text-left transition-all ${schedule.execution_mode === 'OPTIMISE' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-slate-100'}`}
                                                onClick={() => setSchedule({...schedule, execution_mode: 'OPTIMISE'})}
                                            >
                                                <div className="text-[10px] font-black text-indigo-600 mb-1">{t('scheduling.predictive_analysis')}</div>
                                                <div className="text-[11px] font-bold leading-tight text-slate-500 text-slate-800">{t('scheduling.predictive_desc')}</div>
                                            </button>
                                            <button 
                                                className={`p-3 rounded-2xl border-2 text-left transition-all ${schedule.execution_mode === 'SIMPLE' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-slate-100'}`}
                                                onClick={() => setSchedule({...schedule, execution_mode: 'SIMPLE'})}
                                            >
                                                <div className="text-[10px] font-black text-indigo-600 mb-1">{t('scheduling.simple_replacement')}</div>
                                                <div className="text-[11px] font-bold leading-tight text-slate-500 text-slate-800">{t('scheduling.simple_desc')}</div>
                                            </button>
                                            <button 
                                                className={`p-3 rounded-2xl border-2 text-left transition-all ${schedule.execution_mode === 'CUMULATIF' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-slate-100'}`}
                                                onClick={() => setSchedule({...schedule, execution_mode: 'CUMULATIF'})}
                                            >
                                                <div className="text-[10px] font-black text-indigo-600 mb-1">{t('scheduling.cumulative')}</div>
                                                <div className="text-[11px] font-bold leading-tight text-slate-500 text-slate-800">{t('scheduling.cumulative_desc')}</div>
                                            </button>
                                        </div>

                                        {/* Période d'analyse visible pour tous les modes */}
                                        <div className={`p-3 rounded-2xl border flex items-center justify-between ${schedule.execution_mode === 'OPTIMISE' ? 'bg-blue-50/50 border-blue-100' : schedule.execution_mode === 'CUMULATIF' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-100 border-slate-200'}`}>
                                            <div className="flex items-center gap-2">
                                                <Info className={`size-3.5 ${schedule.execution_mode === 'OPTIMISE' ? 'text-blue-500' : schedule.execution_mode === 'CUMULATIF' ? 'text-emerald-500' : 'text-slate-400'}`} />
                                                <span className={`text-[10px] font-bold ${schedule.execution_mode === 'OPTIMISE' ? 'text-blue-600' : schedule.execution_mode === 'CUMULATIF' ? 'text-emerald-700' : 'text-slate-800'}`}>
                                                    {schedule.execution_mode === 'OPTIMISE' ? t('scheduling.period_analysis') : schedule.execution_mode === 'CUMULATIF' ? t('scheduling.period_initial') : t('scheduling.period_counting')}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Input 
                                                    type="number" 
                                                    className={`w-12 bg-transparent border-b text-center font-black text-xs focus:outline-none rounded-none ${schedule.execution_mode === 'OPTIMISE' ? 'border-blue-300 text-blue-600' : 'border-slate-300 text-slate-500'}`} 
                                                    value={schedule.analysis_period_days} 
                                                    onChange={(e) => setSchedule({...schedule, analysis_period_days: parseInt(e.target.value) || 30})}
                                                    min={1}
                                                    max={365}
                                                />
                                                <span className={`text-[10px] font-bold ${schedule.execution_mode === 'OPTIMISE' ? 'text-blue-600' : 'text-slate-800'}`}>{t('scheduling.days_short')}</span>
                                            </div>
                                        </div>
                                        {/* Délai de couverture — paramètre indépendant de la période d'analyse */}
                                        {schedule.execution_mode === 'OPTIMISE' && (
                                            <div className="space-y-3">
                                                <div className="p-3 rounded-2xl border bg-purple-50/50 border-purple-100 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Info className="size-3.5 text-purple-500" />
                                                        <span className="text-[10px] font-bold text-purple-700">
                                                            Autonomie cible (stock à couvrir)
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            type="number"
                                                            className="w-12 bg-transparent border-b border-purple-300 text-center font-black text-xs focus:outline-none text-purple-700 rounded-none"
                                                            value={schedule.delai_couverture_jours}
                                                            onChange={(e) => setSchedule({...schedule, delai_couverture_jours: parseInt(e.target.value) || 30})}
                                                            min={1}
                                                            max={365}
                                                        />
                                                        <span className="text-[10px] font-bold text-purple-700">j</span>
                                                    </div>
                                                </div>
                                                {/* Paramètres logistiques du fournisseur — éditables */}
                                                {schedule.fournisseur > 0 && (
                                                    <div className="p-3 rounded-2xl border bg-blue-50/30 border-blue-100/50 space-y-2">
                                                        <div className="text-[9px] font-bold text-blue-700/60 uppercase tracking-wider">Paramètres logistiques du fournisseur</div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="space-y-1">
                                                                <label className="text-[9px] font-bold text-blue-700/80">Délai livraison</label>
                                                                <div className="flex w-full">
                                                                    <Input
                                                                        type="number"
                                                                        className="w-full font-bold text-blue-700 rounded-r-none"
                                                                        value={logistics.delai_livraison}
                                                                        onChange={(e) => setLogistics({...logistics, delai_livraison: parseInt(e.target.value) || 7})}
                                                                        min={1}
                                                                        max={90}
                                                                    />
                                                                    <span className="bg-blue-100 px-2 flex items-center text-[10px] font-black text-blue-700 rounded-r-lg border border-l-0 border-blue-100">j</span>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[9px] font-bold text-amber-700/80">Marge retard</label>
                                                                <div className="flex w-full">
                                                                    <Input
                                                                        type="number"
                                                                        className="w-full font-bold text-amber-700 rounded-r-none"
                                                                        value={logistics.marge_retard}
                                                                        onChange={(e) => setLogistics({...logistics, marge_retard: parseInt(e.target.value) || 2})}
                                                                        min={0}
                                                                        max={30}
                                                                    />
                                                                    <span className="bg-amber-100 px-2 flex items-center text-[10px] font-black text-amber-700 rounded-r-lg border border-l-0 border-amber-100">j</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {schedule.execution_mode === 'SIMPLE' && (
                                            <p className="text-[9px] text-slate-400 leading-tight">
                                                {t('scheduling.simple_mode_info', { days: schedule.analysis_period_days })}
                                            </p>
                                        )}
                                        {schedule.execution_mode === 'CUMULATIF' && (
                                            <p className="text-[9px] text-emerald-600 leading-tight">
                                                <strong>{t('scheduling.cumulative')}</strong> {t('scheduling.cumulative_mode_info', { days: schedule.analysis_period_days })}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Section 3: Safety Controls */}
                                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                                                <ShieldCheck className="size-4" />
                                            </div>
                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{t('scheduling.security_filter')}</h3>
                                        </div>
                                        <Checkbox 
                                            checked={schedule.min_amount > 0} 
                                            onCheckedChange={(checked) => setSchedule({...schedule, min_amount: checked ? 100000 : 0})}
                                        />
                                    </div>

                                    {schedule.min_amount > 0 ? (
                                        <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase block">{t('scheduling.min_amount_label')}</label>
                                            <div className="relative">
                                                <Input type="number" className="w-full font-bold pr-8" value={schedule.min_amount} onChange={(e) => setSchedule({...schedule, min_amount: parseInt(e.target.value) || 0})}/>
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">F</span>
                                            </div>
                                            <p className="text-[9px] text-amber-600/60 font-bold leading-tight mt-2">{t('scheduling.min_amount_warning')}</p>
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-slate-100 rounded-2xl border border-dashed border-slate-200 text-center">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">{t('scheduling.filter_disabled')}</p>
                                            <p className="text-[9px] text-slate-300 mt-1">{t('scheduling.filter_disabled_desc')}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Section 4: Notifications */}
                                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                                            <Bell className="size-4" />
                                        </div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{t('scheduling.notification_channels')}</h3>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <button 
                                            className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${schedule.notify_whatsapp ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-100'}`}
                                            onClick={() => setSchedule({...schedule, notify_whatsapp: !schedule.notify_whatsapp})}
                                        >
                                            <div className={`size-3 rounded-full ${schedule.notify_whatsapp ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                            <span className="text-[11px] font-black text-slate-800">{t('scheduling.whatsapp')}</span>
                                        </button>
                                        <button 
                                            className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${schedule.notify_sms ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-slate-100'}`}
                                            onClick={() => setSchedule({...schedule, notify_sms: !schedule.notify_sms})}
                                        >
                                            <div className={`size-3 rounded-full ${schedule.notify_sms ? 'bg-indigo-600' : 'bg-slate-300'}`}></div>
                                            <span className="text-[11px] font-black text-slate-800">{t('scheduling.sms_direct')}</span>
                                        </button>
                                    </div>
                                    <p className="text-[10px] italic text-slate-400 text-center">{t('scheduling.notify_summary')}</p>
                                </div>
                            </div>

                            <div className="mt-2 bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-2 px-1">
                                    <MessageSquare className="size-3.5 text-slate-400" />
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('scheduling.service_notes')}</label>
                                </div>
                                <textarea className="w-full h-16 rounded-2xl resize-none text-sm font-medium border border-slate-200 focus:border-indigo-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder={t('scheduling.service_notes_placeholder')} value={schedule.comment} onChange={(e) => setSchedule({...schedule, comment: e.target.value})}></textarea>
                            </div>
                        </div>
                    ) : (
                        /* TAB GENERATION : Reprise de SuggestionCommandeModal */
                        <div className="space-y-4">
                            {stepGen === 1 ? (
                                <div className="max-w-2xl mx-auto space-y-4 pt-4">
                                    <div className="grid grid-cols-3 gap-3">
                                        <label className={`p-3 cursor-pointer rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-2 ${suggestionParams.mode === 'simple' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-500/20'}`}>
                                            <input type="radio" className="hidden" checked={suggestionParams.mode === 'simple'} onChange={() => setSuggestionParams({...suggestionParams, mode: 'simple'})}/>
                                            <div className={`p-2 rounded-xl ${suggestionParams.mode === 'simple' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}><ShieldCheck className="size-4" /></div>
                                            <div className="space-y-0.5">
                                                <span className="text-xs font-black block">{t('scheduling.mode_replacement')}</span>
                                                <p className="text-[9px] font-bold opacity-60">{t('scheduling.mode_replacement_desc')}</p>
                                            </div>
                                        </label>
                                        <label className={`p-3 cursor-pointer rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-2 ${suggestionParams.mode === 'optimise' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-500/20'}`}>
                                            <input type="radio" className="hidden" checked={suggestionParams.mode === 'optimise'} onChange={() => setSuggestionParams({...suggestionParams, mode: 'optimise'})}/>
                                            <div className={`p-2 rounded-xl ${suggestionParams.mode === 'optimise' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}><Zap className="size-4" /></div>
                                            <div className="space-y-0.5">
                                                <span className="text-xs font-black block">{t('scheduling.mode_predictive')}</span>
                                                <p className="text-[9px] font-bold opacity-60">{t('scheduling.mode_predictive_desc')}</p>
                                            </div>
                                        </label>
                                        <label className={`p-3 cursor-pointer rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-2 ${suggestionParams.mode === 'ventes_horaire' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-500/20'}`}>
                                            <input type="radio" className="hidden" checked={suggestionParams.mode === 'ventes_horaire'} onChange={() => setSuggestionParams({...suggestionParams, mode: 'ventes_horaire'})}/>
                                            <div className={`p-2 rounded-xl ${suggestionParams.mode === 'ventes_horaire' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}><Clock className="size-4" /></div>
                                            <div className="space-y-0.5">
                                                <span className="text-xs font-black block">{t('scheduling.mode_temporal')}</span>
                                                <p className="text-[9px] font-bold opacity-60">{t('scheduling.mode_temporal_desc')}</p>
                                            </div>
                                        </label>
                                    </div>
                                    
                                    <div className="bg-slate-100 border border-slate-200 p-5 rounded-3xl space-y-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Settings2 className="size-4 text-indigo-600" />
                                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('scheduling.analysis_params')}</h4>
                                        </div>
                                        {suggestionParams.mode === 'ventes_horaire' ? (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold uppercase opacity-40">{t('scheduling.date_start')}</label>
                                                    <Input type="date" className="w-full rounded-xl font-bold" value={suggestionParams.dateDebut} onChange={(e) => setSuggestionParams({...suggestionParams, dateDebut: e.target.value})}/>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold uppercase opacity-40">{t('scheduling.date_end')}</label>
                                                    <Input type="date" className="w-full rounded-xl font-bold" value={suggestionParams.dateFin} onChange={(e) => setSuggestionParams({...suggestionParams, dateFin: e.target.value})}/>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold uppercase opacity-40">{t('scheduling.analysis_period_days')}</label>
                                                    <div className="flex w-full">
                                                        <Input type="number" className="w-full font-bold rounded-r-none" value={suggestionParams.periode} onChange={(e) => setSuggestionParams({...suggestionParams, periode: parseInt(e.target.value) || 0})}/>
                                                        <span className="bg-slate-200 px-4 flex items-center text-[10px] font-black rounded-r-lg border border-l-0 border-slate-200">{t('scheduling.days_unit')}</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold uppercase opacity-40">{t('scheduling.budget_max')}</label>
                                                    <div className="relative">
                                                        <Input type="number" className="w-full rounded-xl font-bold" placeholder={t('scheduling.unlimited')} value={suggestionParams.budgetMax} onChange={(e) => setSuggestionParams({...suggestionParams, budgetMax: e.target.value})}/>
                                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-300">F</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <div className="flex justify-between items-center bg-slate-900 text-white p-5 rounded-3xl shadow-xl shadow-slate-900/10">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-white/10 rounded-2xl">
                                                <ShoppingCart className="size-6 text-indigo-400" />
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{t('scheduling.total_estimated_order')}</div>
                                                <div className="text-2xl font-mono font-black text-indigo-400">{formatPrice(totalHt)} F <span className="text-xs text-slate-400 ml-1">{t('scheduling.ht_suffix')}</span></div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{t('scheduling.suggested_items')}</div>
                                            <div className="text-xl font-black">{suggestions.length} {t('scheduling.products_unit')}</div>
                                        </div>
                                    </div>
                                    <div className="overflow-auto flex-1 border border-slate-200 rounded-3xl bg-white shadow-inner">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-slate-100 text-[10px] font-black uppercase text-slate-400">
                                                    <th className="w-10"><Checkbox checked={selectedSuggestions.size === suggestions.length} onCheckedChange={() => setSelectedSuggestions(selectedSuggestions.size === suggestions.length ? new Set() : new Set(suggestions.map((_, i) => i)))}/></th>
                                                    <th>{t('scheduling.table_designation')}</th>
                                                    <th className="text-center">{t('scheduling.table_stock')}</th>
                                                    <th className="text-center">{t('scheduling.table_sales')}</th>
                                                    <th className="text-right">{t('scheduling.table_qty')}</th>
                                                    <th className="text-right">{t('scheduling.table_total_ht')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {suggestions.map((item, idx) => (
                                                    <tr key={item.produit_id} className={`hover:bg-slate-100 cursor-pointer transition-colors ${selectedSuggestions.has(idx) ? 'bg-indigo-50' : ''}`} onClick={() => setSelectedSuggestions(prev => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; })}>
                                                        <td><Checkbox checked={selectedSuggestions.has(idx)} onCheckedChange={() => {}}/></td>
                                                        <td className="font-black text-xs text-slate-800">{item.produit_nom}</td>
                                                        <td className="text-center"><span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 font-mono">{item.stock_actuel}</span></td>
                                                        <td className="text-center font-bold text-xs">{item.ventes_periode}</td>
                                                        <td className="text-right text-indigo-600 font-black text-sm">x{item.quantite_suggeree}</td>
                                                        <td className="text-right font-mono font-bold text-xs">{formatPrice(item.montant_ht || (item.prix_achat * item.quantite_suggeree))} F</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </PremiumModal>
    )
}

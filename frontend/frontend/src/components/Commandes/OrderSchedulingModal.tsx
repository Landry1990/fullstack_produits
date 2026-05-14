import { useState, useEffect } from 'react'
import api from '../../services/api'
import { toast } from 'react-hot-toast'
import { formatPrice } from '../../utils/formatters'
import procurementService from '../../services/procurementService'
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
    Bell
} from 'lucide-react'
import type { Fournisseur, ProduitModel, CommandeProduit, OrderSchedule } from '../../types'

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
        analysis_period_days: 30
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

    // --- Generation Logic State (Manual) ---
    const [suggestionParams, setSuggestionParams] = useState({
        periode: 30,
        mode: 'optimise',
        budgetMax: '',
        dateDebut: new Date().toISOString().split('T')[0],
        dateFin: new Date().toISOString().split('T')[0],
    });
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [totalHt, setTotalHt] = useState<number>(0);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [saving, setSaving] = useState(false);
    const [stepGen, setStepGen] = useState<1 | 2>(1);
    const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());

    const handleSave = async () => {
        // Validation fournisseur
        if (!schedule.fournisseur || schedule.fournisseur === 0) {
            toast.error("Veuillez sélectionner un fournisseur valide");
            return;
        }
        
        // Validation fréquence
        if (!schedule.frequency_weeks || schedule.frequency_weeks < 1) {
            toast.error("La fréquence doit être d'au moins 1 semaine");
            return;
        }
        
        // Validation jours actifs
        if (!schedule.active_days || schedule.active_days.length === 0) {
            toast.error("Sélectionnez au moins un jour d'activation");
            return;
        }
        
        // Validation format heure HH:MM ou HH:MM:SS
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
        if (!schedule.time || !timeRegex.test(schedule.time)) {
            toast.error("Format d'heure invalide (HH:MM attendu, ex: 14:30)");
            return;
        }
        // Normaliser en HH:MM (supprimer les secondes si présentes)
        const normalizedTime = schedule.time.split(':').slice(0, 2).join(':');
        
        // Validation date de début >= aujourd'hui
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(schedule.start_date);
        if (startDate < today) {
            toast.error("La date de début ne peut pas être dans le passé");
            return;
        }
        
        // Validation logique conditions si les deux sont définis
        if (schedule.min_amount > 0 && schedule.min_items > 0 && !schedule.condition_logic) {
            toast.error("Précisez la logique AND/OR pour les conditions min montant et min articles");
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
                min_amount: Math.max(0, parseInt(String(schedule.min_amount)) || 0),
                min_items: Math.max(0, parseInt(String(schedule.min_items)) || 0),
            };

            if (schedule.id) {
                await procurementService.updateSchedule(schedule.id, cleanedSchedule);
                toast.success("Planning mis à jour !");
            } else {
                await procurementService.createSchedule(cleanedSchedule);
                toast.success("Planning créé avec succès !");
            }
            onSave(cleanedSchedule);
        } catch (err: any) {
            // Gestion d'erreur détaillée
            const errorMsg = err.response?.data?.fournisseur?.[0] 
                || err.response?.data?.active_days?.[0]
                || err.response?.data?.time?.[0]
                || err.response?.data?.detail
                || err.response?.data?.error
                || err.response?.data?.message
                || "Erreur lors de l'enregistrement du planning";
            toast.error(errorMsg);
        } finally {
            setSaving(false);
        }
    };

    const days = [
        { label: 'L', full: 'Lundi', value: 1 },
        { label: 'M', full: 'Mardi', value: 2 },
        { label: 'M', full: 'Mercredi', value: 3 },
        { label: 'J', full: 'Jeudi', value: 4 },
        { label: 'V', full: 'Vendredi', value: 5 },
        { label: 'S', full: 'Samedi', value: 6 },
        { label: 'D', full: 'Dimanche', value: 0 },
    ];

    const toggleDay = (val: number) => {
        setSchedule(prev => ({
            ...prev,
            active_days: prev.active_days.includes(val) 
                ? prev.active_days.filter(d => d !== val)
                : [...prev.active_days, val]
        }));
    };

    async function fetchSuggestions() {
        // Validation fournisseur
        if (!schedule.fournisseur || schedule.fournisseur === 0) {
            toast.error("Veuillez d'abord sélectionner un fournisseur");
            return;
        }
        
        // Validation budget numérique
        if (suggestionParams.budgetMax && isNaN(Number(suggestionParams.budgetMax))) {
            toast.error("Le budget maximum doit être un nombre valide");
            return;
        }
        
        // Validation dates pour mode ventes horaire
        if (suggestionParams.mode === 'ventes_horaire') {
            if (!suggestionParams.dateDebut || !suggestionParams.dateFin) {
                toast.error("Les dates de début et fin sont requises pour ce mode");
                return;
            }
            if (new Date(suggestionParams.dateDebut) > new Date(suggestionParams.dateFin)) {
                toast.error("La date de début doit être antérieure à la date de fin");
                return;
            }
        }
        
        setLoadingSuggestions(true);
        try {
            const payload: any = {
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
            
            const allIndices = new Set(response.data.suggestions.map((_: any, i: number) => i));
            setSelectedSuggestions(allIndices as Set<number>);
            setStepGen(2);
        } catch (err: any) {
            const errorMsg = err.response?.data?.error 
                || err.response?.data?.detail 
                || err.response?.data?.message 
                || "Erreur lors de la génération des suggestions";
            toast.error(errorMsg);
        } finally {
            setLoadingSuggestions(false);
        }
    }

    function handleApply() {
        const selectedItems = suggestions.filter((_, i) => selectedSuggestions.has(i));
        if (selectedItems.length === 0) {
            toast("Aucune sélection", { icon: '⚠️' });
            return;
        }

        const newLines: CommandeProduit[] = selectedItems.map((item: any, index) => {
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
                } as any;
             }

            return {
                id: Date.now() + index,
                produit: productStub,
                quantity: item.quantite_suggeree,
                price: String(item.prix_achat || productStub.cost_price || 0),
                tva: item.tva || productStub.tva || '0',
                marge: item.taux_marge || productStub.taux_marge || '1.3',
                selling_price: String(item.prix_vente || productStub.selling_price || 0),
            } as any;
        });

        onApplySuggestions(newLines, String(schedule.fournisseur));
    }

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title="Service de Ravitaillement Automatique"
            subtitle={activeTab === 'plan' ? "Configurez l'intelligence de votre stock" : "Générez un aperçu immédiat de la commande"}
            icon={<Zap className="size-6 text-primary fill-primary/20" />}
            maxWidth="max-w-4xl"
            footer={
                <div className="flex justify-between items-center w-full">
                    <button className="btn btn-ghost" onClick={onClose}>{t('scheduling.cancel')}</button>
                    <div className="flex gap-2">
                        {activeTab === 'gen' && stepGen === 2 && (
                            <button className="btn btn-ghost" onClick={() => setStepGen(1)}>
                                <ChevronLeft className="size-4 mr-2" />
                                Paramètres
                            </button>
                        )}
                        {activeTab === 'plan' ? (
                            <button className="btn btn-primary px-10 rounded-xl" onClick={handleSave} disabled={saving}>
                                {saving ? <span className="loading loading-spinner loading-xs"></span> : <><Check className="size-4 mr-2" />{t('scheduling.save_service')}</>}
                            </button>
                        ) : (
                            stepGen === 1 ? (
                                <button className="btn btn-primary px-10 rounded-xl" onClick={fetchSuggestions} disabled={loadingSuggestions}>
                                    {loadingSuggestions ? <span className="loading loading-spinner loading-xs"></span> : <><Search className="size-4 mr-2" />{t('scheduling.analyze')}</>}
                                </button>
                            ) : (
                                <button className="btn btn-primary px-10 rounded-xl" onClick={handleApply} disabled={selectedSuggestions.size === 0}>
                                    <ShoppingCart className="size-4 mr-2" />
                                    Créer la commande ({selectedSuggestions.size})
                                </button>
                            )
                        )}
                    </div>
                </div>
            }
        >
            <div className="p-0 flex flex-col bg-base-100 min-h-[520px] h-[520px]">
                {/* Header info */}
                <div className="p-4 border-b border-base-200 bg-slate-50/50">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex-1 min-w-[250px]">
                            <label className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-1 block">{t('scheduling.supplier_partner')}</label>
                            <select 
                                className="select select-bordered select-sm w-full font-bold text-primary bg-white rounded-xl border-primary/20 focus:border-primary"
                                value={schedule.fournisseur || ''}
                                onChange={(e) => setSchedule({...schedule, fournisseur: parseInt(e.target.value) || 0})}
                            >
                                <option value="">-- Sélectionner un fournisseur --</option>
                                {fournisseurs.map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-4 bg-white p-2 rounded-xl border border-base-200 shadow-sm">
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-bold text-base-content/40 uppercase">{t('scheduling.service_mode')}</span>
                                <div className="flex items-center gap-2">
                                    <div className={`size-2 rounded-full ${schedule.is_active ? 'bg-success animate-pulse' : 'bg-base-300'}`}></div>
                                    <span className="text-xs font-black text-base-content">{schedule.is_active ? t('scheduling.active') : t('scheduling.paused')}</span>
                                </div>
                            </div>
                            <input 
                                type="checkbox" 
                                className="toggle toggle-primary toggle-sm" 
                                checked={schedule.is_active} 
                                onChange={(e) => setSchedule({...schedule, is_active: e.target.checked})}
                            />
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-4 pt-4">
                    <div className="tabs tabs-boxed bg-base-200/50 p-1 rounded-2xl w-fit">
                        <button className={`tab tab-sm font-bold rounded-xl px-8 h-9 transition-all ${activeTab === 'plan' ? 'tab-active bg-white shadow-sm text-primary' : 'text-base-content/50 hover:text-primary'}`} onClick={() => setActiveTab('plan')}>
                            <Calendar className="size-3.5 mr-2" /> Configuration
                        </button>
                        <button className={`tab tab-sm font-bold rounded-xl px-8 h-9 transition-all ${activeTab === 'gen' ? 'tab-active bg-white shadow-sm text-primary' : 'text-base-content/50 hover:text-primary'}`} onClick={() => setActiveTab('gen')}>
                            <Search className="size-3.5 mr-2" /> Aperçu Immédiat
                        </button>
                    </div>
                </div>

                <div className="p-4">
                    {activeTab === 'plan' ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Section 1: Timing */}
                                <div className="bg-white border border-base-200 rounded-3xl p-5 shadow-sm space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-2 bg-primary/10 text-primary rounded-xl">
                                            <Clock className="size-4" />
                                        </div>
                                        <h3 className="text-sm font-black text-base-content uppercase tracking-tight">{t('scheduling.frequency_timing')}</h3>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-base-content/40 uppercase mb-2 block">{t('scheduling.activation_days')}</label>
                                            <div className="flex justify-between gap-1">
                                                {days.map(d => (
                                                    <button
                                                        key={d.value}
                                                        onClick={() => toggleDay(d.value)}
                                                        className={`size-9 rounded-full text-xs font-black transition-all flex items-center justify-center border-2 
                                                            ${schedule.active_days.includes(d.value) 
                                                                ? 'bg-primary border-primary text-white shadow-md shadow-primary/20 scale-110' 
                                                                : 'bg-base-100 border-base-200 text-base-content/40 hover:border-primary/30'}`}
                                                        title={d.full}
                                                    >
                                                        {d.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-base-content/40 uppercase block">{t('scheduling.every')}</label>
                                                <div className="join w-full">
                                                    <input type="number" className="input input-bordered input-sm join-item w-full font-bold" value={schedule.frequency_weeks} onChange={(e) => setSchedule({...schedule, frequency_weeks: parseInt(e.target.value) || 1})}/>
                                                    <span className="bg-base-200 px-3 flex items-center text-[10px] font-black join-item">{t('scheduling.weeks_short')}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-base-content/40 uppercase block">{t('scheduling.hour')}</label>
                                                <input type="time" className="input input-bordered input-sm w-full font-bold rounded-lg" value={schedule.time} onChange={(e) => setSchedule({...schedule, time: e.target.value})}/>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-base-content/40 uppercase block">{t('scheduling.start_on')}</label>
                                                <input type="date" className="input input-bordered input-sm w-full font-bold rounded-lg" value={schedule.start_date} onChange={(e) => setSchedule({...schedule, start_date: e.target.value})}/>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Logic & Intelligence */}
                                <div className="bg-white border border-base-200 rounded-3xl p-5 shadow-sm space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                                            <Zap className="size-4" />
                                        </div>
                                        <h3 className="text-sm font-black text-base-content uppercase tracking-tight">{t('scheduling.calculation_intelligence')}</h3>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="grid grid-cols-3 gap-2">
                                            <button 
                                                className={`p-3 rounded-2xl border-2 text-left transition-all ${schedule.execution_mode === 'OPTIMISE' ? 'border-primary bg-primary/5' : 'border-base-100 bg-base-50'}`}
                                                onClick={() => setSchedule({...schedule, execution_mode: 'OPTIMISE'})}
                                            >
                                                <div className="text-[10px] font-black text-primary mb-1">{t('scheduling.predictive_analysis')}</div>
                                                <div className="text-[11px] font-bold leading-tight opacity-70 text-base-content">{t('scheduling.predictive_desc')}</div>
                                            </button>
                                            <button 
                                                className={`p-3 rounded-2xl border-2 text-left transition-all ${schedule.execution_mode === 'SIMPLE' ? 'border-primary bg-primary/5' : 'border-base-100 bg-base-50'}`}
                                                onClick={() => setSchedule({...schedule, execution_mode: 'SIMPLE'})}
                                            >
                                                <div className="text-[10px] font-black text-primary mb-1">{t('scheduling.simple_replacement')}</div>
                                                <div className="text-[11px] font-bold leading-tight opacity-70 text-base-content">{t('scheduling.simple_desc')}</div>
                                            </button>
                                            <button 
                                                className={`p-3 rounded-2xl border-2 text-left transition-all ${schedule.execution_mode === 'CUMULATIF' ? 'border-primary bg-primary/5' : 'border-base-100 bg-base-50'}`}
                                                onClick={() => setSchedule({...schedule, execution_mode: 'CUMULATIF'})}
                                            >
                                                <div className="text-[10px] font-black text-primary mb-1">{t('scheduling.cumulative')}</div>
                                                <div className="text-[11px] font-bold leading-tight opacity-70 text-base-content">{t('scheduling.cumulative_desc')}</div>
                                            </button>
                                        </div>

                                        {/* Période d'analyse visible pour tous les modes */}
                                        <div className={`p-3 rounded-2xl border flex items-center justify-between ${schedule.execution_mode === 'OPTIMISE' ? 'bg-blue-50/50 border-blue-100' : schedule.execution_mode === 'CUMULATIF' ? 'bg-green-50/50 border-green-100' : 'bg-slate-50 border-slate-200'}`}>
                                            <div className="flex items-center gap-2">
                                                <Info className={`size-3.5 ${schedule.execution_mode === 'OPTIMISE' ? 'text-blue-500' : schedule.execution_mode === 'CUMULATIF' ? 'text-green-500' : 'text-slate-500'}`} />
                                                <span className={`text-[10px] font-bold ${schedule.execution_mode === 'OPTIMISE' ? 'text-blue-700' : schedule.execution_mode === 'CUMULATIF' ? 'text-green-700' : 'text-slate-700'}`}>
                                                    {schedule.execution_mode === 'OPTIMISE' ? "Période d'analyse" : schedule.execution_mode === 'CUMULATIF' ? "Période initiale" : "Période de comptage"}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="number" 
                                                    className={`w-12 bg-transparent border-b text-center font-black text-xs focus:outline-none ${schedule.execution_mode === 'OPTIMISE' ? 'border-blue-300 text-blue-600' : 'border-slate-300 text-slate-600'}`} 
                                                    value={schedule.analysis_period_days} 
                                                    onChange={(e) => setSchedule({...schedule, analysis_period_days: parseInt(e.target.value) || 30})}
                                                    min={1}
                                                    max={365}
                                                />
                                                <span className={`text-[10px] font-bold ${schedule.execution_mode === 'OPTIMISE' ? 'text-blue-700' : 'text-slate-700'}`}>jours</span>
                                            </div>
                                        </div>
                                        {schedule.execution_mode === 'SIMPLE' && (
                                            <p className="text-[9px] text-slate-500 leading-tight">
                                                Le système comptera les ventes sur ces {schedule.analysis_period_days} derniers jours pour suggérer un réassort identique.
                                            </p>
                                        )}
                                        {schedule.execution_mode === 'CUMULATIF' && (
                                            <p className="text-[9px] text-green-600 leading-tight">
                                                <strong>Mode chaîné :</strong> La 1ère commande utilise la période initiale ({schedule.analysis_period_days}j), puis chaque nouvelle commande compte les ventes depuis la précédente génération.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Section 3: Safety Controls */}
                                <div className="bg-white border border-base-200 rounded-3xl p-5 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                                                <ShieldCheck className="size-4" />
                                            </div>
                                            <h3 className="text-sm font-black text-base-content uppercase tracking-tight">Filtre de Sécurité</h3>
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            className="checkbox checkbox-xs checkbox-warning rounded-md" 
                                            checked={schedule.min_amount > 0} 
                                            onChange={(e) => setSchedule({...schedule, min_amount: e.target.checked ? 100000 : 0})}
                                        />
                                    </div>

                                    {schedule.min_amount > 0 ? (
                                        <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="text-[10px] font-bold text-base-content/40 uppercase block">Montant Min de Commande (HT)</label>
                                            <div className="relative">
                                                <input type="number" className="input input-bordered input-sm w-full font-bold pr-8" value={schedule.min_amount} onChange={(e) => setSchedule({...schedule, min_amount: parseInt(e.target.value) || 0})}/>
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black opacity-30">F</span>
                                            </div>
                                            <p className="text-[9px] text-amber-700/60 font-bold leading-tight mt-2">Le ravitaillement automatique ne se déclenche que si ce montant est atteint.</p>
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-slate-50 rounded-2xl border border-dashed border-base-200 text-center">
                                            <p className="text-[10px] font-bold text-base-content/40 uppercase">Filtre Désactivé</p>
                                            <p className="text-[9px] text-base-content/30 mt-1">La commande sera créée quel que soit le montant.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Section 4: Notifications */}
                                <div className="bg-white border border-base-200 rounded-3xl p-5 shadow-sm space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                                            <Bell className="size-4" />
                                        </div>
                                        <h3 className="text-sm font-black text-base-content uppercase tracking-tight">Canaux de Notification</h3>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <button 
                                            className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${schedule.notify_whatsapp ? 'border-success bg-success/5' : 'border-base-100 bg-base-50'}`}
                                            onClick={() => setSchedule({...schedule, notify_whatsapp: !schedule.notify_whatsapp})}
                                        >
                                            <div className={`size-3 rounded-full ${schedule.notify_whatsapp ? 'bg-success' : 'bg-base-300'}`}></div>
                                            <span className="text-[11px] font-black text-base-content">WhatsApp</span>
                                        </button>
                                        <button 
                                            className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${schedule.notify_sms ? 'border-primary bg-primary/5' : 'border-base-100 bg-base-50'}`}
                                            onClick={() => setSchedule({...schedule, notify_sms: !schedule.notify_sms})}
                                        >
                                            <div className={`size-3 rounded-full ${schedule.notify_sms ? 'bg-primary' : 'bg-base-300'}`}></div>
                                            <span className="text-[11px] font-black text-base-content">SMS Direct</span>
                                        </button>
                                    </div>
                                    <p className="text-[10px] italic text-base-content/40 text-center">Vous recevrez un résumé à chaque exécution du service.</p>
                                </div>
                            </div>

                            <div className="mt-2 bg-white border border-base-200 rounded-3xl p-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-2 px-1">
                                    <MessageSquare className="size-3.5 text-base-content/40" />
                                    <label className="text-[10px] font-black uppercase text-base-content/40 tracking-widest">Notes de Service</label>
                                </div>
                                <textarea className="textarea textarea-bordered w-full h-16 rounded-2xl resize-none text-sm font-medium border-base-100 focus:border-primary" placeholder="Consignes particulières pour ce ravitaillement automatique..." value={schedule.comment} onChange={(e) => setSchedule({...schedule, comment: e.target.value})}></textarea>
                            </div>
                        </div>
                    ) : (
                        /* TAB GENERATION : Reprise de SuggestionCommandeModal */
                        <div className="space-y-4">
                            {stepGen === 1 ? (
                                <div className="max-w-2xl mx-auto space-y-4 pt-4">
                                    <div className="grid grid-cols-3 gap-3">
                                        <label className={`p-3 cursor-pointer rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-2 ${suggestionParams.mode === 'simple' ? 'border-primary bg-primary/5' : 'border-base-200 bg-base-100 hover:border-primary/20'}`}>
                                            <input type="radio" className="hidden" checked={suggestionParams.mode === 'simple'} onChange={() => setSuggestionParams({...suggestionParams, mode: 'simple'})}/>
                                            <div className={`p-2 rounded-xl ${suggestionParams.mode === 'simple' ? 'bg-primary text-white' : 'bg-base-200 text-base-content/40'}`}><ShieldCheck className="size-4" /></div>
                                            <div className="space-y-0.5">
                                                <span className="text-xs font-black block">REMPLACEMENT</span>
                                                <p className="text-[9px] font-bold opacity-60">Simple & Sûr</p>
                                            </div>
                                        </label>
                                        <label className={`p-3 cursor-pointer rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-2 ${suggestionParams.mode === 'optimise' ? 'border-primary bg-primary/5' : 'border-base-200 bg-base-100 hover:border-primary/20'}`}>
                                            <input type="radio" className="hidden" checked={suggestionParams.mode === 'optimise'} onChange={() => setSuggestionParams({...suggestionParams, mode: 'optimise'})}/>
                                            <div className={`p-2 rounded-xl ${suggestionParams.mode === 'optimise' ? 'bg-primary text-white' : 'bg-base-200 text-base-content/40'}`}><Zap className="size-4" /></div>
                                            <div className="space-y-0.5">
                                                <span className="text-xs font-black block">PRÉDICTIF</span>
                                                <p className="text-[9px] font-bold opacity-60">Tendances & IA</p>
                                            </div>
                                        </label>
                                        <label className={`p-3 cursor-pointer rounded-2xl border-2 transition-all flex flex-col items-center text-center gap-2 ${suggestionParams.mode === 'ventes_horaire' ? 'border-primary bg-primary/5' : 'border-base-200 bg-base-100 hover:border-primary/20'}`}>
                                            <input type="radio" className="hidden" checked={suggestionParams.mode === 'ventes_horaire'} onChange={() => setSuggestionParams({...suggestionParams, mode: 'ventes_horaire'})}/>
                                            <div className={`p-2 rounded-xl ${suggestionParams.mode === 'ventes_horaire' ? 'bg-primary text-white' : 'bg-base-200 text-base-content/40'}`}><Clock className="size-4" /></div>
                                            <div className="space-y-0.5">
                                                <span className="text-xs font-black block">TEMPOREL</span>
                                                <p className="text-[9px] font-bold opacity-60">Ventes horaires</p>
                                            </div>
                                        </label>
                                    </div>
                                    
                                    <div className="bg-slate-50 border border-base-200 p-5 rounded-3xl space-y-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Settings2 className="size-4 text-primary" />
                                            <h4 className="text-[10px] font-black uppercase text-base-content/60 tracking-widest">Paramètres d'analyse</h4>
                                        </div>
                                        {suggestionParams.mode === 'ventes_horaire' ? (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold uppercase opacity-40">Date Début</label>
                                                    <input type="date" className="input input-bordered w-full rounded-xl font-bold" value={suggestionParams.dateDebut} onChange={(e) => setSuggestionParams({...suggestionParams, dateDebut: e.target.value})}/>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold uppercase opacity-40">Date Fin</label>
                                                    <input type="date" className="input input-bordered w-full rounded-xl font-bold" value={suggestionParams.dateFin} onChange={(e) => setSuggestionParams({...suggestionParams, dateFin: e.target.value})}/>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold uppercase opacity-40">Période d'analyse (jours)</label>
                                                    <div className="join w-full">
                                                        <input type="number" className="input input-bordered join-item w-full font-bold" value={suggestionParams.periode} onChange={(e) => setSuggestionParams({...suggestionParams, periode: parseInt(e.target.value) || 0})}/>
                                                        <span className="join-item bg-base-200 px-4 flex items-center text-[10px] font-black">JOURS</span>
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold uppercase opacity-40">Budget Max (HT)</label>
                                                    <div className="relative">
                                                        <input type="number" className="input input-bordered w-full rounded-xl font-bold" placeholder="Illimité" value={suggestionParams.budgetMax} onChange={(e) => setSuggestionParams({...suggestionParams, budgetMax: e.target.value})}/>
                                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black opacity-20">F</span>
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
                                                <ShoppingCart className="size-6 text-primary" />
                                            </div>
                                            <div>
                                                <div className="text-[10px] opacity-50 uppercase font-black tracking-widest">Total Estimé de la commande</div>
                                                <div className="text-2xl font-mono font-black text-primary">{formatPrice(totalHt)} F <span className="text-xs opacity-50 ml-1">HT</span></div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] opacity-50 uppercase font-black tracking-widest">Articles suggérés</div>
                                            <div className="text-xl font-black">{suggestions.length} produits</div>
                                        </div>
                                    </div>
                                    <div className="overflow-auto flex-1 border border-base-200 rounded-3xl bg-white shadow-inner">
                                        <table className="table table-pin-rows table-sm">
                                            <thead>
                                                <tr className="bg-base-50 text-[10px] font-black uppercase text-base-content/40">
                                                    <th className="w-10"><input type="checkbox" className="checkbox checkbox-xs" checked={selectedSuggestions.size === suggestions.length} onChange={() => setSelectedSuggestions(selectedSuggestions.size === suggestions.length ? new Set() : new Set(suggestions.map((_, i) => i)))}/></th>
                                                    <th>Désignation Produit</th>
                                                    <th className="text-center">Stock</th>
                                                    <th className="text-center">Ventes</th>
                                                    <th className="text-right">Quantité</th>
                                                    <th className="text-right">Total HT</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {suggestions.map((item, idx) => (
                                                    <tr key={idx} className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedSuggestions.has(idx) ? 'bg-primary/5' : ''}`} onClick={() => setSelectedSuggestions(prev => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; })}>
                                                        <td><input type="checkbox" className="checkbox checkbox-xs checkbox-primary rounded" checked={selectedSuggestions.has(idx)} onChange={() => {}}/></td>
                                                        <td className="font-black text-xs text-base-content">{item.produit_nom}</td>
                                                        <td className="text-center"><span className="badge badge-ghost font-mono text-[10px] font-bold">{item.stock_actuel}</span></td>
                                                        <td className="text-center font-bold text-xs">{item.ventes_periode}</td>
                                                        <td className="text-right text-primary font-black text-sm">x{item.quantite_suggeree}</td>
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

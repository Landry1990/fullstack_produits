import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Search, X, Trophy, Check, Plus, Trash2, Users, Target, AlertTriangle, Info, PackageSearch } from 'lucide-react';
import { gooeyToast } from 'goey-toast';
import { logger } from '../../utils/logger';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '../shadcn/dialog';
import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';
import { LocalizedDateInput } from '../LocalizedDateInput';
import { Textarea } from '../shadcn/textarea';
import { Select } from '../shadcn/select';
import { Checkbox } from '../shadcn/checkbox';
import { Badge } from '../shadcn/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../shadcn/tabs';
import { cn } from '../../lib/utils';
import {
    useSaveChallenge,
    useChallengeProductSearch,
    useChallengeUsers,
} from '../../hooks/useChallenges';
import type { Challenge, ChallengeTypeObjectif, ChallengeMode, ChallengeSourceProduits } from '../../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    challenge?: Challenge | null;
}

interface EquipeForm {
    id?: number;
    nom: string;
    membres: number[];
}

interface PointTierForm {
    id?: number;
    mois_max: string;
    points: string;
}

interface FormState {
    nom: string;
    description: string;
    date_debut: string;
    date_fin: string;
    statut: Challenge['statut'];
    is_active: boolean;
    all_users: boolean;
    participants: number[];
    produits: number[];
    type_objectif: ChallengeTypeObjectif;
    objectif_valeur: string;
    mode: ChallengeMode;
    equipes: EquipeForm[];
    source_produits: ChallengeSourceProduits;
    peremption_mois: string;
    point_tiers: PointTierForm[];
}

const STATUTS: Challenge['statut'][] = ['BROU', 'ENC', 'CLO', 'ANN'];
const TYPES_OBJECTIF: ChallengeTypeObjectif[] = ['CA', 'BOITES', 'POINTS'];
const MODES: ChallengeMode[] = ['INDIVIDUEL', 'EQUIPES'];
const SOURCES: ChallengeSourceProduits[] = ['MANUEL', 'AUTO_PEREMPTION'];

const EMPTY_FORM: FormState = {
    nom: '',
    description: '',
    date_debut: '',
    date_fin: '',
    statut: 'BROU',
    is_active: true,
    all_users: true,
    participants: [],
    produits: [],
    type_objectif: 'CA',
    objectif_valeur: '',
    mode: 'INDIVIDUEL',
    equipes: [],
    source_produits: 'MANUEL',
    peremption_mois: '',
    point_tiers: [],
};

const ChallengeFormModal: React.FC<Props> = ({ isOpen, onClose, challenge }) => {
    const { t } = useTranslation(['challenges', 'common']);
    const isEdit = !!challenge;

    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [activeTab, setActiveTab] = useState<string>('general');
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const productDropdownRef = useRef<HTMLDivElement>(null);

    const saveMutation = useSaveChallenge();
    const { data: users } = useChallengeUsers();
    const { data: productResults } = useChallengeProductSearch(productSearch);

    useEffect(() => {
        if (isOpen) {
            if (challenge) {
                setForm({
                    nom: challenge.nom ?? '',
                    description: challenge.description ?? '',
                    date_debut: challenge.date_debut ?? '',
                    date_fin: challenge.date_fin ?? '',
                    statut: challenge.statut ?? 'BROU',
                    is_active: challenge.is_active ?? true,
                    all_users: challenge.all_users ?? true,
                    participants: challenge.participants ?? [],
                    produits: challenge.produits ?? [],
                    type_objectif: challenge.type_objectif ?? 'CA',
                    objectif_valeur: challenge.objectif_valeur != null ? String(challenge.objectif_valeur) : '',
                    mode: challenge.mode ?? 'INDIVIDUEL',
                    equipes: (challenge.equipes ?? []).map((eq) => ({
                        id: eq.id,
                        nom: eq.nom,
                        membres: eq.membres ?? [],
                    })),
                    source_produits: challenge.source_produits ?? 'MANUEL',
                    peremption_mois: challenge.peremption_mois != null ? String(challenge.peremption_mois) : '',
                    point_tiers: (challenge.point_tiers ?? []).map((tier) => ({
                        id: tier.id,
                        mois_max: String(tier.mois_max),
                        points: String(tier.points),
                    })),
                });
            } else {
                setForm(EMPTY_FORM);
            }
            setProductSearch('');
            setShowProductDropdown(false);
            setActiveTab('general');
        }
    }, [isOpen, challenge]);

    // Close product dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (
                productDropdownRef.current &&
                !productDropdownRef.current.contains(e.target as Node)
            ) {
                setShowProductDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const allUsers = users ?? [];
    const allProducts = productResults ?? [];

    // Map of selected product ids -> display info (from search results)
    const selectedProducts = useMemo(() => {
        return form.produits.map((id) => {
            const found = allProducts.find((p) => p.id === id);
            return found
                ? { id, name: found.name, cip1: found.cip1 }
                : { id, name: `#${id}`, cip1: undefined };
        });
    }, [form.produits, allProducts]);

    const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const toggleParticipant = (id: number) => {
        setForm((prev) => ({
            ...prev,
            participants: prev.participants.includes(id)
                ? prev.participants.filter((p) => p !== id)
                : [...prev.participants, id],
        }));
    };

    const addProduct = (id: number) => {
        setForm((prev) =>
            prev.produits.includes(id)
                ? prev
                : { ...prev, produits: [...prev.produits, id] }
        );
        setProductSearch('');
        setShowProductDropdown(false);
    };

    const removeProduct = (id: number) => {
        setForm((prev) => ({ ...prev, produits: prev.produits.filter((p) => p !== id) }));
    };

    // ── Team management ──
    const addEquipe = () => {
        setForm((prev) => ({
            ...prev,
            equipes: [...prev.equipes, { nom: '', membres: [] }],
        }));
    };

    const removeEquipe = (index: number) => {
        setForm((prev) => ({
            ...prev,
            equipes: prev.equipes.filter((_, i) => i !== index),
        }));
    };

    const updateEquipeNom = (index: number, nom: string) => {
        setForm((prev) => ({
            ...prev,
            equipes: prev.equipes.map((eq, i) => (i === index ? { ...eq, nom } : eq)),
        }));
    };

    const toggleEquipeMembre = (index: number, userId: number) => {
        setForm((prev) => ({
            ...prev,
            equipes: prev.equipes.map((eq, i) => {
                if (i !== index) return eq;
                return {
                    ...eq,
                    membres: eq.membres.includes(userId)
                        ? eq.membres.filter((m) => m !== userId)
                        : [...eq.membres, userId],
                };
            }),
        }));
    };

    // ── Point tiers management ──
    const selectType = (type: ChallengeTypeObjectif) => {
        // Auto-configure mode and source based on type
        if (type === 'CA') {
            setForm((prev) => ({ ...prev, type_objectif: type, mode: 'EQUIPES', source_produits: 'MANUEL' }));
        } else if (type === 'POINTS') {
            setForm((prev) => ({ ...prev, type_objectif: type, mode: 'EQUIPES', source_produits: 'AUTO_PEREMPTION' }));
        } else {
            // BOITES: keep current mode, source is manual
            setForm((prev) => ({ ...prev, type_objectif: type, source_produits: 'MANUEL' }));
        }
    };

    const addPointTier = () => {
        setForm((prev) => ({
            ...prev,
            point_tiers: [...prev.point_tiers, { mois_max: '', points: '' }],
        }));
    };

    const removePointTier = (index: number) => {
        setForm((prev) => ({
            ...prev,
            point_tiers: prev.point_tiers.filter((_, i) => i !== index),
        }));
    };

    const updatePointTier = (index: number, field: 'mois_max' | 'points', value: string) => {
        setForm((prev) => ({
            ...prev,
            point_tiers: prev.point_tiers.map((tier, i) =>
                i === index ? { ...tier, [field]: value } : tier
            ),
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.nom.trim()) {
            gooeyToast.error(t('challenges:form.errors.nom_required'));
            return;
        }
        if (form.date_debut && form.date_fin && form.date_debut > form.date_fin) {
            gooeyToast.error(t('challenges:form.errors.date_order'));
            return;
        }
        if (form.mode === 'EQUIPES') {
            const emptyNom = form.equipes.some((eq) => !eq.nom.trim());
            if (emptyNom) {
                gooeyToast.error(t('challenges:form.errors.equipe_nom_required'));
                return;
            }
            if (form.equipes.length < 2) {
                gooeyToast.error(t('challenges:form.errors.equipe_min'));
                return;
            }
        }
        // Validations anti-péremption
        if (form.source_produits === 'AUTO_PEREMPTION' && !form.peremption_mois.trim()) {
            gooeyToast.error(t('challenges:form.errors.peremption_mois_required'));
            return;
        }
        if (form.type_objectif === 'POINTS' && form.point_tiers.length === 0) {
            gooeyToast.error(t('challenges:form.errors.point_tiers_required'));
            return;
        }

        const objectifVal = form.objectif_valeur.trim()
            ? parseFloat(form.objectif_valeur.replace(',', '.'))
            : null;

        const pointTiersData = form.type_objectif === 'POINTS'
            ? form.point_tiers
                .filter((tier) => tier.mois_max.trim() && tier.points.trim())
                .map((tier) => ({
                    mois_max: parseInt(tier.mois_max, 10),
                    points: parseInt(tier.points, 10),
                }))
            : [];

        const payload: Partial<Challenge> & { equipes_data?: EquipeForm[]; point_tiers_data?: typeof pointTiersData } = {
            nom: form.nom.trim(),
            description: form.description.trim(),
            date_debut: form.date_debut || undefined,
            date_fin: form.date_fin || undefined,
            statut: form.statut,
            is_active: form.is_active,
            all_users: form.all_users,
            participants: form.all_users ? [] : form.participants,
            produits: form.source_produits === 'AUTO_PEREMPTION' ? [] : form.produits,
            type_objectif: form.type_objectif,
            objectif_valeur: objectifVal,
            mode: form.mode,
            equipes_data: form.mode === 'EQUIPES' ? form.equipes : [],
            source_produits: form.source_produits,
            peremption_mois: form.source_produits === 'AUTO_PEREMPTION' && form.peremption_mois.trim()
                ? parseInt(form.peremption_mois, 10)
                : null,
            point_tiers_data: pointTiersData,
        };

        try {
            await saveMutation.mutateAsync({
                id: challenge?.id,
                data: payload,
            });
            gooeyToast.success(
                isEdit ? t('challenges:messages.updated') : t('challenges:messages.created')
            );
            onClose();
        } catch (err) {
            logger.error('ChallengeFormModal: save error', err);
            gooeyToast.error(
                isEdit ? t('challenges:messages.error_updating') : t('challenges:messages.error_creating')
            );
        }
    };

    const userLabel = (u: { username: string; first_name: string; last_name: string }) => {
        const full = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim();
        return full ? `${full} (${u.username})` : u.username;
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                            <Trophy className="size-5" />
                        </div>
                        <div>
                            <DialogTitle>
                                {isEdit ? t('challenges:edit') : t('challenges:new')}
                            </DialogTitle>
                            <DialogDescription>
                                {isEdit
                                    ? t('challenges:form.subtitle_edit')
                                    : t('challenges:form.subtitle_create')}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="w-full justify-start bg-slate-100">
                            <TabsTrigger value="general" className="gap-1.5">
                                <Info className="size-3.5" />
                                {t('challenges:tab_general')}
                            </TabsTrigger>
                            <TabsTrigger value="objectif" className="gap-1.5">
                                <Target className="size-3.5" />
                                {t('challenges:tab_objectif')}
                            </TabsTrigger>
                            <TabsTrigger value="participants" className="gap-1.5">
                                <Users className="size-3.5" />
                                {t('challenges:tab_participants')}
                            </TabsTrigger>
                            <TabsTrigger value="produits" className="gap-1.5">
                                <PackageSearch className="size-3.5" />
                                {t('challenges:tab_produits')}
                            </TabsTrigger>
                        </TabsList>

                        {/* ── Onglet Général ── */}
                        <TabsContent value="general" className="space-y-4 min-h-[420px]">
                            {/* Nom */}
                            <div className="space-y-2">
                                <label htmlFor="ch-nom" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                    {t('challenges:form.nom')} <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    id="ch-nom"
                                    disableUppercase
                                    value={form.nom}
                                    onChange={(e) => update('nom', e.target.value)}
                                    placeholder={t('challenges:form.nom_placeholder')}
                                    className="h-11"
                                    required
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <label htmlFor="ch-desc" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                    {t('challenges:form.description')}
                                </label>
                                <Textarea
                                    id="ch-desc"
                                    value={form.description}
                                    onChange={(e) => update('description', e.target.value)}
                                    placeholder={t('challenges:form.description_placeholder')}
                                    rows={3}
                                    className="min-h-[80px]"
                                />
                            </div>

                            {/* Dates + Statut */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="ch-dd" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        {t('challenges:form.date_debut')}
                                    </label>
                                    <LocalizedDateInput
                                        id="ch-dd"
                                        disableUppercase
                                        value={form.date_debut}
                                        onChange={(e) => update('date_debut', e.target.value)}
                                        className="h-11"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="ch-df" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        {t('challenges:form.date_fin')}
                                    </label>
                                    <LocalizedDateInput
                                        id="ch-df"
                                        disableUppercase
                                        value={form.date_fin}
                                        onChange={(e) => update('date_fin', e.target.value)}
                                        className="h-11"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="ch-statut" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        {t('challenges:form.statut')}
                                    </label>
                                    <Select
                                        id="ch-statut"
                                        value={form.statut}
                                        onChange={(e) => update('statut', e.target.value as Challenge['statut'])}
                                        className="h-11"
                                    >
                                        {STATUTS.map((s) => (
                                            <option key={s} value={s}>
                                                {t(`challenges:statuts.${s}`)}
                                            </option>
                                        ))}
                                    </Select>
                                </div>
                            </div>

                            {/* is_active */}
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <Checkbox
                                        checked={form.is_active}
                                        onCheckedChange={(v) => update('is_active', v === true)}
                                    />
                                    <span className="text-sm font-medium text-slate-700">
                                        {t('challenges:form.is_active')}
                                    </span>
                                </label>
                            </div>
                        </TabsContent>

                        {/* ── Onglet Objectif ── */}
                        <TabsContent value="objectif" className="space-y-4 min-h-[420px]">
                            {/* Sélecteur de type de challenge en cartes */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                    {t('challenges:type_challenge')} <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {/* CA */}
                                    <button
                                        type="button"
                                        onClick={() => selectType('CA')}
                                        className={cn(
                                            'text-left p-4 rounded-xl border-2 transition-all',
                                            form.type_objectif === 'CA'
                                                ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20'
                                                : 'border-slate-200 hover:border-slate-300 bg-white'
                                        )}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={cn(
                                                'p-1.5 rounded-lg',
                                                form.type_objectif === 'CA' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                                            )}>
                                                <Trophy className="size-4" />
                                            </div>
                                            <span className="font-bold text-sm text-slate-700">
                                                {t('challenges:type_objectif_ca')}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            {t('challenges:type_ca_desc')}
                                        </p>
                                        <div className="mt-2 flex items-center gap-1.5">
                                            <Users className="size-3 text-slate-400" />
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                {t('challenges:mode_equipes')}
                                            </span>
                                        </div>
                                    </button>

                                    {/* BOITES */}
                                    <button
                                        type="button"
                                        onClick={() => selectType('BOITES')}
                                        className={cn(
                                            'text-left p-4 rounded-xl border-2 transition-all',
                                            form.type_objectif === 'BOITES'
                                                ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20'
                                                : 'border-slate-200 hover:border-slate-300 bg-white'
                                        )}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={cn(
                                                'p-1.5 rounded-lg',
                                                form.type_objectif === 'BOITES' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                                            )}>
                                                <PackageSearch className="size-4" />
                                            </div>
                                            <span className="font-bold text-sm text-slate-700">
                                                {t('challenges:type_objectif_boites')}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            {t('challenges:type_boites_desc')}
                                        </p>
                                        <div className="mt-2 flex items-center gap-1.5">
                                            <Users className="size-3 text-slate-400" />
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                {t('challenges:type_boites_mode')}
                                            </span>
                                        </div>
                                    </button>

                                    {/* POINTS */}
                                    <button
                                        type="button"
                                        onClick={() => selectType('POINTS')}
                                        className={cn(
                                            'text-left p-4 rounded-xl border-2 transition-all',
                                            form.type_objectif === 'POINTS'
                                                ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-500/20'
                                                : 'border-slate-200 hover:border-slate-300 bg-white'
                                        )}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={cn(
                                                'p-1.5 rounded-lg',
                                                form.type_objectif === 'POINTS' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'
                                            )}>
                                                <AlertTriangle className="size-4" />
                                            </div>
                                            <span className="font-bold text-sm text-slate-700">
                                                {t('challenges:type_objectif_points')}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            {t('challenges:type_points_desc')}
                                        </p>
                                        <div className="mt-2 flex items-center gap-1.5">
                                            <Users className="size-3 text-slate-400" />
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                {t('challenges:mode_equipes')}
                                            </span>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Objectif valeur (commun à tous) */}
                            <div className="space-y-2">
                                <label htmlFor="ch-obj" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                    {t('challenges:objectif_valeur')}
                                </label>
                                <Input
                                    id="ch-obj"
                                    type="number"
                                    disableUppercase
                                    value={form.objectif_valeur}
                                    onChange={(e) => update('objectif_valeur', e.target.value)}
                                    placeholder={t('challenges:objectif_valeur_placeholder')}
                                    className="h-11"
                                    min="0"
                                    step="any"
                                />
                                <p className="text-[10px] text-slate-400">
                                    {t('challenges:objectif_valeur_hint')}
                                </p>
                            </div>

                            {/* Mode (only for BOITES — CA and POINTS are fixed to EQUIPES) */}
                            {form.type_objectif === 'BOITES' && (
                                <div className="space-y-2">
                                    <label htmlFor="ch-mode" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        {t('challenges:mode')}
                                    </label>
                                    <Select
                                        id="ch-mode"
                                        value={form.mode}
                                        onChange={(e) => update('mode', e.target.value as ChallengeMode)}
                                        className="h-11"
                                    >
                                        {MODES.map((m) => (
                                            <option key={m} value={m}>
                                                {t(`challenges:mode_${m.toLowerCase()}`)}
                                            </option>
                                        ))}
                                    </Select>
                                </div>
                            )}

                            {/* Seuil péremption (only for POINTS — source is fixed to AUTO_PEREMPTION) */}
                            {form.type_objectif === 'POINTS' && (
                                <div className="space-y-2">
                                    <label htmlFor="ch-perempt" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        {t('challenges:peremption_mois')}
                                    </label>
                                    <Input
                                        id="ch-perempt"
                                        type="number"
                                        disableUppercase
                                        value={form.peremption_mois}
                                        onChange={(e) => update('peremption_mois', e.target.value)}
                                        placeholder={t('challenges:peremption_mois_placeholder')}
                                        className="h-11"
                                        min="1"
                                    />
                                    <p className="text-[10px] text-slate-400">
                                        {t('challenges:peremption_mois_hint')}
                                    </p>
                                </div>
                            )}

                            {/* Barème de points (only for POINTS) */}
                            {form.type_objectif === 'POINTS' && (
                                <div className="space-y-3 p-4 bg-amber-50/50 border border-amber-200 rounded-lg">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                                                {t('challenges:point_tiers')}
                                            </label>
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                {t('challenges:point_tiers_hint')}
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5 h-8 shrink-0"
                                            onClick={addPointTier}
                                        >
                                            <Plus className="size-3.5" />
                                            {t('challenges:point_tier_add')}
                                        </Button>
                                    </div>

                                    {form.point_tiers.length === 0 ? (
                                        <p className="text-sm text-slate-400 text-center py-3">
                                            {t('challenges:point_tier_empty')}
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {form.point_tiers.map((tier, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <div className="flex-1 grid grid-cols-2 gap-2">
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                                                                ≤
                                                            </span>
                                                            <Input
                                                                type="number"
                                                                disableUppercase
                                                                value={tier.mois_max}
                                                                onChange={(e) => updatePointTier(idx, 'mois_max', e.target.value)}
                                                                placeholder={t('challenges:point_tier_mois_placeholder')}
                                                                className="h-9 pl-7"
                                                                min="1"
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                                                                {t('challenges:point_tier_mois_max')}
                                                            </span>
                                                        </div>
                                                        <div className="relative">
                                                            <Target className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-amber-500" />
                                                            <Input
                                                                type="number"
                                                                disableUppercase
                                                                value={tier.points}
                                                                onChange={(e) => updatePointTier(idx, 'points', e.target.value)}
                                                                placeholder={t('challenges:point_tier_points_placeholder')}
                                                                className="h-9 pl-8"
                                                                min="1"
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                                                                {t('challenges:point_tier_points')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 shrink-0"
                                                        onClick={() => removePointTier(idx)}
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </TabsContent>

                        {/* ── Onglet Participants ── */}
                        <TabsContent value="participants" className="space-y-4 min-h-[420px]">
                            {/* all_users (only if INDIVIDUEL) */}
                            {form.mode === 'INDIVIDUEL' && (
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <Checkbox
                                            checked={form.all_users}
                                            onCheckedChange={(v) => update('all_users', v === true)}
                                        />
                                        <span className="text-sm font-medium text-slate-700">
                                            {t('challenges:form.all_users')}
                                        </span>
                                    </label>
                                </div>
                            )}

                            {/* Participants individuels (only if INDIVIDUEL + not all_users) */}
                            {form.mode === 'INDIVIDUEL' && !form.all_users && (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        {t('challenges:form.participants')}
                                    </label>
                                    <div className="border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto bg-white">
                                        {allUsers.length === 0 ? (
                                            <p className="text-sm text-slate-400 text-center py-2">
                                                {t('challenges:form.no_users')}
                                            </p>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {allUsers.map((u) => {
                                                    const checked = form.participants.includes(u.id);
                                                    return (
                                                        <label
                                                            key={u.id}
                                                            className={cn(
                                                                'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors',
                                                                checked
                                                                    ? 'bg-emerald-50 text-emerald-700'
                                                                    : 'hover:bg-slate-50 text-slate-700'
                                                            )}
                                                        >
                                                            <Checkbox
                                                                checked={checked}
                                                                onCheckedChange={() => toggleParticipant(u.id)}
                                                            />
                                                            <span className="truncate">{userLabel(u)}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    {form.participants.length > 0 && (
                                        <p className="text-xs text-slate-500">
                                            {t('challenges:form.participants_selected', { count: form.participants.length })}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Équipes (only if mode = EQUIPES) */}
                            {form.mode === 'EQUIPES' && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                            {t('challenges:equipes')}
                                        </label>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5 h-8"
                                            onClick={addEquipe}
                                        >
                                            <Plus className="size-3.5" />
                                            {t('challenges:equipe_add')}
                                        </Button>
                                    </div>

                                    {form.equipes.length === 0 ? (
                                        <div className="border border-dashed border-slate-200 rounded-lg p-6 text-center">
                                            <Users className="size-8 text-slate-300 mx-auto mb-2" />
                                            <p className="text-sm text-slate-400">
                                                {t('challenges:equipe_empty')}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {form.equipes.map((equipe, idx) => (
                                                <div
                                                    key={idx}
                                                    className="border border-slate-200 rounded-lg p-3 bg-white space-y-3"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            disableUppercase
                                                            value={equipe.nom}
                                                            onChange={(e) => updateEquipeNom(idx, e.target.value)}
                                                            placeholder={t('challenges:equipe_nom_placeholder')}
                                                            className="h-9 flex-1"
                                                        />
                                                        <span className="text-xs text-slate-400 shrink-0">
                                                            {t('challenges:equipe_membres_count', { count: equipe.membres.length })}
                                                        </span>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 shrink-0"
                                                            onClick={() => removeEquipe(idx)}
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                        </Button>
                                                    </div>
                                                    <div className="border border-slate-100 rounded-md p-2 max-h-32 overflow-y-auto bg-slate-50/50">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                            {allUsers.map((u) => {
                                                                const checked = equipe.membres.includes(u.id);
                                                                return (
                                                                    <label
                                                                        key={u.id}
                                                                        className={cn(
                                                                            'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs transition-colors',
                                                                            checked
                                                                                ? 'bg-emerald-50 text-emerald-700'
                                                                                : 'hover:bg-slate-100 text-slate-600'
                                                                        )}
                                                                    >
                                                                        <Checkbox
                                                                            checked={checked}
                                                                            onCheckedChange={() => toggleEquipeMembre(idx, u.id)}
                                                                        />
                                                                        <span className="truncate">{userLabel(u)}</span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </TabsContent>

                        {/* ── Onglet Produits ── */}
                        <TabsContent value="produits" className="space-y-4 min-h-[420px]">
                            {form.source_produits === 'AUTO_PEREMPTION' ? (
                                <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-6 text-center space-y-2">
                                    <PackageSearch className="size-10 text-amber-500 mx-auto" />
                                    <p className="text-sm font-medium text-slate-700">
                                        {t('challenges:classement_produits_peremption')}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {t('challenges:peremption_mois_hint')}
                                    </p>
                                    {form.peremption_mois && (
                                        <p className="text-xs text-amber-700 font-bold">
                                            {t('challenges:peremption_mois')}: {form.peremption_mois}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2" ref={productDropdownRef}>
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        {t('challenges:form.produits')}
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300">
                                            <Search className="size-4" />
                                        </div>
                                        <input
                                            type="text"
                                            value={productSearch}
                                            onChange={(e) => {
                                                setProductSearch(e.target.value);
                                                setShowProductDropdown(true);
                                            }}
                                            onFocus={() => setShowProductDropdown(true)}
                                            placeholder={t('challenges:form.produits_search_placeholder')}
                                            className="w-full pl-10 pr-8 rounded-lg border border-slate-200 bg-white font-medium h-11 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                        />
                                        {productSearch && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setProductSearch('');
                                                    setShowProductDropdown(false);
                                                }}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
                                                <X className="size-4" />
                                            </button>
                                        )}
                                        {showProductDropdown && allProducts.length > 0 && (
                                            <ul className="absolute z-50 w-full bg-white shadow-xl rounded-xl mt-2 max-h-60 overflow-auto border border-slate-200 py-2">
                                                {allProducts.map((p) => {
                                                    const already = form.produits.includes(p.id);
                                                    return (
                                                        <li key={p.id}>
                                                            <button
                                                                type="button"
                                                                onClick={() => addProduct(p.id)}
                                                                className="w-full text-left px-4 py-2.5 hover:bg-slate-100 transition-colors flex items-center justify-between gap-2"
                                                            >
                                                                <div className="min-w-0">
                                                                    <div className="font-bold text-sm truncate">{p.name}</div>
                                                                    {p.cip1 && (
                                                                        <div className="text-[10px] text-slate-400 font-bold">{p.cip1}</div>
                                                                    )}
                                                                </div>
                                                                {already && <Check className="size-4 text-emerald-600 shrink-0" />}
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </div>

                                    {/* Selected products badges */}
                                    {selectedProducts.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {selectedProducts.map((p) => (
                                                <Badge
                                                    key={p.id}
                                                    variant="outline"
                                                    className="gap-1.5 bg-amber-50 border-amber-200 text-amber-700 pr-1.5"
                                                >
                                                    <span className="truncate max-w-[180px]">{p.name}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeProduct(p.id)}
                                                        className="hover:text-amber-900"
                                                    >
                                                        <X className="size-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={saveMutation.isPending}>
                            {t('common:cancel')}
                        </Button>
                        <Button
                            type="submit"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={saveMutation.isPending}
                        >
                            {saveMutation.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                            {isEdit ? t('common:save') : t('challenges:form.create_btn')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ChallengeFormModal;

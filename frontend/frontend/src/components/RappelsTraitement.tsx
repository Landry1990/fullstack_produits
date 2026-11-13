import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { staggerContainer, fadeInUp } from '../lib/motion';
import { gooeyToast } from 'goey-toast';
import { BellPlus, Calendar, Check, Pencil, Phone, Pill, Search, Settings2, Trash2, X } from 'lucide-react';
import PremiumModal from './common/PremiumModal';
import { LocalizedDateInput } from './LocalizedDateInput';
import { ErrorState } from './ui/ErrorState';
import { treatmentReminderService, type TreatmentReminder } from '../services/treatmentReminderService';
import clientService from '../services/clientService';
import produitService from '../services/produitService';
import { usePharmacySettings } from '../hooks/usePharmacySettings';
import { useAuth } from '../context/AuthContext';
import { extractErrorMessage } from '../utils/errorHandling';
import type { Client } from '../types';

const todayStr = () => new Date().toISOString().slice(0, 10);

// ── Mini sélecteur recherche (client / produit) ──────────────────────────────
interface Option { id: number; label: string; sub?: string }

const SearchPick = ({ placeholder, onSearch, onPick, selected }: {
    placeholder: string;
    onSearch: (q: string) => Promise<Option[]>;
    onPick: (o: Option | null) => void;
    selected: Option | null;
}) => {
    const [query, setQuery] = useState('');
    const [options, setOptions] = useState<Option[]>([]);
    const [open, setOpen] = useState(false);
    const [activeIdx, setActiveIdx] = useState(0);
    const boxRef = useRef<HTMLDivElement>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const close = (e: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const handleChange = (v: string) => {
        setQuery(v);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(async () => {
            if (!v.trim()) { setOptions([]); return; }
            setOptions(await onSearch(v.trim()));
            setActiveIdx(0);
            setOpen(true);
        }, 250);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!open || options.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIdx(i => Math.min(i + 1, options.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIdx(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (options[activeIdx]) { onPick(options[activeIdx]); setOpen(false); }
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    return (
        <div ref={boxRef} className="relative">
            {selected ? (
                <div className="flex items-center justify-between h-11 px-3 rounded-xl border border-emerald-200 bg-emerald-50">
                    <span className="text-sm font-bold text-emerald-800 truncate">{selected.label}</span>
                    <button type="button" onClick={() => { onPick(null); setQuery(''); }} className="text-emerald-600 hover:text-emerald-800 shrink-0 ml-2">
                        <X className="size-4" />
                    </button>
                </div>
            ) : (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <input
                        value={query}
                        onChange={e => handleChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => options.length > 0 && setOpen(true)}
                        placeholder={placeholder}
                        className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm font-medium text-slate-700"
                    />
                </div>
            )}
            {open && !selected && (
                <div className="absolute z-30 top-full mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-xl max-h-56 overflow-auto">
                    {options.length === 0 && <div className="px-4 py-3 text-xs text-slate-400 italic">…</div>}
                    {options.map((o, idx) => (
                        <button
                            key={o.id}
                            type="button"
                            ref={idx === activeIdx ? el => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                            onMouseEnter={() => setActiveIdx(idx)}
                            onClick={() => { onPick(o); setOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 transition-colors ${idx === activeIdx ? 'bg-emerald-50' : ''}`}
                        >
                            <div className="text-sm font-bold text-slate-800 truncate">{o.label}</div>
                            {o.sub && <div className="text-xs text-slate-400 truncate">{o.sub}</div>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Page ─────────────────────────────────────────────────────────────────────
export default function RappelsTraitement() {
    const { t } = useTranslation(['rappels', 'common']);
    const { user } = useAuth();
    const { settings, updateSettings } = usePharmacySettings();
    const isAdmin = !!user?.is_superuser || user?.role === 'PHARMACIEN';

    const [rappels, setRappels] = useState<TreatmentReminder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statutFilter, setStatutFilter] = useState<'EN_ATTENTE' | 'TRAITE' | 'PATIENT_INFORME' | 'IGNORE' | ''>('EN_ATTENTE');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<TreatmentReminder | null>(null);

    // Création
    const [client, setClient] = useState<Option | null>(null);
    const [produit, setProduit] = useState<Option | null>(null);
    const [produitId, setProduitId] = useState<number | null>(null);
    const [dateDebut, setDateDebut] = useState(todayStr());
    const [mode, setMode] = useState<'duree' | 'posologie'>('duree');
    const [duree, setDuree] = useState('30');
    const [quantite, setQuantite] = useState('');
    const [doses, setDoses] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    // Réglages
    const [joursAvant, setJoursAvant] = useState(String(settings.rappel_traitement_jours_avant ?? 7));
    const [actif, setActif] = useState(settings.rappel_traitement_actif ?? true);
    useEffect(() => {
        setJoursAvant(String(settings.rappel_traitement_jours_avant ?? 7));
        setActif(settings.rappel_traitement_actif ?? true);
    }, [settings.rappel_traitement_actif, settings.rappel_traitement_jours_avant]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setRappels(await treatmentReminderService.getAll(statutFilter ? { statut: statutFilter } : {}));
        } catch {
            setError(t('rappels:errors.load'));
        } finally {
            setLoading(false);
        }
    }, [statutFilter, t]);

    useEffect(() => { load(); }, [load]);

    const dureeEffective = useMemo(() => {
        if (mode === 'duree') return parseInt(duree, 10) || 0;
        const q = parseInt(quantite, 10), d = parseFloat(doses);
        return q > 0 && d > 0 ? Math.ceil(q / d) : 0;
    }, [mode, duree, quantite, doses]);

    const finPrevue = useMemo(() => {
        if (!dateDebut || dureeEffective <= 0) return null;
        const d = new Date(dateDebut);
        d.setDate(d.getDate() + dureeEffective);
        return d.toISOString().slice(0, 10);
    }, [dateDebut, dureeEffective]);

    const searchClients = useCallback(async (q: string): Promise<Option[]> => {
        const res = await clientService.getAll({ search: q, page_size: 8 }) as { results?: Client[] } | Client[];
        const list = Array.isArray(res) ? res : (res.results ?? []);
        return list.map(c => ({ id: c.id, label: c.name, sub: c.phone }));
    }, []);

    const searchProduits = useCallback(async (q: string): Promise<Option[]> => {
        const res = await produitService.getAll({ search: q, page_size: 8 });
        return res.results.map(p => ({ id: p.id, label: p.name, sub: `Stock: ${p.total_stock ?? p.stock}` }));
    }, []);

    const resetForm = () => {
        setClient(null); setProduit(null); setProduitId(null);
        setDateDebut(todayStr()); setMode('duree'); setDuree('30');
        setQuantite(''); setDoses(''); setNotes('');
        setEditing(null);
    };

    const openEdit = (r: TreatmentReminder) => {
        setEditing(r);
        setClient({ id: r.client, label: r.client_name, sub: r.client_phone });
        setProduit(r.produit ? { id: r.produit, label: r.produit_nom } : null);
        setProduitId(r.produit);
        setDateDebut(r.date_debut);
        if (r.quantite && r.doses_par_jour) {
            setMode('posologie');
            setQuantite(String(r.quantite));
            setDoses(String(parseFloat(r.doses_par_jour)));
        } else {
            setMode('duree');
            setDuree(String(r.duree_jours));
        }
        setNotes(r.notes || '');
        setModalOpen(true);
    };

    const handleCreate = async () => {
        if (!client) { gooeyToast.error(t('rappels:errors.client_required')); return; }
        if (dureeEffective <= 0) { gooeyToast.error(t('rappels:errors.duree_required')); return; }
        setSaving(true);
        const payload = {
            client: client.id,
            produit: produitId,
            produit_nom: produit?.label ?? '',
            date_debut: dateDebut,
            ...(mode === 'posologie'
                ? { quantite: parseInt(quantite, 10), doses_par_jour: parseFloat(doses), duree_jours: null }
                : { duree_jours: dureeEffective, quantite: null, doses_par_jour: null }),
            notes,
        };
        try {
            if (editing) {
                await treatmentReminderService.update(editing.id, payload);
            } else {
                await treatmentReminderService.create(payload);
            }
            gooeyToast.success(t(editing ? 'rappels:toasts.updated' : 'rappels:toasts.created'));
            setModalOpen(false);
            resetForm();
            load();
        } catch (e) {
            gooeyToast.error(extractErrorMessage(e));
        } finally {
            setSaving(false);
        }
    };

    const handleAction = async (id: number, action: 'traiter' | 'ignorer' | 'informer') => {
        try {
            if (action === 'traiter') await treatmentReminderService.traiter(id);
            else if (action === 'informer') await treatmentReminderService.patientInforme(id);
            else await treatmentReminderService.ignorer(id);
            gooeyToast.success(t(`rappels:toasts.${action}`));
            load();
        } catch (e) {
            gooeyToast.error(extractErrorMessage(e));
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await treatmentReminderService.remove(id);
            load();
        } catch (e) {
            gooeyToast.error(extractErrorMessage(e));
        }
    };

    const handleSaveSettings = async () => {
        try {
            await updateSettings({
                rappel_traitement_actif: actif,
                rappel_traitement_jours_avant: parseInt(joursAvant, 10) || 7,
            });
            gooeyToast.success(t('rappels:toasts.settings_saved'));
        } catch (e) {
            gooeyToast.error(extractErrorMessage(e));
        }
    };

    const statutBadge = (r: TreatmentReminder) => {
        if (r.statut === 'TRAITE') return 'bg-emerald-100 text-emerald-700';
        if (r.statut === 'PATIENT_INFORME') return 'bg-blue-100 text-blue-700';
        if (r.statut === 'IGNORE') return 'bg-slate-100 text-slate-500';
        return r.jours_restants < 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
    };

    const tabs: { key: typeof statutFilter; label: string }[] = [
        { key: 'EN_ATTENTE', label: t('rappels:tabs.pending') },
        { key: 'TRAITE', label: t('rappels:tabs.to_inform') },
        { key: 'PATIENT_INFORME', label: t('rappels:tabs.informed') },
        { key: 'IGNORE', label: t('rappels:tabs.ignored') },
        { key: '', label: t('rappels:tabs.all') },
    ];

    return (
        <motion.div variants={staggerContainer} initial="hidden" animate="show"
            className="h-full min-h-0 flex flex-col bg-slate-100 p-2 lg:p-3 gap-3 font-sans overflow-hidden max-w-[1600px] mx-auto w-full">

            {/* Header */}
            <motion.div variants={fadeInUp} className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 flex flex-wrap justify-between items-center gap-3 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Pill className="size-6" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{t('rappels:title')}</h1>
                        <p className="text-caption font-medium text-slate-500 uppercase tracking-widest">{t('rappels:subtitle')}</p>
                    </div>
                </div>
                {isAdmin && (
                    <button onClick={() => setModalOpen(true)}
                        className="inline-flex items-center h-10 px-5 rounded-xl bg-emerald-600 text-white gap-2 shadow-md shadow-emerald-200 font-bold uppercase tracking-widest text-caption hover:bg-emerald-700 transition-all hover:scale-105 active:scale-95">
                        <BellPlus className="size-4" /> {t('rappels:new')}
                    </button>
                )}
            </motion.div>

            {/* Réglages (admin) */}
            {isAdmin && (
                <motion.div variants={fadeInUp} className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-4 shrink-0">
                    <div className="flex items-center gap-2 text-slate-500">
                        <Settings2 className="size-4" />
                        <span className="text-caption font-bold uppercase tracking-widest">{t('rappels:settings.title')}</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <button type="button" onClick={() => setActif(a => !a)}
                            className={`w-10 h-6 rounded-full transition-colors relative ${actif ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                            <span className={`absolute top-0.5 size-5 bg-white rounded-full shadow transition-all ${actif ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                        <span className="text-xs font-bold text-slate-600">{t('rappels:settings.enabled')}</span>
                    </label>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-600">{t('rappels:settings.days_before')}</span>
                        <input type="number" min={0} value={joursAvant} onChange={e => setJoursAvant(e.target.value)}
                            className="w-16 h-8 px-2 rounded-lg border border-slate-200 text-center text-sm font-bold text-slate-700 focus:border-emerald-500 outline-none" />
                        <span className="text-xs text-slate-400">{t('rappels:settings.days_unit')}</span>
                    </div>
                    <button onClick={handleSaveSettings}
                        className="ml-auto h-8 px-4 rounded-lg bg-slate-700 text-white text-caption font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors">
                        {t('rappels:settings.save')}
                    </button>
                </motion.div>
            )}

            {/* Filtres statut */}
            <motion.div variants={fadeInUp} className="flex gap-2 shrink-0">
                {tabs.map(tb => (
                    <button key={tb.key} onClick={() => setStatutFilter(tb.key)}
                        className={`h-9 px-4 rounded-xl text-caption font-bold uppercase tracking-widest transition-all ${
                            statutFilter === tb.key
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                                : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-700'
                        }`}>
                        {tb.label}
                    </button>
                ))}
            </motion.div>

            {/* Table */}
            <motion.div variants={fadeInUp} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-auto flex-1 min-h-0">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                        <tr>
                            {[t('rappels:table.client'), t('rappels:table.produit'), t('rappels:table.posologie'), t('rappels:table.debut'), t('rappels:table.fin'), t('rappels:table.reste'), t('rappels:table.statut'), ''].map((h, i) => (
                                <th key={i} className="px-4 py-3 text-left text-caption font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 font-medium">{t('common:loading')}</td></tr>
                        )}
                        {!loading && rappels.length === 0 && (
                            <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400 font-medium italic">{t('rappels:empty')}</td></tr>
                        )}
                        {!loading && rappels.map(r => (
                            <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                                <td className="px-4 py-3">
                                    <div className="font-bold text-slate-800">{r.client_name}</div>
                                    <div className="text-xs text-slate-400">{r.client_phone}</div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="font-medium text-slate-700">{r.produit_nom}</div>
                                    {r.produit_stock !== null && (
                                        <div className={`text-xs font-bold ${r.produit_stock <= 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                            {t('rappels:table.stock', { count: r.produit_stock })}
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                    {r.doses_par_jour && r.quantite
                                        ? `${r.quantite} × ${parseFloat(r.doses_par_jour)}${t('rappels:table.per_day')} → ${r.duree_jours}j`
                                        : `${r.duree_jours}j`}
                                </td>
                                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{new Date(r.date_debut).toLocaleDateString('fr-FR')}</td>
                                <td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">{new Date(r.date_fin_prevue).toLocaleDateString('fr-FR')}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <span className={`font-bold ${r.jours_restants < 0 ? 'text-red-600' : r.jours_restants <= 3 ? 'text-amber-600' : 'text-slate-600'}`}>
                                        {r.jours_restants < 0 ? t('rappels:table.overdue', { count: -r.jours_restants }) : t('rappels:table.days_left', { count: r.jours_restants })}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded-lg text-caption font-bold uppercase ${statutBadge(r)}`}>{r.statut_display}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    {r.statut === 'EN_ATTENTE' && isAdmin && (
                                        <div className="flex gap-1">
                                            <button onClick={() => openEdit(r)} title={t('rappels:actions.edit')}
                                                className="p-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"><Pencil className="size-4" /></button>
                                            <button onClick={() => handleAction(r.id, 'traiter')} title={t('rappels:actions.done')}
                                                className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors"><Check className="size-4" /></button>
                                            <button onClick={() => handleAction(r.id, 'ignorer')} title={t('rappels:actions.ignore')}
                                                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"><X className="size-4" /></button>
                                        </div>
                                    )}
                                    {r.statut === 'TRAITE' && isAdmin && (
                                        <div className="flex gap-1">
                                            <button onClick={() => handleAction(r.id, 'informer')} title={t('rappels:actions.informed')}
                                                className="p-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"><Phone className="size-4" /></button>
                                            <button onClick={() => handleAction(r.id, 'ignorer')} title={t('rappels:actions.ignore')}
                                                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"><X className="size-4" /></button>
                                            <button onClick={() => handleDelete(r.id)} title={t('rappels:actions.delete')}
                                                className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="size-4" /></button>
                                        </div>
                                    )}
                                    {isAdmin && r.statut !== 'EN_ATTENTE' && r.statut !== 'TRAITE' && (
                                        <button onClick={() => handleDelete(r.id)} title={t('rappels:actions.delete')}
                                            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="size-4" /></button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </motion.div>

            {error && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                    <ErrorState error={error} onRetry={load} retrying={loading} compact className="shadow-sm font-medium" />
                </div>
            )}

            {/* Modale création */}
            <PremiumModal isOpen={modalOpen} onClose={() => { setModalOpen(false); resetForm(); }} title={t(editing ? 'rappels:modal.title_edit' : 'rappels:modal.title')} maxWidth="max-w-lg">
                <div className="p-6 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-caption font-bold uppercase tracking-widest text-slate-400 ml-1">{t('rappels:modal.client')}</label>
                        <SearchPick placeholder={t('rappels:modal.client_ph')} onSearch={searchClients} onPick={setClient} selected={client} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-caption font-bold uppercase tracking-widest text-slate-400 ml-1">{t('rappels:modal.produit')}</label>
                        <SearchPick placeholder={t('rappels:modal.produit_ph')} onSearch={searchProduits}
                            onPick={o => { setProduit(o); setProduitId(o?.id ?? null); }} selected={produit} />
                    </div>
                    <div className="space-y-1.5">
                        <label htmlFor="rappel-date-debut" className="text-caption font-bold uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1.5">
                            <Calendar className="size-3" /> {t('rappels:modal.date_debut')}
                        </label>
                        <LocalizedDateInput id="rappel-date-debut" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none font-mono text-xs font-bold text-slate-700" />
                    </div>

                    {/* Mode de calcul de la durée */}
                    <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setMode('duree')}
                            className={`h-9 rounded-xl border text-caption font-bold uppercase tracking-widest transition-all ${
                                mode === 'duree' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-400'
                            }`}>{t('rappels:modal.mode_duree')}</button>
                        <button type="button" onClick={() => setMode('posologie')}
                            className={`h-9 rounded-xl border text-caption font-bold uppercase tracking-widest transition-all ${
                                mode === 'posologie' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-400'
                            }`}>{t('rappels:modal.mode_posologie')}</button>
                    </div>
                    {mode === 'duree' ? (
                        <div className="space-y-1.5">
                            <label htmlFor="rappel-duree" className="text-caption font-bold uppercase tracking-widest text-slate-400 ml-1">{t('rappels:modal.duree')}</label>
                            <input id="rappel-duree" type="number" min={1} value={duree} onChange={e => setDuree(e.target.value)}
                                className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-sm font-bold text-slate-700" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label htmlFor="rappel-quantite" className="text-caption font-bold uppercase tracking-widest text-slate-400 ml-1">{t('rappels:modal.quantite')}</label>
                                <input id="rappel-quantite" type="number" min={1} value={quantite} onChange={e => setQuantite(e.target.value)} placeholder="60"
                                    className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-sm font-bold text-slate-700" />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="rappel-doses" className="text-caption font-bold uppercase tracking-widest text-slate-400 ml-1">{t('rappels:modal.doses')}</label>
                                <input id="rappel-doses" type="number" min={0.5} step={0.5} value={doses} onChange={e => setDoses(e.target.value)} placeholder="2"
                                    className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-sm font-bold text-slate-700" />
                            </div>
                        </div>
                    )}
                    {finPrevue && (
                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-700">
                            {t('rappels:modal.fin_prevue', { date: new Date(finPrevue).toLocaleDateString('fr-FR'), jours: dureeEffective })}
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <label htmlFor="rappel-notes" className="text-caption font-bold uppercase tracking-widest text-slate-400 ml-1">{t('rappels:modal.notes')}</label>
                        <textarea id="rappel-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 outline-none text-sm text-slate-700 resize-none" />
                    </div>
                    <div className="pt-2 flex gap-3">
                        <button onClick={() => { setModalOpen(false); resetForm(); }}
                            className="flex-1 h-9 rounded-lg text-xs font-bold uppercase tracking-widest text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                            {t('common:cancel')}
                        </button>
                        <button onClick={handleCreate} disabled={saving}
                            className="flex-1 h-9 rounded-lg text-xs font-bold uppercase tracking-widest bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-50">
                            {saving ? '…' : t(editing ? 'rappels:modal.save' : 'rappels:modal.create')}
                        </button>
                    </div>
                </div>
            </PremiumModal>
        </motion.div>
    );
}

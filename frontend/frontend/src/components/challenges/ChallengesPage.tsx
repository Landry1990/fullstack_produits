import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from 'use-debounce';
import {
    Trophy,
    ChevronLeft,
    ChevronRight,
    Loader2,
    FileText,
    Search,
    Plus,
    Pencil,
    Trash2,
    BarChart3,
    Users,
    Package,
    Target,
} from 'lucide-react';
import { gooeyToast } from 'goey-toast';
import { logger } from '../../utils/logger';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { Select } from '../shadcn/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../shadcn/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '../shadcn/dialog';
import { cn } from '../../lib/utils';
import {
    useChallenges,
    useDeleteChallenge,
} from '../../hooks/useChallenges';
import type { Challenge, ChallengeListParams } from '../../types';
import ChallengeFormModal from './ChallengeFormModal';
import ChallengeClassement from './ChallengeClassement';

const PAGE_SIZE = 25;

const STATUT_BADGE_CONFIG: Record<Challenge['statut'], { className: string; dot: string }> = {
    BROU: { className: 'bg-slate-50 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
    ENC: { className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    CLO: { className: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
    ANN: { className: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
};

const STATUTS: (Challenge['statut'] | '')[] = ['', 'BROU', 'ENC', 'CLO', 'ANN'];

const ChallengesPage: React.FC = () => {
    const { t } = useTranslation(['challenges', 'common']);
    const locale = t('common:locale', { defaultValue: 'fr-FR' });

    const [statutFilter, setStatutFilter] = useState<string>('');
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch] = useDebounce(searchInput, 400);
    const [page, setPage] = useState(1);

    // Modal state
    const [formOpen, setFormOpen] = useState(false);
    const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);

    // Classement dialog state
    const [classementOpen, setClassementOpen] = useState(false);
    const [classementChallengeId, setClassementChallengeId] = useState<number | null>(null);

    // Delete confirm dialog state
    const [deleteTarget, setDeleteTarget] = useState<Challenge | null>(null);

    const queryParams = useMemo<ChallengeListParams>(() => {
        const params: ChallengeListParams = { page, page_size: PAGE_SIZE };
        if (statutFilter) params.statut = statutFilter;
        if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
        return params;
    }, [statutFilter, debouncedSearch, page]);

    const { data, isLoading } = useChallenges(queryParams);
    const deleteMutation = useDeleteChallenge();

    const challenges: Challenge[] = data?.results ?? [];
    const total: number = data?.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, total);

    const formatDate = (date: string) => {
        if (!date) return '—';
        try {
            return new Date(date).toLocaleDateString(locale);
        } catch {
            return date;
        }
    };

    const handleStatutChange = (value: string) => {
        setStatutFilter(value);
        setPage(1);
    };

    const handleSearchChange = (value: string) => {
        setSearchInput(value);
        setPage(1);
    };

    const openCreate = () => {
        setEditingChallenge(null);
        setFormOpen(true);
    };

    const openEdit = (challenge: Challenge) => {
        setEditingChallenge(challenge);
        setFormOpen(true);
    };

    const openClassement = (challenge: Challenge) => {
        setClassementChallengeId(challenge.id);
        setClassementOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteMutation.mutateAsync(deleteTarget.id);
            gooeyToast.success(t('challenges:messages.deleted'));
            setDeleteTarget(null);
        } catch (err) {
            logger.error('ChallengesPage: delete error', err);
            gooeyToast.error(t('challenges:messages.error_deleting'));
        }
    };

    const getStatutBadge = (statut: Challenge['statut']) => {
        const config = STATUT_BADGE_CONFIG[statut] ?? STATUT_BADGE_CONFIG.BROU;
        return (
            <Badge className={cn('border shadow-none font-medium gap-1.5', config.className)}>
                <span className={cn('size-1.5 rounded-full', config.dot)} />
                {t(`challenges:statuts.${statut}`)}
            </Badge>
        );
    };

    return (
        <div className="p-6 w-full h-full flex flex-col gap-4">
            {/* ── Header ── */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 w-full">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-amber-100 rounded-lg text-amber-600">
                            <Trophy className="size-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">{t('challenges:title')}</h1>
                            <p className="text-sm text-slate-500">{t('challenges:subtitle')}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                            size="sm"
                            onClick={openCreate}
                        >
                            <Plus className="size-4" />
                            {t('challenges:new')}
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 w-full">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {t('challenges:filters.search')}
                        </label>
                        <div className="relative group">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-600 transition-colors">
                                <Search className="size-4" />
                            </div>
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                placeholder={t('challenges:filters.search_placeholder')}
                                className="w-full sm:w-80 pl-10 pr-8 rounded-lg border border-slate-200 bg-slate-50/50 font-medium h-10 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                            />
                            {searchInput && (
                                <button
                                    type="button"
                                    onClick={() => handleSearchChange('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <span className="text-lg leading-none">&times;</span>
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {t('challenges:filters.statut')}
                        </label>
                        <Select
                            value={statutFilter}
                            onChange={(e) => handleStatutChange(e.target.value)}
                            className="w-full sm:w-48 text-sm h-10"
                        >
                            {STATUTS.map((s) => (
                                <option key={s || 'all'} value={s}>
                                    {s ? t(`challenges:statuts.${s}`) : t('challenges:filters.statut_all')}
                                </option>
                            ))}
                        </Select>
                    </div>
                </div>
            </div>

            {/* ── Table ── */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col w-full flex-1 min-h-0">
                <div className="overflow-x-auto w-full">
                    <Table className="w-full min-w-[1100px]">
                        <TableHeader>
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                                <TableHead className="w-[22%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    {t('challenges:table.nom')}
                                </TableHead>
                                <TableHead className="w-[16%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    {t('challenges:table.periode')}
                                </TableHead>
                                <TableHead className="w-[8%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    {t('challenges:table.statut')}
                                </TableHead>
                                <TableHead className="w-[10%] px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    {t('challenges:type_objectif')}
                                </TableHead>
                                <TableHead className="w-[9%] px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    {t('challenges:table.participants')}
                                </TableHead>
                                <TableHead className="w-[8%] px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    {t('challenges:table.produits')}
                                </TableHead>
                                <TableHead className="w-[27%] px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    {t('challenges:table.actions')}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-64 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <Loader2 className="size-8 animate-spin text-emerald-600" />
                                            <span className="text-sm">{t('challenges:loading')}</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : challenges.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                                            <div className="p-3 bg-slate-50 rounded-full">
                                                <FileText className="size-8 text-slate-300" />
                                            </div>
                                            <p className="text-sm font-medium">{t('challenges:empty')}</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                challenges.map((challenge) => (
                                    <TableRow
                                        key={challenge.id}
                                        className="hover:bg-slate-50/70 transition-colors border-b border-slate-100 last:border-0"
                                    >
                                        <TableCell className="px-4 py-3">
                                            <div className="flex flex-col gap-0.5 min-w-0">
                                                <span className="text-sm font-bold text-slate-800 truncate">
                                                    {challenge.nom}
                                                </span>
                                                {challenge.description && (
                                                    <span className="text-xs text-slate-400 truncate max-w-[280px]">
                                                        {challenge.description}
                                                    </span>
                                                )}
                                                {!challenge.is_active && (
                                                    <span className="text-[10px] text-red-500 font-bold uppercase">
                                                        {t('challenges:table.inactive')}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-sm text-slate-600">
                                            <div className="flex flex-col gap-0.5">
                                                <span>{formatDate(challenge.date_debut)}</span>
                                                <span className="text-slate-400">→ {formatDate(challenge.date_fin)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                {getStatutBadge(challenge.statut)}
                                                {challenge.is_ongoing && (
                                                    <span className="text-[10px] text-emerald-600 font-bold uppercase">
                                                        {t('challenges:table.ongoing')}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-semibold text-slate-700">
                                                    {t(`challenges:type_objectif_${(challenge.type_objectif ?? 'CA').toLowerCase()}`)}
                                                </span>
                                                {challenge.objectif_valeur != null && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-bold">
                                                        <Target className="size-3" />
                                                        {challenge.type_objectif === 'CA'
                                                            ? new Intl.NumberFormat(locale).format(challenge.objectif_valeur) + ' FCFA'
                                                            : challenge.objectif_valeur}
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    {t(`challenges:mode_${(challenge.mode ?? 'INDIVIDUEL').toLowerCase()}`)}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-center">
                                            {challenge.mode === 'EQUIPES' ? (
                                                <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700">
                                                    <Users className="size-3.5 text-slate-400" />
                                                    {challenge.equipes_count ?? 0}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700">
                                                    <Users className="size-3.5 text-slate-400" />
                                                    {challenge.all_users
                                                        ? t('challenges:table.all_users')
                                                        : challenge.participants_count}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-center">
                                            <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700">
                                                <Package className="size-3.5 text-slate-400" />
                                                {challenge.produits_count}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1.5 h-8 px-2.5"
                                                    onClick={() => openClassement(challenge)}
                                                    title={t('challenges:view_classement')}
                                                >
                                                    <BarChart3 className="size-3.5" />
                                                    <span className="hidden xl:inline">{t('challenges:view_classement')}</span>
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1.5 h-8 px-2.5"
                                                    onClick={() => openEdit(challenge)}
                                                    title={t('challenges:edit')}
                                                >
                                                    <Pencil className="size-3.5" />
                                                    <span className="hidden xl:inline">{t('challenges:edit')}</span>
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1.5 h-8 px-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                                    onClick={() => setDeleteTarget(challenge)}
                                                    title={t('challenges:delete')}
                                                >
                                                    <Trash2 className="size-3.5" />
                                                    <span className="hidden xl:inline">{t('challenges:delete')}</span>
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* ── Pagination ── */}
                {total > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                        <p className="text-xs text-slate-500">
                            {t('challenges:pagination.showing', { start, end, total })}
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                <ChevronLeft className="size-4" />
                                {t('common:previous')}
                            </Button>
                            <span className="text-xs font-bold text-slate-600 px-2">
                                {page} / {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5"
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            >
                                {t('common:next')}
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Form Modal (Create / Edit) ── */}
            <ChallengeFormModal
                isOpen={formOpen}
                onClose={() => setFormOpen(false)}
                challenge={editingChallenge}
            />

            {/* ── Classement Dialog ── */}
            <Dialog
                open={classementOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setClassementOpen(false);
                        setClassementChallengeId(null);
                    }
                }}
            >
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                                <BarChart3 className="size-5" />
                            </div>
                            <div>
                                <DialogTitle>{t('challenges:classement.title')}</DialogTitle>
                                <DialogDescription>{t('challenges:classement.subtitle')}</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    {classementChallengeId && <ChallengeClassement challengeId={classementChallengeId} />}
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirm Dialog ── */}
            <Dialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                                <Trash2 className="size-5" />
                            </div>
                            <div>
                                <DialogTitle>{t('challenges:delete')}</DialogTitle>
                                <DialogDescription>{t('challenges:confirm_delete')}</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    {deleteTarget && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                            <p className="font-bold text-slate-800">{deleteTarget.nom}</p>
                            {deleteTarget.description && (
                                <p className="text-xs text-slate-500 mt-1">{deleteTarget.description}</p>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDeleteTarget(null)}
                            disabled={deleteMutation.isPending}
                        >
                            {t('common:cancel')}
                        </Button>
                        <Button
                            type="button"
                            className="bg-red-600 hover:bg-red-700 text-white"
                            disabled={deleteMutation.isPending}
                            onClick={confirmDelete}
                        >
                            {deleteMutation.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                            {t('challenges:delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ChallengesPage;

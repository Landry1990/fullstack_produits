import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle2, Lock, Unlock, Printer, PackageX, CheckCheck } from 'lucide-react';
import type { UseAvoirsDataReturn } from '../../hooks/useAvoirsData';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../shadcn/button';
import { Badge } from '../shadcn/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../shadcn/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/Table';
import { isDraftStatus, getStatusStyle, getStatusLabel, getTypeAvoirLabel } from './utils';

interface AvoirsDetailsProps {
    data: UseAvoirsDataReturn;
}

export const AvoirsDetails: React.FC<AvoirsDetailsProps> = ({ data }) => {
    const {
        selectedAvoir,
        handleBackToList,
        handleValidate,
        handleDelete,
        handleToggleCloture,
        handleToggleAllCloture,
        handleDechargerStock,
        savingValidation
    } = data;
    const { t, i18n } = useTranslation(['stock', 'common']);

    if (!selectedAvoir) return null;

    const allLinesClosed = selectedAvoir.produits?.length > 0 && selectedAvoir.produits.every(p => p.est_cloture);
    const isDraft = isDraftStatus(selectedAvoir.status);

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-6 space-y-6">
            {/* Header / Actions */}
            <Card className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 sticky top-4 z-50">
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleBackToList}
                        className="text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                        title={t('stock:avoirs.details.back')}
                    >
                        <ArrowLeft className="size-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-bold font-mono">
                                {t('stock:avoirs.details.title', { numero: selectedAvoir.numero })}
                            </h1>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${getStatusStyle(selectedAvoir.status)}`}>
                                {getStatusLabel(selectedAvoir.status, t)}
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>{t('stock:avoirs.details.created_at', { date: format(new Date(selectedAvoir.created_at || selectedAvoir.date), 'dd/MM/yyyy HH:mm', { locale: i18n.language === 'fr' ? fr : enUS }) })}</span>
                            {selectedAvoir.created_by_name && (
                                <>
                                    <span className="size-1 rounded-full bg-gray-400" />
                                    <span>{t('stock:avoirs.details.created_by', { name: selectedAvoir.created_by_name })}</span>
                                </>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            const w = 1000, h = 800;
                            window.open(
                                `/app/print-invoice/${selectedAvoir.id}?type=AVOIR`,
                                'PrintAvoir',
                                `width=${w},height=${h},top=${(screen.height-h)/2},left=${(screen.width-w)/2},resizable=yes,scrollbars=yes`
                            );
                        }}
                        className="gap-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                    >
                        <Printer className="size-4" />
                        <span className="hidden sm:inline">{t('stock:avoirs.details.print')}</span>
                    </Button>

                    {!selectedAvoir.stock_decharge ? (
                        <Button
                            type="button"
                            size="sm"
                            className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                            onClick={() => handleDechargerStock(selectedAvoir)}
                            disabled={savingValidation}
                            title="Retirer physiquement ces quantités du stock et enregistrer les mouvements"
                        >
                            <PackageX className="size-4" />
                            Décharger Stock
                        </Button>
                    ) : (
                        <div className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
                            <CheckCheck className="size-4" />
                            Stock déchargé
                        </div>
                    )}

                    {isDraft && (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(selectedAvoir)}
                                disabled={savingValidation}
                                className="border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                            >
                                {t('stock:avoirs.details.delete')}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => handleValidate(selectedAvoir)}
                                disabled={savingValidation}
                                className="gap-2"
                            >
                                <CheckCircle2 className="size-4" />
                                {t('stock:avoirs.details.validate')}
                            </Button>
                        </>
                    )}
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Col: Info Cards */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm uppercase tracking-widest text-slate-500">
                                {t('stock:avoirs.details.fournisseur_info')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-sm text-slate-500 mb-1">{t('stock:avoirs.form.fournisseur')}</p>
                                <p className="font-bold text-lg">{selectedAvoir.fournisseur_name}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 mb-1">{t('stock:avoirs.details.type_label')}</p>
                                <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-sm font-medium border border-slate-200">
                                    {getTypeAvoirLabel(selectedAvoir.type_avoir, t)}
                                </div>
                            </div>
                            {selectedAvoir.observations && (
                                <div>
                                    <p className="text-sm text-slate-500 mb-1">{t('stock:avoirs.details.observations_label')}</p>
                                    <p className="text-sm bg-slate-100 p-3 rounded-xl border border-slate-200/50">
                                        {selectedAvoir.observations}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="flex flex-wrap items-center gap-x-8 gap-y-4 p-4 text-sm">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">{t('stock:avoirs.details.items_count')}</span>
                            <span className="font-mono font-bold text-slate-500 text-base whitespace-nowrap">
                                {selectedAvoir.produits?.length || 0}
                            </span>
                        </div>

                        <div className="flex flex-col border-l pl-5 border-slate-200">
                            <span className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">{t('stock:avoirs.details.total_qty')}</span>
                            <span className="font-mono font-bold text-slate-500 text-base whitespace-nowrap">
                                {selectedAvoir.produits?.reduce((sum, p) => sum + Number(p.quantity || 0), 0)}
                            </span>
                        </div>

                        <div className="flex flex-col border-l pl-5 border-slate-200">
                            <span className="text-[9px] font-black text-indigo-600 uppercase leading-none mb-1">{t('stock:avoirs.details.total_ht')}</span>
                            <span className="font-mono font-black text-2xl text-indigo-600 leading-none whitespace-nowrap">
                                {formatCurrency(Number(selectedAvoir.total_ht) || 0)}
                            </span>
                        </div>
                    </Card>
                </div>

                {/* Right Col: Products Table */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="overflow-hidden">
                        <CardHeader className="border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    {t('stock:avoirs.details.lines_title')}
                                    <Badge className="border-indigo-200 bg-indigo-50 text-indigo-600">
                                        {selectedAvoir.produits?.length || 0}
                                    </Badge>
                                </CardTitle>
                                <CardDescription>
                                    {t('stock:avoirs.details.lines_subtitle')}
                                </CardDescription>
                            </div>

                            <Button
                                variant={allLinesClosed ? 'outline' : 'default'}
                                onClick={handleToggleAllCloture}
                                size="sm"
                                className="gap-2 w-full sm:w-auto"
                            >
                                {allLinesClosed ? (
                                    <>
                                        <Unlock className="size-4" />
                                        {t('stock:avoirs.details.reopen_all')}
                                    </>
                                ) : (
                                    <>
                                        <Lock className="size-4" />
                                        {t('stock:avoirs.details.close_all')}
                                    </>
                                )}
                            </Button>
                        </CardHeader>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12 text-center">{t('stock:avoirs.table.status')}</TableHead>
                                        <TableHead>{t('stock:avoirs.form.table_product')}</TableHead>
                                        <TableHead>{t('stock:avoirs.form.table_lot')}</TableHead>
                                        <TableHead>{t('stock:avoirs.form.table_motif', { defaultValue: 'Motif' })}</TableHead>
                                        <TableHead className="text-center">{t('stock:avoirs.form.table_qty')}</TableHead>
                                        <TableHead className="text-right">{t('stock:avoirs.form.table_price')}</TableHead>
                                        <TableHead className="text-right">{t('stock:avoirs.form.table_total')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedAvoir.produits?.map((ligne, idx) => (
                                        <TableRow key={ligne.id || idx}>
                                            <TableCell className="text-center">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleToggleCloture(ligne.id, ligne.est_cloture)}
                                                    className={`size-8 rounded-full transition-colors ${ligne.est_cloture ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
                                                    title={ligne.est_cloture ? t('stock:avoirs.details.reopen_line') : t('stock:avoirs.details.close_line')}
                                                >
                                                    {ligne.est_cloture ? <Lock className="size-4" /> : <Unlock className="size-4" />}
                                                </Button>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-bold text-slate-700">{ligne.produit_nom}</div>
                                                <div className="text-xs text-slate-500 font-mono mt-0.5">{ligne.produit_cip}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-mono text-xs bg-slate-100 px-2 py-1 rounded w-fit mb-1 font-bold text-slate-600">
                                                    {ligne.lot || t('stock:avoirs.form.no_lot')}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    {ligne.date_expiration ? format(new Date(ligne.date_expiration), 'dd/MM/yyyy', { locale: i18n.language === 'fr' ? fr : enUS }) : t('stock:avoirs.form.no_date')}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {ligne.motif ? (
                                                    <span className="inline-block text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">{ligne.motif}</span>
                                                ) : (
                                                    <span className="text-xs text-slate-300 italic">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className="font-bold text-base bg-slate-100 text-slate-700 px-3 py-1 rounded-lg">
                                                    {ligne.quantity}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-slate-700">
                                                {formatCurrency(Number(ligne.price || 0))}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-indigo-600 font-mono">
                                                {formatCurrency(Number(ligne.total || (Number(ligne.quantity) * Number(ligne.price))))}
                                            </TableCell>
                                        </TableRow>
                                    ))}

                                    {(!selectedAvoir.produits || selectedAvoir.produits.length === 0) && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                                                {t('stock:avoirs.details.no_lines')}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

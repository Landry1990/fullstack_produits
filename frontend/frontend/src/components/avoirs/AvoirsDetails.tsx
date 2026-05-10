import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle2, Lock, Unlock, Printer } from 'lucide-react';
import type { UseAvoirsDataReturn } from '../../hooks/useAvoirsData';
import { formatCurrency } from '../../utils/formatters';

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
        savingValidation
    } = data;
    const { t, i18n } = useTranslation(['stock', 'common']);

    if (!selectedAvoir) return null;

    const allLinesClosed = selectedAvoir.produits?.length > 0 && selectedAvoir.produits.every(p => p.est_cloture);

    const getStatusStyle = (status: string) => {
        switch (status?.toUpperCase()) {
            case 'BROUILLON':
            case 'BRO': return 'bg-warning/10 text-warning border-warning/20';
            case 'VAL':
            case 'VALIDE':
            case 'VALIDÉ':
            case 'VALIDEE':
            case 'VALIDÉE': return 'bg-success/10 text-success border-success/20';
            default: return 'bg-base-200 text-base-content/60 border-base-300';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status?.toUpperCase()) {
            case 'BROUILLON':
            case 'BRO': return t('stock:avoirs.statuses.brouillon', 'Brouillon');
            case 'VAL':
            case 'VALIDE':
            case 'VALIDÉ':
            case 'VALIDEE':
            case 'VALIDÉE': return t('stock:avoirs.statuses.valide', 'Validé');
            default: return status;
        }
    };

    const getTypeAvoirLabel = (type: string) => {
        switch (type?.toUpperCase()) {
            case 'PERIME':
            case 'PÉRIMÉ': return t('stock:avoirs.types.perime', 'Périmé');
            case 'CASSE':
            case 'CASSÉ': return t('stock:avoirs.types.casse', 'Cassé');
            case 'ERREUR_LIVRAISON': 
            case 'ERREUR': return t('stock:avoirs.types.erreur_livraison', 'Erreur Livraison');
            case 'AVARIE': return t('stock:avoirs.types.avarie', 'Avarie');
            case 'NON_FACTURE': return t('stock:avoirs.types.non_facture', 'Non Facturé');
            case 'AUTRE': return t('stock:avoirs.types.autre', 'Autre');
            default: return type;
        }
    };

    return (
        <div className="min-h-screen bg-base-200 p-4 md:p-6 space-y-6">
            
            {/* Header / Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-base-100 p-4 rounded-2xl shadow-sm border border-base-300 sticky top-4 z-50">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleBackToList}
                        className="btn btn-circle btn-ghost btn-sm"
                        title={t('stock:avoirs.details.back')}
                    >
                        <ArrowLeft className="size-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-bold font-mono">
                                {t('stock:avoirs.details.title', { numero: selectedAvoir.numero })}
                            </h1>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${getStatusStyle(selectedAvoir.status)}`}>
                                {getStatusLabel(selectedAvoir.status)}
                            </span>
                        </div>
                        <p className="text-sm text-base-content/60 mt-0.5 flex items-center gap-2">
                            <span>{t('stock:avoirs.details.created_at', { date: format(new Date(selectedAvoir.created_at || selectedAvoir.date), 'dd/MM/yyyy HH:mm', { locale: i18n.language === 'fr' ? fr : enUS }) })}</span>
                            {selectedAvoir.created_by_name && (
                                <>
                                    <span className="size-1 rounded-full bg-base-content/30" />
                                    <span>{t('stock:avoirs.details.created_by', { name: selectedAvoir.created_by_name })}</span>
                                </>
                            )}
                        </p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button 
                        onClick={() => window.print()} 
                        className="btn btn-ghost flex-1 sm:flex-none gap-2"
                    >
                        <Printer className="size-4" />
                        <span className="hidden sm:inline">{t('stock:avoirs.details.print')}</span>
                    </button>

                    {(selectedAvoir.status?.toUpperCase() === 'BROUILLON' || selectedAvoir.status?.toUpperCase() === 'BRO') && (
                        <>
                            <button 
                                className="btn btn-error btn-outline flex-1 sm:flex-none"
                                onClick={() => handleDelete(selectedAvoir)}
                                disabled={savingValidation}
                            >
                                {t('stock:avoirs.details.delete')}
                            </button>
                            <button 
                                className="btn btn-success flex-1 sm:flex-none gap-2 text-white shadow-sm"
                                onClick={() => handleValidate(selectedAvoir)}
                                disabled={savingValidation}
                            >
                                <CheckCircle2 className="size-4" />
                                {t('stock:avoirs.details.validate')}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Col: Info Cards */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Fournisseur Info */}
                    <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-5">
                        <h2 className="text-sm font-bold text-base-content/50 uppercase tracking-widest mb-4">
                            {t('stock:avoirs.details.fournisseur_info')}
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-base-content/60 mb-1">{t('stock:avoirs.form.fournisseur')}</p>
                                <p className="font-bold text-lg">{selectedAvoir.fournisseur_name}</p>
                            </div>
                            <div>
                                <p className="text-sm text-base-content/60 mb-1">{t('stock:avoirs.details.type_label')}</p>
                                <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-base-200 text-base-content/70 text-sm font-medium border border-base-300">
                                    {getTypeAvoirLabel(selectedAvoir.type_avoir)}
                                </div>
                            </div>
                            {selectedAvoir.observations && (
                                <div>
                                    <p className="text-sm text-base-content/60 mb-1">{t('stock:avoirs.details.observations_label')}</p>
                                    <p className="text-sm bg-base-200/50 p-3 rounded-xl border border-base-200/50">
                                        {selectedAvoir.observations}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-3 bg-base-100 rounded-2xl shadow-sm border border-base-300 p-4 flex flex-wrap items-center gap-x-8 gap-y-4 text-sm">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-base-content/40 uppercase leading-none mb-1">{t('stock:avoirs.details.items_count')}</span>
                            <span className="font-mono font-bold text-base-content/80 text-base whitespace-nowrap">
                                {selectedAvoir.produits?.length || 0}
                            </span>
                        </div>
                        
                        <div className="flex flex-col border-l pl-5 border-base-200">
                            <span className="text-[9px] font-bold text-base-content/40 uppercase leading-none mb-1">{t('stock:avoirs.details.total_qty')}</span>
                            <span className="font-mono font-bold text-base-content/80 text-base whitespace-nowrap">
                                {selectedAvoir.produits?.reduce((sum, p) => sum + Number(p.quantity || 0), 0)}
                            </span>
                        </div>

                        <div className="flex flex-col border-l pl-5 border-base-200">
                            <span className="text-[9px] font-black text-primary uppercase leading-none mb-1">{t('stock:avoirs.details.total_ht')}</span>
                            <span className="font-mono font-black text-2xl text-primary leading-none whitespace-nowrap">
                                {formatCurrency(Number(selectedAvoir.total_ht) || 0)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Col: Products Table */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden">
                        
                        <div className="p-4 sm:p-5 border-b border-base-200 bg-base-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    {t('stock:avoirs.details.lines_title')}
                                    <span className="badge badge-primary badge-sm">
                                        {selectedAvoir.produits?.length || 0}
                                    </span>
                                </h3>
                                <p className="text-sm text-base-content/60 mt-0.5">
                                    {t('stock:avoirs.details.lines_subtitle')}
                                </p>
                            </div>
                            
                            <button 
                                onClick={handleToggleAllCloture}
                                className={`btn btn-sm gap-2 w-full sm:w-auto ${allLinesClosed ? 'btn-outline' : 'btn-neutral'}`}
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
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="table w-full text-sm">
                                <thead className="bg-base-200/50">
                                    <tr>
                                        <th className="w-12 text-center">{t('stock:avoirs.table.status')}</th>
                                        <th>{t('stock:avoirs.form.table_product')}</th>
                                        <th>{t('stock:avoirs.form.table_lot')}</th>
                                        <th className="text-center">{t('stock:avoirs.form.table_qty')}</th>
                                        <th className="text-right">{t('stock:avoirs.form.table_price')}</th>
                                        <th className="text-right">{t('stock:avoirs.form.table_total')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedAvoir.produits?.map((ligne, idx) => (
                                        <tr key={ligne.id || idx} className="hover:bg-base-50 transition-colors group">
                                            <td className="text-center">
                                                <button 
                                                    onClick={() => handleToggleCloture(ligne.id, ligne.est_cloture)}
                                                    className={`btn btn-ghost btn-circle btn-sm ${ligne.est_cloture ? 'text-success hover:bg-success/10' : 'text-base-content/30 hover:bg-base-content/10'}`}
                                                    title={ligne.est_cloture ? t('stock:avoirs.details.reopen_line') : t('stock:avoirs.details.close_line')}
                                                >
                                                    {ligne.est_cloture ? <Lock className="size-4" /> : <Unlock className="size-4" />}
                                                </button>
                                            </td>
                                            <td>
                                                <div className="font-bold">{ligne.produit_nom}</div>
                                                <div className="text-xs text-base-content/60 font-mono mt-0.5">{ligne.produit_cip}</div>
                                            </td>
                                            <td>
                                                <div className="font-mono text-xs bg-base-200 px-2 py-1 rounded w-fit mb-1 font-bold">
                                                    {ligne.lot || t('stock:avoirs.form.no_lot')}
                                                </div>
                                                <div className="text-xs text-base-content/60">
                                                    {ligne.date_expiration ? format(new Date(ligne.date_expiration), 'dd/MM/yyyy', { locale: i18n.language === 'fr' ? fr : enUS }) : t('stock:avoirs.form.no_date')}
                                                </div>
                                            </td>
                                            <td className="text-center">
                                                <span className="font-bold text-base bg-base-200 px-3 py-1 rounded-lg">
                                                    {ligne.quantity}
                                                </span>
                                            </td>
                                            <td className="text-right font-mono">
                                                {formatCurrency(Number(ligne.price || 0))}
                                            </td>
                                            <td className="text-right font-bold text-primary font-mono">
                                                {formatCurrency(Number(ligne.total || (Number(ligne.quantity) * Number(ligne.price))))}
                                            </td>
                                        </tr>
                                    ))}
                                    
                                    {(!selectedAvoir.produits || selectedAvoir.produits.length === 0) && (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-base-content/50">
                                                {t('stock:avoirs.details.no_lines')}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
            </div>
        </div>
    );
};

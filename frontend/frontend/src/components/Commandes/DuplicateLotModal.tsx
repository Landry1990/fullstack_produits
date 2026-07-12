import { AlertTriangle, PackagePlus, Plus, X } from 'lucide-react';
import type { ProduitModel, CommandeProduit } from '../../types';

interface DuplicateLotModalProps {
    isOpen: boolean;
    product: ProduitModel | null;
    existingLines: CommandeProduit[];
    onAddNewLine: () => void;
    onIncrementExisting: (index: number) => void;
    onCancel: () => void;
}

function getProductName(cp: CommandeProduit): string {
    if (typeof cp.produit === 'object' && cp.produit !== null) return cp.produit.name;
    return cp.produit_nom || `Produit #${cp.produit}`;
}

export default function DuplicateLotModal({
    isOpen,
    product,
    existingLines,
    onAddNewLine,
    onIncrementExisting,
    onCancel,
}: DuplicateLotModalProps) {
    if (!isOpen || !product) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-amber-50">
                    <div className="p-2 rounded-full bg-amber-100">
                        <AlertTriangle className="size-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 text-sm">Produit déjà dans la commande</h3>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{product.name}</p>
                    </div>
                    <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
                        <X className="size-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-3">
                    <p className="text-sm text-slate-600">
                        Ce produit est déjà saisi{existingLines.length > 1 ? ` (${existingLines.length} lignes)` : ''}. 
                        Que souhaitez-vous faire ?
                    </p>

                    {/* Lignes existantes */}
                    <div className="space-y-2">
                        {existingLines.map((line, i) => (
                            <button
                                key={line.id}
                                onClick={() => onIncrementExisting(i)}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition-colors text-left group"
                            >
                                <Plus className="size-4 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium text-slate-700">
                                        Incrémenter — Ligne {existingLines.length > 1 ? i + 1 : 'existante'}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5 flex gap-3">
                                        <span>Qté : <strong>{line.quantity}</strong></span>
                                        {line.lot && <span>Lot : <strong>{line.lot}</strong></span>}
                                        {line.date_expiration && <span>Exp : <strong>{line.date_expiration}</strong></span>}
                                        {!line.lot && !line.date_expiration && <span className="italic">Lot non encore saisi</span>}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Nouveau lot */}
                    <button
                        onClick={onAddNewLine}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-left group"
                    >
                        <PackagePlus className="size-4 text-indigo-400 group-hover:text-indigo-600 shrink-0" />
                        <div>
                            <div className="text-xs font-medium text-indigo-700">Ajouter une nouvelle ligne</div>
                            <div className="text-xs text-slate-400 mt-0.5">Lot différent livré par le fournisseur</div>
                        </div>
                    </button>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={onCancel}
                        className="text-sm text-slate-500 hover:text-slate-700 px-4 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        Annuler
                    </button>
                </div>
            </div>
        </div>
    );
}

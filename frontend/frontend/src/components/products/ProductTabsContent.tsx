import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ProduitModel, StockLot } from '../../types';

interface ProductTabsContentProps {
  selectedProduit: ProduitModel;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  lots: StockLot[];
  monthlyStats: any[];
  stockHistory: any[];
  loadingHistory: boolean;
  onMovementClick: (item: any) => void;
}

export const ProductTabsContent: React.FC<ProductTabsContentProps> = ({
  selectedProduit,
  activeTab,
  setActiveTab,
  lots,
  monthlyStats,
  stockHistory,
  loadingHistory,
  onMovementClick
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-full">
      {/* Onglets */}
      <div role="tablist" className="tabs tabs-boxed bg-slate-100 rounded-none px-4 pt-2 shrink-0">
        {[
          { id: 'general', label: t('products.detail.tabs.general') },
          { id: 'prix', label: t('products.detail.tabs.price') },
          { id: 'lots', label: t('products.detail.tabs.lots') },
          { id: 'stats', label: t('products.detail.tabs.stats') },
          { id: 'mvmts', label: `📜 MVMTS` }
        ].map((tab) => (
          <a 
            key={tab.id}
            role="tab" 
            className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`} 
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </a>
        ))}
      </div>

      {/* Contenu des onglets */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'general' && (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <tbody>
                <tr>
                  <td className="font-semibold w-1/3">{t('products.detail.general.description')}</td>
                  <td className="uppercase">{selectedProduit.description || '-'}</td>
                </tr>
                <tr>
                  <td className="font-semibold">{t('products.detail.general.rayon')}</td>
                  <td><span className="badge badge-outline badge-sm">{selectedProduit.rayon_name || '-'}</span></td>
                </tr>
                <tr>
                  <td className="font-semibold">{t('products.detail.general.provider')}</td>
                  <td><span className="badge badge-ghost badge-sm">{selectedProduit.fournisseur_name || '-'}</span></td>
                </tr>
                <tr>
                  <td className="font-semibold">{t('products.detail.general.min_max')}</td>
                  <td>{selectedProduit.stock_minimum ?? 0} / {selectedProduit.stock_maximum ?? 0}</td>
                </tr>
                <tr>
                  <td className="font-semibold">{t('products.detail.general.alert_threshold')}</td>
                  <td><span className="badge badge-warning badge-sm">{selectedProduit.stock_alert ?? 0}</span></td>
                </tr>
                <tr>
                  <td className="font-semibold">{t('products.detail.general.expiration')}</td>
                  <td>{selectedProduit.expire_date ? (() => {
                    const d = new Date(selectedProduit.expire_date);
                    return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear().toString().slice(-2)}`;
                  })() : '-'}</td>
                </tr>
                <tr>
                  <td className="font-semibold">{t('products.detail.general.last_purchase')}</td>
                  <td>{selectedProduit.dernier_achat ? new Date(selectedProduit.dernier_achat).toLocaleDateString('fr-FR') : '-'}</td>
                </tr>
                <tr>
                  <td className="font-semibold">{t('products.detail.general.last_sale')}</td>
                  <td>{selectedProduit.dernier_vente ? new Date(selectedProduit.dernier_vente).toLocaleDateString('fr-FR') : '-'}</td>
                </tr>
                <tr>
                  <td className="font-semibold">{t('products.detail.general.lot_management')}</td>
                  <td>{selectedProduit.use_lot_management ? `✅ ${t('products.detail.general.enabled')}` : `❌ ${t('products.detail.general.disabled')}`}</td>
                </tr>
                <tr>
                  <td className="font-semibold">{t('products.detail.general.prescription')}</td>
                  <td>{selectedProduit.requires_prescription ? `✅ ${t('products.detail.general.yes')}` : `❌ ${t('products.detail.general.no')}`}</td>
                </tr>
                <tr>
                  <td className="font-semibold">{t('products.detail.general.surveillance')}</td>
                  <td>{selectedProduit.surveillance_category === 'NONE' ? '-' : selectedProduit.surveillance_category}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'prix' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="stat bg-base-200/30 rounded-xl border border-base-200 p-4">
              <div className="stat-title text-sm">{t('products.detail.price.cost')}</div>
              <div className="stat-value text-blue-600 text-xl">{Math.round(Number(selectedProduit.cost_price || 0)).toLocaleString('fr-FR')} F</div>
            </div>
            <div className="stat bg-primary text-primary-content rounded-xl p-4">
              <div className="stat-title text-primary-content/80 text-sm">{t('products.detail.price.selling')}</div>
              <div className="stat-value text-xl">{Math.round(Number(selectedProduit.selling_price || 0)).toLocaleString('fr-FR')} F</div>
            </div>
            <div className="stat bg-base-200/30 rounded-xl border border-base-200 p-4">
              <div className="stat-title text-sm">{t('products.detail.price.vat')}</div>
              <div className="stat-value text-lg">{selectedProduit.tva || '19.25'}%</div>
            </div>
            <div className="stat bg-base-200/30 rounded-xl border border-base-200 p-4">
              <div className="stat-title text-sm">{t('products.detail.price.margin_percent')}</div>
              <div className="stat-value text-lg">{Number(selectedProduit.pourcentage_marge || 0).toFixed(2)}%</div>
            </div>
            <div className="stat bg-base-200/30 rounded-xl border border-base-200 p-4">
              <div className="stat-title text-sm">{t('products.detail.price.margin_coeff')}</div>
              <div className="stat-value text-lg">{Number(selectedProduit.taux_marge || 0).toFixed(2)}</div>
            </div>
            <div className="stat bg-base-200/30 rounded-xl border border-base-200 p-4">
              <div className="stat-title text-sm">{t('products.detail.price.rotation')}</div>
              <div className="stat-value text-lg">{Number(selectedProduit.rotation_moyenne || 0).toFixed(2)}<span className="text-sm"> {t('products.detail.price.per_month')}</span></div>
            </div>
          </div>
        )}

        {activeTab === 'lots' && propsTabsContentLots(lots)}

        {activeTab === 'stats' && propsTabsContentStats(monthlyStats, t)}

        {activeTab === 'mvmts' && propsTabsContentMovements(stockHistory, loadingHistory, onMovementClick)}
      </div>
    </div>
  );
};

// Helper components to keep the main one cleaner

const propsTabsContentLots = (lots: StockLot[]) => {
    if (!lots || lots.length === 0) return <p className="text-center text-base-content/50 py-8">Aucun lot en stock pour ce produit</p>;

    return (
        <div className="overflow-x-auto">
            <table className="table table-sm">
                <thead className="bg-base-200 sticky top-0">
                    <tr>
                        <th className="text-xs">Date Réception</th>
                        <th className="text-xs">Numéro de Lot</th>
                        <th className="text-xs">Expiration</th>
                        <th className="text-xs">Fournisseur</th>
                        <th className="text-xs text-right">Qté Initiale</th>
                        <th className="text-xs text-right">Qté Restante</th>
                    </tr>
                </thead>
                <tbody>
                    {lots.map((lot) => {
                        const isExpired = lot.date_expiration ? new Date(lot.date_expiration) < new Date() : false;
                        return (
                            <tr key={lot.id} className="hover:bg-base-200/50 transition-colors">
                                <td className="text-xs font-mono">{new Date(lot.date_reception).toLocaleDateString('fr-FR')}</td>
                                <td>
                                    <span className="badge badge-outline badge-xs font-mono">{lot.lot || '-'}</span>
                                </td>
                                <td>
                                    <span className={`text-xs font-bold ${isExpired ? 'text-error' : ''}`}>
                                        {lot.date_expiration ? new Date(lot.date_expiration).toLocaleDateString('fr-FR') : '-'}
                                    </span>
                                </td>
                                <td className="text-xs truncate max-w-[120px]" title={lot.fournisseur_nom}>{lot.fournisseur_nom}</td>
                                <td className="text-right text-xs">{lot.quantity_initial}</td>
                                <td className="text-right font-bold text-xs">
                                    <span className={lot.quantity_remaining > 0 ? 'text-success' : 'text-base-content/30'}>
                                        {lot.quantity_remaining}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
const propsTabsContentStats = (monthlyStats: any[], t: any) => {
    if (monthlyStats.length === 0) return <p className="text-center text-base-content/50 py-4">{t('products.detail.stats.empty')}</p>;

    let currentYear: number | null = null;
    return (
        <div className="overflow-x-auto max-h-80">
            <table className="table table-sm w-full">
                <thead className="bg-base-200 sticky top-0">
                    <tr>
                    <th className="text-xs uppercase whitespace-nowrap"></th>
                    <th className="text-xs uppercase whitespace-nowrap">{t('products.detail.stats.month')}</th>
                    <th className="text-xs uppercase text-right text-primary whitespace-nowrap">{t('products.detail.stats.qty_sold')}</th>
                    <th className="text-xs uppercase text-right text-warning whitespace-nowrap">{t('products.detail.stats.qty_ordered')}</th>
                    <th className="text-xs uppercase text-right text-info whitespace-nowrap">{t('products.detail.stats.nb_clients')}</th>
                    </tr>
                </thead>
                <tbody>
                    {(monthlyStats || []).map((stat, index) => {
                        const showYear = stat.year !== currentYear;
                        currentYear = stat.year;
                        return (
                            <tr key={index} className={showYear ? 'border-t-2 border-base-300' : ''}>
                                <td className="font-bold text-base-content/60">
                                    {showYear ? stat.year : ''}
                                </td>
                                <td>{stat.month_name}</td>
                                <td className="text-right font-mono font-bold text-primary">{stat.qte_v}</td>
                                <td className="text-right font-mono text-warning">{stat.qte_c}</td>
                                <td className="text-right font-mono text-info">{stat.nb_c}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <div className="mt-2 text-[10px] text-base-content/50 flex justify-around">
                <span>V = Vendue</span>
                <span>C = Commandée</span>
                <span>Nb = Nombre</span>
            </div>
        </div>
    );
};

const propsTabsContentMovements = (stockHistory: any[], loadingHistory: boolean, onMovementClick: (item: any) => void) => {
    if (loadingHistory) return (
        <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg"></span>
        </div>
    );

    if (!stockHistory || stockHistory.length === 0) return <p className="text-center text-base-content/50 py-8">Aucun mouvement de stock enregistré</p>;

    return (
        <div className="overflow-x-auto">
            <table className="table table-sm">
                <thead className="bg-base-200 sticky top-0">
                    <tr>
                        <th className="text-xs">Date</th>
                        <th className="text-xs">Type</th>
                        <th className="text-xs">Libellé</th>
                        <th className="text-xs">Opérateur</th>
                        <th className="text-xs text-right">Avant</th>
                        <th className="text-xs text-right">Qté</th>
                        <th className="text-xs text-right">Après</th>
                    </tr>
                </thead>
                <tbody>
                    {(stockHistory || []).map((item, index) => {
                        const isPositive = item.type === 'AJUSTEMENT' 
                            ? item.quantity > 0 
                            : ['ENTREE', 'RETOUR', 'TRANSFORMATION_ENTREE'].includes(item.type);
                        return (
                            <tr 
                                key={index} 
                                className={`hover:bg-base-200/50 transition-colors ${(item.facture || item.commande) ? 'cursor-pointer' : ''}`}
                                onClick={() => onMovementClick(item)}
                            >
                                <td className="whitespace-nowrap text-xs font-mono">
                                    {new Date(item.date).toLocaleDateString('fr-FR')}
                                </td>
                                <td>
                                    <span className={`badge badge-xs font-medium ${
                                        item.type === 'AJUSTEMENT' 
                                            ? 'badge-warning text-warning-content'
                                            : isPositive ? 'badge-success text-white' : 'badge-error text-white'
                                    }`}>
                                        {item.type}
                                    </span>
                                </td>
                                <td className="max-w-[200px] truncate text-xs" title={item.libelle}>
                                    <div className="flex items-center gap-1">
                                        {(item.facture || item.commande) && (
                                            <span className="text-primary" title={item.facture ? "Cliquez pour voir la facture" : "Cliquez pour voir la commande"}>🔍</span>
                                        )}
                                        {item.libelle}
                                        {item.commande_numero && (
                                            <span className="badge badge-ghost badge-xs font-mono ml-auto">
                                                {item.commande_numero}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="text-xs">{item.user || item.user_nom || '-'}</td>
                                <td className="text-right font-mono text-xs">{item.stock_avant}</td>
                                <td className={`text-right font-bold text-xs ${isPositive ? 'text-success' : 'text-error'}`}>
                                    {isPositive ? '+' : ''}{item.quantity}
                                </td>
                                <td className="text-right font-mono font-bold text-xs">{item.stock_apres}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

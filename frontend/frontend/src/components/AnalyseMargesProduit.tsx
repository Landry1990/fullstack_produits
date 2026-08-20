import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown, AlertTriangle, Percent, DollarSign, Tag } from 'lucide-react';
import { useMargeParProduit, useImpactPromotions } from '../hooks/useFinanceStats';
import { formatCurrency } from '../utils/formatters';
import { Select } from './ui/Select';
import { Badge } from './shadcn/badge';
import { Loader2 } from 'lucide-react';

const fmt = (v: number | undefined | null) => formatCurrency(Math.round(v || 0));

type Periode = 'mois' | 'trimestre' | 'annee';

export default function AnalyseMargesProduit() {
  const { t } = useTranslation(['finance', 'common']);
  const [periode, setPeriode] = useState<Periode>('mois');
  const [activeTab, setActiveTab] = useState<'top' | 'bottom' | 'negative' | 'promotions'>('top');

  const { data: margeData, isLoading: loadingMarge } = useMargeParProduit(periode);
  const { data: promoData, isLoading: loadingPromo } = useImpactPromotions(periode);

  const tabs = [
    { id: 'top' as const, label: t('marge_produit.top_20', 'Top 20 (Marge)'), icon: <TrendingUp size={16} /> },
    { id: 'bottom' as const, label: t('marge_produit.bottom_20', 'Bottom 20 (Marge)'), icon: <TrendingDown size={16} /> },
    { id: 'negative' as const, label: t('marge_produit.negative', 'Marge Négative'), icon: <AlertTriangle size={16} /> },
    { id: 'promotions' as const, label: t('marge_produit.promotions', 'Impact Promotions'), icon: <Tag size={16} /> },
  ];

  const currentData = activeTab === 'top' ? margeData?.top_20
    : activeTab === 'bottom' ? margeData?.bottom_20
    : activeTab === 'negative' ? margeData?.negative_margin
    : [];

  return (
    <div className="space-y-6">
      {/* Header avec sélecteur de période */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('marge_produit.title', 'Analyse Marges par Produit')}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('marge_produit.subtitle', 'Top/bottom produits par marge, produits à perte et impact promotions')}
          </p>
        </div>
        <Select
          size="sm"
          value={periode}
          onChange={(e) => setPeriode(e.target.value as Periode)}
        >
          <option value="mois">{t('common:period.month', 'Ce mois')}</option>
          <option value="trimestre">{t('common:period.quarter', 'Trimestre')}</option>
          <option value="annee">{t('common:period.year', 'Année')}</option>
        </Select>
      </div>

      {/* KPIs résumés */}
      {margeData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
              <DollarSign size={14} />
              {t('marge_produit.total_ca', 'CA Total')}
            </div>
            <div className="text-xl font-black text-slate-800">{fmt(margeData.total_ca)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold uppercase tracking-wider mb-1">
              <TrendingUp size={14} />
              {t('marge_produit.total_marge', 'Marge Totale')}
            </div>
            <div className="text-xl font-black text-emerald-600">{fmt(margeData.total_marge)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-blue-500 text-xs font-bold uppercase tracking-wider mb-1">
              <Percent size={14} />
              {t('marge_produit.taux_marge_global', 'Taux Marge Global')}
            </div>
            <div className="text-xl font-black text-blue-600">
              {margeData.total_ca > 0 ? ((margeData.total_marge / margeData.total_ca) * 100).toFixed(1) : 0}%
            </div>
          </div>
          <div className={`rounded-xl shadow-sm border p-4 ${margeData.negative_margin.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
            <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-1 ${margeData.negative_margin.length > 0 ? 'text-red-500' : 'text-slate-400'}`}>
              <AlertTriangle size={14} />
              {t('marge_produit.produits_perte', 'Produits à Perte')}
            </div>
            <div className={`text-xl font-black ${margeData.negative_margin.length > 0 ? 'text-red-600' : 'text-slate-800'}`}>
              {margeData.negative_margin.length}
            </div>
          </div>
        </div>
      )}

      {/* Onglets */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'negative' && margeData && margeData.negative_margin.length > 0 && (
                <Badge variant="destructive" className="text-[10px] ml-1">
                  {margeData.negative_margin.length}
                </Badge>
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Onglet Promotions */}
          {activeTab === 'promotions' ? (
            loadingPromo ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="size-8 animate-spin text-slate-400" />
              </div>
            ) : promoData ? (
              <div className="space-y-6">
                {/* Comparaison CA */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Avec promotion */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Tag className="size-5 text-amber-600" />
                      <h3 className="font-bold text-amber-800">{t('marge_produit.avec_promo', 'Avec Promotion')}</h3>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{t('marge_produit.ca', 'CA')}</span>
                        <span className="font-bold text-slate-800">{fmt(promoData.avec_promotion.ca)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{t('marge_produit.marge', 'Marge')}</span>
                        <span className="font-bold text-emerald-600">{fmt(promoData.avec_promotion.marge)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{t('marge_produit.taux_marge', 'Taux marge')}</span>
                        <span className="font-bold text-amber-600">{promoData.avec_promotion.taux_marge}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{t('marge_produit.pct_ca', '% du CA')}</span>
                        <span className="font-bold text-slate-800">{promoData.avec_promotion.pct_ca}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{t('marge_produit.quantite', 'Quantité')}</span>
                        <span className="font-bold text-slate-800">{promoData.avec_promotion.quantite}</span>
                      </div>
                    </div>
                  </div>

                  {/* Sans promotion */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="size-5 text-emerald-600" />
                      <h3 className="font-bold text-emerald-800">{t('marge_produit.sans_promo', 'Sans Promotion')}</h3>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{t('marge_produit.ca', 'CA')}</span>
                        <span className="font-bold text-slate-800">{fmt(promoData.sans_promotion.ca)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{t('marge_produit.marge', 'Marge')}</span>
                        <span className="font-bold text-emerald-600">{fmt(promoData.sans_promotion.marge)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{t('marge_produit.taux_marge', 'Taux marge')}</span>
                        <span className="font-bold text-emerald-600">{promoData.sans_promotion.taux_marge}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{t('marge_produit.pct_ca', '% du CA')}</span>
                        <span className="font-bold text-slate-800">{promoData.sans_promotion.pct_ca}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{t('marge_produit.quantite', 'Quantité')}</span>
                        <span className="font-bold text-slate-800">{promoData.sans_promotion.quantite}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Résumé impact */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                    <div className="text-xs font-bold uppercase tracking-wider text-red-500 mb-1">
                      {t('marge_produit.ca_perdu', 'CA Perdu (Remises)')}
                    </div>
                    <div className="text-2xl font-black text-red-600">{fmt(promoData.ca_perdu_remises)}</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                    <div className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-1">
                      {t('marge_produit.ecart_taux_marge', 'Écart Taux Marge')}
                    </div>
                    <div className="text-2xl font-black text-blue-600">
                      {promoData.ecart_taux_marge > 0 ? '+' : ''}{promoData.ecart_taux_marge}%
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {t('marge_produit.ecart_hint', 'Sans promo - Avec promo')}
                    </div>
                  </div>
                  <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-center">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      {t('marge_produit.total_ca', 'CA Total')}
                    </div>
                    <div className="text-2xl font-black text-slate-800">{fmt(promoData.total_ca)}</div>
                  </div>
                </div>

                {/* Barre comparative visuelle */}
                {promoData.total_ca > 0 && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                      {t('marge_produit.repartition_ca', 'Répartition du CA')}
                    </div>
                    <div className="flex h-8 rounded-lg overflow-hidden">
                      <div
                        className="bg-amber-400 flex items-center justify-center text-xs font-bold text-white"
                        style={{ width: `${promoData.avec_promotion.pct_ca}%` }}
                      >
                        {promoData.avec_promotion.pct_ca}%
                      </div>
                      <div
                        className="bg-emerald-500 flex items-center justify-center text-xs font-bold text-white"
                        style={{ width: `${promoData.sans_promotion.pct_ca}%` }}
                      >
                        {promoData.sans_promotion.pct_ca}%
                      </div>
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="size-2 rounded-full bg-amber-400" />
                        {t('marge_produit.avec_promo', 'Avec Promotion')}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        {t('marge_produit.sans_promo', 'Sans Promotion')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-400">
                {t('common:no_data', 'Aucune donnée')}
              </div>
            )
          ) : (
            /* Onglets Top/Bottom/Negative - Tableau */
            loadingMarge ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="size-8 animate-spin text-slate-400" />
              </div>
            ) : currentData && currentData.length > 0 ? (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="text-slate-400 text-xs border-b border-slate-200">
                      <th className="text-left py-3 px-2">#</th>
                      <th className="text-left py-3 px-2">{t('marge_produit.product', 'Produit')}</th>
                      <th className="text-left py-3 px-2 hidden md:table-cell">CIP</th>
                      <th className="text-right py-3 px-2">{t('marge_produit.ca', 'CA')}</th>
                      <th className="text-right py-3 px-2">{t('marge_produit.marge', 'Marge')}</th>
                      <th className="text-right py-3 px-2">%</th>
                      <th className="text-right py-3 px-2 hidden sm:table-cell">{t('marge_produit.qty', 'Qté')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentData.map((product, index) => (
                      <tr
                        key={product.id}
                        className={`hover:bg-slate-50 transition-colors ${product.marge < 0 ? 'bg-red-50/50' : ''}`}
                      >
                        <td className="py-3 px-2 font-bold text-slate-400">{index + 1}</td>
                        <td className="py-3 px-2 max-w-[200px] truncate font-medium text-slate-800" title={product.nom}>
                          {product.nom}
                        </td>
                        <td className="py-3 px-2 hidden md:table-cell font-mono text-xs text-slate-400">{product.cip}</td>
                        <td className="py-3 px-2 text-right font-mono text-slate-700">{fmt(product.ca)}</td>
                        <td className={`py-3 px-2 text-right font-mono font-bold ${product.marge < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {fmt(product.marge)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
                            product.taux_marge < 0 ? 'bg-red-100 text-red-700'
                            : product.taux_marge < 10 ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {product.taux_marge}%
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right text-slate-500 hidden sm:table-cell">{product.quantite}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
                {activeTab === 'negative' ? (
                  <>
                    <TrendingUp size={48} className="text-emerald-300" />
                    <p className="font-bold text-emerald-500">
                      {t('marge_produit.no_negative', 'Aucun produit vendu à perte !')}
                    </p>
                  </>
                ) : (
                  <p>{t('common:no_data', 'Aucune donnée')}</p>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

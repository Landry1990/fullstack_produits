import { useState, useEffect } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';

type GroupByOption = 'FORME' | 'RAYON' | 'GROUPE';
type StockDisplayOption = 'MACHINE' | 'ZERO' | 'NON_ZERO';

interface EntityOption {
  id: number;
  name: string;
}

export default function EtatsInventaire() {
  const { t } = useTranslation(['stock', 'common']);
  const [groupBy, setGroupBy] = useState<GroupByOption>('RAYON');
  const [stockDisplay, setStockDisplay] = useState<StockDisplayOption>('MACHINE');
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<number | null>(null);
  const [loadingEntities, setLoadingEntities] = useState(false);

  // Charger les entités en fonction du type de regroupement
  useEffect(() => {
    const fetchEntities = async () => {
      setLoadingEntities(true);
      setSelectedEntity(null); // Reset selection when changing group
      try {
        let endpoint = '';
        if (groupBy === 'RAYON') {
          endpoint = '/api/rayons/';
        } else if (groupBy === 'FORME') {
          endpoint = '/api/formes/';
        } else if (groupBy === 'GROUPE') {
          endpoint = '/api/groupes/';
        }
        
        const response = await api.get(endpoint.replace(/^\/api\//, ''));
        const data = response.data.results || response.data;
        
        // Normaliser les données (rayons utilisent 'name', formes/groupes utilisent 'nom')
        const normalized = data.map((item: any) => ({
          id: item.id,
          name: item.name || item.nom
        }));
        
        setEntities(normalized);
      } catch (error) {
        console.error('Erreur chargement entités', error);
        setEntities([]);
      } finally {
        setLoadingEntities(false);
      }
    };
    
    fetchEntities();
  }, [groupBy]);

  const handlePrint = () => {
    let url = `/app/printing/0?type=INVENTAIRE&group_by=${groupBy}&stock_display=${stockDisplay}`;
    if (selectedEntity) {
      url += `&filter_id=${selectedEntity}`;
    }
    window.open(url, '_blank');
  };

  const groupByOptions = [
    { value: 'RAYON', label: t('stock:etats_inventaire.groups.rayon') },
    { value: 'FORME', label: t('stock:etats_inventaire.groups.forme') },
    { value: 'GROUPE', label: t('stock:etats_inventaire.groups.groupe') },
  ];

  const stockOptions = [
    { value: 'MACHINE', label: t('stock:etats_inventaire.stock_options.machine') },
    { value: 'ZERO', label: t('stock:etats_inventaire.stock_options.zero') },
    { value: 'NON_ZERO', label: t('stock:etats_inventaire.stock_options.non_zero', { defaultValue: 'Stocks non nuls (> 0)' }) },
  ];

  const getEntityLabel = () => {
    return groupBy === 'RAYON' 
      ? t('common:rayon') 
      : groupBy === 'FORME' 
        ? t('common:forme') 
        : t('common:groupe');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">{t('stock:etats_inventaire.title')}</h1>
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">{t('stock:etats_inventaire.generate_title')}</p>
        </div>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Regroupement */}
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">{t('stock:etats_inventaire.grouping_title')}</p>
              <div className="flex flex-col gap-2">
                {groupByOptions.map(option => (
                  <label key={option.value} className="flex items-center gap-3 cursor-pointer group">
                    <div
                      className={`size-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                        groupBy === option.value ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white group-hover:border-blue-400'
                      }`}
                      onClick={() => setGroupBy(option.value as GroupByOption)}
                    >
                      {groupBy === option.value && <div className="size-1.5 rounded-full bg-white"></div>}
                    </div>
                    <input type="radio" name="groupBy" className="sr-only" checked={groupBy === option.value} onChange={() => setGroupBy(option.value as GroupByOption)} />
                    <span className="text-sm font-medium text-slate-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Sélection de l'entité */}
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">{t('stock:etats_inventaire.to_print_label', { type: getEntityLabel() })}</p>
              <div className="relative">
                <select
                  className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none disabled:opacity-50"
                  value={selectedEntity ?? ''}
                  onChange={(e) => setSelectedEntity(e.target.value ? Number(e.target.value) : null)}
                  disabled={loadingEntities}
                >
                  <option value="">{t('stock:etats_inventaire.all_entities', { type: getEntityLabel().toLowerCase() })}</option>
                  {entities.map(entity => (
                    <option key={entity.id} value={entity.id}>{entity.name}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  {loadingEntities
                    ? <span className="size-4 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin inline-block"></span>
                    : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  }
                </div>
              </div>
            </div>

            {/* Affichage Stock */}
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">{t('stock:etats_inventaire.stock_display_title')}</p>
              <div className="flex flex-col gap-2">
                {stockOptions.map(option => (
                  <label key={option.value} className="flex items-center gap-3 cursor-pointer group">
                    <div
                      className={`size-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                        stockDisplay === option.value ? 'border-violet-600 bg-violet-600' : 'border-slate-300 bg-white group-hover:border-violet-400'
                      }`}
                      onClick={() => setStockDisplay(option.value as StockDisplayOption)}
                    >
                      {stockDisplay === option.value && <div className="size-1.5 rounded-full bg-white"></div>}
                    </div>
                    <input type="radio" name="stockDisplay" className="sr-only" checked={stockDisplay === option.value} onChange={() => setStockDisplay(option.value as StockDisplayOption)} />
                    <span className="text-sm font-medium text-slate-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-100"></div>

          {/* Résumé */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p className="text-sm text-slate-600 flex flex-wrap items-center gap-1.5">
              <strong className="text-slate-800">{t('stock:etats_inventaire.summary.recap')}</strong>
              <span>{t('stock:etats_inventaire.summary.title')}</span>
              <span className="inline-flex items-center h-5 px-2 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px]">
                {groupByOptions.find(o => o.value === groupBy)?.label}
              </span>
              {selectedEntity ? (
                <span className="inline-flex items-center h-5 px-2 rounded-full bg-violet-100 text-violet-700 font-bold text-[11px]">
                  {entities.find(e => e.id === selectedEntity)?.name || 'Sélection'}
                </span>
              ) : (
                <span className="inline-flex items-center h-5 px-2 rounded-full bg-slate-200 text-slate-600 font-bold text-[11px]">
                  {t('stock:etats_inventaire.summary.all')}
                </span>
              )}
              <span>{t('stock:etats_inventaire.summary.with')}</span>
              <span className="inline-flex items-center h-5 px-2 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[11px]">
                {stockOptions.find(o => o.value === stockDisplay)?.label}
              </span>
            </p>
          </div>

          {/* Action */}
          <div className="flex justify-end">
            <button
              className="inline-flex items-center gap-2 h-11 px-6 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
              onClick={handlePrint}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zM4 9h12v3H4V9zm1 5h10v2H5v-2z" clipRule="evenodd" />
              </svg>
              {t('stock:etats_inventaire.download_btn')}
            </button>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex gap-4 bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <div className="shrink-0 size-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="size-5">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="font-bold text-blue-800 text-sm mb-1">{t('stock:etats_inventaire.help.title')}</h3>
          <div className="text-xs text-blue-700 space-y-0.5">
            <p>{t('stock:etats_inventaire.help.step1')}</p>
            <p>{t('stock:etats_inventaire.help.step2', { type: getEntityLabel().toLowerCase() })}</p>
            <p>{t('stock:etats_inventaire.help.step3')}</p>
            <p>{t('stock:etats_inventaire.help.step4')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

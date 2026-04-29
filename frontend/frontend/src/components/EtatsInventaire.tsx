import { useState, useEffect } from 'react';
import api from '../services/api';
import { useTranslation } from 'react-i18next';

type GroupByOption = 'FORME' | 'RAYON' | 'GROUPE';
type StockDisplayOption = 'MACHINE' | 'ZERO';

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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t('stock:etats_inventaire.title')}</h1>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-lg mb-4">{t('stock:etats_inventaire.generate_title')}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Regroupement */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">{t('stock:etats_inventaire.grouping_title')}</span>
              </label>
              <div className="flex flex-col gap-2">
                {groupByOptions.map(option => (
                  <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="groupBy"
                      className="radio radio-primary"
                      checked={groupBy === option.value}
                      onChange={() => setGroupBy(option.value as GroupByOption)}
                    />
                    <span className="label-text">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Sélection de l'entité */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">{t('stock:etats_inventaire.to_print_label', { type: getEntityLabel() })}</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={selectedEntity ?? ''}
                onChange={(e) => setSelectedEntity(e.target.value ? Number(e.target.value) : null)}
                disabled={loadingEntities}
              >
                <option value="">{t('stock:etats_inventaire.all_entities', { type: getEntityLabel().toLowerCase() })}</option>
                {entities.map(entity => (
                  <option key={entity.id} value={entity.id}>{entity.name}</option>
                ))}
              </select>
              {loadingEntities && <span className="text-xs text-base-content/60 mt-1">{t('common:loading')}</span>}
            </div>

            {/* Affichage Stock */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">{t('stock:etats_inventaire.stock_display_title')}</span>
              </label>
              <div className="flex flex-col gap-2">
                {stockOptions.map(option => (
                  <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="stockDisplay"
                      className="radio radio-secondary"
                      checked={stockDisplay === option.value}
                      onChange={() => setStockDisplay(option.value as StockDisplayOption)}
                    />
                    <span className="label-text">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="divider"></div>

          {/* Résumé */}
          <div className="bg-base-200 rounded-lg p-4">
            <p className="text-sm">
              <strong>{t('stock:etats_inventaire.summary.recap')}</strong> {t('stock:etats_inventaire.summary.title')}{' '}
              <span className="badge badge-primary badge-sm mx-1">{groupByOptions.find(o => o.value === groupBy)?.label}</span>
              {selectedEntity ? (
                <span className="badge badge-accent badge-sm mx-1">
                  {entities.find(e => e.id === selectedEntity)?.name || 'Sélection'}
                </span>
              ) : (
                <span className="badge badge-ghost badge-sm mx-1">{t('stock:etats_inventaire.summary.all')}</span>
              )}
              {t('stock:etats_inventaire.summary.with')}
              <span className="badge badge-secondary badge-sm mx-1">{stockOptions.find(o => o.value === stockDisplay)?.label}</span>
            </p>
          </div>

          <div className="card-actions justify-end mt-4">
            <button 
              className="btn btn-primary gap-2"
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
      <div className="alert alert-info">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <div>
          <h3 className="font-bold">{t('stock:etats_inventaire.help.title')}</h3>
          <div className="text-xs">
            {t('stock:etats_inventaire.help.step1')}<br/>
            {t('stock:etats_inventaire.help.step2', { type: getEntityLabel().toLowerCase() })}<br/>
            {t('stock:etats_inventaire.help.step3')}<br/>
            {t('stock:etats_inventaire.help.step4')}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

type GroupByOption = 'FORME' | 'RAYON' | 'GROUPE';
type StockDisplayOption = 'MACHINE' | 'ZERO';

interface EntityOption {
  id: number;
  name: string;
}

export default function EtatsInventaire() {
  const { t } = useTranslation();
  const [groupBy, setGroupBy] = useState<GroupByOption>('RAYON');
  const [stockDisplay, setStockDisplay] = useState<StockDisplayOption>('MACHINE');
  const [loading, setLoading] = useState(false);
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<number | null>(null);
  const [loadingEntities, setLoadingEntities] = useState(false);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

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
        
        const response = await axios.get(`${String(apiBaseUrl).replace(/\/$/, '')}${endpoint}`);
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
  }, [groupBy, apiBaseUrl]);

  const handleDownloadPDF = async () => {
    setLoading(true);
    try {
      let url = `${String(apiBaseUrl).replace(/\/$/, '')}/api/produits/etat-inventaire/pdf/?group_by=${groupBy}&stock_display=${stockDisplay}`;
      
      if (selectedEntity) {
        url += `&filter_id=${selectedEntity}`;
      }
      
      const response = await axios.get(url, {
        responseType: 'blob'
      });

      // Créer un lien de téléchargement
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `etat_inventaire_${groupBy.toLowerCase()}_${stockDisplay.toLowerCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success(t('stock.etats_inventaire.messages.success', { defaultValue: 'PDF téléchargé avec succès' }));
    } catch (error) {
      console.error('Erreur téléchargement PDF', error);
      toast.error(t('stock.etats_inventaire.messages.error', { defaultValue: 'Erreur lors du téléchargement du PDF' }));
    } finally {
      setLoading(false);
    }
  };

  const groupByOptions = [
    { value: 'RAYON', label: t('stock.etats_inventaire.groups.rayon', { defaultValue: 'Par Rayon' }) },
    { value: 'FORME', label: t('stock.etats_inventaire.groups.forme', { defaultValue: 'Par Forme' }) },
    { value: 'GROUPE', label: t('stock.etats_inventaire.groups.groupe', { defaultValue: 'Par Groupe' }) },
  ];

  const stockOptions = [
    { value: 'MACHINE', label: t('stock.etats_inventaire.stock_options.machine', { defaultValue: 'Stock Machine (valeurs actuelles)' }) },
    { value: 'ZERO', label: t('stock.etats_inventaire.stock_options.zero', { defaultValue: 'Stock à Zéro (pour saisie)' }) },
  ];

  const getEntityLabel = () => {
    return groupBy === 'RAYON' ? t('common.rayon', { defaultValue: 'Rayon' }) : groupBy === 'FORME' ? t('common.forme', { defaultValue: 'Forme' }) : t('common.groupe', { defaultValue: 'Groupe' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t('stock.etats_inventaire.title', { defaultValue: "États d'Inventaires" })}</h1>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-lg mb-4">{t('stock.etats_inventaire.generate_title', { defaultValue: "Générer un état d'inventaire" })}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Regroupement */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">{t('stock.etats_inventaire.grouping_title', { defaultValue: "Regroupement" })}</span>
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
                <span className="label-text font-semibold">{t('stock.etats_inventaire.to_print_label', { defaultValue: `${getEntityLabel()} à imprimer`, type: getEntityLabel() })}</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={selectedEntity ?? ''}
                onChange={(e) => setSelectedEntity(e.target.value ? Number(e.target.value) : null)}
                disabled={loadingEntities}
              >
                <option value="">{t('stock.etats_inventaire.all_entities', { defaultValue: `Tous les ${getEntityLabel().toLowerCase()}s`, type: getEntityLabel().toLowerCase() })}</option>
                {entities.map(entity => (
                  <option key={entity.id} value={entity.id}>{entity.name}</option>
                ))}
              </select>
              {loadingEntities && <span className="text-xs text-base-content/60 mt-1">{t('stock.etats_inventaire.loading_entities', { defaultValue: "Chargement..." })}</span>}
            </div>

            {/* Affichage Stock */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">{t('stock.etats_inventaire.stock_display_title', { defaultValue: "Affichage du Stock" })}</span>
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
              <strong>{t('stock.etats_inventaire.summary.recap', { defaultValue: "Récapitulatif :" })}</strong> {t('stock.etats_inventaire.summary.title', { defaultValue: "État d'inventaire" })} 
              <span className="badge badge-primary badge-sm mx-1">{groupByOptions.find(o => o.value === groupBy)?.label}</span>
              {selectedEntity ? (
                <span className="badge badge-accent badge-sm mx-1">
                  {entities.find(e => e.id === selectedEntity)?.name || 'Sélection'}
                </span>
              ) : (
                <span className="badge badge-ghost badge-sm mx-1">{t('stock.etats_inventaire.summary.all', { defaultValue: "Tous" })}</span>
              )}
              {t('stock.etats_inventaire.summary.with', { defaultValue: "avec" })}
              <span className="badge badge-secondary badge-sm mx-1">{stockOptions.find(o => o.value === stockDisplay)?.label}</span>
            </p>
          </div>

          <div className="card-actions justify-end mt-4">
            <button 
              className={`btn btn-primary gap-2 ${loading ? 'loading' : ''}`}
              onClick={handleDownloadPDF}
              disabled={loading}
            >
              {!loading && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              )}
              {loading ? t('stock.etats_inventaire.generating', { defaultValue: 'Génération...' }) : t('stock.etats_inventaire.download_btn', { defaultValue: 'Télécharger PDF' })}
            </button>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="alert alert-info">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <div>
          <h3 className="font-bold">{t('stock.etats_inventaire.help.title', { defaultValue: "Comment utiliser ?" })}</h3>
          <div className="text-xs">
            {t('stock.etats_inventaire.help.step1', { defaultValue: "1. Choisissez le type de regroupement" })}<br/>
            {t('stock.etats_inventaire.help.step2', { defaultValue: `2. Sélectionnez un {{type}} spécifique ou laissez "Tous"`, type: getEntityLabel().toLowerCase() })}<br/>
            {t('stock.etats_inventaire.help.step3', { defaultValue: "3. Choisissez l'affichage du stock" })}<br/>
            {t('stock.etats_inventaire.help.step4', { defaultValue: "4. Cliquez sur \"Télécharger PDF\"" })}
          </div>
        </div>
      </div>
    </div>
  );
}

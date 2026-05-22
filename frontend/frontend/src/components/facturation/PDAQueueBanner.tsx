/**
 * Bannière affichant les ventes PDA en attente de traitement
 * Intégration dans la page Facturation
 */
import { Smartphone, ShoppingCart, X, Check, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../utils/formatters';

interface PDAClient {
  id: number;
  name: string;
  phone?: string;
}

interface PDAAyantDroit {
  id: number;
  nom: string;
  prenom: string;
  numero_carte: string;
  taux_couverture: number;
  societe?: string;
}

interface PDAArticle {
  produit_id: number;
  code_barre: string;
  designation: string;
  quantite: number;
  prix_unitaire: string;
  remise_produit: string;
  tva: string;
  total_ht: string;
  total_ttc: string;
}

interface PDAItem {
  type: 'cashier_item_new';
  pda_id: string;
  item_id: string;
  articles: PDAArticle[];
  client?: PDAClient;
  ayant_droit?: PDAAyantDroit;
  total_estime: string;
  articles_count: number;
  timestamp: string;
}

interface PDAQueueBannerProps {
  items: PDAItem[];
  onAccept: (item: PDAItem) => void;
  onDismiss: (itemId: string) => void;
}

export function PDAQueueBanner({ items, onAccept, onDismiss }: PDAQueueBannerProps) {
  const { t } = useTranslation();

  if (items.length === 0) return null;

  return (
    <div className="bg-primary/10 border-b border-indigo-200 px-4 py-3 shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <Smartphone className="size-4 text-primary" />
        <span className="text-xs font-bold text-primary uppercase tracking-wider">
          {items.length} vente{items.length > 1 ? 's' : ''} PDA en attente
        </span>
      </div>
      
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.item_id}
            className="bg-base-100 rounded-xl border border-indigo-200 p-3 shadow-sm flex items-center gap-3"
          >
            {/* Icône PDA */}
            <div className="shrink-0 w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
              <ShoppingCart className="size-5 text-primary" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-base-content">
                  {item.pda_id}
                </span>
                <span className="text-xs text-base-content/60">
                  • {item.articles_count} article{item.articles_count > 1 ? 's' : ''}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-base-content/70 mt-0.5">
                {item.client && (
                  <span className="flex items-center gap-1">
                    <User className="size-3" />
                    {item.client.name}
                  </span>
                )}
                {item.ayant_droit && (
                  <span className="text-primary font-medium">
                    ({item.ayant_droit.taux_couverture}% assuré)
                  </span>
                )}
              </div>
              
              <div className="text-sm font-black text-base-content mt-1">
                {formatCurrency(parseFloat(item.total_estime))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onDismiss(item.item_id)}
                className="p-2 text-base-content/50 hover:text-base-content/70 hover:bg-base-200 rounded-lg transition-all"
                title="Ignorer"
              >
                <X className="size-4" />
              </button>
              <button
                onClick={() => onAccept(item)}
                className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-focus text-white text-xs font-bold rounded-lg shadow-sm shadow-indigo-500/20 transition-all"
              >
                <Check className="size-4" />
                <span>Charger</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

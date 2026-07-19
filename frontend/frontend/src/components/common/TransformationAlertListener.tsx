import { useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTransformationAlerts, type TransformationNeededItem } from '../../hooks/useDashboard';

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

function showTransformationToast(count: number, firstItem: TransformationNeededItem | undefined, t: TFunc) {
  toast(
    (props: { id: string }) => (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 font-bold text-amber-700">
          <Package size={16} className="text-amber-500" />
          {t('dashboard:transformation_alert_title', { defaultValue: '⚡ Transformations nécessaires' })}
        </div>
        <div className="text-xs text-slate-600">
          {count > 1
            ? t('dashboard:transformation_alert_message_plural', {
                defaultValue: `${count} produits à transformer depuis leur conditionnement source`,
                count,
              })
            : t('dashboard:transformation_alert_message', {
                defaultValue: `${firstItem?.destination_name} (stock: ${firstItem?.destination_stock}) — transformer depuis ${firstItem?.source_name}`,
                item: firstItem,
              })}
        </div>
        <Link
          to="/app/transformations"
          onClick={() => toast.dismiss(props.id)}
          className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          {t('dashboard:transformation_alert_link', { defaultValue: 'Aller aux transformations →' })}
        </Link>
      </div>
    ),
    {
      duration: 8000,
      style: {
        background: '#fffbeb',
        border: '1px solid #fcd34d',
        padding: '12px 16px',
      },
      icon: '⚡',
    }
  );
}

export default function TransformationAlertListener() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { data: transformationAlerts } = useTransformationAlerts(true);
  const loginToastShownRef = useRef(false);

  // Toast au chargement (connexion) : une seule fois
  useEffect(() => {
    if (transformationAlerts && transformationAlerts.count > 0 && !loginToastShownRef.current) {
      loginToastShownRef.current = true;
      showTransformationToast(transformationAlerts.count, transformationAlerts.items[0], t);
    }
  }, [transformationAlerts, t]);

  return null;
}

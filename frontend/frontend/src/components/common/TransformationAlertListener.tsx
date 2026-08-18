import { useEffect, useRef } from 'react';
import { gooeyToast } from 'goey-toast';
import { useTranslation } from 'react-i18next';
import { useTransformationAlerts, type TransformationNeededItem } from '../../hooks/useDashboard';

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

function showTransformationToast(count: number, firstItem: TransformationNeededItem | undefined, t: TFunc) {
  const message = count > 1
    ? t('dashboard:transformation_alert_message_plural', {
        defaultValue: `${count} produits à transformer depuis leur conditionnement source`,
        count,
      })
    : t('dashboard:transformation_alert_message', {
        defaultValue: `${firstItem?.destination_name} (stock: ${firstItem?.destination_stock}) — transformer depuis ${firstItem?.source_name}`,
        item: firstItem,
      });

  gooeyToast.info(
    t('dashboard:transformation_alert_title', { defaultValue: '⚡ Transformations nécessaires' }),
    {
      description: message,
      duration: 8000,
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

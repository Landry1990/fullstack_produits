import { useTranslation } from 'react-i18next';

export interface ClinicalAlert {
  type: string
  gravity: 'PRECAUTION' | 'A_PRENDRE_EN_COMPTE' | 'DECONSEILLE' | 'CONTRE_INDIQUE'
  title: string
  description: string
  product_a: { id: number, name: string }
  product_b: { id: number, name: string }
}

interface ClinicalAlertsProps {
  alerts: ClinicalAlert[]
}

export default function ClinicalAlerts({ alerts }: ClinicalAlertsProps) {
  const { t } = useTranslation();
  if (!alerts || alerts.length === 0) return null

  // Group by gravity for sorting/styling
  const severeAlerts = alerts.filter(a => a.gravity === 'CONTRE_INDIQUE' || a.gravity === 'DECONSEILLE')
  const moderateAlerts = alerts.filter(a => a.gravity === 'A_PRENDRE_EN_COMPTE' || a.gravity === 'PRECAUTION')

  return (
    <div className="flex flex-col gap-2 mt-4 px-4">
      {/* Severe Alerts */}
      {severeAlerts.map((alert, idx) => (
        <div key={`severe-${idx}`} role="alert" className="alert alert-error shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div className="flex-1">
            <h3 className="font-bold uppercase tracking-wide flex items-center gap-2">
              {alert.title}
              <span className="badge badge-sm badge-white text-error font-extrabold">{t(`clinical.alerts.gravities.${alert.gravity}`)}</span>
            </h3>
            <div className="text-sm mt-1">{alert.description}</div>
            <div className="text-xs mt-1 opacity-90 font-mono">
              {t('clinical.alerts.products_label')} {alert.product_a.name} ↔ {alert.product_b.name}
            </div>
          </div>
        </div>
      ))}

      {/* Moderate Alerts */}
      {moderateAlerts.map((alert, idx) => (
        <div key={`mod-${idx}`} role="alert" className="alert alert-warning shadow-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <div className="flex-1">
            <h3 className="font-bold flex items-center gap-2">
              {alert.title}
              {alert.gravity === 'A_PRENDRE_EN_COMPTE' && <span className="badge badge-sm badge-ghost">{t('clinical.alerts.to_watch')}</span>}
            </h3>
            <div className="text-xs">{alert.description}</div>
            <div className="text-xs mt-1 font-mono opacity-80">
              {alert.product_a.name} ↔ {alert.product_b.name}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

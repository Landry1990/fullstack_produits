import { toast } from 'react-hot-toast'
import i18n from '../i18n'

export const showExpirationToast = (daysUntilExpiration: number) => {
    if (daysUntilExpiration <= 0) {
        // PÉRIMÉ
        toast.error((t) => (
            <span onClick={() => toast.dismiss(t.id)} style={{ cursor: 'pointer', display: 'block' }}>
                {i18n.t('stock:perimes.alerts.expired', { days: Math.abs(daysUntilExpiration) })}
                <br />
                <small style={{ fontSize: '0.8em', opacity: 0.8 }}>{i18n.t('stock:perimes.alerts.click_to_close')}</small>
            </span>
        ), {
            duration: Infinity,
            position: 'top-center',
            style: { border: '2px solid #ef4444', background: '#fee2e2', color: '#b91c1c', fontWeight: 'bold', minWidth: '300px', textAlign: 'center' }
        })
    } else if (daysUntilExpiration <= 90) { // Augmenté à 3 mois pour être sûr
        // Moins de 3 mois - Alerte FORTE
        toast((t) => (
            <span onClick={() => toast.dismiss(t.id)} style={{ cursor: 'pointer', display: 'block' }}>
                {i18n.t('stock:perimes.alerts.warning', { days: daysUntilExpiration })}
                <br />
                <small style={{ fontSize: '0.8em', opacity: 0.8 }}>{i18n.t('stock:perimes.alerts.click_to_confirm')}</small>
            </span>
        ), {
            icon: '📆',
            style: { border: '2px solid #f97316', background: '#ffedd5', color: '#c2410c', fontWeight: 'bold', minWidth: '300px', textAlign: 'center' },
            duration: Infinity,
            position: 'top-center'
        })
    } else if (daysUntilExpiration <= 180) {
        // Moins de 6 mois - Alerte Info (non bloquante, disparaît seule)
        toast(i18n.t('stock:perimes.alerts.info', { 
            months: Math.floor(daysUntilExpiration / 30),
            days: daysUntilExpiration 
        }), {
            icon: '⏳',
            style: { border: '1px solid #eab308', color: '#854d0e', minWidth: '300px', textAlign: 'center' },
            duration: 5000,
            position: 'top-center'
        })
    }
}

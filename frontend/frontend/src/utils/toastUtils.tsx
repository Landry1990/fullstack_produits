import { gooeyToast } from 'goey-toast'
import i18n from '../i18n'

export const showExpirationToast = (daysUntilExpiration: number) => {
    if (daysUntilExpiration <= 0) {
        // PÉRIMÉ
        gooeyToast.error(
            i18n.t('stock:perimes.alerts.expired', { days: Math.abs(daysUntilExpiration) }),
            {
                description: i18n.t('stock:perimes.alerts.click_to_close'),
                duration: Infinity,
            }
        )
    } else if (daysUntilExpiration <= 90) {
        // Moins de 3 mois - Alerte FORTE
        gooeyToast.warning(
            i18n.t('stock:perimes.alerts.warning', { days: daysUntilExpiration }),
            {
                description: i18n.t('stock:perimes.alerts.click_to_confirm'),
                duration: Infinity,
            }
        )
    } else if (daysUntilExpiration <= 180) {
        // Moins de 6 mois - Alerte Info (non bloquante, disparaît seule)
        gooeyToast.info(
            i18n.t('stock:perimes.alerts.info', {
                months: Math.floor(daysUntilExpiration / 30),
                days: daysUntilExpiration
            }),
            {
                duration: 5000,
            }
        )
    }
}

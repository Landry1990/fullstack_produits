import { toast } from 'react-hot-toast'

export const showExpirationToast = (daysUntilExpiration: number) => {
    if (daysUntilExpiration <= 0) {
        // PÉRIMÉ
        toast.error((t) => (
            <span onClick={() => toast.dismiss(t.id)} style={{ cursor: 'pointer', display: 'block' }}>
                ⛔ STOP : Ce produit est PÉRIMÉ depuis {Math.abs(daysUntilExpiration)} jours !
                <br />
                <small style={{ fontSize: '0.8em', opacity: 0.8 }}>(Cliquez pour fermer)</small>
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
                ⚠️ ATTENTION : Périme dans {daysUntilExpiration} jours !
                <br />
                <small style={{ fontSize: '0.8em', opacity: 0.8 }}>(Cliquez pour confirmer)</small>
            </span>
        ), {
            icon: '📆',
            style: { border: '2px solid #f97316', background: '#ffedd5', color: '#c2410c', fontWeight: 'bold', minWidth: '300px', textAlign: 'center' },
            duration: Infinity,
            position: 'top-center'
        })
    } else if (daysUntilExpiration <= 180) {
        // Moins de 6 mois - Alerte Info (non bloquante, disparaît seule)
        toast(`ℹ️ Info : Périme dans ${Math.floor(daysUntilExpiration / 30)} mois (${daysUntilExpiration} jours)`, {
            icon: '⏳',
            style: { border: '1px solid #eab308', color: '#854d0e', minWidth: '300px', textAlign: 'center' },
            duration: 5000,
            position: 'top-center'
        })
    }
}

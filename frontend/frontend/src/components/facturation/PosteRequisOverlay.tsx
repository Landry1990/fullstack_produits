import { useTranslation } from 'react-i18next'
import { Store } from 'lucide-react'
import { Button } from '../shadcn/button'

interface PosteRequisOverlayProps {
  hasMyActivePoste: boolean
  onOpenExisting: () => void
}

export default function PosteRequisOverlay({ hasMyActivePoste, onOpenExisting }: PosteRequisOverlayProps) {
  const { t } = useTranslation('caisse')
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-100/95 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center space-y-4">
        <div className="mx-auto w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
          <Store className="size-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">
          {hasMyActivePoste ? t('open_point_vente.active_title', { defaultValue: 'Point de vente actif' }) : t('open_point_vente.required_title', { defaultValue: 'Point de vente requis' })}
        </h2>
        <p className="text-sm text-slate-600">
          {hasMyActivePoste
            ? t('open_point_vente.active_message', { defaultValue: 'Vous avez déjà un point de vente ouvert. Vous pouvez le réactiver pour reprendre la facturation.' })
            : t('open_point_vente.required_message', { defaultValue: 'La facturation est verrouillée tant qu\'aucun point de vente n\'est ouvert.' })}
        </p>
        <Button
          type="button"
          size="sm"
          onClick={onOpenExisting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg w-full"
        >
          {hasMyActivePoste ? t('open_point_vente.activate_long', { defaultValue: 'Réactiver mon point de vente' }) : t('open_point_vente.open_long', { defaultValue: 'Ouvrir un point de vente' })}
        </Button>
      </div>
    </div>
  )
}

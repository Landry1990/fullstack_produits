import { useTranslation } from 'react-i18next'
import type { Client } from '../../types'
import { Button } from '../shadcn/button'
import { Badge } from '../shadcn/badge'
import { Star, Wallet, Briefcase } from 'lucide-react'

interface ClientInfoBadgesProps {
  client: Client
  onApplyReward?: () => void
}

export default function ClientInfoBadges({ client, onApplyReward }: ClientInfoBadgesProps) {
  const { t } = useTranslation(['facturation', 'common'])

  return (
    <>
      {/* Type client PRO */}
      {client.client_type === 'PROFESSIONNEL' && (
        <div className="mt-2 px-3 py-2 bg-blue-50 rounded-lg flex justify-between items-center border border-blue-100">
          <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-1">
            <Briefcase className="size-3" />
            {t('facturation:client.professional_badge')}
          </span>
          <Badge variant="secondary" className="h-5 text-[10px] bg-blue-100 text-blue-700 border-blue-200 font-bold">{client.client_type}</Badge>
        </div>
      )}

      {/* Solde dépôt */}
      {client.client_type === 'PARTICULIER' && (client.is_deposit_enabled || parseFloat(client.solde_depot || '0') > 0) && (
        <div className="mt-2 px-3 py-2 bg-emerald-50 rounded-lg flex justify-between items-center border border-emerald-100">
          <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
            <Wallet className="size-3" />
            {t('facturation:client.solde_depot_label')}
          </span>
          <span className="text-sm font-bold text-emerald-700">{parseFloat(client.solde_depot || '0')} F</span>
        </div>
      )}

      {/* Points de Fidélité */}
      {client.client_type === 'PARTICULIER' && client.is_loyalty_member && (
        <div className="mt-2 px-3 py-2 bg-violet-50 rounded-lg flex justify-between items-center border border-violet-100">
          <span className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider flex items-center gap-1">
            <Star className="size-3" />
            {t('facturation:client.label')} {t('facturation:client.loyalty_label')}
          </span>
          <span className="text-sm font-bold text-violet-700">{t('facturation:client.points_balance', { points: client.points_fidelite || 0 })}</span>
        </div>
      )}

      {/* Récompense disponible */}
      {parseFloat(client.pending_discount || '0') > 0 && (
        <div className="mt-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200 flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
              <Star className="size-3 fill-amber-500 text-amber-500" />
              {t('facturation:client.reward_label')}
            </span>
            <Badge variant="secondary" className="h-5 text-[10px] bg-amber-100 text-amber-700 border-amber-200 font-bold">-{client.pending_discount}%</Badge>
          </div>
          <div className="text-[10px] text-amber-600/80 italic">
            {t('facturation:client.pending_reward', { discount: client.pending_discount })}
          </div>
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onApplyReward?.();
            }}
            className="h-7 w-full gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg shadow-sm"
          >
            <Star className="size-3 fill-white" />
            {t('facturation:client.apply_reward_button', { defaultValue: 'Appliquer' })}
          </Button>
        </div>
      )}
    </>
  )
}

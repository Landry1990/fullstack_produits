import React from 'react'
import { useTranslation } from 'react-i18next'
import { Ticket, Plus, Search } from 'lucide-react'
import { Button } from '../shadcn/button'
import { Input } from '../shadcn/input'
import { Badge } from '../shadcn/badge'
import { cn } from '../../lib/utils'
import type { CouponMonnaie, User } from '../../types'

interface CouponPanelProps {
  coupons: CouponMonnaie[]
  onGenerateCoupon: () => void
  searchNumero: string
  onSearchChange: (value: string) => void
  onSearch: () => void
  onSelectCoupon: (coupon: CouponMonnaie) => void
  user: User | null
}

export const CouponPanel: React.FC<CouponPanelProps> = ({
  coupons,
  onGenerateCoupon,
  searchNumero,
  onSearchChange,
  onSearch,
  onSelectCoupon,
  user
}) => {
  const { t } = useTranslation('caisse')
  return (
    <div className="w-96 bg-white border-r border-slate-200 flex flex-col animate-in fade-in slide-in-from-right-2 duration-300">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg flex items-center gap-2 text-slate-900">
            <span className="text-emerald-600">
              <Ticket className="size-6" />
            </span>
            {t('coupons.title')}
          </h2>
          <Button
            size="sm"
            variant="default"
            className="rounded-full size-9 p-0 bg-emerald-600 hover:bg-emerald-700"
            onClick={onGenerateCoupon}
            title={user?.is_superuser || user?.profile?.can_generate_coupon ? t('coupons.generate') : t('coupons.permission_required')}
            disabled={!user?.is_superuser && !user?.profile?.can_generate_coupon}
          >
            <Plus className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 w-full">
          <Input
            type="text"
            placeholder={t('coupons.search_placeholder')}
            className="h-9 rounded-lg flex-1 bg-white border-slate-200 focus:border-emerald-500"
            value={searchNumero}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          />
          <Button
            size="sm"
            variant="secondary"
            className="h-9 px-3 rounded-lg"
            onClick={onSearch}
          >
            <Search className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {coupons.length === 0 ? (
          <div className="text-center py-10 text-slate-400 italic text-sm">
            {t('coupons.none')}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white z-10 border-b border-slate-100">
              <tr>
                <th className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 py-2 text-left">{t('coupons.headers.num_amount')}</th>
                <th className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 py-2 text-left">{t('coupons.headers.creation')}</th>
                <th className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 py-2 text-left">{t('coupons.headers.usage')}</th>
                <th className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 py-2 text-center">{t('coupons.headers.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {coupons.map(coupon => (
                <tr
                  key={coupon.id}
                  className={cn(
                    "cursor-pointer hover:bg-emerald-50/60 transition-colors",
                    coupon.status !== 'ACTIF' && 'opacity-60'
                  )}
                  onClick={() => onSelectCoupon(coupon)}
                >
                  <td className="px-2 py-2">
                    <div className="font-mono text-[10px] font-bold text-slate-700">#{coupon.numero}</div>
                    <div className={cn(
                      "font-bold text-[10px]",
                      coupon.status === 'ACTIF' ? 'text-emerald-600' : 'text-slate-400'
                    )}>
                      {Math.round(Number(coupon.montant))} F
                    </div>
                  </td>
                  <td className="text-[10px] text-slate-500 px-2 py-2">
                    <div className="font-medium text-slate-700 whitespace-nowrap">
                      {new Date(coupon.date_creation).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })} {new Date(coupon.date_creation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="truncate max-w-[80px] text-slate-400" title={coupon.cree_par_nom || t('coupons.system')}>
                      {t('coupons.by', { name: coupon.cree_par_nom || t('coupons.system') })}
                    </div>
                  </td>
                  <td className="text-[10px] text-slate-500 px-2 py-2">
                    {coupon.status === 'UTILISE' ? (
                      <>
                        <div className="font-medium text-slate-700 whitespace-nowrap">
                          {new Date(coupon.date_utilisation!).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })} {new Date(coupon.date_utilisation!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="truncate max-w-[80px] text-slate-400" title={coupon.utilise_par_nom || 'N/A'}>
                          {t('coupons.by', { name: coupon.utilise_par_nom || 'N/A' })}
                        </div>
                      </>
                    ) : '-'}
                  </td>
                  <td className="text-center px-2 py-2">
                    <Badge variant="default" className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5",
                      coupon.status === 'ACTIF' && 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
                      coupon.status === 'UTILISE' && 'bg-slate-100 text-slate-500 hover:bg-slate-100',
                      coupon.status === 'EXPIRE' && 'bg-amber-100 text-amber-700 hover:bg-amber-100',
                      coupon.status !== 'ACTIF' && coupon.status !== 'UTILISE' && coupon.status !== 'EXPIRE' && 'bg-red-100 text-red-700 hover:bg-red-100'
                    )}>
                      {coupon.status === 'ACTIF' ? '✓' : coupon.status === 'UTILISE' ? '✗' : '!'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

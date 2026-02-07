import React from 'react'
import { useTranslation } from 'react-i18next'
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
    <div className="w-96 bg-white border-r border-base-200 flex flex-col animate-fade-in-right">
      <div className="p-4 border-b border-base-100 bg-base-50/50">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <span className="text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </span>
            {t('coupons.title')}
          </h2>
          <button 
            onClick={onGenerateCoupon}
            className="btn btn-sm btn-circle btn-primary"
            title={user?.is_superuser || user?.profile?.can_generate_coupon ? t('coupons.generate') : t('coupons.permission_required')}
            disabled={!user?.is_superuser && !user?.profile?.can_generate_coupon}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div className="join w-full">
          <input 
            type="text" 
            placeholder={t('coupons.search_placeholder')} 
            className="input input-sm input-bordered join-item flex-1"
            value={searchNumero}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onSearch()}
          />
          <button 
            className="btn btn-sm join-item"
            onClick={onSearch}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {coupons.length === 0 ? (
          <div className="text-center py-10 text-base-content/40 italic text-sm">
            {t('coupons.none')}
          </div>
        ) : (
          <table className="table table-xs table-zebra w-full">
            <thead className="sticky top-0 bg-base-100 z-10">
              <tr>
                <th className="text-[10px] px-1">{t('coupons.headers.num_amount')}</th>
                <th className="text-[10px] px-1">{t('coupons.headers.creation')}</th>
                <th className="text-[10px] px-1">{t('coupons.headers.usage')}</th>
                <th className="text-xs text-center">{t('coupons.headers.status')}</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map(coupon => (
                <tr 
                  key={coupon.id} 
                  className={`cursor-pointer hover:bg-primary/10 transition-colors ${
                    coupon.status !== 'ACTIF' ? 'opacity-60' : ''
                  }`}
                  onClick={() => onSelectCoupon(coupon)}
                >
                  <td className="px-1 py-1">
                    <div className="font-mono text-[10px] font-bold">#{coupon.numero}</div>
                    <div className={`font-bold text-[10px] ${coupon.status === 'ACTIF' ? 'text-primary' : 'text-base-content/50'}`}>
                      {Math.round(Number(coupon.montant))} F
                    </div>
                  </td>
                  <td className="text-[10px] text-base-content/60 px-1 py-1">
                    <div className="font-medium text-base-content whitespace-nowrap">
                      {new Date(coupon.date_creation).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })} {new Date(coupon.date_creation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="truncate max-w-[80px]" title={coupon.cree_par_nom || t('coupons.system')}>
                      {t('coupons.by', { name: coupon.cree_par_nom || t('coupons.system') })}
                    </div>
                  </td>
                  <td className="text-[10px] text-base-content/60 px-1 py-1">
                    {coupon.status === 'UTILISE' ? (
                      <>
                        <div className="font-medium text-base-content whitespace-nowrap">
                          {new Date(coupon.date_utilisation!).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })} {new Date(coupon.date_utilisation!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="truncate max-w-[80px]" title={coupon.utilise_par_nom || 'N/A'}>
                          {t('coupons.by', { name: coupon.utilise_par_nom || 'N/A' })}
                        </div>
                      </>
                    ) : '-'}
                  </td>
                  <td className="text-center">
                    <span className={`badge badge-xs ${
                      coupon.status === 'ACTIF' ? 'badge-success' : 
                      coupon.status === 'UTILISE' ? 'badge-neutral' :
                      coupon.status === 'EXPIRE' ? 'badge-warning' : 'badge-error'
                    }`}>
                      {coupon.status === 'ACTIF' ? '✓' : coupon.status === 'UTILISE' ? '✗' : '!'}
                    </span>
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

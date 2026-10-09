import React from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../../../utils/formatters'
import { cn } from '../../../lib/utils'
import type { SearchResult } from './types'

// Rendu unifié d'un résultat de recherche produit (repris du design
// mobile-facturation) : nom en gras lisible, une seule ligne meta
// `CIP · rayon · stock coloré · prix`. Utilisé par <ProductSearch /> et par
// les dropdowns de recherche custom (Transformations, avoirs clients, DCI,
// omnisearch) pour un affichage identique partout.

export interface ProductResultContentProps {
  product: SearchResult
  /** État sélectionné au clavier (texte clair sur fond coloré). */
  active?: boolean
  /** Badges affichés à droite du nom (stock faible, PROMIS, FORCÉ…). */
  badges?: React.ReactNode
  /** Élément supplémentaire inséré dans la ligne meta (ex: forme galénique). */
  extraMeta?: React.ReactNode
  showPrice?: boolean
}

export const ProductResultContent: React.FC<ProductResultContentProps> = ({
  product,
  active = false,
  badges,
  extraMeta,
  showPrice = true,
}) => {
  const { t } = useTranslation(['facturation', 'common'])
  const stock = product.stock ?? 0
  const isNegativeStock = stock < 0
  const isZeroStock = stock === 0

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <div className={cn(
          "truncate text-sm",
          active ? 'text-white font-bold' :
          isNegativeStock ? 'text-red-600 font-medium' :
          isZeroStock ? 'text-slate-500 font-normal' :
          'text-slate-800 font-bold'
        )}>{product.name}</div>
        {badges}
      </div>
      <div className={cn("text-xs flex items-center gap-2 mt-0.5", active ? 'text-blue-100' : 'text-slate-400')}>
        {product.cip1 && (
          <span className={cn("font-mono px-1 rounded", active ? 'bg-white/20' : 'bg-slate-100')}>
            {product.cip1}
          </span>
        )}
        {product.rayon_name && <span className="truncate">{product.rayon_name}</span>}
        {extraMeta}
        <span className={cn(
          active ? 'text-blue-100 font-semibold' :
          isNegativeStock ? 'text-red-500 font-semibold' :
          isZeroStock ? 'text-slate-400' :
          'text-emerald-600 font-semibold'
        )}>
          {isZeroStock
            ? t('facturation:search.out_of_stock', { defaultValue: 'Épuisé' })
            : `${t('facturation:search.stock_label')} ${stock}`}
        </span>
        {showPrice && product.selling_price !== undefined && product.selling_price !== null && (
          <span className={cn("font-bold", active ? 'text-white' : 'text-emerald-700')}>
            {formatCurrency(Number(product.selling_price))}
          </span>
        )}
      </div>
    </div>
  )
}

export interface ProductResultRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'> {
  product: SearchResult
  active?: boolean
  /** Produit en rupture non sélectionnable (vente sans stock négatif). */
  blocked?: boolean
  badges?: React.ReactNode
  /** Contenu affiché à droite (bouton +, chevron…). */
  right?: React.ReactNode
  extraMeta?: React.ReactNode
  showPrice?: boolean
  onClick?: () => void
  /** Props de navigation clavier (data-search-index, id, onMouseEnter, className, style). */
  itemProps?: Record<string, unknown> & { className?: string; style?: React.CSSProperties }
}

export const ProductResultRow: React.FC<ProductResultRowProps> = ({
  product,
  active = false,
  blocked = false,
  badges,
  right,
  extraMeta,
  showPrice,
  onClick,
  itemProps,
  className,
  ...rest
}) => (
  <div
    {...rest}
    {...itemProps}
    onClick={onClick}
    style={active ? itemProps?.style : undefined}
    className={cn(
      itemProps?.className,
      "group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all",
      active ? 'bg-blue-500 shadow-md border-l-4 border-l-blue-700' : 'hover:bg-slate-50',
      blocked && !active && 'text-slate-400 cursor-not-allowed',
      className
    )}
  >
    <ProductResultContent product={product} active={active} badges={badges} extraMeta={extraMeta} showPrice={showPrice} />
    {right}
  </div>
)

export default ProductResultRow

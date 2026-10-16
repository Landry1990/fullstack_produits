/**
 * Thème visuel partagé pour les graphiques Recharts.
 *
 * Usage :
 *   <Tooltip {...chartTooltipProps} formatter={...} />
 *   <XAxis {...chartXAxisProps} />
 *   <YAxis {...chartYAxisProps} tickFormatter={...} />
 *   <Bar {...chartBarProps} />
 *   <Pie {...chartPieProps} />
 *   <defs>…</defs> ou <ChartGradients id="ca" from="#10b981" to="#059669" />
 */

import type { CSSProperties } from 'react'

/** contentStyle commun (carte blanche arrondie + ombre) — cohérent dashboard. */
export const chartTooltipContentStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  boxShadow: '0 10px 25px -5px rgba(0,0,0,.2)',
  padding: '10px 14px',
}

export const chartTooltipItemStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#334155',
}

export const chartTooltipLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  color: '#94a3b8',
  marginBottom: 4,
}

/** Props prêtes à l'emploi pour <Tooltip> (formatter séparé). */
export const chartTooltipProps = {
  contentStyle: chartTooltipContentStyle,
  itemStyle: chartTooltipItemStyle,
  labelStyle: chartTooltipLabelStyle,
} as const

/** Curseur de survol pour les graphiques en barres (bande grise discrète). */
export const chartBarCursor = { fill: '#f1f5f9' } as const

/** Curseur de survol pour les graphiques en lignes/aires (filet vertical). */
export const chartLineCursor = { stroke: '#e2e8f0', strokeWidth: 1 } as const

/** Props axes épurés (pas de ligne d'axe ni de tick). */
export const chartXAxisProps = {
  axisLine: false,
  tickLine: false,
  tick: { fontSize: 11, fontWeight: 700, fill: '#64748b' },
  dy: 8,
} as const

export const chartYAxisProps = {
  axisLine: false,
  tickLine: false,
  tick: { fontSize: 10, fontWeight: 700, fill: '#94a3b8' },
} as const

/** Grille horizontale seule, discrète. */
export const chartGridProps = {
  strokeDasharray: '3 3',
  vertical: false,
  stroke: '#e2e8f0',
} as const

/** Barres arrondies + taille max + animation. */
export const chartBarProps = {
  radius: [6, 6, 0, 0] as [number, number, number, number],
  maxBarSize: 42,
  animationDuration: 900,
} as const

/** Donut moderne : coins arrondis + séparation blanche. */
export const chartPieProps = {
  paddingAngle: 2,
  cornerRadius: 6,
  stroke: '#ffffff',
  strokeWidth: 2,
  animationDuration: 900,
} as const

/** Légende discrète uppercase. */
export const chartLegendProps = {
  wrapperStyle: { fontSize: 10, fontWeight: 800, textTransform: 'uppercase' as const, paddingTop: 8 },
} as const

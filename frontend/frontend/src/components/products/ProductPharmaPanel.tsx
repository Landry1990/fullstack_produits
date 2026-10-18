import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../shadcn/tabs'
import { Badge } from '../shadcn/badge'
import {
  Loader2,
  Pill,
  AlertTriangle,
  BookOpen,
  Package,
  Activity,
  List,
  FlaskConical,
  Thermometer,
  Stethoscope,
} from 'lucide-react'
import type { PharmaData, PosologyBlock, PharmaInteraction } from '../../hooks/useProductPharmaData'

interface ProductPharmaPanelProps {
  data: PharmaData | null
  loading?: boolean
}

const GRAVITY_ORDER = ['CONTRE_INDIQUE', 'DECONSEILLE', 'PRECAUTION', 'A_PRENDRE_EN_COMPTE']

export default function ProductPharmaPanel({ data, loading }: ProductPharmaPanelProps) {
  const { t } = useTranslation(['products', 'sales'])
  const [activeTab, setActiveTab] = useState('posology')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400">
        <Loader2 className="size-5 animate-spin mr-2" />
        {t('products:pharma.loading')}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm text-center px-4">
        <BookOpen className="size-8 mb-2 opacity-30" />
        {t('products:pharma.no_data')}
      </div>
    )
  }

  const hasPosology = data.posology_blocks.length > 0 || data.indication_items.length > 0
  const hasInteractions = data.interactions.length > 0
  const hasPrinciples = data.active_principles.length > 0
  const hasClasses = data.therapeutic_classes.length > 0
  const hasGenerics = data.generiques.length > 0

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-white border-b border-slate-200 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-slate-800 leading-tight truncate" title={data.product.name}>
              {data.product.name}
            </h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-slate-500 mt-1">
              <span>CIP: {data.product.cip1 || '—'}</span>
              {data.product.code_atc && (
                <Badge variant="outline" className="text-[10px] font-mono px-1 py-0 h-auto">
                  ATC {data.product.code_atc}
                </Badge>
              )}
            </div>
          </div>
        </div>
        {hasPrinciples && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {data.active_principles.map((p) => (
              <Badge
                key={p}
                className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200 text-[10px] px-1.5 py-0.5"
              >
                <FlaskConical className="size-3 mr-1" />
                {p}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start rounded-none border-b border-slate-200 bg-white px-2 pt-1 h-auto flex-wrap gap-1">
          <TabTrigger value="posology" icon={<Pill className="size-3.5" />} label={t('products:pharma.tab_posology')} />
          <TabTrigger
            value="interactions"
            icon={<AlertTriangle className="size-3.5" />}
            label={t('products:pharma.tab_interactions')}
            count={hasInteractions ? data.interactions.length : undefined}
            activeClass="data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700"
          />
          <TabTrigger
            value="principles"
            icon={<Activity className="size-3.5" />}
            label={t('products:pharma.tab_principles')}
            activeClass="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
          />
          <TabTrigger
            value="classes"
            icon={<List className="size-3.5" />}
            label={t('products:pharma.tab_classes')}
            activeClass="data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700"
          />
          <TabTrigger
            value="generics"
            icon={<Package className="size-3.5" />}
            label={t('products:pharma.tab_generics')}
            count={hasGenerics ? data.generiques.length : undefined}
            activeClass="data-[state=active]:bg-slate-100 data-[state=active]:text-slate-700"
          />
        </TabsList>

        <div className="flex-1 overflow-auto p-3">
          <TabsContent value="posology" className="mt-0 space-y-3">
            {!hasPosology ? (
              <EmptyState text={t('products:pharma.no_posology')} />
            ) : (
              <>
                {data.indication_items.length > 0 && (
                  <InfoSection title={t('products:pharma.indications')} icon={<Stethoscope className="size-3.5" />}>
                    <ul className="flex flex-wrap gap-1.5">
                      {data.indication_items.map((txt, i) => (
                        <li key={i}>
                          <Badge variant="secondary" className="text-xs font-normal px-2 py-0.5">
                            {txt}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </InfoSection>
                )}
                {data.posology_blocks.map((block, i) => (
                  <PosologyBlockView key={i} block={block} />
                ))}
                {data.conservation_texts.length > 0 && (
                  <InfoSection title={t('products:pharma.conservation')} icon={<Thermometer className="size-3.5" />}>
                    <div className="space-y-1">
                      {data.conservation_texts.map((txt, i) => (
                        <p key={i} className="text-sm text-slate-700 whitespace-pre-line">
                          {txt}
                        </p>
                      ))}
                    </div>
                  </InfoSection>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="interactions" className="mt-0 space-y-2">
            {!hasInteractions ? (
              <EmptyState text={t('products:pharma.no_interactions')} />
            ) : (
              <InteractionsList interactions={data.interactions} />
            )}
          </TabsContent>

          <TabsContent value="principles" className="mt-0 space-y-2">
            {!hasPrinciples ? (
              <EmptyState text={t('products:pharma.no_principles')} />
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.active_principles.map((p) => (
                  <Badge key={p} variant="outline" className="text-sm px-2.5 py-1 border-blue-200 text-blue-800">
                    {p}
                  </Badge>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="classes" className="mt-0 space-y-2">
            {!hasClasses ? (
              <EmptyState text={t('products:pharma.no_classes')} />
            ) : (
              <div className="space-y-2">
                {data.therapeutic_classes.map((cls, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-sm text-slate-700">{cls.label}</span>
                    <Badge variant="secondary" className="text-xs font-mono">{cls.code}</Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="generics" className="mt-0 space-y-2">
            {!hasGenerics ? (
              <EmptyState text={t('products:pharma.no_generics')} />
            ) : (
              <div className="space-y-2">
                {data.generiques.map((gen) => (
                  <div
                    key={gen.id}
                    className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100"
                  >
                    <span className="text-sm text-slate-700 truncate pr-2" title={gen.name}>
                      {gen.name}
                    </span>
                    <div className="text-xs text-slate-500 shrink-0">
                      {gen.selling_price} · {t('products:pharma.stock', { count: gen.stock })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

function TabTrigger({
  value,
  icon,
  label,
  count,
  activeClass = 'data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700',
}: {
  value: string
  icon: React.ReactNode
  label: string
  count?: number
  activeClass?: string
}) {
  return (
    <TabsTrigger
      value={value}
      className={`text-xs px-2 py-1.5 gap-1 ${activeClass}`}
    >
      {icon}
      {label}
      {typeof count === 'number' && (
        <Badge variant="secondary" className="ml-0.5 h-4 text-[10px] px-1">
          {count}
        </Badge>
      )}
    </TabsTrigger>
  )
}

function InfoSection({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
      <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
        {icon}
        {title}
      </h4>
      {children}
    </div>
  )
}

const FIELD_LABEL_KEYS: Record<string, string> = {
  'Voie(s)': 'products:pharma.field_voie',
  'Terrain(s)': 'products:pharma.field_terrain',
  'Indication(s)': 'products:pharma.field_indication',
  'Posologie USUELLE': 'products:pharma.field_posology',
  'Dose minimale': 'products:pharma.field_dose_min',
  'Dose maximale': 'products:pharma.field_dose_max',
  'Fréquence minimale': 'products:pharma.field_freq_min',
  'Fréquence maximale': 'products:pharma.field_freq_max',
  'Durée de traitement': 'products:pharma.field_duration',
}

function PosologyBlockView({ block }: { block: PosologyBlock }) {
  const { t } = useTranslation('products')
  const fields = Object.entries(block.fields)
  return (
    <div className="bg-emerald-50/70 rounded-xl p-3 border border-emerald-100 space-y-1.5">
      {fields.map(([key, value]) => (
        <div key={key} className="text-sm">
          <span className="font-semibold text-emerald-800/80">{t(FIELD_LABEL_KEYS[key] || key)}:</span>{' '}
          <span className="text-slate-800">{value}</span>
        </div>
      ))}
    </div>
  )
}

const GRAVITY_CONFIG: Record<string, { cls: string; order: number }> = {
  CONTRE_INDIQUE: { cls: 'bg-red-100 text-red-800 border-red-200', order: 0 },
  DECONSEILLE: { cls: 'bg-orange-100 text-orange-800 border-orange-200', order: 1 },
  PRECAUTION: { cls: 'bg-amber-100 text-amber-800 border-amber-200', order: 2 },
  A_PRENDRE_EN_COMPTE: { cls: 'bg-blue-100 text-blue-800 border-blue-200', order: 3 },
}

function InteractionsList({ interactions }: { interactions: PharmaInteraction[] }) {
  const { t } = useTranslation('products')
  const grouped = useMemo(() => {
    const map: Record<string, PharmaInteraction[]> = {}
    for (const inter of interactions) {
      ;(map[inter.gravity] ||= []).push(inter)
    }
    return map
  }, [interactions])

  return (
    <div className="space-y-3">
      {GRAVITY_ORDER.map((gravity) => {
        const list = grouped[gravity]
        if (!list?.length) return null
        const cfg = GRAVITY_CONFIG[gravity] || GRAVITY_CONFIG.A_PRENDRE_EN_COMPTE
        return (
          <div key={gravity}>
            <h4 className={`text-xs font-bold uppercase tracking-wider mb-1.5 px-1 ${cfg.cls.split(' ')[1]}`}>
              {t(`products:pharma.gravity_${gravity}`)} ({list.length})
            </h4>
            <div className="space-y-2">
              {list.map((inter, i) => (
                <InteractionRow key={i} interaction={inter} cfg={cfg} t={t} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function InteractionRow({
  interaction,
  cfg,
  t,
}: {
  interaction: PharmaInteraction
  cfg: { cls: string }
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  const partnerName = interaction.other.startsWith('MQ-')
    ? `${t('products:pharma.unknown_substance')} (${interaction.other})`
    : interaction.other

  return (
    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-medium text-slate-800 leading-snug min-w-0 truncate" title={partnerName}>
          {t('products:pharma.interaction_with', { name: partnerName })}
        </p>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 shrink-0 ${cfg.cls}`}>
          {t(`products:pharma.gravity_${interaction.gravity}`)}
        </Badge>
      </div>
      {interaction.description && (
        <p className="text-xs text-slate-500 leading-relaxed">{interaction.description}</p>
      )}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-sm text-center">
      <BookOpen className="size-8 mb-2 opacity-30" />
      {text}
    </div>
  )
}

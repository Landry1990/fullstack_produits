import type { TVA } from '../../types'
import { Trash2, Loader2, Settings } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../shadcn/input'
import { Badge } from '../shadcn/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../shadcn/table'
import type { SettingsTabProps } from './types'

type TFunc = SettingsTabProps['t']

function TVARow({ tva, onDelete, t }: { tva: TVA; onDelete: (id: number) => void; t: TFunc }) {
  return (
    <TableRow className="hover:bg-indigo-50/50 transition-colors group">
      <TableCell className="font-black text-2xl text-indigo-600">{tva.taux}%</TableCell>
      <TableCell className="font-medium text-slate-500">{tva.libelle || '-'}</TableCell>
      <TableCell>
        {tva.is_active ? (
          <Badge className="bg-emerald-500 text-white font-bold px-4 py-1.5 rounded-lg shadow-sm shadow-emerald-500/20">{t('tva.active')}</Badge>
        ) : (
          <Badge variant="outline" className="font-medium px-4 py-1.5 rounded-lg opacity-60">{t('tva.inactive')}</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDelete(tva.id)}
          className="text-red-600 hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
          title={t('tva.delete')}
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

export function TVATable({ tvaList, loadingTVA, deleteTVA, t }: { tvaList: TVA[]; loadingTVA: boolean; deleteTVA: (id: number) => void; t: TFunc }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <Table className="w-full">
        <TableHeader>
          <TableRow className="bg-slate-100 hover:bg-slate-100">
            <TableHead className="font-bold text-slate-500">{t('tva.rate')}</TableHead>
            <TableHead className="font-bold text-slate-500">{t('tva.label')}</TableHead>
            <TableHead className="font-bold text-slate-500">{t('tva.status')}</TableHead>
            <TableHead className="text-right font-bold text-slate-500">{t('tva.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loadingTVA ? (
            <TableRow><TableCell colSpan={4} className="text-center p-12"><Loader2 className="inline-block size-8 animate-spin text-indigo-600" /></TableCell></TableRow>
          ) : !Array.isArray(tvaList) || tvaList.length === 0 ? (
            <TableRow><TableCell colSpan={4} className="text-center p-12 opacity-40 italic">{t('tva.empty')}</TableCell></TableRow>
          ) : (
            tvaList.map(tva => <TVARow key={tva.id} tva={tva} onDelete={deleteTVA} t={t} />)
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function TVAForm({ t, newTvaRate, setNewTvaRate, newTvaLabel, setNewTvaLabel, addingTva, handleAddTva }: { t: TFunc; newTvaRate: string; setNewTvaRate: (v: string) => void; newTvaLabel: string; setNewTvaLabel: (v: string) => void; addingTva: boolean; handleAddTva: () => void }) {
  return (
    <div className="bg-slate-100 p-8 rounded-[2rem] border border-slate-200">
      <h3 className="font-bold text-lg mb-6 flex items-center gap-3">
        <Settings className="size-5 text-indigo-600" />
        {t('tva.add_title')}
      </h3>
      <div className="flex flex-col md:flex-row gap-6 items-end">
        <div className="flex flex-col gap-1 w-full md:w-48">
          <label><span className="text-sm font-bold text-slate-500">{t('tva.rate')} *</span></label>
          <div className="relative">
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              className="w-full h-12 rounded-xl font-bold pr-10"
              value={newTvaRate}
              onChange={e => setNewTvaRate(e.target.value)}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-300">%</div>
          </div>
        </div>
        <div className="flex flex-col gap-1 w-full md:flex-1">
          <label><span className="text-sm font-bold text-slate-500">{t('tva.label')}</span></label>
          <Input
            type="text"
            placeholder={t('placeholders.tva_label')}
            className="w-full h-12 rounded-xl"
            value={newTvaLabel}
            onChange={e => setNewTvaLabel(e.target.value)}
          />
        </div>
        <Button
          type="button"
          onClick={handleAddTva}
          disabled={addingTva || !newTvaRate}
          className="h-12 px-10 rounded-xl shadow-lg shadow-indigo-500/30"
        >
          {addingTva ? <Loader2 className="size-5 animate-spin" /> : t('tva.add_btn')}
        </Button>
      </div>
    </div>
  )
}

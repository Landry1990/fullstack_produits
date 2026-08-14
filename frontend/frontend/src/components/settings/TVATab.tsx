import { Percent } from 'lucide-react'
import { TVATable, TVAForm } from './TVAComponents'
import type { TVATabProps } from './types'

export function TVATab({ t, tvaList, loadingTVA, deleteTVA, newTvaRate, setNewTvaRate, newTvaLabel, setNewTvaLabel, addingTva, handleAddTva }: TVATabProps) {
  return (
    <div className="bg-white shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden rounded-2xl">
      <div className="p-0">
        <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50">
          <h2 className="font-bold text-xl flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Percent className="h-5 w-5 text-indigo-600" />
            </div>
            {t('sections.tva')}
          </h2>
        </div>
        <div className="p-8 space-y-8">
          <TVATable tvaList={tvaList} loadingTVA={loadingTVA} deleteTVA={deleteTVA} t={t} />
          <TVAForm
            t={t}
            newTvaRate={newTvaRate}
            setNewTvaRate={setNewTvaRate}
            newTvaLabel={newTvaLabel}
            setNewTvaLabel={setNewTvaLabel}
            addingTva={addingTva}
            handleAddTva={handleAddTva}
          />
        </div>
      </div>
    </div>
  )
}

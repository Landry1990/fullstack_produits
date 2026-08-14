import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import FacturationHeader from './facturation/FacturationHeader'
import FacturationLeftPanel from './facturation/FacturationLeftPanel'
import FacturationRightPanel from './facturation/FacturationRightPanel'
import FacturationModals from './facturation/FacturationModals'

import { useFacturationState } from '../hooks/useFacturationState'
import { useDatamatrixScan } from '../hooks/useDatamatrixScan'

export default function Facturation() {
  const hook = useFacturationState()
  const location = useLocation()
  const navigate = useNavigate()
  const [showOpenPosteModal, setShowOpenPosteModal] = useState(false)
  const [datamatrixEnabled, setDatamatrixEnabled] = useState(false)

  useEffect(() => {
    if (location.state?.openPosteModal) {
      setShowOpenPosteModal(true)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location, navigate])

  const scan = useDatamatrixScan({
    addProduit: (p, opts) => hook.cart.addProduit(p, opts),
    setLignesFacture: hook.cart.setLignesFacture,
    lignesFacture: hook.cart.lignesFacture,
  })

  return (
    <div className="relative h-full flex flex-col bg-slate-50 font-sans text-slate-900 overflow-hidden">

      <FacturationHeader
        hook={hook}
        datamatrixEnabled={datamatrixEnabled}
        setDatamatrixEnabled={setDatamatrixEnabled}
        setShowOpenPosteModal={setShowOpenPosteModal}
      />

      {/* ── MAIN LAYOUT ── */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        <FacturationLeftPanel hook={hook} datamatrixEnabled={datamatrixEnabled} scan={scan} />
        <FacturationRightPanel hook={hook} />
      </div>

      {/* ── ALL MODALS ── */}
      <FacturationModals
        hook={hook}
        showOpenPosteModal={showOpenPosteModal}
        setShowOpenPosteModal={setShowOpenPosteModal}
      />
    </div>
  )
}

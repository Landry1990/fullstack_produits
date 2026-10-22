/**
 * Historique des clôtures de caisse — composant orchestrateur.
 * La logique (état, fetch, filtres, export, impression) vit dans
 * `hooks/caisse/useHistoriqueClotures` ; le rendu est découpé dans
 * `components/caisse/clotures/` (header, stats, table, sessions, modales).
 */
import { motion, AnimatePresence } from 'framer-motion'
import { useHistoriqueClotures } from '../hooks/caisse/useHistoriqueClotures'
import { tabContent } from '../lib/motion'
import CloturesHeader from './caisse/clotures/CloturesHeader'
import SessionsPanel from './caisse/clotures/SessionsPanel'
import CloturesStats from './caisse/clotures/CloturesStats'
import CloturesTable from './caisse/clotures/CloturesTable'
import ClotureDetailDialog from './caisse/clotures/ClotureDetailDialog'
import SessionDetailDialog from './caisse/clotures/SessionDetailDialog'

export default function HistoriqueClotures() {
  const state = useHistoriqueClotures()
  const { activeTab, canViewSessions } = state
  const showSessions = activeTab === 'sessions' && canViewSessions

  return (
    <div className="h-full flex flex-col bg-slate-50 max-w-[1600px] mx-auto w-full">
      {/* Header and Filters Card */}
      <CloturesHeader state={state} />

      {/* Contenu conditionnel selon l'onglet */}
      <AnimatePresence mode="wait">
        <motion.div
          key={showSessions ? 'sessions' : 'clotures'}
          variants={tabContent}
          initial="hidden"
          animate="show"
          exit="exit"
          className="flex-1 min-h-0 flex flex-col"
        >
          {showSessions ? (
            /* ========== ONGLET SESSIONS DE CAISSE ========== */
            <SessionsPanel state={state} />
          ) : (
            /* ========== ONGLET CLÔTURES (existant) ========== */
            <>
              <CloturesStats state={state} />
              <CloturesTable state={state} />

              {/* Modal détails */}
              <ClotureDetailDialog state={state} />
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Modal Détail Session de Caisse */}
      <SessionDetailDialog state={state} />
    </div>
  )
}

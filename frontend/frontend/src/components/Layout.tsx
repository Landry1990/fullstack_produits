import { Suspense, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import Sidebar from './Sidebar'
import UserHeader from './common/UserHeader'
import Omnisearch from './common/Omnisearch'
import { Button } from './shadcn/button'
import TransformationAlertListener from './common/TransformationAlertListener'
import { SidebarProvider } from '../context/SidebarContext'
import { useSidebar } from '../hooks/useSidebar'
import { usePosteCaisseMode } from '../context/PosteCaisseModeContext'
import LicenceExpirationBanner from './LicenceExpirationBanner'
import UpdateReminderModal from './UpdateReminderModal'

function LayoutContent() {
  const { isZenithMode, isMidnightTheme } = useSidebar()
  const { isPosMode, activePoste, closePoste, isLoading } = usePosteCaisseMode()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (isPosMode && location.pathname !== '/app/facturation') {
      navigate('/app/facturation', { replace: true })
    }
  }, [isPosMode, location.pathname, navigate])

  if (isPosMode) {
    return (
      <div className={`flex flex-col h-dvh bg-base-100 transition-colors duration-300 relative overflow-hidden`}>
        <div className="shrink-0 z-50 flex items-center justify-between bg-emerald-600 text-white px-4 py-2 shadow-md">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm uppercase tracking-wide">Mode point de vente</span>
            {activePoste && (
              <span className="text-xs bg-emerald-700 px-2 py-0.5 rounded">
                {activePoste.nom}
              </span>
            )}
            {isLoading && <Loader2 className="size-3 animate-spin" />}
          </div>
          <Button
            type="button"
            onClick={() => closePoste()}
            variant="ghost" size="sm" className="text-white hover:bg-emerald-700 h-6 px-2 text-xs"
          >
            Fermer le point
          </Button>
        </div>
        <main className="flex-1 overflow-hidden">
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-dvh ${isZenithMode ? 'bg-base-100' : 'bg-base-200'} ${isMidnightTheme ? 'theme-midnight' : ''} transition-colors duration-300 relative overflow-hidden`}>
      <LicenceExpirationBanner />
      <div className="flex flex-1 relative overflow-hidden">
        <Omnisearch />
        {!isZenithMode && <Sidebar />}
        
        <main className={`flex-1 overflow-hidden flex flex-col transition-all duration-300 min-h-0`}>
          {!isZenithMode && (
            <div className="sticky top-0 z-40 flex items-center justify-end bg-base-200/80 backdrop-blur-md border-b border-base-300/50 px-2 py-1">
              <UserHeader />
            </div>
          )}
        <div className={`flex-1 flex flex-col max-size-full overflow-x-hidden overflow-y-auto ${!isZenithMode ? 'px-1 py-1 sm:px-2 sm:py-2 lg:px-3 lg:py-3 xl:px-4 xl:py-4' : ''}`}>
          {/* Outlet render direct - Suspense pour les composants lazy-loaded */}
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          }>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
    </div>
  )
}

export default function Layout() {
  return (
    <SidebarProvider>
      <TransformationAlertListener />
      <UpdateReminderModal />
      <LayoutContent />
    </SidebarProvider>
  )
}
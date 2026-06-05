import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import UserHeader from './common/UserHeader'
import Omnisearch from './common/Omnisearch'
import { SidebarProvider, useSidebar } from '../context/SidebarContext'
import LicenceExpirationBanner from './LicenceExpirationBanner'

function LayoutContent() {
  const { isZenithMode, isMidnightTheme } = useSidebar()

  return (
    <div className={`flex flex-col h-dvh ${isZenithMode ? 'bg-base-100' : 'bg-base-200'} ${isMidnightTheme ? 'theme-midnight' : ''} transition-colors duration-300 relative overflow-hidden`}>
      <LicenceExpirationBanner />
      <div className="flex flex-1 relative overflow-hidden">
        <Omnisearch />
        {!isZenithMode && <Sidebar />}
        
        <main className={`flex-1 overflow-hidden flex flex-col transition-all duration-300 min-h-0`}>
          {!isZenithMode && (
            <div className="sticky top-0 z-40 flex items-center justify-end bg-base-200/80 backdrop-blur-md border-b border-base-300/50 px-3 py-1">
              <UserHeader />
            </div>
          )}
        <div className={`flex-1 flex flex-col max-size-full overflow-x-hidden overflow-y-auto ${!isZenithMode ? 'px-2 py-2 sm:px-3 sm:py-3 lg:px-4 lg:py-4 xl:px-6 xl:py-5' : ''}`}>
          {/* Outlet render direct - Suspense pour les composants lazy-loaded */}
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
              <span className="loading loading-spinner loading-lg text-primary"></span>
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
      <LayoutContent />
    </SidebarProvider>
  )
}
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import UserHeader from './common/UserHeader'
import Omnisearch from './common/Omnisearch'
import { SidebarProvider, useSidebar } from '../context/SidebarContext'
import LicenceExpirationBanner from './LicenceExpirationBanner'

function LayoutContent() {
  const { isZenithMode, isMidnightTheme } = useSidebar()

  return (
    <div className={`flex flex-col min-h-screen ${isZenithMode ? 'bg-base-100' : 'bg-base-200'} ${isMidnightTheme ? 'theme-midnight' : ''} transition-colors duration-300 relative`}>
      <LicenceExpirationBanner />
      <div className="flex flex-1 relative overflow-hidden">
        <Omnisearch />
        {!isZenithMode && <Sidebar />}
        
        <main className={`flex-1 overflow-x-hidden overflow-y-auto h-screen ${isZenithMode ? 'p-0' : 'px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6'} transition-all duration-300 relative`}>
        <div className={`max-w-full h-full relative ${!isZenithMode ? 'pt-12 sm:pt-14' : ''}`}>
          {!isZenithMode && <UserHeader />}
          {/* Outlet render direct - Suspense deja dans App.tsx */}
          <Outlet />
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
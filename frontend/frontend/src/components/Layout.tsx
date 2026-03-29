import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import UserHeader from './common/UserHeader'
import Omnisearch from './common/Omnisearch'
import { SidebarProvider, useSidebar } from '../context/SidebarContext'

function LayoutContent() {
  const { isOpen, closeSidebar, isZenithMode, isMidnightTheme } = useSidebar()

  return (
    <div className={`flex min-h-screen ${isZenithMode ? 'bg-base-100' : 'bg-base-200'} ${isMidnightTheme ? 'theme-midnight' : ''} transition-colors duration-300 relative`}>
      <Omnisearch />
      {!isZenithMode && <Sidebar />}
      
      {/* Overlay pour fermer la sidebar sur mobile */}
      {isOpen && !isZenithMode && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <main className={`flex-1 overflow-x-hidden overflow-y-auto h-screen ${isZenithMode ? 'p-0' : 'p-4 md:p-6 lg:p-8'} transition-all duration-300 relative`}>
        <div className={`max-w-full h-full relative ${!isZenithMode ? 'pt-12 md:pt-14' : ''}`}>
          {!isZenithMode && <UserHeader />}
          <Outlet />
        </div>
      </main>
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
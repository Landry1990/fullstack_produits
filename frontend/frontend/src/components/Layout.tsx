import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { SidebarProvider, useSidebar } from '../context/SidebarContext'

function LayoutContent() {
  const { isOpen, closeSidebar, isZenithMode, isMidnightTheme } = useSidebar()

  return (
    <div className={`flex min-h-screen ${isZenithMode ? 'bg-base-100' : 'bg-base-200'} ${isMidnightTheme ? 'theme-midnight' : ''} transition-colors duration-300`}>
      {!isZenithMode && <Sidebar />}
      
      {/* Overlay pour fermer la sidebar sur mobile */}
      {isOpen && !isZenithMode && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}
      
      <main className={`flex-1 overflow-x-hidden overflow-y-auto h-screen ${isZenithMode ? 'p-0' : 'p-4 md:p-6 lg:p-8'} transition-all duration-300`}>
        <div className="max-w-full h-full">
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
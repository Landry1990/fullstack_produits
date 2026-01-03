import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { SidebarProvider, useSidebar } from '../context/SidebarContext'

function LayoutContent() {
  const { isOpen, closeSidebar } = useSidebar()

  return (
    <div className="flex min-h-screen bg-base-200">
      <Sidebar />
      
      {/* Overlay pour fermer la sidebar sur mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}
      
      
      <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden overflow-y-auto h-screen">
        <div className="max-w-full">
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
import { createContext, useContext, useState, type ReactNode } from 'react'

interface SidebarContextType {
  isOpen: boolean
  isCollapsed: boolean
  isZenithMode: boolean
  isMidnightTheme: boolean
  toggleSidebar: () => void
  closeSidebar: () => void
  openSidebar: () => void
  toggleCollapse: () => void
  toggleZenithMode: () => void
  toggleMidnightTheme: () => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  // Lire l'état sauvegardé depuis localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    return saved === 'true'
  })
  const [isZenithMode, setIsZenithMode] = useState(false)
  const [isMidnightTheme, setIsMidnightTheme] = useState(false)

  const toggleSidebar = () => setIsOpen(prev => !prev)
  const closeSidebar = () => setIsOpen(false)
  const openSidebar = () => setIsOpen(true)
  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }
  const toggleZenithMode = () => setIsZenithMode(prev => !prev)
  const toggleMidnightTheme = () => setIsMidnightTheme(prev => !prev)

  return (
    <SidebarContext.Provider value={{ 
      isOpen, 
      isCollapsed,
      isZenithMode, 
      isMidnightTheme,
      toggleSidebar, 
      closeSidebar, 
      openSidebar, 
      toggleCollapse,
      toggleZenithMode,
      toggleMidnightTheme
    }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}

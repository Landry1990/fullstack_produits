import { createContext, use, useState, useEffect, useMemo, type ReactNode } from 'react'

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
  const [isMidnightTheme, setIsMidnightTheme] = useState(() => {
    return localStorage.getItem('theme-midnight') === 'true'
  })

  // Appliquer le thème à la racine du document (pour affecter aussi les Modals et SweetAlerts)
  useEffect(() => {
    if (isMidnightTheme) {
      document.documentElement.classList.add('theme-midnight')
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.classList.remove('theme-midnight')
      document.documentElement.setAttribute('data-theme', 'light')
    }
  }, [isMidnightTheme])

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
  const toggleMidnightTheme = () => setIsMidnightTheme(prev => {
    const next = !prev
    localStorage.setItem('theme-midnight', String(next))
    return next
  })

  // Mémoriser l'objet value pour éviter les re-renders inutiles
  const contextValue = useMemo(() => ({
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
  }), [isOpen, isCollapsed, isZenithMode, isMidnightTheme]);

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const context = use(SidebarContext)
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}

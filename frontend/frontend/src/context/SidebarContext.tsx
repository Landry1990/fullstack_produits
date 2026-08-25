import { useState, useEffect, useMemo, createContext, type ReactNode } from 'react'

export interface SidebarContextType {
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

export const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

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

  // Auto-collapse on small desktop screens (1024px-1280px)
  // Sur mobile (< 1024px), ne pas collapser — la sidebar s'affiche en overlay
  // et doit montrer les labels complets + sous-menus cliquables
  useEffect(() => {
    const checkScreenWidth = () => {
      const isSmallDesktop = window.innerWidth >= 1024 && window.innerWidth < 1280
      if (isSmallDesktop) {
        setIsCollapsed(true)
      }
    }
    checkScreenWidth()
    window.addEventListener('resize', checkScreenWidth)
    return () => window.removeEventListener('resize', checkScreenWidth)
  }, [])

  // Persister les préférences utilisateur
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isCollapsed))
  }, [isCollapsed])

  useEffect(() => {
    localStorage.setItem('theme-midnight', String(isMidnightTheme))
  }, [isMidnightTheme])

  const toggleSidebar = () => setIsOpen(prev => !prev)
  const closeSidebar = () => setIsOpen(false)
  const openSidebar = () => setIsOpen(true)
  const toggleCollapse = () => setIsCollapsed(prev => !prev)
  const toggleZenithMode = () => setIsZenithMode(prev => !prev)
  const toggleMidnightTheme = () => setIsMidnightTheme(prev => !prev)

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


import { createContext, useContext, useState, type ReactNode } from 'react'

interface SidebarContextType {
  isOpen: boolean
  isZenithMode: boolean
  isMidnightTheme: boolean
  toggleSidebar: () => void
  closeSidebar: () => void
  openSidebar: () => void
  toggleZenithMode: () => void
  toggleMidnightTheme: () => void
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isZenithMode, setIsZenithMode] = useState(false)
  const [isMidnightTheme, setIsMidnightTheme] = useState(false)

  const toggleSidebar = () => setIsOpen(prev => !prev)
  const closeSidebar = () => setIsOpen(false)
  const openSidebar = () => setIsOpen(true)
  const toggleZenithMode = () => setIsZenithMode(prev => !prev)
  const toggleMidnightTheme = () => setIsMidnightTheme(prev => !prev)

  return (
    <SidebarContext.Provider value={{ 
      isOpen, 
      isZenithMode, 
      isMidnightTheme,
      toggleSidebar, 
      closeSidebar, 
      openSidebar, 
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

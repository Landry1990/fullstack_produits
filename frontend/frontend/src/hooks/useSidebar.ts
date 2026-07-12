import { use } from 'react'
import { SidebarContext, type SidebarContextType } from '../context/SidebarContext'

export function useSidebar(): SidebarContextType {
  const context = use<SidebarContextType | undefined>(SidebarContext)
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}

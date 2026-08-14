import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

export interface MenuItem {
  key: string
  labelKey: string
  submenus?: MenuItem[]
}

export interface MenuHierarchyResponse {
  hierarchy: MenuItem[]
  allKeys: string[]
  adminOnlyKeys: string[]
}

/**
 * Hook pour récupérer la hiérarchie des menus depuis le backend.
 * Source de vérité partagée entre frontend et backend.
 */
export function useMenuHierarchy() {
  return useQuery<MenuHierarchyResponse>({
    queryKey: ['menu-hierarchy'],
    queryFn: async () => {
      const res = await api.get('menu-hierarchy/')
      return res.data as MenuHierarchyResponse
    },
    staleTime: 1000 * 60 * 30, // 30 min (la hiérarchie change rarement)
    gcTime: 1000 * 60 * 60, // 1h en cache
  })
}

/**
 * Retourne toutes les clés de menus (parents + sous-menus).
 * Fallback statique si l'endpoint n'est pas disponible.
 */
export function getAllMenuKeysFromHierarchy(hierarchy: MenuItem[]): string[] {
  const keys: string[] = []
  hierarchy.forEach((menu) => {
    keys.push(menu.key)
    if (menu.submenus) {
      menu.submenus.forEach((sub) => keys.push(sub.key))
    }
  })
  return keys
}

/**
 * Récupère le label d'un menu à partir de sa clé.
 */
export function getMenuLabel(
  hierarchy: MenuItem[],
  key: string,
  t: (key: string, options?: { defaultValue?: string }) => string
): string {
  for (const menu of hierarchy) {
    if (menu.key === key) {
      return t(menu.labelKey, { defaultValue: menu.key })
    }
    if (menu.submenus) {
      for (const sub of menu.submenus) {
        if (sub.key === key) {
          return t(sub.labelKey, { defaultValue: sub.key })
        }
      }
    }
  }
  return key
}

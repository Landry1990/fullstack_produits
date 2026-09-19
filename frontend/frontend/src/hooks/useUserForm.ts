import { useState } from 'react';
import { getAllMenuKeysFromHierarchy, type MenuItem } from './useMenuHierarchy';
import {
  PERMISSIONS_META,
  ROLE_MENU_DEFAULTS,
  ADMIN_MENU_KEYS_FALLBACK,
  buildInitialPermissions,
  buildInitialFormData,
  type ManagedUser,
  type UserFormData,
  type Role,
} from '../components/users/usersMeta';

/**
 * Encapsule l'état du formulaire de création/édition d'utilisateur :
 * formData + presets de rôle + toggles de menus + copie de droits.
 */
export function useUserForm(menuHierarchy: MenuItem[], adminOnlyKeys?: string[]) {
  const [formData, setFormData] = useState<UserFormData>(() => buildInitialFormData());

  const adminKeys = adminOnlyKeys && adminOnlyKeys.length > 0 ? adminOnlyKeys : ADMIN_MENU_KEYS_FALLBACK;
  const getAllMenuKeys = () => getAllMenuKeysFromHierarchy(menuHierarchy);

  const applyRole = (role: string, preserveMenus: boolean = false) => {
    if (!['PHARMACIEN', 'CAISSIER', 'VENDEUR', 'COMPTABLE'].includes(role)) return;

    const typedRole = role as Role;
    const updates: Partial<UserFormData> = {
      role: typedRole,
      is_superuser: typedRole === 'PHARMACIEN',
      max_discount_rate: typedRole === 'PHARMACIEN' ? 100 : 0,
    };

    PERMISSIONS_META.forEach(p => {
      (updates as Record<string, boolean>)[p.key] = p.roleDefaults[typedRole];
    });

    if (!preserveMenus) {
      updates.allowed_menus = typedRole === 'PHARMACIEN' ? getAllMenuKeys() : ROLE_MENU_DEFAULTS[typedRole];
    }

    setFormData(prev => ({ ...prev, ...updates }));
  };

  /** Copie rôle + menus + permissions depuis un autre utilisateur. */
  const copyFromUser = (sourceUser: ManagedUser) => {
    const role = sourceUser.profile?.role || (sourceUser.is_superuser ? 'PHARMACIEN' : 'VENDEUR');

    setFormData(prev => {
      const updates: Partial<UserFormData> = {
        role,
        is_superuser: sourceUser.is_superuser,
        allowed_menus: sourceUser.profile?.allowed_menus || [],
        max_discount_rate: Number(sourceUser.profile?.max_discount_rate || 0),
      };
      PERMISSIONS_META.forEach(p => {
        (updates as Record<string, boolean>)[p.key] = sourceUser.profile?.[p.key] || false;
      });
      // Preserve the legacy copy default for cash totals.
      updates.can_view_cash_totals = sourceUser.profile?.can_view_cash_totals ?? true;
      return { ...prev, ...updates };
    });
  };

  /** Initialise le formulaire pour l'édition d'un utilisateur existant. */
  const initForEdit = (user: ManagedUser) => {
    const cleanedMenus = (user.profile?.allowed_menus || []).filter(k => !adminKeys.includes(k));
    const base: UserFormData = {
      username: user.username,
      email: user.email,
      password: '',
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.profile?.role || (user.is_superuser ? 'PHARMACIEN' : 'VENDEUR'),
      is_superuser: user.is_superuser,
      is_active: user.is_active,
      allowed_menus: cleanedMenus,
      max_discount_rate: Number(user.profile?.max_discount_rate || 0),
      ...buildInitialPermissions('VENDEUR'),
    };
    if (user.is_superuser) {
      // A superuser implicitly has all menus and permissions regardless of
      // Profile flags; reflect that in the form so nothing is left unchecked.
      base.allowed_menus = getAllMenuKeys();
      PERMISSIONS_META.forEach(p => {
        base[p.key] = true;
      });
      base.max_discount_rate = 100;
    } else {
      PERMISSIONS_META.forEach(p => {
        base[p.key] = user.profile?.[p.key] || false;
      });
      // Preserve legacy default for cash totals when not explicitly set.
      base.can_view_cash_totals = user.profile?.can_view_cash_totals ?? true;
    }
    setFormData(base);
  };

  const initForCreate = () => setFormData(buildInitialFormData());

  const toggleMenu = (menuKey: string, submenus?: { key: string }[]) => {
    setFormData(prev => {
      let allowed = [...prev.allowed_menus];
      const allowedSet = new Set(allowed);
      const isParent = !!submenus;
      const isCurrentlySelected = allowedSet.has(menuKey);

      if (isCurrentlySelected) {
        allowed = allowed.filter(k => k !== menuKey);
        if (isParent) {
          const subKeySet = new Set(submenus.map(s => s.key));
          allowed = allowed.filter(k => !subKeySet.has(k));
        }
      } else {
        allowed.push(menuKey);
        if (isParent) {
          submenus.forEach(sub => {
            if (!allowedSet.has(sub.key)) {
              allowed.push(sub.key);
            }
          });
        }
      }
      return { ...prev, allowed_menus: allowed };
    });
  };

  const toggleSubMenu = (submenuKey: string, parentKey: string, totalSubmenusCount: number) => {
    setFormData(prev => {
      let allowed = [...prev.allowed_menus];
      const allowedSet = new Set(allowed);
      if (allowedSet.has(submenuKey)) {
        allowed = allowed.filter(k => k !== submenuKey);
        allowed = allowed.filter(k => k !== parentKey);
      } else {
        allowed.push(submenuKey);
        allowedSet.add(submenuKey);
        const parent = menuHierarchy.find(m => m.key === parentKey);
        const currentCount = parent?.submenus?.filter(s => allowedSet.has(s.key)).length || 0;
        if (currentCount === totalSubmenusCount && !allowedSet.has(parentKey)) {
          allowed.push(parentKey);
        }
      }
      return { ...prev, allowed_menus: allowed };
    });
  };

  return {
    formData,
    setFormData,
    getAllMenuKeys,
    applyRole,
    copyFromUser,
    initForEdit,
    initForCreate,
    toggleMenu,
    toggleSubMenu,
  };
}

export type UserForm = ReturnType<typeof useUserForm>;

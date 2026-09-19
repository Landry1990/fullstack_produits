/**
 * Métadonnées métier de la gestion des utilisateurs.
 *
 * ⚠️ Sync backend : chaque clé de PERMISSIONS_META doit correspondre à un champ
 * du modèle Profile (backend/api/models/users.py) et du ProfileSerializer
 * (backend/api/serializers/users.py).
 */

export const PERMISSIONS_META = [
  { key: 'can_cash_out', labelKey: 'permissions.cash_out', descKey: 'permissions.cash_out_desc', group: 'operations', color: 'emerald' as const, roleDefaults: { PHARMACIEN: true, CAISSIER: true, VENDEUR: false, COMPTABLE: false } },
  { key: 'can_do_returns', labelKey: 'permissions.returns', group: 'operations', roleDefaults: { PHARMACIEN: true, CAISSIER: false, VENDEUR: false, COMPTABLE: false } },
  { key: 'can_sell_negative_stock', labelKey: 'permissions.negative_stock', group: 'operations', color: 'warning' as const, roleDefaults: { PHARMACIEN: true, CAISSIER: false, VENDEUR: false, COMPTABLE: false } },
  { key: 'can_modify_price', labelKey: 'permissions.modify_price', group: 'operations', roleDefaults: { PHARMACIEN: true, CAISSIER: false, VENDEUR: false, COMPTABLE: false } },
  { key: 'can_do_remise', labelKey: 'permissions.modify_remise', group: 'operations', roleDefaults: { PHARMACIEN: true, CAISSIER: false, VENDEUR: false, COMPTABLE: false } },
  { key: 'can_generate_coupon', labelKey: 'permissions.generate_coupon', group: 'operations', roleDefaults: { PHARMACIEN: true, CAISSIER: false, VENDEUR: false, COMPTABLE: false } },
  { key: 'can_modify_invoice', labelKey: 'permissions.modify_invoice', group: 'operations', roleDefaults: { PHARMACIEN: true, CAISSIER: true, VENDEUR: false, COMPTABLE: false } },
  { key: 'can_view_cash_sessions', labelKey: 'permissions.view_cash_sessions', group: 'operations', roleDefaults: { PHARMACIEN: true, CAISSIER: false, VENDEUR: false, COMPTABLE: false } },
  { key: 'can_view_cash_totals', labelKey: 'permissions.view_cash_totals', group: 'operations', roleDefaults: { PHARMACIEN: true, CAISSIER: false, VENDEUR: false, COMPTABLE: true } },
  { key: 'can_validate_sales', labelKey: 'permissions.can_validate_sales', group: 'operations', roleDefaults: { PHARMACIEN: true, CAISSIER: false, VENDEUR: false, COMPTABLE: false } },
  { key: 'is_terminal_account', labelKey: 'permissions.is_terminal_account', group: 'operations', roleDefaults: { PHARMACIEN: false, CAISSIER: false, VENDEUR: false, COMPTABLE: false } },
  { key: 'can_validate_zero_amount', labelKey: 'permissions.validate_zero_amount', group: 'sudo', color: 'error' as const, roleDefaults: { PHARMACIEN: true, CAISSIER: false, VENDEUR: false, COMPTABLE: false } },
  { key: 'can_cancel_invoice', labelKey: 'permissions.cancel_invoice', group: 'sudo', color: 'error' as const, roleDefaults: { PHARMACIEN: true, CAISSIER: false, VENDEUR: false, COMPTABLE: false } },
  { key: 'can_cancel_promis', labelKey: 'permissions.cancel_promis', group: 'sudo', color: 'error' as const, roleDefaults: { PHARMACIEN: true, CAISSIER: false, VENDEUR: false, COMPTABLE: false } },
  { key: 'can_delete_product', labelKey: 'permissions.delete_product', group: 'sudo', color: 'error' as const, roleDefaults: { PHARMACIEN: true, CAISSIER: false, VENDEUR: false, COMPTABLE: false } },
  { key: 'can_delete_fournisseur', labelKey: 'permissions.delete_fournisseur', group: 'sudo', color: 'error' as const, roleDefaults: { PHARMACIEN: true, CAISSIER: false, VENDEUR: false, COMPTABLE: false } },
  { key: 'can_adjust_stock', labelKey: 'permissions.adjust_stock', group: 'sudo', color: 'warning' as const, roleDefaults: { PHARMACIEN: true, CAISSIER: false, VENDEUR: false, COMPTABLE: false } },
  { key: 'can_manage_perimes', labelKey: 'permissions.manage_perimes', group: 'sudo', color: 'warning' as const, roleDefaults: { PHARMACIEN: true, CAISSIER: false, VENDEUR: false, COMPTABLE: false } },
  { key: 'can_manage_avoirs', labelKey: 'permissions.manage_avoirs', group: 'sudo', color: 'warning' as const, roleDefaults: { PHARMACIEN: true, CAISSIER: false, VENDEUR: false, COMPTABLE: false } },
  { key: 'can_create_client_credit', labelKey: 'permissions.create_client_credit', group: 'sudo', color: 'warning' as const, roleDefaults: { PHARMACIEN: true, CAISSIER: false, VENDEUR: false, COMPTABLE: false } },
  { key: 'can_manage_challenges', labelKey: 'permissions.manage_challenges', group: 'sudo', color: 'warning' as const, roleDefaults: { PHARMACIEN: true, CAISSIER: false, VENDEUR: false, COMPTABLE: false } },
  { key: 'can_delete_commande', labelKey: 'permissions.delete_commande', group: 'sudo', color: 'warning' as const, roleDefaults: { PHARMACIEN: true, CAISSIER: false, VENDEUR: false, COMPTABLE: false } },
  { key: 'can_close_commande', labelKey: 'permissions.close_commande', group: 'sudo', color: 'warning' as const, roleDefaults: { PHARMACIEN: true, CAISSIER: false, VENDEUR: false, COMPTABLE: false } },
] as const;

export type PermissionKey = typeof PERMISSIONS_META[number]['key'];
export type Role = 'PHARMACIEN' | 'CAISSIER' | 'VENDEUR' | 'COMPTABLE';

export interface ManagedUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_superuser: boolean;
  is_active: boolean;
  profile: {
    role: string;
    allowed_menus: string[];
    max_discount_rate?: string | number;
  } & Partial<Record<PermissionKey, boolean>>;
}

export type UserFormData = {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: Role | string;
  is_superuser: boolean;
  is_active: boolean;
  allowed_menus: string[];
  max_discount_rate: number;
} & Record<PermissionKey, boolean>;

export const ROLES = [
  { value: 'PHARMACIEN', labelKey: 'roles.pharmacist' },
  { value: 'COMPTABLE', labelKey: 'roles.accountant' },
  { value: 'CAISSIER', labelKey: 'roles.cashier' },
  { value: 'VENDEUR', labelKey: 'roles.seller' }
];

export const ROLE_MENU_DEFAULTS: Record<Role, string[]> = {
  PHARMACIEN: [], // tous les menus (résolu dynamiquement via la hiérarchie)
  CAISSIER: ['ventes_consultation', 'ventes_historique', 'ventes_journal', 'caisse', 'facturation', 'clients', 'produits', 'vitrine'],
  VENDEUR: ['facturation', 'caisse', 'produits', 'vitrine', 'clients', 'inventaire_organisation'],
  COMPTABLE: ['compta', 'compta_dashboard', 'compta_grand_livre', 'compta_balance', 'compta_resultat', 'compta_charges', 'compta_plan'],
};

// Clés réservées aux admins — fallback si l'API menu-hierarchy n'est pas
// disponible. Source de vérité : backend/api/menu_hierarchy.py (adminOnlyKeys).
export const ADMIN_MENU_KEYS_FALLBACK = ['utilisateurs', 'user_sessions', 'audit', 'import_dci', 'maintenance', 'corbeille'];

export const buildInitialPermissions = (role: Role): Record<PermissionKey, boolean> =>
  Object.fromEntries(PERMISSIONS_META.map(p => [p.key, p.roleDefaults[role]])) as Record<PermissionKey, boolean>;

export const buildInitialFormData = (): UserFormData => ({
  username: '',
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  role: 'VENDEUR',
  is_superuser: false,
  is_active: true,
  allowed_menus: ['facturation', 'caisse', 'produits', 'vitrine', 'clients', 'inventaire_organisation'],
  ...buildInitialPermissions('VENDEUR'),
  // Preserve the legacy default: new sellers can see cash journal totals.
  can_view_cash_totals: true,
  max_discount_rate: 0,
});

export const permissionClass = (color?: 'emerald' | 'warning' | 'error') => {
  const base = 'p-2 bg-white rounded-lg border';
  switch (color) {
    case 'emerald': return `${base} border-slate-200 text-emerald-600 font-medium`;
    case 'warning': return `${base} border-amber-100 text-amber-600 font-medium`;
    case 'error': return `${base} border-red-100 text-red-500 font-medium`;
    default: return `${base} border-slate-200`;
  }
};

export const checkboxColor = (color?: 'emerald' | 'warning' | 'error') => {
  if (color === 'emerald') return 'success';
  return color;
};

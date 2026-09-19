import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { gooeyToast } from 'goey-toast';
import { getApiErrorDetail, extractErrorMessage } from '../utils/errorHandling';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import { useMenuHierarchy, getAllMenuKeysFromHierarchy, getMenuLabel as getMenuLabelFromHierarchy, type MenuItem } from '../hooks/useMenuHierarchy';
import PasswordConfirmModal from './PasswordConfirmModal';
import { Checkbox } from './ui/Checkbox';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { Select } from './ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/Tabs';
import { UserPlus, Pencil, Trash2, Save, X, Lock, User, Mail, Copy, Coins, Zap, CheckCircle, Info } from 'lucide-react';
import { logger } from '../utils/logger'


interface User {
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

const PERMISSIONS_META = [
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

type PermissionKey = typeof PERMISSIONS_META[number]['key'];
type Role = 'PHARMACIEN' | 'CAISSIER' | 'VENDEUR' | 'COMPTABLE';

const permissionClass = (color?: 'emerald' | 'warning' | 'error') => {
  const base = 'p-2 bg-white rounded-lg border';
  switch (color) {
    case 'emerald': return `${base} border-slate-200 text-emerald-600 font-medium`;
    case 'warning': return `${base} border-amber-100 text-amber-600 font-medium`;
    case 'error': return `${base} border-red-100 text-red-500 font-medium`;
    default: return `${base} border-slate-200`;
  }
};

const checkboxColor = (color?: 'emerald' | 'warning' | 'error') => {
  if (color === 'emerald') return 'success';
  return color;
};

const MENU_HIERARCHY_FALLBACK: MenuItem[] = [
  { key: 'dashboard', labelKey: 'sidebar:dashboard' },
  { key: 'manager_sidebar', labelKey: 'sidebar:manager_sidebar' },
  {
    key: 'ventes',
    labelKey: 'sidebar:ventes.title',
    submenus: [
      { key: 'ventes_consultation', labelKey: 'sidebar:ventes.consultation' },
      { key: 'ventes_historique', labelKey: 'sidebar:ventes.historique' },
      { key: 'ventes_journal', labelKey: 'sidebar:ventes.journal' },
      { key: 'ventes_clotures', labelKey: 'sidebar:ventes.clotures' },
      { key: 'ventes_ordonnancier', labelKey: 'sidebar:ventes.ordonnancier' },
      { key: 'ventes_promotions', labelKey: 'sidebar:ventes.promotions' },
      { key: 'caisse', labelKey: 'sidebar:ventes.caisse_centralisee' }
    ]
  },
  { key: 'facturation', labelKey: 'sidebar:facturation' },
  { key: 'produits', labelKey: 'sidebar:produits' },
  { key: 'vitrine', labelKey: 'sidebar:vitrine' },
  {
    key: 'commandes_loc',
    labelKey: 'sidebar:commandes.local_title',
    submenus: [
      { key: 'commandes_loc_current', labelKey: 'sidebar:commandes.new_current' },
      { key: 'commandes_loc_history', labelKey: 'sidebar:commandes.history' }
    ]
  },
  {
    key: 'commandes_dir',
    labelKey: 'sidebar:commandes.direct_title',
    submenus: [
      { key: 'commandes_dir_current', labelKey: 'sidebar:commandes.new_current' },
      { key: 'commandes_dir_history', labelKey: 'sidebar:commandes.history' }
    ]
  },
  { key: 'fournisseurs', labelKey: 'sidebar:fournisseurs.title' },
  { key: 'clients', labelKey: 'sidebar:clients' },
  { key: 'creances', labelKey: 'sidebar:creances' },
  {
    key: 'inventaire',
    labelKey: 'sidebar:stock.title',
    submenus: [
      { key: 'inventaire_saisie', labelKey: 'sidebar:stock.inventaire.title' },
      { key: 'inventaire_journal', labelKey: 'sidebar:stock.journal' },
      { key: 'inventaire_analyse', labelKey: 'sidebar:stock.analyse.title' },
      { key: 'inventaire_reappro', labelKey: 'sidebar:stock.reappro.title' },
      { key: 'inventaire_avoirs', labelKey: 'sidebar:stock.avoirs' },
      { key: 'inventaire_promis', labelKey: 'sidebar:stock.promis' },
      { key: 'inventaire_transformations', labelKey: 'sidebar:stock.transformations.title' },
      { key: 'inventaire_perimes', labelKey: 'sidebar:stock.perimes.title' },
      { key: 'inventaire_organisation', labelKey: 'sidebar:stock.organisation.title' },
      { key: 'inventaire_etats', labelKey: 'sidebar:stock.etats_inventaire.title' },
      { key: 'inventaire_rapport_ug', labelKey: 'sidebar:stock.rapport_ug' }
    ]
  },
  {
    key: 'statistiques',
    labelKey: 'sidebar:statistiques.title',
    submenus: [
      { key: 'statistiques_rapports', labelKey: 'sidebar:statistiques.rapports' },
      { key: 'statistiques_abc', labelKey: 'sidebar:statistiques.abc' },
      { key: 'statistiques_fournisseurs', labelKey: 'sidebar:statistiques.fournisseurs' },
      { key: 'statistiques_mensuels', labelKey: 'sidebar:statistiques.mensuel' },
      { key: 'statistiques_finances', labelKey: 'sidebar:statistiques.finances' },
      { key: 'statistiques_vendeurs', labelKey: 'sidebar:statistiques.classement_vendeurs' },
      { key: 'statistiques_temporelle', labelKey: 'sidebar:statistiques.analyse_temporelle' },
      { key: 'statistiques_guide', labelKey: 'sidebar:statistiques.guide' }
    ]
  },
  {
    key: 'settings',
    labelKey: 'sidebar:parametres.title',
    submenus: [
      { key: 'settings_facture', labelKey: 'sidebar:parametres.facture' },
      { key: 'settings_pharmacie', labelKey: 'sidebar:parametres.pharmacie' },
      { key: 'settings_whatsapp', labelKey: 'sidebar:parametres.whatsapp' },
      { key: 'settings_telegram', labelKey: 'sidebar:parametres.telegram' }
    ]
  },
  {
    key: 'compta',
    labelKey: 'sidebar:compta.title',
    submenus: [
      { key: 'compta_dashboard', labelKey: 'sidebar:compta.dashboard' },
      { key: 'compta_grand_livre', labelKey: 'sidebar:compta.grand_livre' },
      { key: 'compta_balance', labelKey: 'sidebar:compta.balance' },
      { key: 'compta_resultat', labelKey: 'sidebar:compta.resultat' },
      { key: 'compta_charges', labelKey: 'sidebar:compta.charges' },
      { key: 'compta_plan', labelKey: 'sidebar:compta.plan' }
    ]
  },
  {
    key: 'divers',
    labelKey: 'sidebar:divers.title',
    submenus: [
      { key: 'divers_ca', labelKey: 'sidebar:divers.ca' },
      { key: 'divers_commandes', labelKey: 'sidebar:divers.commandes' }
    ]
  },
  { key: 'aide_formation', labelKey: 'sidebar:aide_formation' },
  { key: 'perimes', labelKey: 'sidebar:stock.perimes.title' },
  { key: 'commandes', labelKey: 'sidebar:commandes.title' }
];

const ROLES = [
  { value: 'PHARMACIEN', labelKey: 'roles.pharmacist' },
  { value: 'COMPTABLE', labelKey: 'roles.accountant' },
  { value: 'CAISSIER', labelKey: 'roles.cashier' },
  { value: 'VENDEUR', labelKey: 'roles.seller' }
];

export default function GestionUtilisateurs() {
  const { t } = useTranslation(['users', 'sidebar', 'common']);
  const { data: menuData } = useMenuHierarchy();
  const MENU_HIERARCHY = menuData?.hierarchy ?? MENU_HIERARCHY_FALLBACK;
  const getAllMenuKeys = () => getAllMenuKeysFromHierarchy(MENU_HIERARCHY);
  const getMenuLabel = (key: string, tFn: (key: string, options?: { defaultValue?: string }) => string) => getMenuLabelFromHierarchy(MENU_HIERARCHY, key, tFn);
  const confirm = useConfirm();
  const [users, setUsers] = useState<User[]>([]);
  const [, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const { user: currentUser, login } = useAuth();

  // Sudo Mode State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordModalConfig, setPasswordModalConfig] = useState({ title: '', message: '' });
  const pendingActionRef = useRef<(() => Promise<void>) | null>(null);

  // Copy permissions from user
  const [copyFromUserId, setCopyFromUserId] = useState<number | ''>('');

  // La corbeille des utilisateurs est gérée centrally via le menu Corbeille de la sidebar
  // (composant Corbeille.tsx + endpoint /api/corbeille/). Plus d'onglet local ici.

  // Form State
  type FormData = {
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

  const buildInitialPermissions = (role: Role): Record<PermissionKey, boolean> =>
    Object.fromEntries(PERMISSIONS_META.map(p => [p.key, p.roleDefaults[role]])) as Record<PermissionKey, boolean>;

  const INITIAL_FORM_DATA: FormData = {
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
    max_discount_rate: 0,
  };
  // Preserve the legacy default: new sellers can see cash journal totals.
  INITIAL_FORM_DATA.can_view_cash_totals = true;

  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);

  useEffect(() => {
    fetchUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('users/');
      const data: unknown = response.data;
      setUsers(Array.isArray(data) ? data : (Array.isArray((data as { results?: unknown })?.results) ? (data as { results: unknown[] }).results : []));
    } catch (error) {
      logger.error('Error fetching users:', error);
      gooeyToast.error(t('messages.load_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPermissions = (sourceUserId: number | '') => {
    if (!sourceUserId) return;

    const sourceUser = users.find(u => u.id === sourceUserId);
    if (!sourceUser) return;

    const role = sourceUser.profile?.role || (sourceUser.is_superuser ? 'PHARMACIEN' : 'VENDEUR');

    setFormData(prev => {
      const updates: Partial<FormData> = {
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

    gooeyToast.success(t('messages.permissions_copied', { username: sourceUser.username, defaultValue: `Droits copiés de ${sourceUser.username}` }));
  };

  const ROLE_MENU_DEFAULTS: Record<Role, string[]> = {
    PHARMACIEN: [], // placeholder, filled dynamically below
    CAISSIER: ['ventes_consultation', 'ventes_historique', 'ventes_journal', 'caisse', 'facturation', 'clients', 'produits', 'vitrine'],
    VENDEUR: ['facturation', 'caisse', 'produits', 'vitrine', 'clients', 'inventaire_organisation'],
    COMPTABLE: ['compta', 'compta_dashboard', 'compta_grand_livre', 'compta_balance', 'compta_resultat', 'compta_charges', 'compta_plan'],
  };

  const handleRoleChange = (role: string, preserveMenus: boolean = false) => {
    if (!['PHARMACIEN', 'CAISSIER', 'VENDEUR', 'COMPTABLE'].includes(role)) return;

    const typedRole = role as Role;
    const updates: Partial<FormData> = {
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

  const handleOpenModal = (user: User | null = null) => {
    // Reset copy selector
    setCopyFromUserId('');

    if (user) {
      setEditingUser(user);
      const adminKeys = ['utilisateurs', 'user_sessions', 'audit', 'import_dci', 'maintenance', 'corbeille'];
      const cleanedMenus = (user.profile?.allowed_menus || []).filter(k => !adminKeys.includes(k));
      const base: FormData = {
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
    } else {
      setEditingUser(null);
      setFormData(INITIAL_FORM_DATA);
    }
    setModalOpen(true);
  };

  const handleMenuToggle = (menuKey: string, submenus?: {key: string}[]) => {
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

  const handleSubMenuToggle = (submenuKey: string, parentKey: string, totalSubmenusCount: number) => {
    setFormData(prev => {
        let allowed = [...prev.allowed_menus];
        const allowedSet = new Set(allowed);
        if (allowedSet.has(submenuKey)) {
            allowed = allowed.filter(k => k !== submenuKey);
            allowed = allowed.filter(k => k !== parentKey);
        } else {
            allowed.push(submenuKey);
            allowedSet.add(submenuKey);
            const parent = MENU_HIERARCHY.find(m => m.key === parentKey);
            const currentCount = parent?.submenus?.filter(s => allowedSet.has(s.key)).length || 0;
            if (currentCount === totalSubmenusCount && !allowedSet.has(parentKey)) {
                allowed.push(parentKey);
            }
        }
        return { ...prev, allowed_menus: allowed };
    });
  };

  const executeDeleteUser = async (userId: number, username: string) => {
    try {
      await api.patch(`users/${userId}/`, { is_active: false });
      gooeyToast.success(t('messages.deactivated', { username, defaultValue: `${username} a été désactivé. Vous pouvez le restaurer depuis le menu Corbeille.` }));
      fetchUsers();
    } catch (error) {
      logger.error('Error deleting/deactivating user:', error);
      gooeyToast.error(getApiErrorDetail(error, t('messages.deactivate_error', { defaultValue: 'Erreur lors de la désactivation.' })));
    }
  };

  const handlePasswordConfirmed = () => {
    if (pendingActionRef.current) {
      pendingActionRef.current();
      pendingActionRef.current = null;
    }
    setIsPasswordModalOpen(false);
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    const confirmed = await confirm({
      title: t('messages.deactivate_confirm_title', { defaultValue: 'Désactiver l\'utilisateur ?' }),
      message: t('messages.deactivate_confirm', { username, defaultValue: `Voulez-vous désactiver l'utilisateur ${username} ? Il sera déplacé vers le menu Corbeille et pourra être restauré depuis là-bas.` }),
      variant: 'danger',
      confirmText: t('messages.deactivate_btn', { defaultValue: 'Désactiver' })
    });
    
    if (confirmed) {
      setPasswordModalConfig({
        title: t('messages.sudo_title'),
        message: t('messages.sudo_message')
      });
      pendingActionRef.current = () => executeDeleteUser(userId, username);
      setIsPasswordModalOpen(true);
    }
  };

  // La restauration se fait depuis le menu Corbeille global (Corbeille.tsx)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const profilePayload: Record<string, unknown> = {
        role: formData.role,
        allowed_menus: formData.allowed_menus,
        max_discount_rate: formData.max_discount_rate,
      };
      PERMISSIONS_META.forEach(p => {
        profilePayload[p.key] = formData[p.key];
      });

      const payload: Record<string, unknown> & { profile: Record<string, unknown> } = {
        username: formData.username,
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        is_active: formData.is_active,
        profile: profilePayload,
      };
      
      if (formData.password) {
        payload.password = formData.password;
      }

      // Seul un superadmin peut changer le statut superadmin
      if (currentUser?.is_superuser) {
        payload.is_superuser = formData.is_superuser;
      }

      if (editingUser) {
        const { data: finalUser } = await api.patch(`users/${editingUser.id}/`, payload);
        setUsers(prev => prev.map(u => u.id === finalUser.id ? finalUser : u));
        // Si c'est l'utilisateur courant, rafraîchir ses droits dans la session active
        if (currentUser && editingUser.id === currentUser.id) {
          const updatedSession = {
            ...currentUser,
            allowed_menus: payload.profile.allowed_menus as string[],
            ...payload.profile,
          };
          login(updatedSession);
        }
        gooeyToast.success(t('messages.updated'));
      } else {
        const { data: newUser } = await api.post('users/', payload);
        setUsers(prev => [...prev, newUser].slice().sort((a, b) => a.username.localeCompare(b.username)));
        gooeyToast.success(t('messages.created'));
      }
      
      setModalOpen(false);
    } catch (error) {
      logger.error('Error saving user:', error);
      const msg = extractErrorMessage(error) || t('messages.save_error');
      gooeyToast.error(msg, { duration: 6000 });
    }
  };

  if (!currentUser?.is_superuser) {
    return <div className="p-4 text-red-500 font-medium">{t('messages.access_denied')}</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-800">{t('title')}</h1>
          <Badge variant="ghost" size="md">
            {users.filter(u => u.is_active).length} {t('tabs.active', 'Actifs')}
          </Badge>
        </div>
        <Button leftIcon={<UserPlus className="h-5 w-5" />} onClick={() => handleOpenModal()}>
          {t('new_user')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {users.reduce<React.JSX.Element[]>((acc, user) => {
          if (!user.is_active) return acc;
          acc.push(
            <Card key={user.id} variant="default" padding="md">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-sm bg-slate-700 shrink-0">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold flex items-center gap-2 text-slate-800 truncate">
                      {user.username}
                    </div>
                    <div className="text-sm text-slate-400">{user.first_name} {user.last_name}</div>
                    <div className="text-xs text-slate-400">{user.email}</div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 md:w-72">
                  <Badge variant={user.is_superuser ? 'primary' : user.profile?.role === 'COMPTABLE' ? 'secondary' : user.profile?.role === 'CAISSIER' ? 'accent' : 'ghost'} size="sm">
                    {user.is_superuser 
                      ? t('badges.pharmacist') 
                      : user.profile?.role === 'COMPTABLE'
                          ? t('roles.accountant', 'COMPTABLE')
                      : user.profile?.role === 'CAISSIER' 
                          ? t('roles.cashier') 
                          : t('roles.seller')}
                  </Badge>
                  <div className="flex flex-wrap gap-1">
                    {user.is_superuser ? (
                      <Badge variant="primary" size="sm">{t('badges.full_access')}</Badge>
                    ) : (() => {
                      const allowedMenus = user.profile?.allowed_menus || [];
                      const allKeys = getAllMenuKeys();
                      // If they have all keys (or all but a few), show full access
                      const isFullAccess = allowedMenus.length >= allKeys.length - 2;
                      
                      if (isFullAccess && allowedMenus.length > 0) {
                        return (
                          <Badge variant="primary" size="sm">
                            {t('badges.full_access', 'Accès complet')}
                          </Badge>
                        );
                      }
                      
                      const limit = 4;
                      const visibleMenus = allowedMenus.slice(0, limit);
                      const hiddenCount = allowedMenus.length - limit;
                      
                      return (
                        <>
                          {visibleMenus.map(menu => (
                            <Badge key={menu} variant="outline" size="sm">
                              {getMenuLabel(menu, t)}
                            </Badge>
                          ))}
                          {hiddenCount > 0 && (
                            <Badge 
                              variant="ghost" 
                              size="sm"
                              title={allowedMenus.slice(limit).map(m => getMenuLabel(m, t)).join(', ')}
                            >
                              +{hiddenCount} {t('common:others', 'autres')}
                            </Badge>
                          )}
                          {allowedMenus.length === 0 && (
                            <Badge variant="error" size="sm">{t('badges.no_access')}</Badge>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex gap-2">
                  {user.profile?.can_cash_out && (
                    <Badge variant="success" size="sm" title={t('permissions.cash_out')} aria-label={t('permissions.cash_out')}>
                      <Coins className="h-3 w-3" />
                    </Badge>
                  )}
                  {user.profile?.can_sell_negative_stock && (
                    <Badge variant="warning" size="sm" title={t('permissions.negative_stock')} aria-label={t('permissions.negative_stock')}>
                      <Zap className="h-3 w-3" />
                    </Badge>
                  )}
                  {user.profile?.can_validate_sales && (
                    <Badge variant="primary" size="sm" title={t('permissions.can_validate_sales')} aria-label={t('permissions.can_validate_sales')}>
                      <CheckCircle className="h-3 w-3" />
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 md:ml-auto">
                  <Button variant="ghost" size="sm" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => handleOpenModal(user)}>
                    {t('actions.edit')}
                  </Button>
                  {currentUser?.username !== user.username && (
                    <Button variant="ghost" size="sm" leftIcon={<Trash2 className="h-4 w-4" />} className="text-error hover:bg-error/10" onClick={() => handleDeleteUser(user.id, user.username)}>
                      {t('actions.deactivate', 'Désactiver')}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
          return acc;
        }, [])}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0 grid-rows-[auto_1fr]">
          <DialogHeader className="p-6 pb-2 border-b border-base-200">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <User className="h-5 w-5" />
              </div>
              {editingUser ? t('modal.edit_title') : t('modal.new_title')}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 min-h-0">
              <Tabs defaultValue="informations" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="informations">{t('modal.tabs.information')}</TabsTrigger>
                  <TabsTrigger value="menus">{t('modal.tabs.menus')}</TabsTrigger>
                  <TabsTrigger value="permissions">{t('modal.tabs.permissions')}</TabsTrigger>
                </TabsList>

                <TabsContent value="informations" className="space-y-6">
                  <Card variant="bordered" padding="md">
                    <div className="flex items-center gap-2 mb-4 border-l-2 border-primary pl-3">
                      <h4 className="font-bold text-xs uppercase tracking-widest text-primary">{t('modal.basic_info')}</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input 
                        label={t('form.username')}
                        icon={<User size={16} />}
                        value={formData.username}
                        onChange={e => setFormData({...formData, username: e.target.value})}
                        required
                      />
                      <Input 
                        label={t('form.email')}
                        type="email"
                        icon={<Mail size={16} />}
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                      />
                      <Input 
                        label={t('form.first_name')}
                        value={formData.first_name}
                        onChange={e => setFormData({...formData, first_name: e.target.value})}
                      />
                      <Input 
                        label={t('form.last_name')}
                        value={formData.last_name}
                        onChange={e => setFormData({...formData, last_name: e.target.value})}
                      />
                    </div>
                  </Card>

                  <Card variant="bordered" padding="md">
                    <div className="flex items-center gap-2 mb-4 border-l-2 border-primary pl-3">
                      <h4 className="font-bold text-xs uppercase tracking-widest text-primary">{t('form.role')}</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input 
                        label={t('form.password')}
                        type="password"
                        icon={<Lock size={16} />}
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        placeholder={editingUser ? t('form.password_placeholder_edit') : ''}
                      />
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="user-role-select">{t('form.role')}</Label>
                        <Select
                          id="user-role-select"
                          value={formData.role}
                          onChange={e => handleRoleChange(e.target.value)}
                        >
                          {ROLES.map(role => (
                            <option key={role.value} value={role.value}>{t(role.labelKey)}</option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  </Card>

                  {!editingUser && (
                    <Card variant="default" padding="md" className="bg-primary/5 border-primary/20">
                      <div className="flex items-center gap-2 mb-3">
                        <Copy className="h-4 w-4 text-primary" />
                        <h4 className="font-bold text-xs uppercase tracking-wider text-primary">{t('form.copy_permissions', 'Copier les droits d\'un utilisateur')}</h4>
                      </div>
                      <div className="flex gap-2">
                        <Select
                          aria-label={t('form.copy_permissions', 'Copier les droits d\'un utilisateur')}
                          value={copyFromUserId}
                          onChange={e => setCopyFromUserId(e.target.value ? Number(e.target.value) : '')}
                          containerClassName="flex-1"
                        >
                          <option value="">{t('form.select_user', 'Sélectionner un utilisateur...')}</option>
                          {users.flatMap(user => user.is_active ? [(
                            <option key={user.id} value={String(user.id)}>
                              {user.username} ({user.profile?.role || (user.is_superuser ? 'PHARMACIEN' : 'VENDEUR')})
                            </option>
                          )] : [])}
                        </Select>
                        <Button
                          type="button"
                          onClick={() => handleCopyPermissions(copyFromUserId)}
                          disabled={!copyFromUserId}
                          leftIcon={<Copy className="h-4 w-4" />}
                        >
                          {t('form.copy_btn', 'Copier')}
                        </Button>
                      </div>
                      <p className="text-xs text-base-content/60 mt-2 italic">
                        {t('form.copy_help', 'Copie tous les droits, menus autorisés et permissions spéciales de l\'utilisateur sélectionné.')}
                      </p>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="menus" className="space-y-4">
                  <div className="flex items-center gap-2 border-l-2 border-secondary pl-3 bg-secondary/10 py-1 rounded-r-lg">
                    <h4 className="font-bold text-xs uppercase tracking-widest text-secondary">{t('modal.authorized_menus')}</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {MENU_HIERARCHY.map(menu => {
                      const allowedSet = new Set(formData.allowed_menus);
                      const parentLabel = t(menu.labelKey);
                      const isParentChecked = allowedSet.has(menu.key);
                      const indeterminate = !isParentChecked && menu.submenus?.some(sub => allowedSet.has(sub.key));

                      return (
                        <Card key={menu.key} variant="default" padding="sm" className={`${menu.submenus && menu.submenus.length > 0 ? 'flex flex-col h-full' : ''}`}>
                          <div className="bg-base-200/50 p-3 flex-none border-b border-base-200 rounded-t-lg">
                            <Checkbox
                              checked={isParentChecked || indeterminate}
                              onChange={() => handleMenuToggle(menu.key, menu.submenus)}
                              disabled={formData.is_superuser}
                              label={parentLabel}
                            />
                          </div>
                          
                          {menu.submenus && menu.submenus.length > 0 && (
                            <div className="p-3 grid grid-cols-1 gap-1.5 flex-1">
                              {menu.submenus.map(sub => {
                                const subLabel = t(sub.labelKey);
                                return (
                                  <div key={sub.key} className="flex items-start transition-all py-0.5 group">
                                    <Checkbox 
                                      size="xs"
                                      color="primary"
                                      checked={allowedSet.has(sub.key) || allowedSet.has(menu.key)}
                                      onChange={() => handleSubMenuToggle(sub.key, menu.key, menu.submenus!.length)}
                                      disabled={formData.is_superuser}
                                      label={subLabel}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                  {formData.is_superuser && (
                    <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm italic flex items-center gap-2">
                      <Info className="h-4 w-4 shrink-0" />
                      <span>{t('modal.admin_note')}</span>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="permissions" className="space-y-4">
                  {formData.is_superuser && (
                    <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm italic flex items-center gap-2">
                      <Info className="h-4 w-4 shrink-0" />
                      <span>{t('modal.superuser_permissions_note', 'Le superutilisateur possède implicitement tous les droits.')}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card variant="default" padding="md">
                      <div className="flex items-center gap-2 mb-4 border-l-2 border-success pl-3 bg-success/10 py-1 rounded-r-lg">
                        <h4 className="font-bold text-xs uppercase tracking-widest text-success">{t('modal.special_permissions')}</h4>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {PERMISSIONS_META.filter(p => p.group === 'operations').map(p => {
                          if (p.key === 'can_cash_out') {
                            return (
                              <div key={p.key} className="flex cursor-pointer justify-start gap-4 p-2 bg-base-100 rounded-lg border border-base-300 hover:border-success/50 transition-all shadow-sm group">
                                <Checkbox
                                  checked={formData[p.key]}
                                  onChange={checked => setFormData({ ...formData, [p.key]: checked })}
                                  disabled={formData.is_superuser || formData.role === 'VENDEUR'}
                                  color="success"
                                  size="sm"
                                />
                                <div className="flex flex-col">
                                  <span className="font-bold text-xs group-hover:text-success transition-colors">{t(p.labelKey)}</span>
                                  {p.descKey && <span className="text-[10px] opacity-60 leading-none mt-0.5">{t(p.descKey)}</span>}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <Checkbox
                              key={p.key}
                              size="xs"
                              color={checkboxColor(p.color)}
                              checked={formData[p.key]}
                              onChange={checked => setFormData({ ...formData, [p.key]: checked })}
                              label={t(p.labelKey)}
                              className={permissionClass(p.color)}
                              disabled={formData.is_superuser}
                            />
                          );
                        })}

                        <div className="flex flex-col gap-1 px-2 mt-1">
                          <Label htmlFor="max-discount-rate">{t('form.max_discount')}</Label>
                          <Input
                            id="max-discount-rate"
                            type="number"
                            value={formData.max_discount_rate}
                            onChange={e => setFormData({...formData, max_discount_rate: parseInt(e.target.value) || 0})}
                            size="sm"
                            disabled={formData.is_superuser}
                          />
                        </div>
                      </div>
                    </Card>

                    <Card variant="default" padding="md">
                      <div className="flex items-center gap-2 mb-4 border-l-2 border-error pl-3 bg-error/10 py-1 rounded-r-lg">
                        <h4 className="font-bold text-xs uppercase tracking-widest text-error">{t('modal.security_sudo')}</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {PERMISSIONS_META.filter(p => p.group === 'sudo').map(p => (
                          <Checkbox
                            key={p.key}
                            size="xs"
                            color={checkboxColor(p.color)}
                            checked={formData[p.key]}
                            onChange={checked => setFormData({ ...formData, [p.key]: checked })}
                            label={t(p.labelKey)}
                            className={permissionClass(p.color)}
                            disabled={formData.is_superuser}
                          />
                        ))}
                      </div>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <DialogFooter className="p-4 border-t border-base-200">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} leftIcon={<X className="h-4 w-4" />}>
                {t('common:cancel')}
              </Button>
              <Button type="submit" leftIcon={<Save className="h-4 w-4" />}>
                {t('common:save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <PasswordConfirmModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onConfirm={handlePasswordConfirmed}
        title={passwordModalConfig.title}
        message={passwordModalConfig.message}
      />
    </div>
  );
}

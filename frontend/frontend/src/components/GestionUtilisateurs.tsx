import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { getApiErrorDetail } from '../utils/errorHandling';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import PasswordConfirmModal from './PasswordConfirmModal';
import { Checkbox } from './ui/Checkbox';
import { Input } from './ui/Input';
import { Mail, User, Lock, Copy } from 'lucide-react';


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
    can_do_returns?: boolean;
    can_sell_negative_stock?: boolean;
    can_cash_out?: boolean;
    can_delete_product?: boolean;
    can_adjust_stock?: boolean;
    can_delete_fournisseur?: boolean;
    can_delete_commande?: boolean;
    can_close_commande?: boolean;
    can_generate_coupon?: boolean;
    can_cancel_invoice?: boolean;
    can_cancel_promis?: boolean;
    can_manage_perimes?: boolean;
    can_manage_avoirs?: boolean;
    can_validate_zero_amount?: boolean;
    can_modify_price?: boolean;
    can_modify_invoice?: boolean;
    max_discount_rate?: string | number;
  };
}

const MENU_HIERARCHY = [
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
  { key: 'changelog', labelKey: 'sidebar:changelog' },
  { key: 'utilisateurs', labelKey: 'sidebar:utilisateurs' },
  { key: 'user_sessions', labelKey: 'sidebar:user_sessions_sidebar' },
  { key: 'audit', labelKey: 'sidebar:audit' },
  { key: 'maintenance', labelKey: 'sidebar:maintenance' },
  { key: 'corbeille', labelKey: 'sidebar:corbeille' },
  { key: 'perimes', labelKey: 'sidebar:stock.perimes.title' },
  { key: 'commandes', labelKey: 'sidebar:commandes.title' }
];

const getAllMenuKeys = () => {
    let keys: string[] = [];
    MENU_HIERARCHY.forEach(menu => {
        keys.push(menu.key);
        if (menu.submenus) {
            menu.submenus.forEach(sub => keys.push(sub.key));
        }
    });
    return keys;
};

const ROLES = [
  { value: 'PHARMACIEN', labelKey: 'roles.pharmacist' },
  { value: 'COMPTABLE', labelKey: 'roles.accountant' },
  { value: 'CAISSIER', labelKey: 'roles.cashier' },
  { value: 'VENDEUR', labelKey: 'roles.seller' }
];

export default function GestionUtilisateurs() {
  const { t } = useTranslation(['users', 'sidebar', 'common']);
  const confirm = useConfirm();
  const [users, setUsers] = useState<User[]>([]);
  const [, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const { user: currentUser } = useAuth();

  // Sudo Mode State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordModalConfig, setPasswordModalConfig] = useState({ title: '', message: '' });
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  // Copy permissions from user
  const [copyFromUserId, setCopyFromUserId] = useState<number | ''>('');

  // Filter state for active/trash view
  const [showTrash, setShowTrash] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'VENDEUR',
    is_superuser: false,
    is_active: true,
    allowed_menus: [] as string[],
    can_do_returns: false,
    can_sell_negative_stock: false,
    can_cash_out: false,
    can_delete_product: false,
    can_adjust_stock: false,
    can_delete_fournisseur: false,
    can_delete_commande: false,
    can_close_commande: false,
    can_generate_coupon: false,
    can_cancel_invoice: false,
    can_cancel_promis: false,
    can_manage_perimes: false,
    can_manage_avoirs: false,
    can_validate_zero_amount: false,
    can_modify_price: false,
    can_modify_invoice: false,
    max_discount_rate: 0,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('users/');
      const data: any = response.data;
      setUsers(Array.isArray(data) ? data : (data.results || []));
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error(t('messages.load_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPermissions = (sourceUserId: number | '') => {
    if (!sourceUserId) return;
    
    const sourceUser = users.find(u => u.id === sourceUserId);
    if (!sourceUser) return;

    setFormData(prev => ({
      ...prev,
      role: sourceUser.profile?.role || (sourceUser.is_superuser ? 'PHARMACIEN' : 'VENDEUR'),
      is_superuser: sourceUser.is_superuser,
      allowed_menus: sourceUser.profile?.allowed_menus || [],
      can_do_returns: sourceUser.profile?.can_do_returns || false,
      can_sell_negative_stock: sourceUser.profile?.can_sell_negative_stock || false,
      can_cash_out: sourceUser.profile?.can_cash_out ?? false,
      can_delete_product: sourceUser.profile?.can_delete_product || false,
      can_adjust_stock: sourceUser.profile?.can_adjust_stock || false,
      can_delete_fournisseur: sourceUser.profile?.can_delete_fournisseur || false,
      can_delete_commande: sourceUser.profile?.can_delete_commande || false,
      can_close_commande: sourceUser.profile?.can_close_commande || false,
      can_generate_coupon: sourceUser.profile?.can_generate_coupon || false,
      can_cancel_invoice: sourceUser.profile?.can_cancel_invoice || false,
      can_cancel_promis: sourceUser.profile?.can_cancel_promis || false,
      can_manage_perimes: sourceUser.profile?.can_manage_perimes || false,
      can_manage_avoirs: sourceUser.profile?.can_manage_avoirs || false,
      can_validate_zero_amount: sourceUser.profile?.can_validate_zero_amount || false,
      can_modify_price: sourceUser.profile?.can_modify_price || false,
      can_modify_invoice: sourceUser.profile?.can_modify_invoice || false,
      max_discount_rate: Number(sourceUser.profile?.max_discount_rate || 0),
    }));
    
    toast.success(t('messages.permissions_copied', { username: sourceUser.username, defaultValue: `Droits copiés de ${sourceUser.username}` }));
  };

  const handleRoleChange = (role: string) => {
    let updates: any = { role };
    
    if (role === 'PHARMACIEN') {
      updates.is_superuser = true;
      updates.can_cash_out = true;
      updates.can_do_returns = true;
      updates.can_sell_negative_stock = true;
      updates.can_delete_product = true;
      updates.can_adjust_stock = true;
      updates.can_delete_fournisseur = true;
      updates.can_delete_commande = true;
      updates.can_close_commande = true;
      updates.can_generate_coupon = true;
      updates.can_cancel_invoice = true;
      updates.can_cancel_promis = true;
      updates.can_manage_perimes = true;
      updates.can_manage_avoirs = true;
      updates.can_validate_zero_amount = true;
      updates.can_modify_price = true;
      updates.can_modify_invoice = true;
      updates.max_discount_rate = 100;
      updates.allowed_menus = getAllMenuKeys();
    } else if (role === 'CAISSIER') {
      updates.is_superuser = false;
      updates.can_cash_out = true;
      updates.can_do_returns = false;
      updates.can_sell_negative_stock = false;
      updates.can_delete_product = false;
      updates.can_adjust_stock = false;
      updates.can_delete_fournisseur = false;
      updates.can_delete_commande = false;
      updates.can_close_commande = false;
      updates.can_generate_coupon = false;
      updates.can_modify_invoice = true;
      updates.allowed_menus = ['ventes_consultation', 'ventes_historique', 'ventes_journal', 'caisse', 'facturation', 'clients', 'produits', 'vitrine'];
    } else if (role === 'VENDEUR') {
      updates.is_superuser = false;
      updates.can_cash_out = false;
      updates.can_do_returns = false;
      updates.can_sell_negative_stock = false;
      updates.can_delete_product = false;
      updates.can_adjust_stock = false;
      updates.can_delete_fournisseur = false;
      updates.can_delete_commande = false;
      updates.can_close_commande = false;
      updates.can_generate_coupon = false;
      updates.can_cancel_invoice = false;
      updates.can_cancel_promis = false;
      updates.can_manage_perimes = false;
      updates.can_manage_avoirs = false;
      updates.can_validate_zero_amount = false;
      updates.can_modify_price = false;
      updates.can_modify_invoice = false;
      updates.max_discount_rate = 0;
      updates.allowed_menus = ['facturation', 'caisse', 'produits', 'vitrine', 'clients', 'inventaire_organisation'];
    } else if (role === 'COMPTABLE') {
      updates.is_superuser = false;
      updates.can_cash_out = false;
      updates.can_do_returns = false;
      updates.can_sell_negative_stock = false;
      updates.can_delete_product = false;
      updates.can_adjust_stock = false;
      updates.can_delete_fournisseur = false;
      updates.can_delete_commande = false;
      updates.can_close_commande = false;
      updates.can_generate_coupon = false;
      updates.can_cancel_invoice = false;
      updates.can_cancel_promis = false;
      updates.can_manage_perimes = false;
      updates.can_manage_avoirs = false;
      updates.can_validate_zero_amount = false;
      updates.can_modify_price = false;
      updates.can_modify_invoice = false;
      updates.max_discount_rate = 0;
      updates.allowed_menus = ['compta', 'compta_dashboard', 'compta_grand_livre', 'compta_balance', 'compta_resultat', 'compta_charges', 'compta_plan'];
    }

    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleOpenModal = (user: User | null = null) => {
    // Reset copy selector
    setCopyFromUserId('');

    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        email: user.email,
        password: '',
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.profile?.role || (user.is_superuser ? 'PHARMACIEN' : 'VENDEUR'),
        is_superuser: user.is_superuser,
        is_active: user.is_active,
        allowed_menus: user.profile?.allowed_menus || [],
        can_do_returns: user.profile?.can_do_returns || false,
        can_sell_negative_stock: user.profile?.can_sell_negative_stock || false,
        can_cash_out: user.profile?.can_cash_out ?? false,
        can_delete_product: user.profile?.can_delete_product || false,
        can_adjust_stock: user.profile?.can_adjust_stock || false,
        can_delete_fournisseur: user.profile?.can_delete_fournisseur || false,
        can_delete_commande: user.profile?.can_delete_commande || false,
        can_close_commande: user.profile?.can_close_commande || false,
        can_generate_coupon: user.profile?.can_generate_coupon || false,
        can_cancel_invoice: user.profile?.can_cancel_invoice || false,
        can_cancel_promis: user.profile?.can_cancel_promis || false,
        can_manage_perimes: user.profile?.can_manage_perimes || false,
        can_manage_avoirs: user.profile?.can_manage_avoirs || false,
        can_validate_zero_amount: user.profile?.can_validate_zero_amount || false,
        can_modify_price: user.profile?.can_modify_price || false,
        can_modify_invoice: user.profile?.can_modify_invoice || false,
        max_discount_rate: Number(user.profile?.max_discount_rate || 0),
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'VENDEUR',
        is_superuser: false,
        is_active: true,
        allowed_menus: ['facturation', 'produits', 'vitrine'],
        can_do_returns: false,
        can_sell_negative_stock: false,
        can_cash_out: false,
        can_delete_product: false,
        can_adjust_stock: false,
        can_delete_fournisseur: false,
        can_delete_commande: false,
        can_close_commande: false,
        can_generate_coupon: false,
        can_cancel_invoice: false,
        can_cancel_promis: false,
        can_manage_perimes: false,
        can_manage_avoirs: false,
        can_validate_zero_amount: false,
        can_modify_price: false,
        can_modify_invoice: false,
        max_discount_rate: 0,
      });
      handleRoleChange('VENDEUR');
    }
    setModalOpen(true);
  };

  const handleMenuToggle = (menuKey: string, submenus?: {key: string}[]) => {
    setFormData(prev => {
      let allowed = [...prev.allowed_menus];
      const isParent = !!submenus;
      const isCurrentlySelected = allowed.includes(menuKey);

      if (isCurrentlySelected) {
          allowed = allowed.filter(k => k !== menuKey);
          if (isParent) {
             const subKeys = submenus.map(s => s.key);
             allowed = allowed.filter(k => !subKeys.includes(k));
          }
      } else {
          allowed.push(menuKey);
          if (isParent) {
             submenus.forEach(sub => {
                 if (!allowed.includes(sub.key)) {
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
        if (allowed.includes(submenuKey)) {
            allowed = allowed.filter(k => k !== submenuKey);
            allowed = allowed.filter(k => k !== parentKey);
        } else {
            allowed.push(submenuKey);
            const parent = MENU_HIERARCHY.find(m => m.key === parentKey);
            const currentCount = parent?.submenus?.filter(s => allowed.includes(s.key)).length || 0;
            if (currentCount === totalSubmenusCount && !allowed.includes(parentKey)) {
                allowed.push(parentKey);
            }
        }
        return { ...prev, allowed_menus: allowed };
    });
  };

  const executeDeleteUser = async (userId: number, username: string) => {
    try {
      await api.patch(`users/${userId}/`, { is_active: false });
      toast.success(t('messages.deactivated', { username, defaultValue: `${username} a été désactivé (corbeille).` }));
      fetchUsers();
    } catch (error) {
      console.error('Error deleting/deactivating user:', error);
      toast.error(getApiErrorDetail(error, t('messages.deactivate_error', { defaultValue: 'Erreur lors de la mise à la corbeille.' })));
    }
  };

  const handlePasswordConfirmed = () => {
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
    setIsPasswordModalOpen(false);
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    const confirmed = await confirm({
      title: t('messages.deactivate_confirm_title', { defaultValue: 'Mettre à la corbeille ?' }),
      message: t('messages.deactivate_confirm', { username, defaultValue: `Voulez-vous désactiver l'utilisateur ${username} et le placer dans la corbeille ?` }),
      variant: 'danger',
      confirmText: t('messages.deactivate_btn', { defaultValue: 'Désactiver' })
    });
    
    if (confirmed) {
      setPasswordModalConfig({
        title: t('messages.sudo_title'),
        message: t('messages.sudo_message')
      });
      setPendingAction(() => () => executeDeleteUser(userId, username));
      setIsPasswordModalOpen(true);
    }
  };

  const executeRestoreUser = async (userId: number, username: string) => {
    try {
      await api.patch(`users/${userId}/`, { is_active: true });
      toast.success(t('messages.restored', { username, defaultValue: `${username} a été restauré avec succès.` }));
      fetchUsers();
    } catch (error) {
      console.error('Error restoring user:', error);
      toast.error(getApiErrorDetail(error, t('messages.restore_error', { defaultValue: 'Erreur lors de la restauration.' })));
    }
  };

  const handleRestoreUser = async (userId: number, username: string) => {
    const confirmed = await confirm({
      title: t('messages.restore_confirm_title', { defaultValue: 'Restaurer l\'utilisateur ?' }),
      message: t('messages.restore_confirm', { username, defaultValue: `Voulez-vous restaurer l'utilisateur ${username} ?` }),
      variant: 'success',
      confirmText: t('messages.restore_btn', { defaultValue: 'Restaurer' })
    });
    
    if (confirmed) {
      setPasswordModalConfig({
        title: t('messages.sudo_title'),
        message: t('messages.sudo_message')
      });
      setPendingAction(() => () => executeRestoreUser(userId, username));
      setIsPasswordModalOpen(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        username: formData.username,
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        is_active: formData.is_active,
        profile: {
          role: formData.role,
          allowed_menus: formData.allowed_menus,
          can_do_returns: formData.can_do_returns,
          can_sell_negative_stock: formData.can_sell_negative_stock,
          can_cash_out: formData.can_cash_out,
          can_delete_product: formData.can_delete_product,
          can_adjust_stock: formData.can_adjust_stock,
          can_delete_fournisseur: formData.can_delete_fournisseur,
          can_delete_commande: formData.can_delete_commande,
          can_close_commande: formData.can_close_commande,
          can_generate_coupon: formData.can_generate_coupon,
          can_cancel_invoice: formData.can_cancel_invoice,
          can_cancel_promis: formData.can_cancel_promis,
          can_manage_perimes: formData.can_manage_perimes,
          can_manage_avoirs: formData.can_manage_avoirs,
          can_validate_zero_amount: formData.can_validate_zero_amount,
          can_modify_price: formData.can_modify_price,
          can_modify_invoice: formData.can_modify_invoice,
          max_discount_rate: formData.max_discount_rate
        }
      };
      
      if (formData.password) {
        payload.password = formData.password;
      }

      // Seul un superadmin peut changer le statut superadmin
      if (currentUser?.is_superuser) {
        payload.is_superuser = formData.is_superuser;
      }

      if (editingUser) {
        const updatedUser = { ...editingUser, ...payload, profile: { ...editingUser.profile, ...payload.profile } };
        // We set the whole object from the response if possible, but for now we update local state
        setUsers(prev => prev.map(u => u.id === editingUser.id ? ({} as any) : u)); // Placeholder to force refresh if needed, but better below
        const { data: finalUser } = await api.patch(`users/${editingUser.id}/`, payload);
        setUsers(prev => prev.map(u => u.id === finalUser.id ? finalUser : u));
        toast.success(t('messages.updated'));
      } else {
        const { data: newUser } = await api.post('users/', payload);
        setUsers(prev => [...prev, newUser].toSorted((a, b) => a.username.localeCompare(b.username)));
        toast.success(t('messages.created'));
      }
      
      setModalOpen(false);
      // fetchUsers(); // Supprimé pour l'instantanéité
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error(getApiErrorDetail(error, t('messages.save_error')));
    }
  };

  if (!currentUser?.is_superuser) {
    return <div className="p-4 text-error">{t('messages.access_denied')}</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-primary">{t('title')}</h1>
          <div className="flex bg-base-200 rounded-lg p-1">
            <button
              onClick={() => setShowTrash(false)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${!showTrash ? 'bg-base-100 text-primary shadow-sm' : 'text-base-content/60 hover:text-base-content'}`}
            >
              {t('tabs.active', 'Actifs')}
              <span className="ml-2 text-xs bg-base-300 text-base-content/70 px-1.5 py-0.5 rounded-full">{users.filter(u => u.is_active).length}</span>
            </button>
            <button
              onClick={() => setShowTrash(true)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${showTrash ? 'bg-base-100 text-error shadow-sm' : 'text-base-content/60 hover:text-base-content'}`}
            >
              {t('tabs.trash', 'Corbeille')}
              <span className="ml-2 text-xs bg-error/20 text-error px-1.5 py-0.5 rounded-full">{users.filter(u => !u.is_active).length}</span>
            </button>
          </div>
        </div>
        {!showTrash && (
          <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-focus transition-colors shadow-sm" onClick={() => handleOpenModal()}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('new_user')}
          </button>
        )}
      </div>

      <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th>{t('table.user')}</th>
              <th>{t('table.role_access')}</th>
              <th>{t('table.special_permissions')}</th>
              <th className="text-right">{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.filter(u => showTrash ? !u.is_active : u.is_active).map(user => (
              <tr key={user.id} className={`hover ${!user.is_active ? 'bg-error/10/30' : ''}`}>
                <td>
                  <div className="flex items-center space-x-3">
                    <div className="inline-flex items-center justify-center">
                      <div className={`text-white rounded-full w-10 ${!user.is_active ? 'bg-gray-400' : 'bg-gray-800'}`}>
                        <span className="text-xl">{user.username.charAt(0).toUpperCase()}</span>
                      </div>
                    </div>
                    <div>
                      <div className="font-bold flex items-center gap-2">
                        {user.username}
                        {!user.is_active && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-error/20 text-error uppercase">{t('badges.inactive', 'Inactif')}</span>}
                      </div>
                      <div className="text-sm text-base-content/50">{user.first_name} {user.last_name}</div>
                      <div className="text-xs text-base-content/50">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex flex-col gap-1">
                    <span className={`badge font-bold uppercase tracking-widest text-[9px] ${
                      user.is_superuser ? 'badge-primary' : 
                      user.profile?.role === 'COMPTABLE' ? 'badge-accent text-white' :
                      user.profile?.role === 'CAISSIER' ? 'badge-secondary' : 'badge-ghost'
                    }`}>
                      {user.is_superuser 
                        ? t('badges.pharmacist') 
                        : user.profile?.role === 'COMPTABLE'
                            ? t('roles.accountant', 'COMPTABLE')
                        : user.profile?.role === 'CAISSIER' 
                            ? t('roles.cashier') 
                            : t('roles.seller')}
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {user.is_superuser ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-base-200 text-base-content/70 border border-base-300">{t('badges.full_access')}</span>
                      ) : (
                        user.profile?.allowed_menus.map(menu => (
                          <span key={menu} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-base-200 text-base-content/70 border border-base-300 text-base-content/70">
                            {menu}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex gap-2">
                    {user.profile?.can_cash_out && (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-success/10 text-success border border-emerald-200" title={t('permissions.cash_out')}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                    )}
                    {user.profile?.can_sell_negative_stock && (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-warning/10 text-warning border border-amber-200" title={t('permissions.negative_stock')}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </div>
                    )}
                  </div>
                </td>
                <td className="text-right">
                  {showTrash ? (
                    // Trash view - show restore button
                    <button 
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-success hover:bg-success/10 rounded-lg text-sm font-medium transition-colors"
                      onClick={() => handleRestoreUser(user.id, user.username)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      {t('actions.restore', 'Restaurer')}
                    </button>
                  ) : (
                    // Active view - show edit and deactivate buttons
                    <>
                      <button 
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-base-content/70 hover:bg-base-200 rounded-lg text-sm font-medium transition-colors"
                        onClick={() => handleOpenModal(user)}
                      >
                        {t('actions.edit')}
                      </button>
                      {currentUser?.username !== user.username && (
                        <button 
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-base-content/70 hover:bg-base-200 rounded-lg text-sm font-medium transition-colors text-error"
                          onClick={() => handleDeleteUser(user.id, user.username)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          {t('actions.deactivate', 'Corbeille')}
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-base-100 w-11/12 max-w-5xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 pb-2 border-b border-base-300 flex justify-between items-center bg-base-100 flex-none">
              <h3 className="font-bold text-xl flex items-center gap-2">
                <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                {editingUser ? t('modal.edit_title') : t('modal.new_title')}
              </h3>
              <button className="inline-flex items-center justify-center size-8 rounded-full text-base-content/60 hover:bg-base-200 transition-colors" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-l-2 border-indigo-500 pl-3 bg-primary/10/50 py-1 rounded-r-lg">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input 
                    label={t('form.password')}
                    type="password"
                    icon={<Lock size={16} />}
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    placeholder={editingUser ? t('form.password_placeholder_edit') : ''}
                  />
                  <div className="flex flex-col gap-1 w-full">
                    <label className="flex flex-col gap-0.5 pt-0 px-1">
                      <span className="label-text font-bold text-base-content/60 uppercase text-[10px] tracking-wider">{t('form.role')}</span>
                    </label>
                    <select 
                      className="w-full rounded-lg border border-base-300 bg-base-100 h-10 px-3 text-sm font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      value={formData.role}
                      onChange={e => handleRoleChange(e.target.value)}
                    >
                      {ROLES.map(role => (
                        <option key={role.value} value={role.value}>{t(role.labelKey)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Copy permissions from existing user - only when creating new user */}
                {!editingUser && (
                  <div className="flex flex-col gap-3 p-4 bg-primary/10/50 rounded-xl border border-indigo-100">
                    <div className="flex items-center gap-2">
                      <Copy className="size-4 text-primary" />
                      <span className="font-bold text-xs uppercase tracking-wider text-primary">{t('form.copy_permissions', 'Copier les droits d\'un utilisateur')}</span>
                    </div>
                    <div className="flex gap-2">
                      <select 
                        className="flex-1 rounded-lg border border-base-300 bg-base-100 h-10 px-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        value={copyFromUserId}
                        onChange={e => setCopyFromUserId(e.target.value ? Number(e.target.value) : '')}
                      >
                        <option value="">{t('form.select_user', 'Sélectionner un utilisateur...')}</option>
                        {users.filter(u => u.is_active).map(user => (
                          <option key={user.id} value={user.id}>
                            {user.username} ({user.profile?.role || (user.is_superuser ? 'PHARMACIEN' : 'VENDEUR')})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleCopyPermissions(copyFromUserId)}
                        disabled={!copyFromUserId}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-focus disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      >
                        <Copy className="size-4" />
                        {t('form.copy_btn', 'Copier')}
                      </button>
                    </div>
                    <p className="text-xs text-base-content/60 italic">
                      {t('form.copy_help', 'Copie tous les droits, menus autorisés et permissions spéciales de l\'utilisateur sélectionné.')}
                    </p>
                  </div>
                )}
              </div>


              <div className="space-y-4">
                <div className="flex items-center gap-2 border-l-2 border-secondary pl-3 bg-secondary/10/50 py-1 rounded-r-lg">
                  <h4 className="font-bold text-xs uppercase tracking-widest text-purple-600">{t('modal.authorized_menus')}</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {MENU_HIERARCHY.map(menu => {
                      const parentLabel = t(menu.labelKey);
                      const isParentChecked = formData.allowed_menus.includes(menu.key);
                      const indeterminate = !isParentChecked && menu.submenus?.some(sub => formData.allowed_menus.includes(sub.key));

                      return (
                        <div key={menu.key} className={`bg-base-200/30 rounded-xl border border-base-300 overflow-hidden ${menu.submenus && menu.submenus.length > 0 ? 'flex flex-col h-full' : ''}`}>
                           <div className="bg-base-200/80 p-3 flex-none border-b border-base-300">
                             <label className="flex items-center cursor-pointer gap-3">
                               <input 
                                 type="checkbox" 
                                 className={`size-4 rounded border-base-300 text-primary focus:ring-primary shrink-0 cursor-pointer ${indeterminate ? '' : ''}`}
                                 checked={isParentChecked || indeterminate}
                                 onChange={() => handleMenuToggle(menu.key, menu.submenus)}
                                 disabled={formData.is_superuser}
                               />
                               <span className={`font-bold text-sm select-none ${formData.is_superuser ? 'text-base-content/50' : ''}`}>{parentLabel}</span>
                             </label>
                           </div>
                           
                           {menu.submenus && menu.submenus.length > 0 && (
                               <div className="p-3 grid grid-cols-1 gap-1.5 flex-1 bg-base-100/50">
                                  {menu.submenus.map(sub => {
                                     const subLabel = t(sub.labelKey);
                                     return (
                                        <div key={sub.key} className="flex items-start transition-all py-0.5 group">
                                          <Checkbox 
                                            size="xs"
                                            color="primary"
                                            checked={formData.allowed_menus.includes(sub.key) || formData.allowed_menus.includes(menu.key)}
                                            onChange={checked => handleSubMenuToggle(sub.key, menu.key, menu.submenus!.length)}
                                            disabled={formData.is_superuser}
                                            label={subLabel}
                                          />
                                        </div>
                                     );
                                  })}
                               </div>
                           )}
                        </div>
                   )})}
                </div>
                {formData.is_superuser && (
                  <div className="p-3 rounded-lg bg-info/10 border border-blue-200 text-blue-800 text-sm italic shadow-sm flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 size-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span>{t('modal.admin_note')}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-l-2 border-success pl-3 bg-success/10/50 py-1 rounded-r-lg">
                      <h4 className="font-bold text-xs uppercase tracking-widest text-success">{t('modal.special_permissions')}</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3 bg-base-200/50 p-4 rounded-xl border border-base-300">
                      <label className="label cursor-pointer justify-start gap-4 p-2 bg-base-100 rounded-lg border border-base-200 hover:border-success transition-all shadow-sm group">
                        <input 
                          type="checkbox" 
                          className="size-4 rounded border-base-300 text-success focus:ring-emerald-500 cursor-pointer appearance-none checked:bg-success"
                          checked={formData.can_cash_out}
                          onChange={e => setFormData({...formData, can_cash_out: e.target.checked})}
                          disabled={formData.is_superuser || formData.role === 'VENDEUR'}
                        />
                        <div className="flex flex-col">
                          <span className="font-bold text-xs group-hover:text-success transition-colors">{t('permissions.cash_out')}</span>
                          <span className="text-[10px] opacity-60 leading-none mt-0.5">{t('permissions.cash_out_desc')}</span>
                        </div>
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Checkbox 
                          size="xs"
                          checked={formData.can_do_returns} 
                          onChange={checked => setFormData({...formData, can_do_returns: checked})} 
                          label={t('permissions.returns')} 
                          className="p-2 bg-base-100/50 rounded-lg"
                        />
                        <Checkbox 
                          size="xs"
                          color="warning"
                          checked={formData.can_sell_negative_stock} 
                          onChange={checked => setFormData({...formData, can_sell_negative_stock: checked})} 
                          label={t('permissions.negative_stock')} 
                          className="p-2 bg-base-100/50 rounded-lg text-warning font-bold"
                        />
                        <Checkbox 
                          size="xs"
                          checked={formData.can_modify_price} 
                          onChange={checked => setFormData({...formData, can_modify_price: checked})} 
                          label={t('permissions.modify_price')} 
                          className="p-2 bg-base-100/50 rounded-lg"
                        />
                        <Checkbox 
                          size="xs"
                          checked={formData.can_generate_coupon} 
                          onChange={checked => setFormData({...formData, can_generate_coupon: checked})} 
                          label={t('permissions.generate_coupon')} 
                          className="p-2 bg-base-100/50 rounded-lg"
                        />
                        <Checkbox 
                          size="xs"
                          checked={formData.can_modify_invoice} 
                          onChange={checked => setFormData({...formData, can_modify_invoice: checked})} 
                          label={t('permissions.modify_invoice')} 
                          className="p-2 bg-base-100/50 rounded-lg"
                        />
                      </div>

                      <div className="flex flex-col gap-1 px-2 mt-1">
                        <label className="flex flex-col gap-0.5 py-1">
                          <span className="text-[10px] font-bold text-base-content/60">{t('form.max_discount')}</span>
                        </label>
                        <input 
                          type="number" 
                          className="w-full rounded-lg border border-base-300 bg-base-100 h-8 px-3 text-sm font-bold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                          value={formData.max_discount_rate}
                          onChange={e => setFormData({...formData, max_discount_rate: parseInt(e.target.value) || 0})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-l-2 border-error pl-3 bg-error/10/50 py-1 rounded-r-lg">
                      <h4 className="font-bold text-xs uppercase tracking-widest text-error">{t('modal.security_sudo')}</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-base-200/50 p-4 rounded-xl border border-base-300">
                      <Checkbox 
                        size="xs" color="error"
                        checked={formData.can_validate_zero_amount}
                        onChange={checked => setFormData({...formData, can_validate_zero_amount: checked})}
                        label={t('permissions.validate_zero_amount', 'Autoriser ventes à 0F')}
                        className="p-2 bg-base-100/50 rounded-lg text-error font-bold"
                      />
                      <Checkbox 
                        size="xs" color="error"
                        checked={formData.can_cancel_invoice} onChange={checked => setFormData({...formData, can_cancel_invoice: checked})}
                        label={t('permissions.cancel_invoice')} className="p-2 bg-base-100/50 rounded-lg text-error font-medium"
                      />
                      <Checkbox 
                        size="xs" color="error"
                        checked={formData.can_cancel_promis} onChange={checked => setFormData({...formData, can_cancel_promis: checked})}
                        label={t('permissions.cancel_promis')} className="p-2 bg-base-100/50 rounded-lg text-error font-medium"
                      />
                      <Checkbox 
                        size="xs" color="error"
                        checked={formData.can_delete_product} onChange={checked => setFormData({...formData, can_delete_product: checked})}
                        label={t('permissions.delete_product')} className="p-2 bg-base-100/50 rounded-lg text-error font-medium"
                      />
                      <Checkbox 
                        size="xs" color="error"
                        checked={formData.can_delete_fournisseur} onChange={checked => setFormData({...formData, can_delete_fournisseur: checked})}
                        label={t('permissions.delete_fournisseur')} className="p-2 bg-base-100/50 rounded-lg text-error font-medium"
                      />
                      <Checkbox 
                        size="xs" color="warning"
                        checked={formData.can_adjust_stock} onChange={checked => setFormData({...formData, can_adjust_stock: checked})}
                        label={t('permissions.adjust_stock')} className="p-2 bg-base-100/50 rounded-lg text-warning font-medium"
                      />
                      <Checkbox 
                        size="xs" color="warning"
                        checked={formData.can_manage_perimes} onChange={checked => setFormData({...formData, can_manage_perimes: checked})}
                        label={t('permissions.manage_perimes')} className="p-2 bg-base-100/50 rounded-lg text-warning font-medium"
                      />
                      <Checkbox 
                        size="xs" color="warning"
                        checked={formData.can_manage_avoirs} onChange={checked => setFormData({...formData, can_manage_avoirs: checked})}
                        label={t('permissions.manage_avoirs')} className="p-2 bg-base-100/50 rounded-lg text-warning font-medium"
                      />
                      <Checkbox 
                        size="xs" color="warning"
                        checked={formData.can_delete_commande} onChange={checked => setFormData({...formData, can_delete_commande: checked})}
                        label={t('permissions.delete_commande')} className="p-2 bg-base-100/50 rounded-lg text-warning font-medium"
                      />
                      <Checkbox 
                        size="xs" color="warning"
                        checked={formData.can_close_commande} onChange={checked => setFormData({...formData, can_close_commande: checked})}
                        label={t('permissions.close_commande')} className="p-2 bg-base-100/50 rounded-lg text-warning font-medium"
                      />
                    </div>
                  </div>
              </div>
            </form>

            <div className="p-4 bg-base-200 border-t border-base-300 flex justify-end gap-3 flex-none">
              <button type="button" className="inline-flex items-center gap-1.5 px-3 py-2 text-base-content/70 hover:bg-base-200 rounded-lg text-sm font-medium transition-colors" onClick={() => setModalOpen(false)}>{t('common:cancel')}</button>
              <button type="submit" onClick={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-focus transition-colors shadow-sm px-10 shadow-lg shadow-indigo-200">{t('common:save')}</button>
            </div>
          </div>
        </div>
      )}

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

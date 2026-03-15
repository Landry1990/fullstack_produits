import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../hooks/useConfirm';
import PasswordConfirmModal from './PasswordConfirmModal';

interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_superuser: boolean;
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
    can_modify_price?: boolean;
    can_modify_invoice?: boolean;
    max_discount_rate?: string | number;
  };
}

const MENU_HIERARCHY = [
  { key: 'dashboard', label: 'Tableau de bord', labelKey: 'sidebar.dashboard' },
  { key: 'manager_sidebar', label: 'Manager Dashboard', labelKey: 'sidebar.manager_sidebar' },
  { 
    key: 'ventes', 
    label: 'Ventes', 
    labelKey: 'sidebar.ventes.title',
    submenus: [
      { key: 'ventes_consultation', label: 'Consultation', labelKey: 'sidebar.ventes.consultation' },
      { key: 'ventes_historique', label: 'Historique', labelKey: 'sidebar.ventes.historique' },
      { key: 'ventes_journal', label: 'Journal de Caisse', labelKey: 'sidebar.ventes.journal' },
      { key: 'ventes_clotures', label: 'Clôtures', labelKey: 'sidebar.ventes.clotures' },
      { key: 'ventes_ordonnancier', label: 'Ordonnancier', labelKey: 'sidebar.ventes.ordonnancier' },
      { key: 'ventes_promotions', label: 'Promotions', labelKey: 'sidebar.ventes.promotions' },
      { key: 'caisse', label: 'Caisse Centralisée', labelKey: 'sidebar.ventes.caisse_centralisee' }
    ]
  },
  { key: 'facturation', label: 'Facturation', labelKey: 'sidebar.facturation' },
  { key: 'produits', label: 'Produits', labelKey: 'sidebar.produits' },
  { key: 'vitrine', label: 'Vitrine', labelKey: 'sidebar.vitrine' },
  { 
    key: 'commandes_loc', 
    label: 'Commandes Locales',
    labelKey: 'sidebar.commandes.local_title',
    submenus: [
      { key: 'commandes_loc_current', label: 'Nouvelle & En cours', labelKey: 'sidebar.commandes.new_current' },
      { key: 'commandes_loc_history', label: 'Historique', labelKey: 'sidebar.commandes.history' }
    ]
  },
  { 
    key: 'commandes_dir', 
    label: 'Commandes Directes',
    labelKey: 'sidebar.commandes.direct_title',
    submenus: [
      { key: 'commandes_dir_current', label: 'Nouvelle & En cours', labelKey: 'sidebar.commandes.new_current' },
      { key: 'commandes_dir_history', label: 'Historique', labelKey: 'sidebar.commandes.history' }
    ]
  },
  { key: 'fournisseurs', label: 'Fournisseurs', labelKey: 'sidebar.fournisseurs.title' },
  { key: 'clients', label: 'Clients', labelKey: 'sidebar.clients' },
  { key: 'creances', label: 'Créances', labelKey: 'sidebar.creances' },
  { 
    key: 'inventaire', 
    label: 'Stock', 
    labelKey: 'sidebar.stock.title',
    submenus: [
      { key: 'inventaire_saisie', label: 'Saisie Inventaire', labelKey: 'sidebar.stock.inventaire.title' },
      { key: 'inventaire_journal', label: 'Journal Ajustements', labelKey: 'sidebar.stock.journal' },
      { key: 'inventaire_analyse', label: 'Analyse Stock', labelKey: 'sidebar.stock.analyse.title' },
      { key: 'inventaire_reappro', label: 'Réappro Rayon', labelKey: 'sidebar.stock.reappro.title' },
      { key: 'inventaire_avoirs', label: 'Avoirs Fournisseurs', labelKey: 'sidebar.stock.avoirs' },
      { key: 'inventaire_promis', label: 'Produits Promis', labelKey: 'sidebar.stock.promis' },
      { key: 'inventaire_transformations', label: 'Transformations', labelKey: 'sidebar.stock.transformations.title' },
      { key: 'inventaire_perimes', label: 'Périmés / Retours', labelKey: 'sidebar.stock.perimes.title' },
      { key: 'inventaire_organisation', label: 'Organisation', labelKey: 'sidebar.stock.organisation.title' },
      { key: 'inventaire_etats', label: 'États Inventaires', labelKey: 'sidebar.stock.etats_inventaire.title' }
    ]
  },
  { 
    key: 'statistiques', 
    label: 'Statistiques', 
    labelKey: 'sidebar.statistiques.title',
    submenus: [
      { key: 'statistiques_rapports', label: 'Centre de Rapports', labelKey: 'sidebar.statistiques.rapports' },
      { key: 'statistiques_abc', label: 'Analyse ABC', labelKey: 'sidebar.statistiques.abc' },
      { key: 'statistiques_fournisseurs', label: 'Stats Fournisseurs', labelKey: 'sidebar.statistiques.fournisseurs' },
      { key: 'statistiques_mensuels', label: 'Rapports Mensuels', labelKey: 'sidebar.statistiques.mensuel' },
      { key: 'statistiques_finances', label: 'Module Financier', labelKey: 'sidebar.statistiques.finances' },
      { key: 'statistiques_vendeurs', label: 'Classement Vendeurs', labelKey: 'sidebar.statistiques.classement_vendeurs' },
      { key: 'statistiques_temporelle', label: 'Analyse Temporelle', labelKey: 'sidebar.statistiques.analyse_temporelle' }
    ]
  },
  {
    key: 'settings',
    label: 'Paramètres',
    labelKey: 'sidebar.parametres.title',
    submenus: [
      { key: 'settings_facture', label: 'Facture', labelKey: 'sidebar.parametres.facture' },
      { key: 'settings_pharmacie', label: 'Pharmacie', labelKey: 'sidebar.parametres.pharmacie' },
      { key: 'settings_whatsapp', label: 'Historique WhatsApp' },
      { key: 'settings_etiquettes', label: 'Options d\'Étiquettes', labelKey: 'sidebar.parametres.etiquettes' }
    ]
  }
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
  { value: 'PHARMACIEN', label: 'Pharmacien (Admin Complet)' },
  { value: 'CAISSIER', label: 'Caissier (Facturation + Encaissement)' },
  { value: 'VENDEUR', label: 'Vendeur (Vente uniquement, pas d\'encaissement)' }
];

export default function GestionUtilisateurs() {
  const { t } = useTranslation();
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

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'VENDEUR',
    is_superuser: false,
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
    can_modify_price: false,
    can_modify_invoice: false,
    max_discount_rate: 0,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users/');
      // Handle paginated response
      const data: any = response.data;
      setUsers(Array.isArray(data) ? data : (data.results || []));
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error(t('users.messages.load_error'));
    } finally {
      setLoading(false);
    }
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
      updates.can_modify_invoice = true; // Caissier can modify sales by default
      updates.allowed_menus = ['ventes_consultation', 'ventes_historique', 'ventes_journal', 'caisse', 'facturation', 'clients', 'produits', 'vitrine'];
    } else if (role === 'VENDEUR') {
      updates.is_superuser = false;
      updates.can_cash_out = false; // RESTRICTION MAJEURE
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
      updates.can_modify_price = false;
      updates.can_modify_invoice = false;
      updates.max_discount_rate = 0;
      // Vendeur a accès à la caisse pour les rappels seulement (sera géré dans CaisseCentralisee)
      updates.allowed_menus = ['facturation', 'caisse', 'produits', 'vitrine', 'clients', 'inventaire_organisation'];
    }

    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleOpenModal = (user: User | null = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        email: user.email,
        password: '', // Don't fill password on edit
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.profile?.role || (user.is_superuser ? 'PHARMACIEN' : 'VENDEUR'),
        is_superuser: user.is_superuser,
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
        can_modify_price: false,
        can_modify_invoice: false,
        max_discount_rate: 0,
      });
      handleRoleChange('VENDEUR'); // Initialize defaults
    }
    setModalOpen(true);
  };

  const handleMenuToggle = (menuKey: string, submenus?: {key: string}[]) => {
    setFormData(prev => {
      let allowed = [...prev.allowed_menus];
      
      const isParent = !!submenus;
      const isCurrentlySelected = allowed.includes(menuKey);

      if (isCurrentlySelected) {
          // Deselect parent and all its submenus
          allowed = allowed.filter(k => k !== menuKey);
          if (isParent) {
             const subKeys = submenus.map(s => s.key);
             allowed = allowed.filter(k => !subKeys.includes(k));
          }
      } else {
          // Select parent and all its submenus
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
            // If we uncheck a submenu, also uncheck the parent to reflect partial state correctly
            allowed = allowed.filter(k => k !== parentKey);
        } else {
            allowed.push(submenuKey);
            // If all submenus are now checked, check the parent too
            // Find current parent submenus in allowed list
            const currentCount = MENU_HIERARCHY.find(m => m.key === parentKey)?.submenus?.filter(s => allowed.includes(s.key)).length || 0;
            if (currentCount === totalSubmenusCount && !allowed.includes(parentKey)) {
                allowed.push(parentKey);
            }
        }
        
        return { ...prev, allowed_menus: allowed };
    });
  };

  // Execute user deletion (called after password confirmation)
  const executeDeleteUser = async (userId: number, username: string) => {
    try {
      await axios.delete(`/api/users/${userId}/`);
      toast.success(t('users.messages.deleted', { username }));
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(t('users.messages.delete_error'));
    }
  };

  // Handle password confirmation callback
  const handlePasswordConfirmed = () => {
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    const confirmed = await confirm({
      title: t('users.messages.delete_confirm_title'),
      message: t('users.messages.delete_confirm', { username }),
      variant: 'danger',
      confirmText: t('users.messages.delete_btn')
    });
    
    if (confirmed) {
      // Trigger Password Modal for sudo confirmation
      setPasswordModalConfig({
        title: t('users.messages.sudo_title'),
        message: t('users.messages.sudo_message')
      });
      setPendingAction(() => () => executeDeleteUser(userId, username));
      setIsPasswordModalOpen(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        username: formData.username,
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        is_superuser: formData.is_superuser,
        ...(formData.password ? { password: formData.password } : {}),
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
          can_modify_price: formData.can_modify_price,
          can_modify_invoice: formData.can_modify_invoice,
          max_discount_rate: formData.max_discount_rate
        }
      };
      
      if (editingUser) {
        await axios.patch(`/api/users/${editingUser.id}/`, payload);
        toast.success(t('users.messages.updated'));
      } else {
        await axios.post('/api/users/', payload);
        toast.success(t('users.messages.created'));
      }
      
      setModalOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error(t('users.messages.save_error'));
    }
  };

  if (!currentUser?.is_superuser) {
    return <div className="p-4 text-error">{t('users.messages.access_denied')}</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-primary">{t('users.title')}</h1>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('users.new_user')}
        </button>
      </div>

      <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
        <table className="table w-full">
          <thead>
            <tr>
              <th>{t('users.table.user')}</th>
              <th>{t('users.table.role_access')}</th>
              <th>{t('users.table.special_permissions')}</th>
              <th className="text-right">{t('users.table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="hover">
                <td>
                  <div className="flex items-center space-x-3">
                    <div className="avatar placeholder">
                      <div className="bg-neutral-focus text-neutral-content rounded-full w-10">
                        <span className="text-xl">{user.username.charAt(0).toUpperCase()}</span>
                      </div>
                    </div>
                    <div>
                      <div className="font-bold">{user.username}</div>
                      <div className="text-sm opacity-50">{user.first_name} {user.last_name}</div>
                      <div className="text-xs opacity-50">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex flex-col gap-1">
                    <span className={`badge ${
                      user.is_superuser ? 'badge-primary' : 
                      user.profile?.role === 'CAISSIER' ? 'badge-secondary' : 'badge-ghost'
                    }`}>
                      {user.is_superuser 
                        ? t('users.badges.pharmacist') 
                        : user.profile?.role === 'CAISSIER' 
                            ? t('users.roles.cashier') 
                            : t('users.roles.seller')}
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {user.is_superuser ? (
                        <span className="badge badge-outline badge-xs">{t('users.badges.full_access')}</span>
                      ) : (
                        user.profile?.allowed_menus.map(menu => (
                          <span key={menu} className="badge badge-outline badge-xs opacity-70">
                            {/* Simple mapping for now, ideally use t(`sidebar.${menu}`) but structure varies */}
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
                      <div className="badge badge-success badge-outline gap-1" title="Peut encaisser">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                    )}
                    {user.profile?.can_sell_negative_stock && (
                      <div className="badge badge-warning badge-outline gap-1" title="Stock Négatif">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </div>
                    )}
                  </div>
                </td>
                <td className="text-right">
                  <button 
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleOpenModal(user)}
                  >
                    {t('clients.actions.edit')}
                  </button>
                  {currentUser?.username !== user.username && (
                    <button 
                      className="btn btn-ghost btn-sm text-error"
                      onClick={() => handleDeleteUser(user.id, user.username)}
                    >
                      {t('clients.actions.delete')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-5xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 pb-2 border-b border-base-300 flex justify-between items-center bg-base-100 flex-none">
              <h3 className="font-bold text-xl flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                {editingUser ? t('users.modal.edit_title') : t('users.modal.new_title')}
              </h3>
              <button className="btn btn-sm btn-circle btn-ghost" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* Section 1: Basic Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-l-4 border-primary pl-3">
                  <h4 className="font-bold text-sm uppercase tracking-wider text-base-content/70">{t('users.modal.basic_info')}</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="form-control">
                    <label className="label text-xs font-semibold py-1">{t('users.form.role')}</label>
                    <select 
                      className="select select-bordered w-full select-primary font-bold"
                      value={formData.role}
                      onChange={(e) => handleRoleChange(e.target.value)}
                    >
                      {ROLES.map(role => {
                           const roleKey = role.value === 'PHARMACIEN' ? 'pharmacist' : role.value === 'CAISSIER' ? 'cashier' : 'seller';
                           return <option key={role.value} value={role.value}>{t(`users.roles.${roleKey}`)}</option>
                      })}
                    </select>
                  </div>

                  <div className="form-control">
                    <label className="label text-xs font-semibold py-1">{t('users.form.username')}</label>
                    <input 
                      type="text" 
                      className="input input-bordered" 
                      value={formData.username}
                      onChange={e => setFormData({...formData, username: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div className="form-control">
                    <label className="label text-xs font-semibold py-1">
                      {t('users.form.password')}
                      {editingUser && <span className="label-text-alt text-warning ml-2">{t('users.form.password_hint')}</span>}
                    </label>
                    <input 
                      type="password" 
                      className="input input-bordered" 
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      required={!editingUser}
                    />
                  </div>

                  <div className="form-control">
                    <label className="label text-xs font-semibold py-1">{t('users.form.firstname')}</label>
                    <input 
                      type="text" 
                      className="input input-bordered" 
                      value={formData.first_name}
                      onChange={e => setFormData({...formData, first_name: e.target.value})}
                    />
                  </div>

                  <div className="form-control">
                    <label className="label text-xs font-semibold py-1">{t('users.form.lastname')}</label>
                    <input 
                      type="text" 
                      className="input input-bordered" 
                      value={formData.last_name}
                      onChange={e => setFormData({...formData, last_name: e.target.value})}
                    />
                  </div>
                  
                  <div className="form-control">
                    <label className="label text-xs font-semibold py-1">{t('users.form.email')}</label>
                    <input 
                      type="email" 
                      className="input input-bordered" 
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Permissions UI - NOW FULL WIDTH */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-l-4 border-secondary pl-3">
                  <h4 className="font-bold text-sm uppercase tracking-wider text-base-content/70">{t('users.modal.authorized_menus')}</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {MENU_HIERARCHY.map(menu => {
                     const parentLabel = menu.labelKey ? t(menu.labelKey, menu.label) : menu.label;
                     const isParentChecked = formData.allowed_menus.includes(menu.key);
                     const indeterminate = !isParentChecked && menu.submenus?.some(sub => formData.allowed_menus.includes(sub.key));

                     return (
                       <div key={menu.key} className="bg-base-200/30 rounded-xl border border-base-300 overflow-hidden flex flex-col h-full">
                          <div className="bg-base-200/80 p-3 flex-none border-b border-base-300">
                            <label className="flex items-center cursor-pointer gap-3">
                              <input 
                                type="checkbox" 
                                className={`checkbox checkbox-sm checkbox-primary shrink-0 ${indeterminate ? 'checkbox-indeterminate' : ''}`}
                                checked={isParentChecked || indeterminate}
                                onChange={() => handleMenuToggle(menu.key, menu.submenus)}
                                disabled={formData.is_superuser}
                              />
                              <span className={`font-bold text-sm select-none ${formData.is_superuser ? 'opacity-50' : ''}`}>{parentLabel}</span>
                            </label>
                          </div>
                          
                          {menu.submenus && menu.submenus.length > 0 && (
                              <div className="p-3 grid grid-cols-1 gap-1.5 flex-1 bg-base-100/50">
                                 {menu.submenus.map(sub => {
                                    const subLabel = sub.labelKey ? t(sub.labelKey, sub.label) : sub.label;
                                    return (
                                      <label key={sub.key} className="flex items-start cursor-pointer gap-2 py-0.5 group">
                                        <input 
                                          type="checkbox" 
                                          className="checkbox checkbox-xs checkbox-secondary shrink-0 mt-0.5 group-hover:border-secondary transition-colors"
                                          checked={formData.allowed_menus.includes(sub.key) || formData.allowed_menus.includes(menu.key)}
                                          onChange={() => handleSubMenuToggle(sub.key, menu.key, menu.submenus!.length)}
                                          disabled={formData.is_superuser}
                                        />
                                        <span className={`text-xs select-none leading-tight pt-0.5 ${formData.is_superuser ? 'opacity-50' : 'text-base-content/80 group-hover:text-base-content'} transition-colors`}>{subLabel}</span>
                                      </label>
                                    );
                                 })}
                              </div>
                          )}
                       </div>
                  )})}
                </div>
                {formData.is_superuser && (
                  <div className="alert alert-info py-2 shadow-sm italic text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span>{t('users.modal.admin_note')}</span>
                  </div>
                )}
              </div>

              {/* Section 3: Specialized & Security */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left: General & Sales */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-l-4 border-success pl-3">
                      <h4 className="font-bold text-sm uppercase tracking-wider text-base-content/70">{t('users.modal.special_permissions')}</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3 bg-base-200/50 p-4 rounded-xl border border-base-300">
                      <label className="label cursor-pointer justify-start gap-4 p-2 bg-base-100 rounded-lg border border-base-200 hover:border-success transition-all shadow-sm group">
                        <input 
                          type="checkbox" 
                          className="toggle toggle-success toggle-sm"
                          checked={formData.can_cash_out}
                          onChange={e => setFormData({...formData, can_cash_out: e.target.checked})}
                          disabled={formData.is_superuser || formData.role === 'VENDEUR'}
                        />
                        <div className="flex flex-col">
                          <span className="font-bold text-xs group-hover:text-success transition-colors">{t('users.permissions.cash_out')}</span>
                          <span className="text-[10px] opacity-60 leading-none mt-0.5">{t('users.permissions.cash_out_desc')}</span>
                        </div>
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                         <label className="label cursor-pointer justify-start gap-3 p-2 bg-base-100/50 rounded-lg group">
                          <input type="checkbox" className="checkbox checkbox-xs" checked={formData.can_do_returns} onChange={e => setFormData({...formData, can_do_returns: e.target.checked})} />
                          <span className="text-xs font-medium opacity-80 group-hover:opacity-100">{t('users.permissions.returns')}</span>
                        </label>
                        <label className="label cursor-pointer justify-start gap-3 p-2 bg-base-100/50 rounded-lg group">
                          <input type="checkbox" className="checkbox checkbox-xs checkbox-warning" checked={formData.can_sell_negative_stock} onChange={e => setFormData({...formData, can_sell_negative_stock: e.target.checked})} />
                          <span className="text-xs font-bold text-warning/80 group-hover:text-warning">{t('users.permissions.negative_stock')}</span>
                        </label>
                        <label className="label cursor-pointer justify-start gap-3 p-2 bg-base-100/50 rounded-lg group">
                          <input type="checkbox" className="checkbox checkbox-xs" checked={formData.can_modify_price} onChange={e => setFormData({...formData, can_modify_price: e.target.checked})} />
                          <span className="text-xs font-medium opacity-80 group-hover:opacity-100">Peut modifier le prix</span>
                        </label>
                        <label className="label cursor-pointer justify-start gap-3 p-2 bg-base-100/50 rounded-lg group">
                          <input type="checkbox" className="checkbox checkbox-xs" checked={formData.can_generate_coupon} onChange={e => setFormData({...formData, can_generate_coupon: e.target.checked})} />
                          <span className="text-xs font-medium opacity-80 group-hover:opacity-100">{t('users.permissions.generate_coupon')}</span>
                        </label>
                        <label className="label cursor-pointer justify-start gap-3 p-2 bg-base-100/50 rounded-lg group">
                          <input type="checkbox" className="checkbox checkbox-xs" checked={formData.can_modify_invoice} onChange={e => setFormData({...formData, can_modify_invoice: e.target.checked})} />
                          <span className="text-xs font-medium opacity-80 group-hover:opacity-100">{t('users.permissions.modify_invoice')}</span>
                        </label>
                      </div>

                      <div className="form-control px-2 mt-1">
                        <label className="label py-1">
                          <span className="label-text text-[10px] font-bold opacity-60">Taux de remise max (%)</span>
                        </label>
                        <input 
                          type="number" 
                          className="input input-bordered input-xs !h-8 font-bold" 
                          value={formData.max_discount_rate}
                          onChange={e => setFormData({...formData, max_discount_rate: parseInt(e.target.value) || 0})}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right: Security & Admin */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-l-4 border-error pl-3">
                      <h4 className="font-bold text-sm uppercase tracking-wider text-base-content/70">Sécurité & Sudo</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-base-200/50 p-4 rounded-xl border border-base-300">
                      <label className="label cursor-pointer justify-start gap-3 p-2 bg-base-100/50 rounded-lg group">
                        <input type="checkbox" className="checkbox checkbox-xs checkbox-error" checked={formData.can_cancel_invoice} onChange={e => setFormData({...formData, can_cancel_invoice: e.target.checked})} />
                        <span className="text-xs font-medium text-error opacity-80 group-hover:opacity-100">Annuler Factures</span>
                      </label>
                      <label className="label cursor-pointer justify-start gap-3 p-2 bg-base-100/50 rounded-lg group">
                        <input type="checkbox" className="checkbox checkbox-xs checkbox-error" checked={formData.can_cancel_promis} onChange={e => setFormData({...formData, can_cancel_promis: e.target.checked})} />
                        <span className="text-xs font-medium text-error opacity-80 group-hover:opacity-100">Annuler Promis</span>
                      </label>
                      <label className="label cursor-pointer justify-start gap-3 p-2 bg-base-100/50 rounded-lg group">
                        <input type="checkbox" className="checkbox checkbox-xs checkbox-error" checked={formData.can_delete_product} onChange={e => setFormData({...formData, can_delete_product: e.target.checked})} />
                        <span className="text-xs font-medium text-error opacity-80 group-hover:opacity-100">Supprimer Produits</span>
                      </label>
                      <label className="label cursor-pointer justify-start gap-3 p-2 bg-base-100/50 rounded-lg group">
                        <input type="checkbox" className="checkbox checkbox-xs checkbox-error" checked={formData.can_delete_fournisseur} onChange={e => setFormData({...formData, can_delete_fournisseur: e.target.checked})} />
                        <span className="text-xs font-medium text-error opacity-80 group-hover:opacity-100">Supprimer Fournisseurs</span>
                      </label>
                      <label className="label cursor-pointer justify-start gap-3 p-2 bg-base-100/50 rounded-lg group">
                        <input type="checkbox" className="checkbox checkbox-xs checkbox-warning" checked={formData.can_adjust_stock} onChange={e => setFormData({...formData, can_adjust_stock: e.target.checked})} />
                        <span className="text-xs font-medium text-warning opacity-80 group-hover:opacity-100">Ajuster Stock</span>
                      </label>
                      <label className="label cursor-pointer justify-start gap-3 p-2 bg-base-100/50 rounded-lg group">
                        <input type="checkbox" className="checkbox checkbox-xs" checked={formData.can_manage_perimes} onChange={e => setFormData({...formData, can_manage_perimes: e.target.checked})} />
                        <span className="text-xs font-medium opacity-80 group-hover:opacity-100">Gérer Périmés</span>
                      </label>
                    </div>
                  </div>
              </div>
            </form>

            <div className="p-4 bg-base-200 border-t border-base-300 flex justify-end gap-3 flex-none">
              <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>{t('users.modal.cancel')}</button>
              <button type="submit" onClick={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)} className="btn btn-primary px-10 shadow-lg shadow-primary/20">{t('users.modal.save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Sudo Mode Password Modal */}
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

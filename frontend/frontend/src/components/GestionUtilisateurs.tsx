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
    max_discount_rate?: string | number;
  };
}

const AVAILABLE_MENUS = [
  { key: 'dashboard', label: 'Tableau de bord' },
  { key: 'ventes', label: 'Ventes' },
  { key: 'facturation', label: 'Facturation' },
  { key: 'caisse', label: 'Caisse Centralisée' }, // Ajout caisse
  { key: 'produits', label: 'Produits' },
  { key: 'commandes', label: 'Commandes' },
  { key: 'fournisseurs', label: 'Fournisseurs' },
  { key: 'clients', label: 'Clients' },
  { key: 'rayons', label: 'Rayons' },
  { key: 'inventaire', label: 'Inventaire' },
  { key: 'avoirs', label: 'Avoirs Fournisseurs' },
  { key: 'promis', label: 'Produits Promis' },
  { key: 'perimes', label: 'Périmés / Retours' },
  { key: 'statistiques', label: 'Statistiques' },
];

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
      updates.max_discount_rate = 100;
      updates.allowed_menus = AVAILABLE_MENUS.map(m => m.key);
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
      updates.allowed_menus = ['ventes', 'facturation', 'caisse', 'clients', 'produits'];
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
      updates.max_discount_rate = 0;
      // Vendeur a accès à la caisse pour les rappels seulement (sera géré dans CaisseCentralisee)
      updates.allowed_menus = ['facturation', 'caisse', 'produits', 'clients', 'rayons'];
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
        allowed_menus: ['facturation', 'produits'],
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
        max_discount_rate: 0,
      });
      handleRoleChange('VENDEUR'); // Initialize defaults
    }
    setModalOpen(true);
  };

  const handleMenuToggle = (menuKey: string) => {
    setFormData(prev => {
      const menus = prev.allowed_menus.includes(menuKey)
        ? prev.allowed_menus.filter(k => k !== menuKey)
        : [...prev.allowed_menus, menuKey];
      return { ...prev, allowed_menus: menus };
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
          <div className="modal-box w-11/12 max-w-3xl">
            <button className="btn btn-sm btn-circle absolute right-2 top-2" onClick={() => setModalOpen(false)}>✕</button>
            <h3 className="font-bold text-lg mb-4">
              {editingUser ? t('users.modal.edit_title') : t('users.modal.new_title')}
            </h3>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left Column: Required Info */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm uppercase text-gray-500">{t('users.modal.basic_info')}</h4>
                
                <div className="form-control">
                  <label className="label">{t('users.form.role')}</label>
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
                  <label className="label">{t('users.form.username')}</label>
                  <input 
                    type="text" 
                    className="input input-bordered" 
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-control">
                  <label className="label">
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

                <div className="grid grid-cols-2 gap-2">
                  <div className="form-control">
                    <label className="label text-xs">{t('users.form.firstname')}</label>
                    <input 
                      type="text" 
                      className="input input-bordered input-sm" 
                      value={formData.first_name}
                      onChange={e => setFormData({...formData, first_name: e.target.value})}
                    />
                  </div>
                  <div className="form-control">
                    <label className="label text-xs">{t('users.form.lastname')}</label>
                    <input 
                      type="text" 
                      className="input input-bordered input-sm" 
                      value={formData.last_name}
                      onChange={e => setFormData({...formData, last_name: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="form-control">
                  <label className="label text-xs">{t('users.form.email')}</label>
                  <input 
                    type="email" 
                    className="input input-bordered input-sm" 
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              {/* Right Column: Permissions */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm uppercase text-gray-500">{t('users.modal.access_permissions')}</h4>
                
                <div className="bg-base-200 p-4 rounded-lg">
                  <label className="label font-bold">{t('users.modal.authorized_menus')}</label>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    {AVAILABLE_MENUS.map(menu => {
                       // Map menu keys to translation keys
                       let label = menu.label;
                       if (menu.key === 'dashboard') label = t('sidebar.dashboard');
                       else if (menu.key === 'ventes') label = t('sidebar.ventes.title');
                       else if (menu.key === 'facturation') label = t('sidebar.facturation');
                       else if (menu.key === 'caisse') label = t('sidebar.ventes.caisse_centralisee');
                       else if (menu.key === 'produits') label = t('sidebar.produits');
                       else if (menu.key === 'commandes') label = t('sidebar.commandes.title');
                       else if (menu.key === 'fournisseurs') label = t('sidebar.fournisseurs.title');
                       else if (menu.key === 'clients') label = t('sidebar.clients');
                       else if (menu.key === 'rayons') label = t('sidebar.stock.rayons');
                       else if (menu.key === 'statistiques') label = t('sidebar.statistiques.title');

                       return (
                      <label key={menu.key} className="label cursor-pointer justify-start gap-2 py-0">
                        <input 
                          type="checkbox" 
                          className="checkbox checkbox-xs checkbox-primary"
                          checked={formData.allowed_menus.includes(menu.key)}
                          onChange={() => handleMenuToggle(menu.key)}
                          disabled={formData.is_superuser} // Admin has all menus
                        />
                        <span className={`label-text text-sm ${formData.is_superuser ? 'opacity-50' : ''}`}>{label}</span>
                      </label>
                    )})}
                  </div>
                  {formData.is_superuser && <div className="text-xs text-info mt-2">{t('users.modal.admin_note')}</div>}
                </div>

                <div className="bg-base-200 p-4 rounded-lg space-y-2">
                  <label className="label font-bold py-0">{t('users.modal.special_permissions')}</label>
                  
                  <label className="label cursor-pointer justify-start gap-3 bg-base-100 p-2 rounded border border-base-300">
                    <input 
                      type="checkbox" 
                      className="toggle toggle-success toggle-sm"
                      checked={formData.can_cash_out}
                      onChange={e => setFormData({...formData, can_cash_out: e.target.checked})}
                      disabled={formData.is_superuser || formData.role === 'VENDEUR'} // Vendeur cannot cash out
                    />
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{t('users.permissions.cash_out')}</span>
                      <span className="text-xs text-base-content/60">{t('users.permissions.cash_out_desc')}</span>
                    </div>
                  </label>

                  {formData.role === 'VENDEUR' && (
                    <div className="text-xs text-warning">
                       {t('users.modal.seller_warning')}
                    </div>
                  )}

                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-xs"
                      checked={formData.can_do_returns}
                      onChange={e => setFormData({...formData, can_do_returns: e.target.checked})}
                    />
                    <span className="label-text text-sm">{t('users.permissions.returns')}</span>
                  </label>
                  
                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-xs"
                      checked={formData.can_sell_negative_stock}
                      onChange={e => setFormData({...formData, can_sell_negative_stock: e.target.checked})}
                    />
                    <span className="label-text text-sm font-bold text-warning">{t('users.permissions.negative_stock')}</span>
                  </label>

                  <div className="divider my-1">{t('users.modal.security')}</div>

                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-xs checkbox-error"
                      checked={formData.can_delete_product}
                      onChange={e => setFormData({...formData, can_delete_product: e.target.checked})}
                    />
                    <span className="label-text text-sm">{t('users.permissions.delete_product')}</span>
                  </label>

                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-xs checkbox-warning"
                      checked={formData.can_adjust_stock}
                      onChange={e => setFormData({...formData, can_adjust_stock: e.target.checked})}
                    />
                    <span className="label-text text-sm">{t('users.permissions.adjust_stock')}</span>
                  </label>

                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-xs checkbox-error"
                      checked={formData.can_delete_fournisseur}
                      onChange={e => setFormData({...formData, can_delete_fournisseur: e.target.checked})}
                    />
                    <span className="label-text text-sm">{t('users.permissions.delete_provider')}</span>
                  </label>

                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-xs checkbox-error"
                      checked={formData.can_delete_commande}
                      onChange={e => setFormData({...formData, can_delete_commande: e.target.checked})}
                    />
                    <span className="label-text text-sm">{t('users.permissions.delete_order')}</span>
                  </label>

                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-xs checkbox-warning"
                      checked={formData.can_close_commande}
                      onChange={e => setFormData({...formData, can_close_commande: e.target.checked})}
                    />
                    <span className="label-text text-sm">{t('users.permissions.close_order')}</span>
                  </label>

                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-xs checkbox-warning"
                      checked={formData.can_generate_coupon}
                      onChange={e => setFormData({...formData, can_generate_coupon: e.target.checked})}
                    />
                    <span className="label-text text-sm">{t('users.permissions.generate_coupon')}</span>
                  </label>

                  <div className="divider my-1">Sudo Actions</div>

                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-xs"
                      checked={formData.can_cancel_invoice}
                      onChange={e => setFormData({...formData, can_cancel_invoice: e.target.checked})}
                    />
                    <span className="label-text text-sm">Peut annuler des factures</span>
                  </label>

                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-xs"
                      checked={formData.can_cancel_promis}
                      onChange={e => setFormData({...formData, can_cancel_promis: e.target.checked})}
                    />
                    <span className="label-text text-sm">Peut annuler des promis</span>
                  </label>

                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-xs"
                      checked={formData.can_manage_perimes}
                      onChange={e => setFormData({...formData, can_manage_perimes: e.target.checked})}
                    />
                    <span className="label-text text-sm">Peut gérer les périmés</span>
                  </label>

                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-xs"
                      checked={formData.can_manage_avoirs}
                      onChange={e => setFormData({...formData, can_manage_avoirs: e.target.checked})}
                    />
                    <span className="label-text text-sm">Peut gérer les avoirs</span>
                  </label>

                  <div className="divider my-1">Prix & Remises</div>

                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-xs"
                      checked={formData.can_modify_price}
                      onChange={e => setFormData({...formData, can_modify_price: e.target.checked})}
                    />
                    <span className="label-text text-sm">Peut modifier le prix</span>
                  </label>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-xs">Taux de remise max (%)</span>
                    </label>
                    <input 
                      type="number" 
                      className="input input-bordered input-sm" 
                      value={formData.max_discount_rate}
                      onChange={e => setFormData({...formData, max_discount_rate: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-action col-span-1 md:col-span-2">
                <button type="button" className="btn" onClick={() => setModalOpen(false)}>{t('users.modal.cancel')}</button>
                <button type="submit" className="btn btn-primary px-8">{t('users.modal.save')}</button>
              </div>
            </form>
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

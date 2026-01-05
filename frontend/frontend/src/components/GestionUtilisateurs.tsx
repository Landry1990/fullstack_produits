import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

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
  { key: 'statistiques', label: 'Statistiques' },
];

const ROLES = [
  { value: 'PHARMACIEN', label: 'Pharmacien (Admin Complet)' },
  { value: 'CAISSIER', label: 'Caissier (Facturation + Encaissement)' },
  { value: 'VENDEUR', label: 'Vendeur (Vente uniquement, pas d\'encaissement)' }
];

export default function GestionUtilisateurs() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const { user: currentUser } = useAuth();

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
      toast.error('Erreur lors du chargement des utilisateurs');
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
      updates.allowed_menus = AVAILABLE_MENUS.map(m => m.key);
    } else if (role === 'CAISSIER') {
      updates.is_superuser = false;
      updates.can_cash_out = true;
      updates.can_do_returns = false;
      updates.can_sell_negative_stock = false;
      updates.allowed_menus = ['ventes', 'facturation', 'caisse', 'clients', 'produits'];
    } else if (role === 'VENDEUR') {
      updates.is_superuser = false;
      updates.can_cash_out = false; // RESTRICTION MAJEURE
      updates.can_do_returns = false;
      updates.can_sell_negative_stock = false;
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

  const handleDeleteUser = async (userId: number, username: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${username}" ? Cette action est irréversible.`)) {
      try {
        await axios.delete(`/api/users/${userId}/`);
        toast.success(`Utilisateur ${username} supprimé`);
        fetchUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
        toast.error("Erreur lors de la suppression de l'utilisateur");
      }
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
          can_cash_out: formData.can_cash_out
        }
      };
      
      if (editingUser) {
        await axios.patch(`/api/users/${editingUser.id}/`, payload);
        toast.success('Utilisateur mis à jour');
      } else {
        await axios.post('/api/users/', payload);
        toast.success('Utilisateur créé');
      }
      
      setModalOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  if (!currentUser?.is_superuser) {
    return <div className="p-4 text-error">Accès refusé. Réservé aux administrateurs.</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-primary">Gestion des Utilisateurs</h1>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouvel Utilisateur
        </button>
      </div>

      <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Rôle & Accès</th>
              <th>Permissions Spéciales</th>
              <th className="text-right">Actions</th>
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
                      {user.is_superuser ? 'Pharmacien (Admin)' : user.profile?.role || 'Vendeur'}
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {user.is_superuser ? (
                        <span className="badge badge-outline badge-xs">Accès Total</span>
                      ) : (
                        user.profile?.allowed_menus.map(menu => (
                          <span key={menu} className="badge badge-outline badge-xs opacity-70">{menu}</span>
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
                    Modifier
                  </button>
                  {currentUser?.username !== user.username && (
                    <button 
                      className="btn btn-ghost btn-sm text-error"
                      onClick={() => handleDeleteUser(user.id, user.username)}
                    >
                      Supprimer
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
              {editingUser ? 'Modifier Utilisateur' : 'Nouvel Utilisateur'}
            </h3>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left Column: Required Info */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm uppercase text-gray-500">Informations de base</h4>
                
                <div className="form-control">
                  <label className="label">Type de Compte (Rôle)</label>
                  <select 
                    className="select select-bordered w-full select-primary font-bold"
                    value={formData.role}
                    onChange={(e) => handleRoleChange(e.target.value)}
                  >
                    {ROLES.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-control">
                  <label className="label">Nom d'utilisateur</label>
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
                    Mot de passe
                    {editingUser && <span className="label-text-alt text-warning ml-2">(Laisser vide si inchangé)</span>}
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
                    <label className="label text-xs">Prénom</label>
                    <input 
                      type="text" 
                      className="input input-bordered input-sm" 
                      value={formData.first_name}
                      onChange={e => setFormData({...formData, first_name: e.target.value})}
                    />
                  </div>
                  <div className="form-control">
                    <label className="label text-xs">Nom</label>
                    <input 
                      type="text" 
                      className="input input-bordered input-sm" 
                      value={formData.last_name}
                      onChange={e => setFormData({...formData, last_name: e.target.value})}
                    />
                  </div>
                </div>
                
                <div className="form-control">
                  <label className="label text-xs">Email</label>
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
                <h4 className="font-semibold text-sm uppercase text-gray-500">Accès et Permissions</h4>
                
                <div className="bg-base-200 p-4 rounded-lg">
                  <label className="label font-bold">Menus Autorisés</label>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    {AVAILABLE_MENUS.map(menu => (
                      <label key={menu.key} className="label cursor-pointer justify-start gap-2 py-0">
                        <input 
                          type="checkbox" 
                          className="checkbox checkbox-xs checkbox-primary"
                          checked={formData.allowed_menus.includes(menu.key)}
                          onChange={() => handleMenuToggle(menu.key)}
                          disabled={formData.is_superuser} // Admin has all menus
                        />
                        <span className={`label-text text-sm ${formData.is_superuser ? 'opacity-50' : ''}`}>{menu.label}</span>
                      </label>
                    ))}
                  </div>
                  {formData.is_superuser && <div className="text-xs text-info mt-2">Le Pharmacien (Admin) a accès à tous les menus.</div>}
                </div>

                <div className="bg-base-200 p-4 rounded-lg space-y-2">
                  <label className="label font-bold py-0">Permissions Spéciales</label>
                  
                  <label className="label cursor-pointer justify-start gap-3 bg-base-100 p-2 rounded border border-base-300">
                    <input 
                      type="checkbox" 
                      className="toggle toggle-success toggle-sm"
                      checked={formData.can_cash_out}
                      onChange={e => setFormData({...formData, can_cash_out: e.target.checked})}
                      disabled={formData.is_superuser || formData.role === 'VENDEUR'} // Vendeur cannot cash out
                    />
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">Encaissement Autorisé</span>
                      <span className="text-xs text-base-content/60">Accès aux boutons de paiement</span>
                    </div>
                  </label>

                  {formData.role === 'VENDEUR' && (
                    <div className="text-xs text-warning">
                       ⚠️ Un vendeur ne peut pas encaisser par définition.
                    </div>
                  )}

                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-xs"
                      checked={formData.can_do_returns}
                      onChange={e => setFormData({...formData, can_do_returns: e.target.checked})}
                    />
                    <span className="label-text text-sm">Autoriser les retours</span>
                  </label>
                  
                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-xs"
                      checked={formData.can_sell_negative_stock}
                      onChange={e => setFormData({...formData, can_sell_negative_stock: e.target.checked})}
                    />
                    <span className="label-text text-sm">Vente hors stock</span>
                  </label>
                </div>
              </div>

              <div className="modal-action col-span-1 md:col-span-2">
                <button type="button" className="btn" onClick={() => setModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary px-8">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

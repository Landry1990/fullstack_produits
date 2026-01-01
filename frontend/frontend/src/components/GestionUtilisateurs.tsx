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
    allowed_menus: string[];
    can_do_returns?: boolean;
    can_sell_negative_stock?: boolean;
  };
}

const AVAILABLE_MENUS = [
  { key: 'ventes', label: 'Ventes' },
  { key: 'facturation', label: 'Facturation' },
  { key: 'produits', label: 'Produits' },
  { key: 'commandes', label: 'Commandes' },
  { key: 'fournisseurs', label: 'Fournisseurs' },
  { key: 'clients', label: 'Clients' },
  { key: 'rayons', label: 'Rayons' },
  { key: 'statistiques', label: 'Statistiques' },
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
    allowed_menus: [] as string[],
    can_do_returns: false,
    can_sell_negative_stock: false,
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
    } finally {
      setLoading(false);
    }
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
        allowed_menus: user.profile?.allowed_menus || [],
        can_do_returns: user.profile?.can_do_returns || false,
        can_sell_negative_stock: user.profile?.can_sell_negative_stock || false,
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        allowed_menus: [],
        can_do_returns: false,
        can_sell_negative_stock: false,
      });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        profile: {
          allowed_menus: formData.allowed_menus,
          can_do_returns: formData.can_do_returns,
          can_sell_negative_stock: formData.can_sell_negative_stock
        }
      };
      
      // Remove password if empty during edit
      if (editingUser && !payload.password) {
        delete (payload as any).password;
      }

      if (editingUser) {
        await axios.patch(`/api/users/${editingUser.id}/`, payload);
      } else {
        await axios.post('/api/users/', payload);
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
          + Nouvel Utilisateur
        </button>
      </div>

      <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Accès Menus</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>
                  <div className="font-bold">{user.username}</div>
                  <div className="text-sm opacity-50">{user.first_name} {user.last_name}</div>
                </td>
                <td>{user.email}</td>
                <td>
                  {user.is_superuser ? (
                    <span className="badge badge-primary">Admin</span>
                  ) : (
                    <span className="badge badge-ghost">Utilisateur</span>
                  )}
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {user.is_superuser ? (
                      <span className="badge badge-success badge-sm">Tout</span>
                    ) : (
                      user.profile?.allowed_menus.map(menu => (
                        <span key={menu} className="badge badge-outline badge-sm">{menu}</span>
                      ))
                    )}
                  </div>
                </td>
                <td>
                  <button 
                    className="btn btn-sm btn-ghost"
                    onClick={() => handleOpenModal(user)}
                  >
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">
              {editingUser ? 'Modifier Utilisateur' : 'Nouvel Utilisateur'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
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
              
              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">Prénom</label>
                  <input 
                    type="text" 
                    className="input input-bordered" 
                    value={formData.first_name}
                    onChange={e => setFormData({...formData, first_name: e.target.value})}
                  />
                </div>
                <div className="form-control">
                  <label className="label">Nom</label>
                  <input 
                    type="text" 
                    className="input input-bordered" 
                    value={formData.last_name}
                    onChange={e => setFormData({...formData, last_name: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label">Email</label>
                <input 
                  type="email" 
                  className="input input-bordered" 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  Mot de passe
                  {editingUser && <span className="label-text-alt text-warning ml-2">(Laisser vide pour ne pas changer)</span>}
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
                <label className="label">Permissions (Menus autorisés)</label>
                <div className="grid grid-cols-2 gap-2 bg-base-200 p-4 rounded-lg">
                  {AVAILABLE_MENUS.map(menu => (
                    <label key={menu.key} className="label cursor-pointer justify-start gap-2">
                      <input 
                        type="checkbox" 
                        className="checkbox checkbox-sm checkbox-primary"
                        checked={formData.allowed_menus.includes(menu.key)}
                        onChange={() => handleMenuToggle(menu.key)}
                      />
                      <span className="label-text">{menu.label}</span>
                    </label>
                  ))}
                </div>
                </div>

              <div className="form-control">
                <label className="label">Permissions Spéciales</label>
                <div className="grid grid-cols-1 gap-2 bg-base-200 p-4 rounded-lg">
                  <label className="label cursor-pointer justify-start gap-2">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-sm checkbox-secondary"
                      checked={formData.can_do_returns}
                      onChange={e => setFormData({...formData, can_do_returns: e.target.checked})}
                    />
                    <span className="label-text">Autoriser les retours (Quantités négatives)</span>
                  </label>
                  <label className="label cursor-pointer justify-start gap-2">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-sm checkbox-secondary"
                      checked={formData.can_sell_negative_stock}
                      onChange={e => setFormData({...formData, can_sell_negative_stock: e.target.checked})}
                    />
                    <span className="label-text">Autoriser la vente avec stock négatif</span>
                  </label>
                </div>
              </div>

              <div className="modal-action">
                <button type="button" className="btn" onClick={() => setModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

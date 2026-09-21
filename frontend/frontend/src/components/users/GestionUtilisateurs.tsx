import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { gooeyToast } from 'goey-toast';
import { getApiErrorDetail, extractErrorMessage } from '../../utils/errorHandling';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../hooks/useConfirm';
import { useMenuHierarchy, getAllMenuKeysFromHierarchy, getMenuLabel as getMenuLabelFromHierarchy } from '../../hooks/useMenuHierarchy';
import { useUserForm } from '../../hooks/useUserForm';
import PasswordConfirmModal from '../PasswordConfirmModal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { UserPlus } from 'lucide-react';
import { logger } from '../../utils/logger'
import { PERMISSIONS_META, type ManagedUser } from './usersMeta';
import { MENU_HIERARCHY_FALLBACK } from './menuHierarchyFallback';
import UserListItem from './UserListItem';
import UserFormDialog from './UserFormDialog';
import { PageContainer } from '../ui/PageContainer';

export default function GestionUtilisateurs() {
  const { t } = useTranslation(['users', 'sidebar', 'common']);
  const { data: menuData } = useMenuHierarchy();
  const MENU_HIERARCHY = menuData?.hierarchy ?? MENU_HIERARCHY_FALLBACK;
  const getAllMenuKeys = () => getAllMenuKeysFromHierarchy(MENU_HIERARCHY);
  const getMenuLabel = (key: string) => getMenuLabelFromHierarchy(MENU_HIERARCHY, key, t);
  const confirm = useConfirm();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const { user: currentUser, login } = useAuth();
  const form = useUserForm(MENU_HIERARCHY, menuData?.adminOnlyKeys);
  const { formData } = form;

  // Sudo Mode State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordModalConfig, setPasswordModalConfig] = useState({ title: '', message: '' });
  const pendingActionRef = useRef<(() => Promise<void>) | null>(null);

  // La corbeille des utilisateurs est gérée centrally via le menu Corbeille de la sidebar
  // (composant Corbeille.tsx + endpoint /api/corbeille/). Plus d'onglet local ici.

  useEffect(() => {
    fetchUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('users/');
      const data: unknown = response.data;
      setUsers(Array.isArray(data) ? data : (Array.isArray((data as { results?: unknown })?.results) ? (data as { results: ManagedUser[] }).results : []));
    } catch (error) {
      logger.error('Error fetching users:', error);
      gooeyToast.error(t('messages.load_error'));
    }
  };

  const handleOpenModal = (user: ManagedUser | null = null) => {
    if (user) {
      setEditingUser(user);
      form.initForEdit(user);
    } else {
      setEditingUser(null);
      form.initForCreate();
    }
    setModalOpen(true);
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

  const handleDeactivateUser = async (user: ManagedUser) => {
    const confirmed = await confirm({
      title: t('messages.deactivate_confirm_title', { defaultValue: 'Désactiver l\'utilisateur ?' }),
      message: t('messages.deactivate_confirm', { username: user.username, defaultValue: `Voulez-vous désactiver l'utilisateur ${user.username} ? Il sera déplacé vers le menu Corbeille et pourra être restauré depuis là-bas.` }),
      variant: 'danger',
      confirmText: t('messages.deactivate_btn', { defaultValue: 'Désactiver' })
    });

    if (confirmed) {
      setPasswordModalConfig({
        title: t('messages.sudo_title'),
        message: t('messages.sudo_message')
      });
      pendingActionRef.current = () => executeDeleteUser(user.id, user.username);
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
    <PageContainer variant="dense" className="p-6">
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
        {users.filter(u => u.is_active).map(user => (
          <UserListItem
            key={user.id}
            user={user}
            isSelf={currentUser?.username === user.username}
            allMenuKeysCount={getAllMenuKeys().length}
            menuLabel={getMenuLabel}
            onEdit={handleOpenModal}
            onDeactivate={handleDeactivateUser}
          />
        ))}
      </div>

      <UserFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        editingUser={editingUser}
        users={users}
        menuHierarchy={MENU_HIERARCHY}
        form={form}
        onSubmit={handleSubmit}
      />

      <PasswordConfirmModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onConfirm={handlePasswordConfirmed}
        title={passwordModalConfig.title}
        message={passwordModalConfig.message}
      />
    </PageContainer>
  );
}

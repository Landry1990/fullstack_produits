import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gooeyToast } from 'goey-toast';
import { User, Mail, Lock, Copy } from 'lucide-react';
import { Input } from '../../ui/Input';
import { Label } from '../../ui/Label';
import { Select } from '../../ui/Select';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ROLES, type ManagedUser } from '../usersMeta';
import type { UserForm } from '../../../hooks/useUserForm';

interface Props {
  form: UserForm;
  users: ManagedUser[];
  isEditing: boolean;
}

export default function UserInfoTab({ form, users, isEditing }: Props) {
  const { t } = useTranslation(['users', 'sidebar', 'common']);
  const { formData, setFormData, applyRole, copyFromUser } = form;
  const [copyFromUserId, setCopyFromUserId] = useState<number | ''>('');

  const handleCopy = (sourceUserId: number | '') => {
    if (!sourceUserId) return;
    const sourceUser = users.find(u => u.id === sourceUserId);
    if (!sourceUser) return;
    copyFromUser(sourceUser);
    gooeyToast.success(t('messages.permissions_copied', { username: sourceUser.username, defaultValue: `Droits copiés de ${sourceUser.username}` }));
  };

  return (
    <div className="space-y-6">
      <Card variant="bordered" padding="md">
        <div className="flex items-center gap-2 mb-4 border-l-2 border-primary pl-3">
          <h4 className="font-bold text-xs uppercase tracking-widest text-primary">{t('modal.basic_info')}</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t('form.username')}
            icon={<User size={16} />}
            value={formData.username}
            onChange={e => setFormData({ ...formData, username: e.target.value })}
            required
          />
          <Input
            label={t('form.email')}
            type="email"
            icon={<Mail size={16} />}
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
          />
          <Input
            label={t('form.first_name')}
            value={formData.first_name}
            onChange={e => setFormData({ ...formData, first_name: e.target.value })}
          />
          <Input
            label={t('form.last_name')}
            value={formData.last_name}
            onChange={e => setFormData({ ...formData, last_name: e.target.value })}
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
            onChange={e => setFormData({ ...formData, password: e.target.value })}
            placeholder={isEditing ? t('form.password_placeholder_edit') : ''}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-role-select">{t('form.role')}</Label>
            <Select
              id="user-role-select"
              value={formData.role}
              onChange={e => applyRole(e.target.value)}
            >
              {ROLES.map(role => (
                <option key={role.value} value={role.value}>{t(role.labelKey)}</option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {!isEditing && (
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
              onClick={() => handleCopy(copyFromUserId)}
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
    </div>
  );
}

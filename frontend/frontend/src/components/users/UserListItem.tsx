import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import type { ManagedUser } from './usersMeta';

interface Props {
  user: ManagedUser;
  isSelf: boolean;
  allMenuKeysCount: number;
  menuLabel: (key: string) => string;
  onEdit: (user: ManagedUser) => void;
  onDeactivate: (user: ManagedUser) => void;
}

export default function UserListItem({ user, isSelf, onEdit, onDeactivate }: Props) {
  const { t } = useTranslation(['users', 'sidebar', 'common']);

  const roleBadge = (
    <Badge variant={user.is_superuser ? 'primary' : user.profile?.role === 'COMPTABLE' ? 'secondary' : user.profile?.role === 'CAISSIER' ? 'accent' : 'ghost'} size="sm">
      {user.is_superuser
        ? t('badges.pharmacist')
        : user.profile?.role === 'COMPTABLE'
          ? t('roles.accountant', 'COMPTABLE')
          : user.profile?.role === 'CAISSIER'
            ? t('roles.cashier')
            : t('roles.seller')}
    </Badge>
  );

  return (
    <Card variant="default" padding="none" className="px-3 py-2">
      <div className="flex flex-col md:flex-row md:items-center gap-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm bg-slate-700 shrink-0">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-bold flex items-center gap-2 text-slate-800 truncate">
              {user.username}
              {roleBadge}
            </div>
            <div className="text-xs text-slate-500 truncate">
              {[`${user.first_name || ''} ${user.last_name || ''}`.trim(), user.email].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 md:ml-auto">
          <Button variant="ghost" size="sm" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => onEdit(user)}>
            {t('actions.edit')}
          </Button>
          {!isSelf && !user.is_superuser && (
            <Button variant="ghost" size="sm" leftIcon={<Trash2 className="h-4 w-4" />} className="text-error hover:bg-error/10" onClick={() => onDeactivate(user)}>
              {t('actions.deactivate', 'Désactiver')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

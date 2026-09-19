import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Trash2, Coins, Zap, CheckCircle } from 'lucide-react';
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

export default function UserListItem({ user, isSelf, allMenuKeysCount, menuLabel, onEdit, onDeactivate }: Props) {
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

  const menuBadges = () => {
    if (user.is_superuser) {
      return <Badge variant="primary" size="sm">{t('badges.full_access')}</Badge>;
    }
    const allowedMenus = user.profile?.allowed_menus || [];
    // If they have all keys (or all but a few), show full access
    const isFullAccess = allowedMenus.length >= allMenuKeysCount - 2;

    if (isFullAccess && allowedMenus.length > 0) {
      return <Badge variant="primary" size="sm">{t('badges.full_access', 'Accès complet')}</Badge>;
    }

    const limit = 4;
    const visibleMenus = allowedMenus.slice(0, limit);
    const hiddenCount = allowedMenus.length - limit;

    return (
      <>
        {visibleMenus.map(menu => (
          <Badge key={menu} variant="outline" size="sm">
            {menuLabel(menu)}
          </Badge>
        ))}
        {hiddenCount > 0 && (
          <Badge
            variant="ghost"
            size="sm"
            title={allowedMenus.slice(limit).map(menuLabel).join(', ')}
          >
            +{hiddenCount} {t('common:others', 'autres')}
          </Badge>
        )}
        {allowedMenus.length === 0 && (
          <Badge variant="error" size="sm">{t('badges.no_access')}</Badge>
        )}
      </>
    );
  };

  return (
    <Card variant="default" padding="md">
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
          {roleBadge}
          <div className="flex flex-wrap gap-1">
            {menuBadges()}
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

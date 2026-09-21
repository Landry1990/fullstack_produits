import React from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { Checkbox } from '../../ui/Checkbox';
import { Input } from '../../ui/Input';
import { Label } from '../../ui/Label';
import { Card } from '../../ui/Card';
import { PERMISSIONS_META, permissionClass, checkboxColor } from '../usersMeta';
import type { UserForm } from '../../../hooks/useUserForm';

interface Props {
  form: UserForm;
}

export default function UserPermissionsTab({ form }: Props) {
  const { t } = useTranslation(['users', 'sidebar', 'common']);
  const { formData, setFormData } = form;

  return (
    <div className="space-y-4">
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
                      {p.descKey && <span className="text-caption opacity-60 leading-none mt-0.5">{t(p.descKey)}</span>}
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
                onChange={e => setFormData({ ...formData, max_discount_rate: parseInt(e.target.value) || 0 })}
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
    </div>
  );
}

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Info, Users, Loader2 } from 'lucide-react';
import { Checkbox } from '../../shadcn/checkbox';
import { Input } from '../../shadcn/input';
import { Label } from '../../shadcn/label';
import { Card } from '../../shadcn/card';
import { Button } from '../../shadcn/button';
import { PERMISSIONS_META, permissionClass } from '../usersMeta';
import type { UserForm } from '../../../hooks/useUserForm';

interface Props {
  form: UserForm;
  onApplyToRole?: () => void | Promise<void>;
}

export default function UserPermissionsTab({ form, onApplyToRole }: Props) {
  const { t } = useTranslation(['users', 'sidebar', 'common']);
  const { formData, setFormData } = form;
  const [isApplying, setIsApplying] = useState(false);

  const handleApplyToRole = async () => {
    if (!onApplyToRole) return;
    setIsApplying(true);
    try {
      await onApplyToRole();
    } finally {
      setIsApplying(false);
    }
  };

  const renderPermission = (p: (typeof PERMISSIONS_META)[number]) => {
    if (p.key === 'can_cash_out') {
      return (
        <div key={p.key} className="flex cursor-pointer justify-start gap-4 p-2 bg-base-100 rounded-lg border border-base-300 hover:border-success/50 transition-all shadow-sm group">
          <Checkbox
            checked={formData[p.key]}
            onCheckedChange={checked => setFormData({ ...formData, [p.key]: checked === true })}
            disabled={formData.is_superuser || formData.role === 'VENDEUR'}
          />
          <div className="flex flex-col">
            <span className="font-bold text-xs group-hover:text-success transition-colors">{t(p.labelKey)}</span>
            {p.descKey && <span className="text-caption opacity-60 leading-none mt-0.5">{t(p.descKey)}</span>}
          </div>
        </div>
      );
    }
    return (
      <div key={p.key} className={`flex items-center gap-2 ${permissionClass(p.color)}`}>
        <Checkbox
          checked={formData[p.key]}
          onCheckedChange={checked => setFormData({ ...formData, [p.key]: checked === true })}
          disabled={formData.is_superuser}
        />
        <label className="text-sm font-medium select-none text-slate-600 dark:text-slate-300">{t(p.labelKey)}</label>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {formData.is_superuser && (
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm italic flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0" />
          <span>{t('modal.superuser_permissions_note', 'Le superutilisateur possède implicitement tous les droits.')}</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4 border-l-2 border-success pl-3 bg-success/10 py-1 rounded-r-lg">
            <h4 className="font-bold text-xs uppercase tracking-widest text-success">{t('modal.special_permissions')}</h4>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {PERMISSIONS_META.filter(p => p.group === 'operations').map(renderPermission)}

            <div className="flex flex-col gap-1 px-2 mt-1">
              <Label htmlFor="max-discount-rate">{t('form.max_discount')}</Label>
              <Input
                id="max-discount-rate"
                type="number"
                value={formData.max_discount_rate}
                onChange={e => setFormData({ ...formData, max_discount_rate: parseInt(e.target.value) || 0 })}
                className="h-9 text-xs"
                disabled={formData.is_superuser}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4 border-l-2 border-error pl-3 bg-error/10 py-1 rounded-r-lg">
            <h4 className="font-bold text-xs uppercase tracking-widest text-error">{t('modal.security_sudo')}</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PERMISSIONS_META.filter(p => p.group === 'sudo').map(renderPermission)}
          </div>
        </Card>
      </div>

      {onApplyToRole && !formData.is_superuser && (
        <Card className="p-6 bg-warning/5 border-warning/20">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-warning flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t('form.apply_to_role')}
              </h4>
              <p className="text-xs text-base-content/60 mt-1 italic">
                {t('form.apply_to_role_help')}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleApplyToRole}
              disabled={isApplying}
              className="bg-amber-500 shadow-amber-500/20 before:bg-amber-600 hover:shadow-amber-500/30"
            >
              {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              {t('form.apply_to_role_btn')}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

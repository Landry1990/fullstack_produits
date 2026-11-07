import React from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { Checkbox } from '../../shadcn/checkbox';
import { Card } from '../../shadcn/card';
import type { MenuItem } from '../../../hooks/useMenuHierarchy';
import type { UserForm } from '../../../hooks/useUserForm';

interface Props {
  form: UserForm;
  menuHierarchy: MenuItem[];
}

export default function UserMenusTab({ form, menuHierarchy }: Props) {
  const { t } = useTranslation(['users', 'sidebar', 'common']);
  const { formData, toggleMenu, toggleSubMenu } = form;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-l-2 border-secondary pl-3 bg-secondary/10 py-1 rounded-r-lg">
        <h4 className="font-bold text-xs uppercase tracking-widest text-secondary">{t('modal.authorized_menus')}</h4>
      </div>
      <div className="columns-1 md:columns-2 lg:columns-3 gap-4">
        {menuHierarchy.map(menu => {
          const allowedSet = new Set(formData.allowed_menus);
          const parentLabel = t(menu.labelKey);
          const isParentChecked = allowedSet.has(menu.key);
          const indeterminate = !isParentChecked && menu.submenus?.some(sub => allowedSet.has(sub.key));

          return (
            <Card
              key={menu.key}
              className={`p-4 mb-4 break-inside-avoid ${menu.submenus && menu.submenus.length > 0 ? 'flex flex-col' : ''}`}
            >
              <div className="bg-base-200/50 p-3 flex-none border-b border-base-200 rounded-t-lg">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={isParentChecked ? true : indeterminate ? 'indeterminate' : false}
                    onCheckedChange={() => toggleMenu(menu.key, menu.submenus)}
                    disabled={formData.is_superuser}
                  />
                  <label className="text-sm font-medium select-none text-slate-600 dark:text-slate-300">{parentLabel}</label>
                </div>
              </div>

              {menu.submenus && menu.submenus.length > 0 && (
                <div className="p-3 grid grid-cols-1 gap-1.5 flex-1">
                  {menu.submenus.map(sub => (
                    <div key={sub.key} className="flex items-center gap-2 transition-all py-0.5 group">
                      <Checkbox
                        checked={allowedSet.has(sub.key) || allowedSet.has(menu.key)}
                        onCheckedChange={() => toggleSubMenu(sub.key, menu.key, menu.submenus!.length)}
                        disabled={formData.is_superuser}
                      />
                      <label className="text-sm font-medium select-none text-slate-600 dark:text-slate-300">{t(sub.labelKey)}</label>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
      {formData.is_superuser && (
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm italic flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0" />
          <span>{t('modal.admin_note')}</span>
        </div>
      )}
    </div>
  );
}

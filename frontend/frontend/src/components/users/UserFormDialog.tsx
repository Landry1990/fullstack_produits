import React from 'react';
import { useTranslation } from 'react-i18next';
import { User, Save, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';
import { Button } from '../ui/Button';
import UserInfoTab from './tabs/UserInfoTab';
import UserMenusTab from './tabs/UserMenusTab';
import UserPermissionsTab from './tabs/UserPermissionsTab';
import type { MenuItem } from '../../hooks/useMenuHierarchy';
import type { UserForm } from '../../hooks/useUserForm';
import type { ManagedUser } from './usersMeta';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingUser: ManagedUser | null;
  users: ManagedUser[];
  menuHierarchy: MenuItem[];
  form: UserForm;
  onSubmit: (e: React.FormEvent) => void;
}

export default function UserFormDialog({ open, onOpenChange, editingUser, users, menuHierarchy, form, onSubmit }: Props) {
  const { t } = useTranslation(['users', 'sidebar', 'common']);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 grid-rows-[auto_1fr]">
        <DialogHeader className="p-6 pb-2 border-b border-base-200">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <User className="h-5 w-5" />
            </div>
            {editingUser ? t('modal.edit_title') : t('modal.new_title')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 min-h-0">
            <Tabs defaultValue="informations" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="informations">{t('modal.tabs.information')}</TabsTrigger>
                <TabsTrigger value="menus">{t('modal.tabs.menus')}</TabsTrigger>
                <TabsTrigger value="permissions">{t('modal.tabs.permissions')}</TabsTrigger>
              </TabsList>

              <TabsContent value="informations">
                <UserInfoTab form={form} users={users} isEditing={!!editingUser} />
              </TabsContent>

              <TabsContent value="menus">
                <UserMenusTab form={form} menuHierarchy={menuHierarchy} />
              </TabsContent>

              <TabsContent value="permissions">
                <UserPermissionsTab form={form} />
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="p-4 border-t border-base-200">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} leftIcon={<X className="h-4 w-4" />}>
              {t('common:cancel')}
            </Button>
            <Button type="submit" leftIcon={<Save className="h-4 w-4" />}>
              {t('common:save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

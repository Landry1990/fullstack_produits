import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Save, Trash2, X, Loader2, Users } from 'lucide-react';
import api from '../../services/api';
import { gooeyToast } from 'goey-toast';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../shadcn/dialog';
import { Button } from '../shadcn/button';
import { Checkbox } from '../shadcn/checkbox';
import { Input } from '../shadcn/input';
import { Label } from '../shadcn/label';
import { Badge } from '../shadcn/badge';
import { PERMISSIONS_META, type GroupePerm } from './usersMeta';
import { MENU_HIERARCHY_FALLBACK } from './menuHierarchyFallback';
import { useMenuHierarchy } from '../../hooks/useMenuHierarchy';
import { useConfirm } from '../../hooks/useConfirm';
import { logger } from '../../utils/logger';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

type GroupeForm = GroupePerm & Record<string, unknown>;

const EMPTY_GROUPE: Partial<GroupeForm> = {
  name: '', description: '', max_discount_rate: 0,
};

/** CRUD des groupes de permissions : modifier un groupe met à jour tous ses membres côté serveur. */
export default function GroupePermissionsModal({ open, onOpenChange, onSaved }: Props) {
  const { t } = useTranslation(['users', 'common']);
  const confirm = useConfirm();
  const [groupes, setGroupes] = useState<GroupeForm[]>([]);
  const [selected, setSelected] = useState<GroupeForm | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: menuData } = useMenuHierarchy();
  const MENU_HIERARCHY = menuData?.hierarchy ?? MENU_HIERARCHY_FALLBACK;

  const toggleGroupeMenu = (key: string) => {
    if (!selected) return;
    const current = selected.allowed_menus ?? [];
    const next = current.includes(key)
      ? current.filter(k => k !== key)
      : [...current, key];
    // Tableau vide → null : « le groupe ne gère pas les menus ». Un []
    // transmis viderait les allowed_menus de tous les membres à la save.
    setSelected({ ...selected, allowed_menus: next.length ? next : null });
  };

  const fetchGroupes = useCallback(async () => {
    try {
      const { data } = await api.get('groupe-permissions/');
      const list = Array.isArray(data) ? data : data?.results ?? [];
      setGroupes(list);
      if (selected) {
        setSelected(list.find((g: GroupeForm) => g.id === selected.id) ?? null);
      }
    } catch (err) {
      logger.error('Error loading groupes:', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (open) fetchGroupes(); }, [open, fetchGroupes]);

  const handleSelect = (g: GroupeForm) => setSelected({ ...g });

  const handleNew = () => {
    const g: Partial<GroupeForm> = { ...EMPTY_GROUPE };
    PERMISSIONS_META.forEach(p => { (g as Record<string, unknown>)[p.key] = false; });
    (g as Record<string, unknown>).can_cash_out = true;
    (g as Record<string, unknown>).can_view_cash_totals = true;
    setSelected(g as GroupeForm);
  };

  const save = async () => {
    if (!selected || !selected.name?.trim()) {
      gooeyToast.error(t('groupes.name_required', { defaultValue: 'Le nom du groupe est requis.' }));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...selected,
        allowed_menus: selected.allowed_menus?.length ? selected.allowed_menus : null,
      };
      if (selected.id) {
        await api.patch(`groupe-permissions/${selected.id}/`, payload);
      } else {
        await api.post('groupe-permissions/', payload);
      }
      gooeyToast.success(t('groupes.saved', { defaultValue: 'Groupe enregistré — les droits des membres ont été recalculés.' }));
      await fetchGroupes();
      onSaved?.();
    } catch (err) {
      logger.error('Error saving groupe:', err);
      gooeyToast.error(t('common:errors.save_failed', { defaultValue: 'Erreur lors de l\'enregistrement.' }));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected?.id) return;
    const ok = await confirm({
      title: t('groupes.delete_title', { defaultValue: 'Supprimer le groupe ?' }),
      message: t('groupes.delete_confirm', {
        name: selected.name,
        defaultValue: `Supprimer le groupe « ${selected.name} » ? Ses membres garderont leurs droits actuels mais passeront en gestion individuelle.`,
      }),
      variant: 'danger',
      confirmText: t('common:actions.delete', { defaultValue: 'Supprimer' }),
    });
    if (!ok) return;
    try {
      await api.delete(`groupe-permissions/${selected.id}/`);
      setSelected(null);
      await fetchGroupes();
      onSaved?.();
    } catch (err) {
      logger.error('Error deleting groupe:', err);
      gooeyToast.error(t('groupes.delete_error', { defaultValue: 'Suppression impossible.' }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,1200px)] max-w-none aspect-video overflow-hidden p-6 flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('groupes.title', { defaultValue: 'Groupes de permissions' })}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[220px_1fr] gap-4 flex-1 min-h-0">
          {/* Liste */}
          <div className="border rounded-lg p-2 space-y-1 overflow-y-auto min-h-0">
            {groupes.map(g => (
              <button
                key={g.id}
                type="button"
                onClick={() => handleSelect(g)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${selected?.id === g.id ? 'bg-primary/10 text-primary' : 'hover:bg-slate-100'}`}
              >
                {g.name}
                <span className="block text-xs opacity-60">{g.membres_count ?? 0} {t('groupes.members', { defaultValue: 'membre(s)' })}</span>
              </button>
            ))}
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleNew}>
              <Plus className="h-4 w-4" /> {t('groupes.new', { defaultValue: 'Nouveau groupe' })}
            </Button>
          </div>

          {/* Édition */}
          <div className="border rounded-lg p-4 overflow-y-auto min-h-0">
            {!selected ? (
              <p className="text-sm text-slate-500">{t('groupes.select_hint', { defaultValue: 'Sélectionnez ou créez un groupe.' })}</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="gp-name">{t('groupes.name', { defaultValue: 'Nom' })}</Label>
                    <Input id="gp-name" value={selected.name ?? ''} onChange={e => setSelected({ ...selected, name: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="gp-rate">{t('groupes.max_discount', { defaultValue: 'Remise max (%)' })}</Label>
                    <Input id="gp-rate" type="number" min={0} max={100} value={selected.max_discount_rate ?? 0}
                      onChange={e => setSelected({ ...selected, max_discount_rate: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="gp-desc">{t('groupes.description', { defaultValue: 'Description' })}</Label>
                  <Input id="gp-desc" value={selected.description ?? ''} onChange={e => setSelected({ ...selected, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {PERMISSIONS_META.map(p => (
                    <div key={p.key} className="flex items-center gap-2">
                      <Checkbox
                        checked={Boolean(selected[p.key])}
                        onCheckedChange={v => setSelected({ ...selected, [p.key]: v === true })}
                      />
                      <label className="text-sm">{t(p.labelKey)}</label>
                    </div>
                  ))}
                </div>
                <div>
                  <Label>{t('groupes.menus', { defaultValue: 'Pages accessibles (menus)' })}</Label>
                  <p className="text-xs text-slate-500 mb-2">
                    {t('groupes.menus_hint', { defaultValue: 'Ces pages s’appliquent à tous les membres du groupe. Les écarts par utilisateur restent possibles via les dérogations.' })}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 border rounded-md p-2 max-h-40 overflow-y-auto">
                    {MENU_HIERARCHY.map((m: { key: string; labelKey?: string }) => (
                      <div key={m.key} className="flex items-center gap-2">
                        <Checkbox
                          checked={(selected.allowed_menus ?? []).includes(m.key)}
                          onCheckedChange={() => toggleGroupeMenu(m.key)}
                        />
                        <label className="text-sm">{t(m.labelKey ?? `sidebar:${m.key}`, { defaultValue: m.key })}</label>
                      </div>
                    ))}
                  </div>
                </div>
                {selected.is_system && (
                  <Badge variant="outline">{t('groupes.system', { defaultValue: 'Groupe de base (non supprimable)' })}</Badge>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          {selected?.id && !selected.is_system && (
            <Button variant="destructive" onClick={remove}><Trash2 className="h-4 w-4" /> {t('common:actions.delete', { defaultValue: 'Supprimer' })}</Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}><X className="h-4 w-4" /> {t('common:cancel')}</Button>
          {selected && (
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t('common:save')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

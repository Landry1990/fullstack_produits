import { useState, type FormEvent } from 'react';
import { Edit2, FileText, Plus, Send, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Input } from '../../ui/Input';
import { Skeleton } from '../../ui/Skeleton';
import { Textarea } from '../../ui/Textarea';
import type { MessageTemplate } from '../../../services/communicationService';
import { useDeleteTemplateMutation, useSaveTemplateMutation } from './useMessaging';
import { useConfirm } from '../../../hooks/useConfirm';

interface TemplatesPanelProps {
  templates: MessageTemplate[];
  loading: boolean;
  isAdmin: boolean;
  onApply: (content: string) => void;
}

interface TemplateFormState {
  id: number | null;
  title: string;
  content: string;
}

const EMPTY_FORM: TemplateFormState = { id: null, title: '', content: '' };

export function TemplatesPanel({ templates, loading, isAdmin, onApply }: TemplatesPanelProps) {
  const { t } = useTranslation(['messaging', 'common']);
  const confirm = useConfirm();
  const [form, setForm] = useState<TemplateFormState>(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const saveTemplateMutation = useSaveTemplateMutation();
  const deleteTemplateMutation = useDeleteTemplateMutation();

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (template: MessageTemplate) => {
    setForm({ id: template.id, title: template.title, content: template.content });
    setFormOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (saveTemplateMutation.isPending || !form.title.trim() || !form.content.trim()) return;
    try {
      await saveTemplateMutation.mutateAsync({ id: form.id, data: { title: form.title, content: form.content } });
      setForm(EMPTY_FORM);
      setFormOpen(false);
    } catch {
      return;
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: t('common:confirmation'),
      message: t('templates.delete_confirm'),
      confirmText: t('common:confirm'),
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteTemplateMutation.mutateAsync(id);
    } catch {
      return;
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col p-4 md:p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6 sticky top-0 bg-white z-10 pb-2 border-b border-slate-200">
        <h4 className="text-lg font-semibold text-slate-700">{t('templates.title')}</h4>
        {isAdmin && !formOpen && (
          <Button type="button" size="sm" variant="outline" leftIcon={<Plus size={14} aria-hidden />} onClick={openCreate}>
            {t('templates.add')}
          </Button>
        )}
      </div>

      {formOpen && isAdmin && (
        <form onSubmit={handleSave} className="mb-6 p-4 rounded-xl border border-indigo-200 bg-blue-50 space-y-3">
          <h5 className="text-sm font-semibold text-slate-700">
            {form.id !== null ? t('templates.edit') : t('templates.add')}
          </h5>
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
            placeholder={t('templates.placeholder_title')}
            aria-label={t('templates.placeholder_title')}
          />
          <Textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            required
            placeholder={t('templates.placeholder_content')}
            aria-label={t('templates.placeholder_content')}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1"
              disabled={saveTemplateMutation.isPending}
              onClick={() => {
                setForm(EMPTY_FORM);
                setFormOpen(false);
              }}
            >
              {t('common:cancel')}
            </Button>
            <Button type="submit" size="sm" isLoading={saveTemplateMutation.isPending} className="flex-1">
              {t('common:save')}
            </Button>
          </div>
        </form>
      )}

      {loading && templates.length === 0 ? (
        <div className="grid gap-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full bg-slate-200" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState compact icon={<FileText className="size-6" />} title={t('templates.empty')} className="py-10" />
      ) : (
        <div className="grid gap-4">
          {templates.map((temp) => (
            <div key={temp.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="flex justify-between items-start mb-2 min-w-0 gap-2">
                <h5 className="font-semibold text-blue-600 truncate">{temp.title}</h5>
                <Badge variant="ghost" size="sm" className="shrink-0 italic font-normal">
                  {temp.created_by_name}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 line-clamp-3 mb-4">{temp.content}</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  leftIcon={<Send size={13} aria-hidden />}
                  onClick={() => onApply(temp.content)}
                  className="flex-1"
                >
                  {t('templates.use')}
                </Button>
                {isAdmin && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={t('templates.edit')}
                      onClick={() => openEdit(temp)}
                    >
                      <Edit2 size={14} aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={t('templates.delete')}
                      className="hover:text-red-500 hover:bg-red-50"
                      onClick={() => handleDelete(temp.id)}
                    >
                      <Trash2 size={14} aria-hidden />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

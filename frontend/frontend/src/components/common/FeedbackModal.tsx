import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { X, Send, Bug, Lightbulb, TrendingUp, HelpCircle, MoreHorizontal } from 'lucide-react';
import feedbackService, { type Feedback } from '../../services/feedbackService';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { t } = useTranslation('common');
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState<Omit<Feedback, 'id' | 'user' | 'username' | 'status' | 'admin_response' | 'responded_at' | 'responded_by' | 'created_at' | 'updated_at'>>({
    category: 'OTHER',
    priority: 'MEDIUM',
    subject: '',
    description: '',
    page_url: window.location.href,
    browser_info: navigator.userAgent,
  });

  const categoryOptions = [
    { value: 'BUG', label: t('feedback.category_bug', 'Bug / Erreur'), icon: Bug },
    { value: 'FEATURE', label: t('feedback.category_feature', 'Nouvelle fonctionnalité'), icon: Lightbulb },
    { value: 'IMPROVEMENT', label: t('feedback.category_improvement', 'Amélioration'), icon: TrendingUp },
    { value: 'QUESTION', label: t('feedback.category_question', 'Question'), icon: HelpCircle },
    { value: 'OTHER', label: t('feedback.category_other', 'Autre'), icon: MoreHorizontal },
  ];

  const priorityOptions = [
    { value: 'LOW', label: t('feedback.priority_low', 'Faible'), color: 'bg-green-100 text-green-700' },
    { value: 'MEDIUM', label: t('feedback.priority_medium', 'Moyenne'), color: 'bg-yellow-100 text-yellow-700' },
    { value: 'HIGH', label: t('feedback.priority_high', 'Haute'), color: 'bg-orange-100 text-orange-700' },
    { value: 'URGENT', label: t('feedback.priority_urgent', 'Urgente'), color: 'bg-red-100 text-red-700' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.subject.trim() || !formData.description.trim()) {
      toast.error(t('feedback.error_required', 'Veuillez remplir le sujet et la description'));
      return;
    }

    setLoading(true);
    try {
      const result = await feedbackService.create(formData);
      toast.success(t('feedback.success', 'Feedback envoyé avec succès'));
      if (result.email_sent === false) {
        toast.error(t('feedback.email_failed', "L'email de notification n'a pas pu être envoyé — vérifiez la configuration SMTP"), { duration: 6000 });
      }
      setFormData({
        category: 'OTHER',
        priority: 'MEDIUM',
        subject: '',
        description: '',
        page_url: window.location.href,
        browser_info: navigator.userAgent,
      });
      onClose();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error(t('feedback.error', 'Erreur lors de l\'envoi du feedback'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {t('feedback.title', 'Envoyer un Feedback')}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {t('feedback.subtitle', 'Aidez-nous à améliorer l\'application')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="size-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Category */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              {t('feedback.category_label', 'Catégorie')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {categoryOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: option.value as any })}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      formData.category === option.value
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <Icon className="size-5" />
                    <span className="text-xs font-medium text-center">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              {t('feedback.priority_label', 'Priorité')}
            </label>
            <div className="flex flex-wrap gap-2">
              {priorityOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, priority: option.value as any })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    formData.priority === option.value
                      ? option.color
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label htmlFor="subject" className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
              {t('feedback.subject_label', 'Sujet')}
            </label>
            <input
              type="text"
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder={t('feedback.subject_placeholder', 'Résumez votre feedback en quelques mots')}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 outline-none transition-all text-gray-700"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
              {t('feedback.description_label', 'Description')}
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('feedback.description_placeholder', 'Décrivez votre feedback en détail...')}
              rows={5}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 outline-none transition-all text-gray-700 resize-none"
              required
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {t('common.cancel', 'Annuler')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  {t('common.sending', 'Envoi...')}
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  {t('feedback.send', 'Envoyer')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

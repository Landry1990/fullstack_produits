import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, MessageSquare, Trash2, Edit2, Plus, Bell, Clock, CheckCheck, Check, Archive, Reply, Paperclip, X, Shield } from 'lucide-react';
import communicationService from '../../services/communicationService';
import type { InternalMessage, MessageTemplate } from '../../services/communicationService';
import userService from '../../services/userService';
import type { SimpleUser } from '../../services/userService';
import PremiumModal from './PremiumModal';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

interface MessagingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onMessageRead?: () => void;
}

export default function MessagingModal({ isOpen, onClose, currentUser, onMessageRead }: MessagingModalProps) {
  const { t } = useTranslation(['messaging', 'common']);
  const [activeTab, setActiveTab] = useState<'received' | 'sent' | 'archived' | 'templates' | 'new' | 'supervision'>('received');
  const [allMessages, setAllMessages] = useState<InternalMessage[]>([]);
  const isAdmin = currentUser?.is_staff || currentUser?.is_superuser;
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [users, setUsers] = useState<SimpleUser[]>([]);

  // Form states
  const [recipientId, setRecipientId] = useState<number | ''>('');
  const [msgContent, setMsgContent] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ title: '', content: '' });

  // New feature states
  const [replyingTo, setReplyingTo] = useState<InternalMessage | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const requests: Promise<any>[] = [
        communicationService.getMessages(),
        communicationService.getTemplates(),
        userService.getAll()
      ];
      // Admin: charger aussi tous les messages pour la supervision
      if (isAdmin) {
        requests.push(communicationService.getMessages({ all: 'true' }));
      }
      
      const results = await Promise.all(requests);
      const [msgRes, tempRes, userRes] = results;
      
      const msgs = Array.isArray(msgRes.data) ? msgRes.data : (msgRes.data.results || []);
      const temps = Array.isArray(tempRes.data) ? tempRes.data : (tempRes.data.results || []);
      
      setMessages(msgs);
      setTemplates(temps);
      setUsers(userRes.filter((u: SimpleUser) => u.id !== currentUser?.id));
      
      if (isAdmin && results[3]) {
        const allMsgs = Array.isArray(results[3].data) ? results[3].data : (results[3].data.results || []);
        setAllMessages(allMsgs);
      }
    } catch (error) {
      console.error("Error loading messaging data", error);
      toast.error(t('common:error_loading'));
    }
  };

  useEffect(() => {
    let interval: any;
    if (isOpen) {
      loadData(); // Initial load
      interval = setInterval(() => {
        loadData(); // Background auto-refresh for real-time feel
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen]);

  const receivedMessages = useMemo(() => 
    messages.filter((m: InternalMessage) => 
      (m.recipient_name === currentUser?.username || m.recipient === null) && 
      m.sender_name !== currentUser?.username &&
      !m.is_archived
    ),
    [messages, currentUser]
  );
  
  const archivedMessages = useMemo(() => 
    messages.filter((m: InternalMessage) => m.is_archived),
    [messages, currentUser]
  );
  
  const sentMessages = useMemo(() => 
    messages.filter((m: InternalMessage) => m.sender_name === currentUser?.username),
    [messages, currentUser]
  );

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgContent.trim() && !attachmentFile) return;

    try {
      await communicationService.sendMessage({
        recipient: recipientId === '' ? null : recipientId,
        content: msgContent,
        parent: replyingTo?.id || null,
        attachment: attachmentFile
      });
      toast.success(t('new.success_sent'));
      setMsgContent('');
      setRecipientId('');
      setAttachmentFile(null);
      setReplyingTo(null);
      setActiveTab('sent');
      loadData();
    } catch (error) {
      toast.error(t('new.error_sent'));
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await communicationService.markAsRead(id);
      setMessages((prev: InternalMessage[]) => prev.map((m: InternalMessage) => m.id === id ? { ...m, is_read: true } : m));
      if (onMessageRead) onMessageRead();
    } catch (error) {
      toast.error(t('common:error'));
    }
  };

  const handleArchiveMessage = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await communicationService.archiveMessage(id);
      setMessages((prev: InternalMessage[]) => prev.map((m: InternalMessage) => m.id === id ? { ...m, is_archived: true } : m));
      toast.success('Message archivé');
    } catch (error) {
      toast.error(t('common:error'));
    }
  };

  const handleReplyToMessage = (e: React.MouseEvent, m: InternalMessage) => {
    e.stopPropagation();
    setReplyingTo(m);
    setRecipientId(m.recipient === null ? '' : m.sender);
    setActiveTab('new');
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!window.confirm(t('templates.delete_confirm'))) return;
    try {
      await communicationService.deleteTemplate(id);
      toast.success(t('templates.success_deleted'));
      loadData();
    } catch (error) {
      toast.error(t('common:error'));
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTemplate) {
        await communicationService.updateTemplate(editingTemplate.id, templateForm);
        toast.success(t('templates.success_saved'));
      } else {
        await communicationService.createTemplate(templateForm);
        toast.success(t('templates.success_saved'));
      }
      setEditingTemplate(null);
      setTemplateForm({ title: '', content: '' });
      loadData();
    } catch (error) {
      toast.error(t('common:error'));
    }
  };

  const applyTemplate = (content: string) => {
    setMsgContent(content);
    setActiveTab('new');
  };

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('title')}
      subtitle={t('subtitle')}
      icon={<MessageSquare className="text-primary" />}
      maxWidth="max-w-4xl"
    >
      <div className="flex flex-col md:flex-row h-[420px] overflow-hidden bg-base-100">
        {/* Navigation Tabs (Sidebar on Desktop, Top Bar on Mobile) */}
        <div className="w-full md:w-60 border-b md:border-b-0 md:border-r border-base-300 bg-base-200 p-2 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-y-auto no-scrollbar shrink-0">
          <button 
            onClick={() => setActiveTab('received')}
            className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl transition-all whitespace-nowrap flex-1 md:flex-none ${activeTab === 'received' ? 'bg-primary text-white shadow-sm' : 'hover:bg-base-200 text-base-content'}`}
          >
            <Bell size={18} />
            <span className="font-medium text-xs md:text-sm">{t('tabs.received')}</span>
            {receivedMessages.filter(m => !m.is_read).length > 0 && (
              <span className="ml-auto inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">
                {receivedMessages.filter(m => !m.is_read).length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('archived')}
            className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl transition-all whitespace-nowrap flex-1 md:flex-none ${activeTab === 'archived' ? 'bg-primary text-white shadow-sm' : 'hover:bg-base-200 text-base-content'}`}
          >
            <Archive size={18} />
            <span className="font-medium text-xs md:text-sm">Archivés</span>
          </button>
          <button 
            onClick={() => setActiveTab('sent')}
            className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl transition-all whitespace-nowrap flex-1 md:flex-none ${activeTab === 'sent' ? 'bg-primary text-white shadow-sm' : 'hover:bg-base-200 text-base-content'}`}
          >
            <Send size={18} />
            <span className="font-medium text-xs md:text-sm">{t('tabs.sent')}</span>
          </button>
          <button 
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl transition-all whitespace-nowrap flex-1 md:flex-none ${activeTab === 'templates' ? 'bg-primary text-white shadow-sm' : 'hover:bg-base-200 text-base-content'}`}
          >
            <Edit2 size={18} />
            <span className="font-medium text-xs md:text-sm">{t('tabs.templates')}</span>
          </button>
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('supervision')}
              className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl transition-all whitespace-nowrap flex-1 md:flex-none ${activeTab === 'supervision' ? 'bg-amber-500 text-white shadow-sm' : 'hover:bg-base-200 text-base-content'}`}
            >
              <Shield size={18} />
              <span className="font-medium text-xs md:text-sm">Supervision</span>
              <span className="ml-auto inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-warning bg-warning/20 rounded-full">{allMessages.length}</span>
            </button>
          )}
          
          <div className="hidden md:block mt-auto pt-4 border-t border-base-300">
            <button 
              onClick={() => { setActiveTab('new'); setEditingTemplate(null); }}
              className={`flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-success text-white hover:bg-success-focus transition-all font-medium shadow-sm`}
            >
              <Plus size={18} />
              <span>{t('tabs.new')}</span>
            </button>
          </div>

          {/* Mobile Compose Button */}
          <button 
            onClick={() => { setActiveTab('new'); setEditingTemplate(null); }}
            className={`md:hidden flex items-center justify-center p-2 rounded-xl bg-success text-white ml-auto hover:bg-success-focus`}
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-base-100 min-h-0">
          {activeTab === 'received' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6 sticky top-0 bg-base-100 z-10 pb-2 border-b border-base-200">
                <h4 className="text-lg font-semibold text-base-content flex items-center gap-2">
                  {t('received.title')}
                  {receivedMessages.filter(m => !m.is_read).length > 0 && (
                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-medium text-error bg-error/20 rounded-full" title="Messages non lus">
                      {receivedMessages.filter(m => !m.is_read).length} non lu(s)
                    </span>
                  )}
                </h4>
              </div>
              <div className="grid gap-3">
                {receivedMessages.length === 0 ? (
                   <div className="text-center py-10 text-base-content/50 italic">{t('received.empty')}</div>
                ) : (
                  receivedMessages.map((m: InternalMessage) => (
                    <div 
                      key={m.id} 
                      className={`group p-4 rounded-xl border transition-all cursor-pointer relative ${!m.is_read ? 'bg-primary/10 border-indigo-200 shadow-sm' : 'bg-base-200 border-base-300 hover:bg-base-200'}`}
                      onClick={() => !m.is_read && handleMarkAsRead(m.id)}
                    >
                      <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity bg-base-100 rounded-lg shadow-sm border border-base-300 flex overflow-hidden z-10">
                        <button className="p-2 hover:bg-base-200 text-base-content/60 hover:text-primary transition-colors" onClick={(e) => handleReplyToMessage(e, m)} title="Répondre"><Reply size={15} /></button>
                        <button className="p-2 hover:bg-error/10 text-base-content/60 hover:text-error transition-colors border-l border-base-300" onClick={(e) => handleArchiveMessage(e, m.id)} title="Archiver"><Archive size={15} /></button>
                      </div>
                      
                      {m.parent_content && (
                        <div className="mb-3 p-2 bg-base-200 rounded border-l-2 border-indigo-400 text-xs">
                           <span className="font-medium text-base-content/70">En réponse à {m.parent_sender_name} :</span>
                           <p className="text-base-content/60 truncate">{m.parent_content}</p>
                        </div>
                      )}

                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 min-w-0 pr-16">
                          <div className={`size-8 rounded-full ${!m.is_read ? 'bg-primary text-white' : 'bg-gray-300 text-base-content'} flex items-center justify-center font-bold text-xs uppercase shrink-0 transition-colors`}>
                            {m.sender_name.charAt(0)}
                          </div>
                          <div className="truncate flex flex-col items-start">
                            <span className="font-semibold text-sm text-base-content truncate block leading-tight">{m.sender_name}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              {m.recipient === null && <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium text-primary bg-primary/20 rounded">{t('received.broadcast')}</span>}
                              {!m.is_read && <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium text-white bg-red-500 rounded animate-pulse">NOUVEAU</span>}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-base-content/50 flex items-center gap-1 shrink-0">
                          <Clock size={10} />
                          {format(new Date(m.created_at), 'dd/MM HH:mm', { locale: fr })}
                        </span>
                      </div>
                      <p className="text-sm text-base-content/80 whitespace-pre-wrap">{m.content}</p>
                      
                      {m.attachment_url && (
                        <div className="mt-3">
                          <div 
                            className="inline-flex items-center justify-center rounded-lg border bg-base-100 overflow-hidden cursor-zoom-in hover:opacity-90 max-w-xs"
                            onClick={(e) => { e.stopPropagation(); setZoomImage(m.attachment_url as string); }}
                          >
                           <img src={m.attachment_url} alt="Pièce jointe" className="max-h-32 object-contain hidden md:block" onError={(e) => e.currentTarget.style.display='none'} />
                           <div className="p-2 px-3 text-xs md:hidden flex items-center gap-2 font-bold text-primary"><Paperclip size={14}/> Voir la pièce jointe</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'sent' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6 sticky top-0 bg-base-100 z-10 pb-2 border-b border-base-200">
                <h4 className="text-lg font-semibold text-base-content">{t('sent.title')}</h4>
              </div>
              <div className="grid gap-3">
                {sentMessages.length === 0 ? (
                  <div className="text-center py-10 text-base-content/50 italic">{t('sent.empty')}</div>
                ) : (
                  sentMessages.map((m: InternalMessage) => (
                    <div key={m.id} className="p-4 rounded-xl border bg-base-200 border-base-300">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-base-content/50 shrink-0">{t('sent.to')}</span>
                          <span className="font-semibold text-sm text-primary truncate">{m.recipient_name}</span>
                        </div>
                        <span className="text-[10px] text-base-content/50 flex items-center gap-1 shrink-0">
                          {(() => {
                            if (!m.read_by) return null;
                            if (m.recipient === null) {
                              return m.read_by.length === 0 ? 
                                <span className="inline-flex items-center gap-0.5 text-base-content/50" title="Personne n'a encore lu"><Check size={12} /></span> : 
                                <span className="inline-flex items-center gap-0.5 text-blue-500" title={`Lu par ${m.read_by.length} personne(s)`}><CheckCheck size={12} /> {m.read_by.length}</span>;
                            }
                            const isRead = m.read_by.includes(Number(m.recipient));
                            return isRead ? 
                              <span className="inline-flex items-center gap-0.5 text-success font-medium" title="Lu"><CheckCheck size={12} /></span> : 
                              <span className="inline-flex items-center gap-0.5 text-base-content/50" title="Non lu"><Check size={12} /></span>;
                          })()}
                          <span className="mx-0.5 text-base-content/40">•</span>
                          {format(new Date(m.created_at), 'dd/MM HH:mm', { locale: fr })}
                        </span>
                      </div>
                      <p className="text-sm text-base-content/70">{m.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'archived' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6 sticky top-0 bg-base-100 z-10 pb-2 border-b border-base-200">
                <h4 className="text-lg font-semibold text-base-content">Messages archivés</h4>
              </div>
              <div className="grid gap-3">
                {archivedMessages.length === 0 ? (
                  <div className="text-center py-10 text-base-content/50 italic">Aucun message archivé</div>
                ) : (
                  archivedMessages.map((m: InternalMessage) => (
                    <div 
                      key={m.id} 
                      className={`p-4 rounded-xl border transition-all bg-base-200 border-base-300 opacity-80`}
                    >
                      {m.parent_content && (
                        <div className="mb-3 p-2 bg-base-200 rounded border-l-2 border-gray-400 text-xs">
                           <span className="font-medium text-base-content/70">En réponse à {m.parent_sender_name} :</span>
                           <p className="text-base-content/60 truncate">{m.parent_content}</p>
                        </div>
                      )}

                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 min-w-0 pr-16">
                          <div className={`size-8 rounded-full bg-gray-300 text-base-content flex items-center justify-center font-bold text-xs uppercase shrink-0 transition-colors`}>
                            {m.sender_name.charAt(0)}
                          </div>
                          <div className="truncate flex flex-col items-start">
                            <span className="font-semibold text-sm text-base-content truncate block leading-tight">{m.sender_name}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              {m.recipient === null && <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium text-base-content/70 bg-base-300 rounded">{t('received.broadcast')}</span>}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-base-content/50 flex items-center gap-1 shrink-0">
                          <Clock size={10} />
                          {format(new Date(m.created_at), 'dd/MM HH:mm', { locale: fr })}
                        </span>
                      </div>
                      <p className="text-sm text-base-content/70 whitespace-pre-wrap">{m.content}</p>
                      
                      {m.attachment_url && (
                        <div className="mt-3">
                          <div 
                            className="inline-flex items-center justify-center rounded-lg border border-base-300 bg-base-100 overflow-hidden cursor-zoom-in hover:opacity-90 max-w-xs shadow-sm"
                            onClick={(e) => { e.stopPropagation(); setZoomImage(m.attachment_url as string); }}
                          >
                           <img src={m.attachment_url} alt="Pièce jointe" className="max-h-32 object-contain hidden md:block" onError={(e) => e.currentTarget.style.display='none'} />
                           <div className="p-2 px-3 text-xs md:hidden flex items-center gap-2 font-medium text-base-content/70"><Paperclip size={14}/> Voir la pièce jointe</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'supervision' && isAdmin && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6 sticky top-0 bg-base-100 z-10 pb-2 border-b border-base-200">
                <h4 className="text-lg font-semibold text-base-content flex items-center gap-2">
                  <Shield className="size-5 text-amber-500" />
                  Supervision – Tous les messages
                  <span className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-medium text-warning bg-warning/20 rounded-full">{allMessages.length}</span>
                </h4>
              </div>
              <div className="grid gap-3">
                {allMessages.length === 0 ? (
                  <div className="text-center py-10 text-base-content/50 italic">Aucun message dans le système</div>
                ) : (
                  allMessages.map((m: InternalMessage) => (
                    <div 
                      key={m.id} 
                      className="p-4 rounded-xl border bg-base-200 border-base-300"
                    >
                      {m.parent_content && (
                        <div className="mb-3 p-2 bg-base-200 rounded border-l-2 border-indigo-400 text-xs">
                           <span className="font-medium text-base-content/70">En réponse à {m.parent_sender_name} :</span>
                           <p className="text-base-content/60 truncate">{m.parent_content}</p>
                        </div>
                      )}
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="size-8 rounded-full bg-warning/20 text-warning flex items-center justify-center font-bold text-xs uppercase shrink-0">
                            {m.sender_name.charAt(0)}
                          </div>
                          <div className="truncate flex flex-col items-start">
                            <span className="font-semibold text-sm text-base-content truncate block leading-tight">{m.sender_name}</span>
                            <span className="text-[10px] text-base-content/50">→ {m.recipient_name}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-base-content/50 flex items-center gap-1 shrink-0">
                          <Clock size={10} />
                          {format(new Date(m.created_at), 'dd/MM HH:mm', { locale: fr })}
                        </span>
                      </div>
                      <p className="text-sm text-base-content/70 whitespace-pre-wrap">{m.content}</p>
                      {m.attachment_url && (
                        <div className="mt-3">
                          <div 
                            className="inline-flex items-center justify-center rounded-lg border border-base-300 bg-base-100 overflow-hidden cursor-zoom-in hover:opacity-90 max-w-xs shadow-sm"
                            onClick={() => setZoomImage(m.attachment_url as string)}
                          >
                           <img src={m.attachment_url} alt="Pièce jointe" className="max-h-32 object-contain hidden md:block" onError={(e) => e.currentTarget.style.display='none'} />
                           <div className="p-2 px-3 text-xs md:hidden flex items-center gap-2 font-medium text-primary"><Paperclip size={14}/> Voir la pièce jointe</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6 sticky top-0 bg-base-100 z-10 pb-2 border-b border-base-200">
                <h4 className="text-lg font-semibold text-base-content">{t('templates.title')}</h4>
                <button 
                  onClick={() => { setEditingTemplate(null); setTemplateForm({title: '', content: ''}); setActiveTab('new'); }}
                  className="inline-flex items-center px-3 py-1.5 border border-indigo-600 text-xs font-medium rounded-lg text-primary bg-base-100 hover:bg-primary/10 transition-colors"
                >
                  {t('templates.manage')}
                </button>
              </div>
              <div className="grid gap-4">
                {templates.map((temp) => (
                  <div key={temp.id} className="p-4 rounded-xl border border-base-300 bg-base-200 group relative">
                    <div className="flex justify-between items-start mb-2 pr-16 min-w-0">
                      <h5 className="font-semibold text-primary truncate">{temp.title}</h5>
                      <span className="text-[10px] text-base-content/50 italic truncate ml-2">{temp.created_by_name}</span>
                    </div>
                    <p className="text-sm text-base-content/70 line-clamp-3 mb-4">{temp.content}</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => applyTemplate(temp.content)}
                        className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-primary hover:bg-primary-focus transition-colors flex-1"
                      >
                        {t('new.send')}
                      </button>
                      <button 
                        onClick={() => { setEditingTemplate(temp); setTemplateForm({title: temp.title, content: temp.content}); setActiveTab('new'); }}
                        className="p-1.5 text-base-content/50 hover:text-primary hover:bg-base-200 rounded transition-colors shrink-0"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteTemplate(temp.id)}
                        className="p-1.5 text-base-content/50 hover:text-error hover:bg-error/10 rounded transition-colors shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'new' && (
            <div className="animate-in slide-in-from-right-4 duration-300 h-full flex flex-col">
              <h4 className="text-lg font-semibold text-base-content mb-6 border-b border-base-200 pb-2">
                {editingTemplate ? t('templates.edit') : t('new.title')}
              </h4>
              <form onSubmit={editingTemplate ? handleSaveTemplate : handleSendMessage} className="space-y-4 md:space-y-6 flex flex-col flex-1 min-h-0">
                {editingTemplate ? (
                  <div className="w-full shrink-0">
                    <label className="block text-xs font-medium text-base-content/60 uppercase tracking-wider mb-1">
                      {t('templates.placeholder_title')}
                    </label>
                    <input 
                      type="text"
                      className="w-full px-3 py-2 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-base-100"
                      value={templateForm.title}
                      onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
                      required
                      placeholder={t('templates.placeholder_title')}
                    />
                  </div>
                ) : (
                  <div className="w-full shrink-0">
                    <label className="block text-xs font-medium text-base-content/60 uppercase tracking-wider mb-1">
                      {t('new.recipient')}
                    </label>
                    <select 
                      className="w-full px-3 py-2 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-base-100"
                      value={recipientId}
                      onChange={(e) => setRecipientId(e.target.value === '' ? '' : Number(e.target.value))}
                    >
                      <option value="">{t('new.all')}</option>
                      {users.map((u: any) => (
                        <option key={u.id} value={u.id}>{u.username}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex-1 min-h-[100px] flex flex-col">
                  {!editingTemplate && replyingTo && (
                    <div className="mb-2 p-3 bg-primary/10 rounded-lg border border-indigo-200 flex flex-col gap-1 relative pr-8">
                       <button 
                         type="button" 
                         className="absolute right-2 top-2 text-base-content/50 hover:text-error"
                         onClick={() => setReplyingTo(null)}
                       >
                         <X size={14} />
                       </button>
                       <span className="text-xs font-semibold text-primary flex items-center gap-1"><Reply size={12}/> Réponse à {replyingTo.sender_name}</span>
                       <p className="text-xs text-base-content/70 line-clamp-2 italic border-l-2 border-indigo-300 pl-2">{replyingTo.content}</p>
                    </div>
                  )}
                  <label className="block text-xs font-medium text-base-content/60 uppercase tracking-wider mb-1">
                    {editingTemplate ? t('templates.placeholder_content') : t('new.content')}
                  </label>
                  <textarea 
                    className="w-full flex-1 px-3 py-2 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none text-sm bg-base-100"
                    value={editingTemplate ? templateForm.content : msgContent}
                    onChange={(e) => editingTemplate ? setTemplateForm({ ...templateForm, content: e.target.value }) : setMsgContent(e.target.value)}
                    required={!attachmentFile}
                    placeholder={t('new.placeholder')}
                  />
                </div>

                {!editingTemplate && (
                  <div className="shrink-0">
                    <label className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-base-300 bg-base-200 cursor-pointer hover:bg-base-200 transition-colors relative">
                      <Paperclip size={18} className="text-primary" />
                      <span className="text-sm font-medium text-base-content/70 truncate mr-8">
                        {attachmentFile ? attachmentFile.name : 'Joindre un fichier ou une image'}
                      </span>
                      <input 
                        type="file" 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setAttachmentFile(e.target.files[0]);
                          }
                        }}
                      />
                      {attachmentFile && (
                        <button 
                          type="button" 
                          className="absolute right-3 p-1 text-error hover:bg-error/10 rounded-full bg-base-100 shadow-sm"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAttachmentFile(null); }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </label>
                  </div>
                )}

                <div className="flex gap-2 md:gap-3 py-4 shrink-0">
                  <button 
                    type="button" 
                    onClick={() => setActiveTab(editingTemplate ? 'templates' : 'received')}
                    className="px-4 py-2 text-sm font-medium text-base-content bg-base-100 border border-base-300 rounded-lg hover:bg-base-200 transition-colors flex-1"
                  >
                    {t('common:cancel')}
                  </button>
                  <button 
                    type="submit" 
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-focus shadow-sm flex-1"
                  >
                    <Send size={18} />
                    {editingTemplate ? t('common:save') : t('new.send')}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {zoomImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setZoomImage(null)}>
          <div className="relative max-w-5xl max-h-[90vh] size-full flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-2 right-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/70 rounded-full transition-all p-2 z-10 shadow-lg" onClick={() => setZoomImage(null)}>
               <X size={24} />
            </button>
            <div className="bg-base-100 p-2 rounded-xl shadow-2xl h-full w-full flex items-center justify-center overflow-auto relative">
                <img src={zoomImage} alt="Zoom" className="max-w-full max-h-full object-contain" />
            </div>
          </div>
        </div>
      )}
    </PremiumModal>
  );
}

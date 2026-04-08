import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, MessageSquare, Trash2, Edit2, Plus, Bell, Clock, CheckCheck, Check, Archive, Reply, Paperclip, X } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'received' | 'sent' | 'archived' | 'templates' | 'new'>('received');
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
      const [msgRes, tempRes, userRes] = await Promise.all([
        communicationService.getMessages(),
        communicationService.getTemplates(),
        userService.getAll()
      ]);
      
      const msgs = Array.isArray(msgRes.data) ? msgRes.data : (msgRes.data.results || []);
      const temps = Array.isArray(tempRes.data) ? tempRes.data : (tempRes.data.results || []);
      
      setMessages(msgs);
      setTemplates(temps);
      setUsers(userRes.filter(u => u.id !== currentUser?.id));
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

  const useTemplate = (content: string) => {
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
      <div className="flex flex-col md:flex-row h-[75vh] md:h-[500px] max-h-[700px] min-h-[400px] overflow-hidden">
        {/* Navigation Tabs (Sidebar on Desktop, Top Bar on Mobile) */}
        <div className="w-full md:w-60 border-b md:border-b-0 md:border-r border-base-200 bg-base-200/30 p-2 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-y-auto no-scrollbar shrink-0">
          <button 
            onClick={() => setActiveTab('received')}
            className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl transition-all whitespace-nowrap flex-1 md:flex-none ${activeTab === 'received' ? 'bg-primary text-white shadow-md' : 'hover:bg-base-200'}`}
          >
            <Bell size={18} />
            <span className="font-medium text-xs md:text-sm">{t('tabs.received')}</span>
            {receivedMessages.filter(m => !m.is_read).length > 0 && (
              <span className="badge badge-error badge-sm ml-auto font-bold">
                {receivedMessages.filter(m => !m.is_read).length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('archived')}
            className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl transition-all whitespace-nowrap flex-1 md:flex-none ${activeTab === 'archived' ? 'bg-primary text-white shadow-md' : 'hover:bg-base-200'}`}
          >
            <Archive size={18} />
            <span className="font-medium text-xs md:text-sm">Archivés</span>
          </button>
          <button 
            onClick={() => setActiveTab('sent')}
            className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl transition-all whitespace-nowrap flex-1 md:flex-none ${activeTab === 'sent' ? 'bg-primary text-white shadow-md' : 'hover:bg-base-200'}`}
          >
            <Send size={18} />
            <span className="font-medium text-xs md:text-sm">{t('tabs.sent')}</span>
          </button>
          <button 
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl transition-all whitespace-nowrap flex-1 md:flex-none ${activeTab === 'templates' ? 'bg-primary text-white shadow-md' : 'hover:bg-base-200'}`}
          >
            <Edit2 size={18} />
            <span className="font-medium text-xs md:text-sm">{t('tabs.templates')}</span>
          </button>
          
          <div className="hidden md:block mt-auto pt-4 border-t border-base-300">
            <button 
              onClick={() => { setActiveTab('new'); setEditingTemplate(null); }}
              className={`flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-success text-white hover:opacity-90 transition-all font-bold shadow-lg`}
            >
              <Plus size={18} />
              <span>{t('tabs.new')}</span>
            </button>
          </div>

          {/* Mobile Compose Button */}
          <button 
            onClick={() => { setActiveTab('new'); setEditingTemplate(null); }}
            className={`md:hidden flex items-center justify-center p-2 rounded-xl bg-success text-white ml-auto`}
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-base-100 min-h-0">
          {activeTab === 'received' && (
            <div className="space-y-4">
              <h4 className="text-lg font-bold flex items-center gap-2 mb-6 sticky top-0 bg-base-100 z-10 pb-2">
                {t('received.title')}
                {receivedMessages.filter(m => !m.is_read).length > 0 && (
                  <span className="badge badge-error badge-sm shadow-sm" title="Messages non lus">
                    {receivedMessages.filter(m => !m.is_read).length} non lu(s)
                  </span>
                )}
              </h4>
              <div className="grid gap-3">
                {receivedMessages.length === 0 ? (
                   <div className="text-center py-10 text-base-content/40 italic">{t('received.empty')}</div>
                ) : (
                  receivedMessages.map((m: InternalMessage) => (
                    <div 
                      key={m.id} 
                      className={`group p-4 rounded-2xl border transition-all cursor-pointer relative ${!m.is_read ? 'bg-primary/5 border-primary/20 shadow-sm ring-1 ring-primary/10' : 'bg-base-200/50 border-base-300'}`}
                      onClick={() => !m.is_read && handleMarkAsRead(m.id)}
                    >
                      <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity bg-base-100 rounded-lg shadow border flex overflow-hidden z-10">
                        <button className="p-2 hover:bg-base-200 text-base-content/70 hover:text-primary transition-colors" onClick={(e) => handleReplyToMessage(e, m)} title="Répondre"><Reply size={15} /></button>
                        <button className="p-2 hover:bg-error/10 text-base-content/70 hover:text-error transition-colors border-l" onClick={(e) => handleArchiveMessage(e, m.id)} title="Archiver"><Archive size={15} /></button>
                      </div>
                      
                      {m.parent_content && (
                        <div className="mb-3 p-2 bg-base-200/80 rounded border-l-2 border-primary/50 text-xs">
                           <span className="font-bold opacity-70">En réponse à {m.parent_sender_name} :</span>
                           <p className="opacity-60 truncate">{m.parent_content}</p>
                        </div>
                      )}

                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 min-w-0 pr-16">
                          <div className={`w-8 h-8 rounded-full ${!m.is_read ? 'bg-primary text-primary-content' : 'bg-base-300 text-base-content'} flex items-center justify-center font-bold text-xs uppercase shrink-0 transition-colors shadow-inner`}>
                            {m.sender_name.charAt(0)}
                          </div>
                          <div className="truncate flex flex-col items-start">
                            <span className="font-bold text-sm truncate block leading-tight">{m.sender_name}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              {m.recipient === null && <span className="badge badge-ghost badge-outline badge-xs text-[9px] uppercase font-bold text-primary">{t('received.broadcast')}</span>}
                              {!m.is_read && <span className="badge badge-error badge-xs text-[9px] uppercase font-bold text-error-content shadow-sm shadow-error/40 animate-pulse">NOUVEAU</span>}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-base-content/50 flex items-center gap-1 shrink-0">
                          <Clock size={10} />
                          {format(new Date(m.created_at), 'dd/MM HH:mm', { locale: fr })}
                        </span>
                      </div>
                      <p className="text-sm text-base-content/80 whitespace-pre-wrap">{m.content}</p>
                      
                      {m.attachment && (
                        <div className="mt-3">
                          <div 
                            className="inline-flex items-center justify-center rounded-lg border bg-base-100 overflow-hidden cursor-zoom-in hover:opacity-90 max-w-xs"
                            onClick={(e) => { e.stopPropagation(); setZoomImage(m.attachment as string); }}
                          >
                           <img src={m.attachment} alt="Pièce jointe" className="max-h-32 object-contain hidden md:block" onError={(e) => e.currentTarget.style.display='none'} />
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
              <h4 className="text-lg font-bold mb-6 sticky top-0 bg-base-100 z-10 pb-2">{t('sent.title')}</h4>
              <div className="grid gap-3">
                {sentMessages.length === 0 ? (
                  <div className="text-center py-10 text-base-content/40 italic">{t('sent.empty')}</div>
                ) : (
                  sentMessages.map((m: InternalMessage) => (
                    <div key={m.id} className="p-4 rounded-2xl border bg-base-200/30 border-base-300">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-base-content/50 shrink-0">{t('sent.to')}</span>
                          <span className="font-bold text-sm text-primary truncate">{m.recipient_name}</span>
                        </div>
                        <span className="text-[10px] text-base-content/50 flex items-center gap-1 shrink-0">
                          {(() => {
                            if (!m.read_by) return null;
                            if (m.recipient === null) {
                              return m.read_by.length === 0 ? 
                                <span className="inline-flex items-center gap-0.5 text-base-content/40" title="Personne n'a encore lu"><Check size={12} /></span> : 
                                <span className="inline-flex items-center gap-0.5 text-info" title={`Lu par ${m.read_by.length} personne(s)`}><CheckCheck size={12} /> {m.read_by.length}</span>;
                            }
                            const isRead = m.read_by.includes(Number(m.recipient));
                            return isRead ? 
                              <span className="inline-flex items-center gap-0.5 text-success font-semibold" title="Lu"><CheckCheck size={12} /></span> : 
                              <span className="inline-flex items-center gap-0.5 text-base-content/40" title="Non lu"><Check size={12} /></span>;
                          })()}
                          <span className="mx-0.5 opacity-30">•</span>
                          {format(new Date(m.created_at), 'dd/MM HH:mm', { locale: fr })}
                        </span>
                      </div>
                      <p className="text-sm text-base-content/80">{m.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'archived' && (
            <div className="space-y-4">
              <h4 className="text-lg font-bold mb-6 sticky top-0 bg-base-100 z-10 pb-2">Messages archivés</h4>
              <div className="grid gap-3">
                {archivedMessages.length === 0 ? (
                  <div className="text-center py-10 text-base-content/40 italic">Aucun message archivé</div>
                ) : (
                  archivedMessages.map((m: InternalMessage) => (
                    <div 
                      key={m.id} 
                      className={`p-4 rounded-2xl border transition-all bg-base-200/50 border-base-300 opacity-80`}
                    >
                      {m.parent_content && (
                        <div className="mb-3 p-2 bg-base-200/80 rounded border-l-2 border-primary/50 text-xs">
                           <span className="font-bold opacity-70">En réponse à {m.parent_sender_name} :</span>
                           <p className="opacity-60 truncate">{m.parent_content}</p>
                        </div>
                      )}

                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 min-w-0 pr-16">
                          <div className={`w-8 h-8 rounded-full bg-base-300 text-base-content flex items-center justify-center font-bold text-xs uppercase shrink-0 transition-colors shadow-inner`}>
                            {m.sender_name.charAt(0)}
                          </div>
                          <div className="truncate flex flex-col items-start">
                            <span className="font-bold text-sm truncate block leading-tight">{m.sender_name}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              {m.recipient === null && <span className="badge badge-ghost badge-outline badge-xs text-[9px] uppercase font-bold text-primary">{t('received.broadcast')}</span>}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-base-content/50 flex items-center gap-1 shrink-0">
                          <Clock size={10} />
                          {format(new Date(m.created_at), 'dd/MM HH:mm', { locale: fr })}
                        </span>
                      </div>
                      <p className="text-sm text-base-content/80 whitespace-pre-wrap">{m.content}</p>
                      
                      {m.attachment && (
                        <div className="mt-3">
                          <div 
                            className="inline-flex items-center justify-center rounded-lg border bg-base-100 overflow-hidden cursor-zoom-in hover:opacity-90 max-w-xs"
                            onClick={(e) => { e.stopPropagation(); setZoomImage(m.attachment as string); }}
                          >
                           <img src={m.attachment} alt="Pièce jointe" className="max-h-32 object-contain hidden md:block" onError={(e) => e.currentTarget.style.display='none'} />
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

          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-6 sticky top-0 bg-base-100 z-10 pb-2">
                <h4 className="text-lg font-bold">{t('templates.title')}</h4>
                <button 
                  onClick={() => { setEditingTemplate(null); setTemplateForm({title: '', content: ''}); setActiveTab('new'); }}
                  className="btn btn-xs btn-outline btn-primary"
                >
                  {t('templates.manage')}
                </button>
              </div>
              <div className="grid gap-4">
                {templates.map((temp) => (
                  <div key={temp.id} className="p-4 rounded-2xl border border-base-300 bg-base-200/20 group relative">
                    <div className="flex justify-between items-start mb-2 pr-16 min-w-0">
                      <h5 className="font-bold text-primary truncate">{temp.title}</h5>
                      <span className="text-[10px] text-base-content/40 italic truncate ml-2">{temp.created_by_name}</span>
                    </div>
                    <p className="text-sm text-base-content/70 line-clamp-3 mb-4">{temp.content}</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => useTemplate(temp.content)}
                        className="btn btn-xs btn-primary flex-1"
                      >
                        {t('new.send')}
                      </button>
                      <button 
                        onClick={() => { setEditingTemplate(temp); setTemplateForm({title: temp.title, content: temp.content}); setActiveTab('new'); }}
                        className="btn btn-xs btn-ghost btn-square text-base-content/40 hover:text-primary transition-colors shrink-0"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteTemplate(temp.id)}
                        className="btn btn-xs btn-ghost btn-square text-base-content/40 hover:text-error transition-colors shrink-0"
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
              <h4 className="text-lg font-bold mb-6">
                {editingTemplate ? t('templates.edit') : t('new.title')}
              </h4>
              <form onSubmit={editingTemplate ? handleSaveTemplate : handleSendMessage} className="space-y-4 md:space-y-6 flex flex-col flex-1 min-h-0">
                {editingTemplate ? (
                  <div className="form-control w-full shrink-0">
                    <label className="label py-1">
                      <span className="label-text font-bold text-base-content/60 text-xs">{t('templates.placeholder_title')}</span>
                    </label>
                    <input 
                      type="text"
                      className="input input-bordered input-sm md:input-md w-full rounded-xl bg-base-200/50"
                      value={templateForm.title}
                      onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
                      required
                      placeholder={t('templates.placeholder_title')}
                    />
                  </div>
                ) : (
                  <div className="form-control w-full shrink-0">
                    <label className="label py-1">
                      <span className="label-text font-bold text-base-content/60 text-xs">{t('new.recipient')}</span>
                    </label>
                    <select 
                      className="select select-bordered select-sm md:select-md w-full rounded-xl bg-base-200/50"
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

                <div className="form-control flex-1 min-h-[100px] flex flex-col">
                  {!editingTemplate && replyingTo && (
                    <div className="mb-2 p-3 bg-base-200/50 rounded-xl border border-primary/20 flex flex-col gap-1 relative pr-8">
                       <button 
                         type="button" 
                         className="absolute right-2 top-2 text-base-content/40 hover:text-error"
                         onClick={() => setReplyingTo(null)}
                       >
                         <X size={14} />
                       </button>
                       <span className="text-xs font-bold text-primary flex items-center gap-1"><Reply size={12}/> Réponse à {replyingTo.sender_name}</span>
                       <p className="text-xs text-base-content/70 line-clamp-2 italic border-l-2 border-primary/30 pl-2">{replyingTo.content}</p>
                    </div>
                  )}
                  <label className="label py-1">
                    <span className="label-text font-bold text-base-content/60 text-xs">{editingTemplate ? t('templates.placeholder_content') : t('new.content')}</span>
                  </label>
                  <textarea 
                    className="textarea textarea-bordered w-full flex-1 rounded-2xl bg-base-200/50 resize-none text-sm"
                    value={editingTemplate ? templateForm.content : msgContent}
                    onChange={(e) => editingTemplate ? setTemplateForm({ ...templateForm, content: e.target.value }) : setMsgContent(e.target.value)}
                    required={!attachmentFile}
                    placeholder={t('new.placeholder')}
                  />
                </div>

                {!editingTemplate && (
                  <div className="form-control shrink-0">
                    <label className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-base-300 bg-base-200/30 cursor-pointer hover:bg-base-200/50 transition-colors relative">
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
                    className="btn btn-ghost btn-sm md:btn-md flex-1 rounded-xl"
                  >
                    {t('common:cancel')}
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary btn-sm md:btn-md flex-1 rounded-xl shadow-lg shadow-primary/30"
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
          <div className="relative max-w-5xl max-h-[90vh] w-full h-full flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
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

import api from './api';

export interface InternalMessage {
  id: number;
  sender: number;
  sender_name: string;
  recipient: number | null;
  recipient_name: string;
  content: string;
  is_read: boolean;
  read_by?: number[];
  is_archived?: boolean;
  attachment?: string | null;
  attachment_url?: string | null;
  parent?: number | null;
  parent_content?: string;
  parent_sender_name?: string;
  created_at: string;
  read_at: string | null;
}

export interface MessageTemplate {
  id: number;
  title: string;
  content: string;
  is_active: boolean;
  created_by: number | null;
  created_by_name: string;
  created_at: string;
}

const communicationService = {
  // Messages Internes
  getMessages: (params?: any) => api.get('/internal-messages/', { params }),
  sendMessage: (data: { recipient?: number | null; content: string; parent?: number | null; attachment?: File | null }) => {
    if (data.attachment) {
      const formData = new FormData();
      if (data.recipient) formData.append('recipient', data.recipient.toString());
      formData.append('content', data.content);
      if (data.parent) formData.append('parent', data.parent.toString());
      formData.append('attachment', data.attachment);
      return api.post('/internal-messages/', formData);
    }
    return api.post('/internal-messages/', data);
  },
  markAsRead: (id: number) => api.post(`/internal-messages/${id}/mark_as_read/`),
  archiveMessage: (id: number) => api.post(`/internal-messages/${id}/archive/`),
  getUnreadCount: () => api.get('/internal-messages/unread_count/'),
  deleteMessage: (id: number) => api.delete(`/internal-messages/${id}/`),

  // Modèles de Messages
  getTemplates: (params?: any) => api.get('/message-templates/', { params }),
  createTemplate: (data: Partial<MessageTemplate>) => api.post('/message-templates/', data),
  updateTemplate: (id: number, data: Partial<MessageTemplate>) => api.put(`/message-templates/${id}/`, data),
  deleteTemplate: (id: number) => api.delete(`/message-templates/${id}/`),
  sendWhatsAppMessage: (number: string, text: string) => api.post('/whatsapp/send_manual/', { number, text }),
};

export default communicationService;

import api from './api';

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

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
  attachment_url?: string | null;
  parent?: number | null;
  parent_content?: string;
  parent_sender_name?: string;
  created_at: string;
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

export interface SendMessagePayload {
  recipient?: number | null;
  content: string;
  parent?: number | null;
  attachment?: File | null;
}

export type MessageBox = 'received' | 'sent' | 'archived' | 'all';

export interface MessageListParams {
  box: MessageBox;
  page?: number;
  page_size?: number;
  search?: string;
  has_attachment?: boolean;
  unread?: boolean;
}

export function extractResults<T>(data: PaginatedResponse<T> | T[] | undefined | null): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

function serializeParams(params: Record<string, string | number | boolean | undefined | null>) {
  const result: Record<string, string | number> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === false) return;
    if (typeof value === 'boolean') {
      result[key] = 'true';
    } else {
      result[key] = value;
    }
  });
  return result;
}

const communicationService = {
  // Messages Internes
  getMessages: (params: MessageListParams) =>
    api.get<PaginatedResponse<InternalMessage>>('/internal-messages/', {
      params: serializeParams({
        box: params.box,
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
        search: params.search,
        has_attachment: params.has_attachment,
        unread: params.unread,
      }),
    }),
  sendMessage: (data: SendMessagePayload) => {
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
  getAttachment: (id: number) => api.get<Blob>(`/internal-messages/${id}/attachment/`, { responseType: 'blob' }),
  getUnreadCount: () => api.get<{ count: number }>('/internal-messages/unread_count/'),
  deleteMessage: (id: number) => api.delete(`/internal-messages/${id}/`),

  // Modèles de Messages
  getTemplates: (params?: Record<string, string | number | boolean | undefined | null>) =>
    api.get<PaginatedResponse<MessageTemplate>>('/message-templates/', {
      params: serializeParams({ page_size: 100, ...params }),
    }),
  createTemplate: (data: Partial<MessageTemplate>) => api.post('/message-templates/', data),
  updateTemplate: (id: number, data: Partial<MessageTemplate>) => api.put(`/message-templates/${id}/`, data),
  deleteTemplate: (id: number) => api.delete(`/message-templates/${id}/`),
  sendWhatsAppMessage: (number: string, text: string) => api.post('/whatsapp/send_manual/', { number, text }),
};

export default communicationService;

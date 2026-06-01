import api from './api';

export interface Feedback {
  id?: number;
  user?: number;
  username?: string;
  category: 'BUG' | 'FEATURE' | 'IMPROVEMENT' | 'QUESTION' | 'OTHER';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status?: 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  subject: string;
  description: string;
  screenshot?: string;
  page_url?: string;
  browser_info?: string;
  admin_response?: string;
  responded_at?: string;
  responded_by?: number;
  created_at?: string;
  updated_at?: string;
}

export interface FeedbackResponse {
  id: number;
  user: number;
  username: string;
  category: string;
  priority: string;
  status: string;
  subject: string;
  description: string;
  screenshot?: string;
  page_url?: string;
  browser_info?: string;
  admin_response?: string;
  responded_at?: string;
  responded_by?: number;
  created_at: string;
  updated_at: string;
}

const feedbackService = {
  getAll: async (): Promise<FeedbackResponse[]> => {
    const response = await api.get<FeedbackResponse[]>('feedback/');
    return response.data;
  },

  getById: async (id: number): Promise<FeedbackResponse> => {
    const response = await api.get<FeedbackResponse>(`feedback/${id}/`);
    return response.data;
  },

  create: async (feedback: Omit<Feedback, 'id' | 'user' | 'username' | 'status' | 'admin_response' | 'responded_at' | 'responded_by' | 'created_at' | 'updated_at'>): Promise<FeedbackResponse> => {
    const response = await api.post<FeedbackResponse>('feedback/', feedback);
    return response.data;
  },
};

export default feedbackService;

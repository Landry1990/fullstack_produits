import api from './api';

export interface LicenceNotification {
  id: number;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  days_remaining: number | null;
  expiry_date: string | null;
  created_at: string;
}

export interface LicenceStatus {
  is_valid: boolean;
  is_lifetime: boolean;
  days_remaining: number | null;
  pharmacie_nom: string | null;
  plan: string | null;
}

export interface LicenceNotificationsResponse {
  notifications: LicenceNotification[];
  licence_status: LicenceStatus;
}

export const licenceService = {
  /**
   * Récupérer les notifications actives de licence
   */
  async getNotifications(): Promise<LicenceNotificationsResponse> {
    const response = await api.get<LicenceNotificationsResponse>('/licence/notifications/');
    return response.data;
  },

  /**
   * Ignorer une notification
   */
  async dismissNotification(notificationId: number): Promise<void> {
    await api.post('/licence/notifications/', { notification_id: notificationId });
  },
};

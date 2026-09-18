import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { gooeyToast } from 'goey-toast';
import communicationService, {
  type InternalMessage,
  type MessageBox,
  type MessageListParams,
  type MessageTemplate,
  type SendMessagePayload,
} from '../../../services/communicationService';
import userService, { type SimpleUser } from '../../../services/userService';
import { logger } from '../../../utils/logger';
import type { MessagingUser } from './types';

export const DEFAULT_PAGE_SIZE = 20;

export interface MessageFilters {
  box: MessageBox | null;
  page: number;
  page_size: number;
  search: string;
  has_attachment: boolean;
  unread: boolean;
}

export interface MessagingData {
  messages: InternalMessage[];
  totalCount: number;
  totalPages: number;
  templates: MessageTemplate[];
  users: SimpleUser[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
}

interface UseMessagingOptions {
  enabled: boolean;
  currentUser: MessagingUser | null | undefined;
  filters: MessageFilters;
}

const MESSAGES_QUERY_KEY = 'internalMessages';
const TEMPLATES_QUERY_KEY = 'messageTemplates';
const USERS_QUERY_KEY = 'messagingUsers';

function buildMessageQueryKey(filters: MessageFilters) {
  return [MESSAGES_QUERY_KEY, filters.box, filters.page, filters.page_size, filters.search, filters.has_attachment, filters.unread];
}

export function useMessaging({ enabled, currentUser, filters }: UseMessagingOptions): MessagingData {
  const messagesQuery = useQuery({
    queryKey: buildMessageQueryKey(filters),
    queryFn: async () => {
      if (!filters.box) return { count: 0, next: null, previous: null, results: [] };
      const response = await communicationService.getMessages(filters as MessageListParams);
      return response.data;
    },
    enabled: enabled && filters.box !== null,
    staleTime: 1000 * 60,
  });

  const templatesQuery = useQuery({
    queryKey: [TEMPLATES_QUERY_KEY],
    queryFn: async () => {
      const response = await communicationService.getTemplates({ page_size: 500 });
      return response.data.results ?? [];
    },
    enabled,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 30,
  });

  const usersQuery = useQuery({
    queryKey: [USERS_QUERY_KEY],
    queryFn: async () => {
      const response = await userService.getAll();
      return response.filter((u) => u.id !== currentUser?.id);
    },
    enabled,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 30,
  });

  const isLoading = messagesQuery.isLoading || templatesQuery.isLoading || usersQuery.isLoading;
  const isFetching = messagesQuery.isFetching;

  if (messagesQuery.error) {
    logger.error('Error loading messages', messagesQuery.error);
  }
  if (templatesQuery.error) {
    logger.error('Error loading templates', templatesQuery.error);
  }
  if (usersQuery.error) {
    logger.error('Error loading users', usersQuery.error);
  }

  const totalCount = messagesQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.page_size));

  return {
    messages: messagesQuery.data?.results ?? [],
    totalCount,
    totalPages,
    templates: templatesQuery.data ?? [],
    users: usersQuery.data ?? [],
    isLoading,
    isFetching,
    error: (messagesQuery.error || templatesQuery.error || usersQuery.error) as Error | null,
    refetch: () => {
      messagesQuery.refetch();
      templatesQuery.refetch();
      usersQuery.refetch();
    },
  };
}

export function useMarkAsReadMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation(['messaging', 'common']);

  return useMutation({
    mutationFn: (id: number) => communicationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MESSAGES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [MESSAGES_QUERY_KEY, 'unread_count'] });
    },
    onError: () => {
      gooeyToast.error(t('common:error'));
    },
  });
}

export function useArchiveMessageMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation(['messaging', 'common']);

  return useMutation({
    mutationFn: (id: number) => communicationService.archiveMessage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MESSAGES_QUERY_KEY] });
      gooeyToast.success(t('messages.archived'));
    },
    onError: () => {
      gooeyToast.error(t('messages.archive_error'));
    },
  });
}

export function useSendMessageMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation(['messaging', 'common']);

  return useMutation({
    mutationFn: (data: SendMessagePayload) => communicationService.sendMessage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MESSAGES_QUERY_KEY] });
      gooeyToast.success(t('new.success_sent'));
    },
    onError: () => {
      gooeyToast.error(t('new.error_sent'));
    },
  });
}

export function useSaveTemplateMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation(['messaging', 'common']);

  return useMutation({
    mutationFn: ({ id, data }: { id: number | null; data: Partial<MessageTemplate> }) => {
      if (id !== null) {
        return communicationService.updateTemplate(id, data);
      }
      return communicationService.createTemplate(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_QUERY_KEY] });
      gooeyToast.success(t('templates.success_saved'));
    },
    onError: () => {
      gooeyToast.error(t('common:error'));
    },
  });
}

export function useDeleteTemplateMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation(['messaging', 'common']);

  return useMutation({
    mutationFn: (id: number) => communicationService.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TEMPLATES_QUERY_KEY] });
      gooeyToast.success(t('templates.success_deleted'));
    },
    onError: () => {
      gooeyToast.error(t('common:error'));
    },
  });
}

export function useUnreadMessageCount(enabled: boolean) {
  return useQuery({
    queryKey: [MESSAGES_QUERY_KEY, 'unread_count'],
    queryFn: async () => {
      const response = await communicationService.getUnreadCount();
      return response.data.count ?? 0;
    },
    enabled,
    refetchInterval: 30000,
    staleTime: 1000 * 30,
  });
}

export function useSupervisionMessageCount(enabled: boolean) {
  return useQuery({
    queryKey: [MESSAGES_QUERY_KEY, 'count', 'all'],
    queryFn: async () => {
      const response = await communicationService.getMessages({ box: 'all', page: 1, page_size: 1 });
      return response.data.count ?? 0;
    },
    enabled,
    staleTime: 1000 * 60,
  });
}

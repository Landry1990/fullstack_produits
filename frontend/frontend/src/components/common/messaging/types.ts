import type { InternalMessage } from '../../../services/communicationService';

export type MessagingTab = 'received' | 'sent' | 'archived' | 'templates' | 'new' | 'supervision';

export interface MessagingUser {
  id?: number;
  username: string;
  is_staff?: boolean;
  is_superuser?: boolean;
}

export interface ComposerState {
  recipientId: number | '';
  msgContent: string;
  replyingTo: InternalMessage | null;
  attachmentFile: File | null;
}

export type ComposerAction =
  | { type: 'SET_RECIPIENT'; payload: number | '' }
  | { type: 'SET_CONTENT'; payload: string }
  | { type: 'SET_REPLY_TO'; payload: InternalMessage | null; recipientId?: number | '' }
  | { type: 'SET_ATTACHMENT'; payload: File | null }
  | { type: 'RESET' };

export const initialComposerState: ComposerState = {
  recipientId: '',
  msgContent: '',
  replyingTo: null,
  attachmentFile: null,
};

export function composerReducer(state: ComposerState, action: ComposerAction): ComposerState {
  switch (action.type) {
    case 'SET_RECIPIENT':
      return { ...state, recipientId: action.payload };
    case 'SET_CONTENT':
      return { ...state, msgContent: action.payload };
    case 'SET_REPLY_TO':
      return {
        ...state,
        replyingTo: action.payload,
        recipientId: action.payload === null ? '' : (action.recipientId ?? state.recipientId),
      };
    case 'SET_ATTACHMENT':
      return { ...state, attachmentFile: action.payload };
    case 'RESET':
      return initialComposerState;
    default:
      return state;
  }
}

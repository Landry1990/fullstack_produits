import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react';
import PremiumModal from './PremiumModal';
import { MessagingCenter } from './messaging/MessagingCenter';
import type { MessagingUser } from './messaging/types';

interface MessagingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: MessagingUser;
  onMessageRead?: () => void;
}

/**
 * Fenêtre modale de la messagerie interne.
 * Le contenu est délégué à MessagingCenter (components/common/messaging/).
 */
export default function MessagingModal({ isOpen, onClose, currentUser, onMessageRead }: MessagingModalProps) {
  const { t } = useTranslation('messaging');

  return createPortal(
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('title')}
      subtitle={t('subtitle')}
      icon={<MessageSquare className="text-blue-600" />}
      maxWidth="max-w-5xl"
    >
      <MessagingCenter currentUser={currentUser} isOpen={isOpen} onMessageRead={onMessageRead} />
    </PremiumModal>,
    document.body,
  );
}

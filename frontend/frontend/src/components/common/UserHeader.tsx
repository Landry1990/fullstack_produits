import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { useTranslation } from 'react-i18next';
import communicationService from '../../services/communicationService';
import MessagingModal from './MessagingModal';
import FeedbackModal from './FeedbackModal';
import { Bell, ChevronDown, LogOut, Moon, Sun, MessageSquare, User as UserIcon, MessageCircle } from 'lucide-react';
import { playNotificationSound } from '../../utils/audio';

export default function UserHeader() {
  const { t, i18n } = useTranslation(['messaging', 'sidebar', 'common']);
  const { user, logout } = useAuth();
  const { isMidnightTheme, toggleMidnightTheme } = useSidebar();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMessagingOpen, setIsMessagingOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const prevUnreadCount = useRef<number>(0);

  const fetchUnread = async () => {
    if (!user) return;
    try {
      const res = await communicationService.getUnreadCount();
      const newCount = res.data.count || 0;
      
      // Notify if new messages arrive
      if (newCount > prevUnreadCount.current) {
        // Play an alert sound for the recipient
        playNotificationSound();

        if (!isMessagingOpen) {
          toast.success(
            (toastObj: any) => (
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-base-content">{t('new.new_notification')}</p>
                  <p className="text-xs text-base-content/60">{t('subtitle')}</p>
                </div>
                <button 
                  onClick={() => {
                    setIsMessagingOpen(true);
                    // @ts-ignore
                    toast.dismiss(toastObj.id);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary-focus transition-colors"
                >
                  {t('new.view')}
                </button>
              </div>
            ),
            { duration: 6000, position: 'top-right' }
          );
        }
      }
      
      setUnreadCount(newCount);
      prevUnreadCount.current = newCount;
    } catch (error) {
      console.error("Error fetching unread count", error);
    }
  };

  // Polling for unread messages
  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [user]);

  // Handle outside click to close menu
  useEffect(() => {
    if (isMenuOpen) {
      const handleClickOutside = () => setIsMenuOpen(false);
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isMenuOpen]);

  if (!user) return null;

  return (
    <>
      <header className="flex items-center justify-end w-full">
        <div className="flex items-center gap-2">
          
          {/* Notifications / Messages Bell */}
          <button 
            onClick={() => setIsMessagingOpen(true)}
            className="relative p-2 rounded-full hover:bg-primary/10 transition-colors"
            title="Messagerie Interne"
          >
            <Bell size={16} className="text-base-content/70" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold size-5 flex items-center justify-center rounded-full animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Feedback Button */}
          <button 
            onClick={() => setIsFeedbackOpen(true)}
            className="p-2 rounded-full hover:bg-primary/10 transition-colors"
            title="Feedback"
          >
            <MessageCircle size={16} className="text-base-content/70" />
          </button>

          <div className="h-6 w-[1px] bg-gray-300 mx-0.5"></div>

          {/* User Profile Area */}
          <div 
            className="relative"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
          >
            <button className="flex items-center gap-2 px-1.5 py-0.5 rounded-lg hover:bg-base-200 transition-all group">
              <div className="size-7 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shadow-md ring-2 ring-gray-200 overflow-hidden">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left mr-1">
                <p className="text-sm font-semibold text-base-content leading-none mb-1">
                  {user.username}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-base-content/60 font-medium">
                  {user.is_superuser ? t('sidebar:roles.pharmacist') : t('sidebar:roles.user')}
                </p>
              </div>
              <ChevronDown size={14} className={`text-base-content/50 transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-base-100 border border-base-300 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 z-50">
                <div className="p-4 border-b border-base-200 bg-base-200">
                  <p className="text-xs font-semibold text-base-content/50 uppercase tracking-widest mb-2">Compte</p>
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                      <UserIcon size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-base-content truncate">{user.username}</p>
                      <p className="text-xs text-base-content/60 truncate">{user.email || t('sidebar:roles.user')}</p>
                    </div>
                  </div>
                </div>

                <div className="p-2">
                  <button 
                    onClick={() => setIsMessagingOpen(true)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-primary/10 hover:text-primary transition-colors text-left"
                  >
                    <MessageSquare size={18} />
                    <span className="flex-1">Messages</span>
                    {unreadCount > 0 && <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">{unreadCount}</span>}
                  </button>

                  <button 
                    onClick={toggleMidnightTheme}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-base-200 hover:text-base-content transition-colors text-left"
                  >
                    {isMidnightTheme ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} className="text-primary" />}
                    <span>{isMidnightTheme ? 'Mode Clair' : 'Mode Sombre'}</span>
                  </button>

                  <div className="flex items-center gap-2 p-2 mt-1">
                    <button 
                      onClick={() => i18n.changeLanguage('fr')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${i18n.language === 'fr' ? 'bg-primary text-white shadow-sm' : 'bg-base-200 text-base-content/70 hover:bg-base-300'}`}
                    >
                      FR
                    </button>
                    <button 
                      onClick={() => i18n.changeLanguage('en')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${i18n.language === 'en' ? 'bg-primary text-white shadow-sm' : 'bg-base-200 text-base-content/70 hover:bg-base-300'}`}
                    >
                      EN
                    </button>
                  </div>
                </div>

                <div className="p-2 bg-base-200 border-t border-base-200">
                  <button 
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-error hover:bg-error/10 transition-colors text-left"
                  >
                    <LogOut size={18} />
                    <span className="font-semibold">Déconnexion</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <MessagingModal 
        isOpen={isMessagingOpen}
        onClose={() => {
          setIsMessagingOpen(false);
          // Refresh unread count when closing
          const fetchUnread = async () => {
            const res = await communicationService.getUnreadCount();
            setUnreadCount(res.data.count || 0);
          };
          fetchUnread();
        }}
        onMessageRead={() => {
          fetchUnread();
        }}
        currentUser={user}
      />

      <FeedbackModal 
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />
    </>
  );
}

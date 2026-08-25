import { useState, useEffect, useRef } from 'react';
import { gooeyToast } from 'goey-toast';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../hooks/useSidebar';
import { useTranslation } from 'react-i18next';
import communicationService from '../../services/communicationService';
import MessagingModal from './MessagingModal';
import FeedbackModal from './FeedbackModal';
import { Bell, ChevronDown, LogOut, Moon, Sun, MessageSquare, User as UserIcon, MessageCircle, Key } from 'lucide-react';
import { playNotificationSound } from '../../utils/audio';
import { logger } from '../../utils/logger'

export default function UserHeader() {
  const { t, i18n } = useTranslation(['messaging', 'sidebar', 'common']);
  const { user, logout } = useAuth();
  const { isMidnightTheme, toggleMidnightTheme } = useSidebar();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMessagingOpen, setIsMessagingOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const prevUnreadCount = useRef<number>(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          gooeyToast.success(t('new.new_notification'), {
            description: t('subtitle'),
            action: {
              label: t('new.view'),
              onClick: () => setIsMessagingOpen(true),
            },
            duration: 6000,
          });
        }
      }
      
      setUnreadCount(newCount);
      prevUnreadCount.current = newCount;
    } catch (error) {
      logger.error("Error fetching unread count", error);
    }
  };

  // Polling for unread messages
  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [user, fetchUnread]);

  // Handle outside click to close menu
  useEffect(() => {
    if (isMenuOpen) {
      const handleClickOutside = () => setIsMenuOpen(false);
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isMenuOpen]);

  const switchLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('i18nextLng', lng);
  };

  if (!user) return null;

  return (
    <>
      <header className="flex items-center justify-end w-full">
        <div className="flex items-center gap-2">
          
          {/* Notifications / Messages Bell */}
          <button 
            onClick={() => setIsMessagingOpen(true)}
            className="relative p-2 rounded-full hover:bg-emerald-50 transition-colors"
            title={t('common:messaging')}
          >
            <Bell size={16} className="text-slate-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold size-5 flex items-center justify-center rounded-full animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Feedback Button */}
          <button 
            onClick={() => setIsFeedbackOpen(true)}
            className="p-2 rounded-full hover:bg-emerald-50 transition-colors"
            title={t('common:feedback')}
          >
            <MessageCircle size={16} className="text-slate-500" />
          </button>

          {/* Language Switcher — toujours visible */}
          <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => switchLanguage('fr')}
              className={`px-2 py-1 rounded-md text-xs font-bold transition-all ${
                i18n.language === 'fr' || i18n.language.startsWith('fr')
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
              title={t('common:french')}
            >
              FR
            </button>
            <button
              onClick={() => switchLanguage('en')}
              className={`px-2 py-1 rounded-md text-xs font-bold transition-all ${
                i18n.language === 'en' || i18n.language.startsWith('en')
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
              title={t('common:english')}
            >
              EN
            </button>
          </div>

          <div className="h-6 w-[1px] bg-gray-300 mx-0.5"></div>

          {/* User Profile Area */}
          <div 
            className="relative"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
          >
            <button className="flex items-center gap-2 px-1.5 py-0.5 rounded-lg hover:bg-slate-100 transition-all group">
              <div className="size-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-md ring-2 ring-gray-200 overflow-hidden">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left mr-1">
                <p className="text-sm font-semibold text-slate-700 leading-none mb-1">
                  {user.username}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                  {user.is_superuser ? t('sidebar:roles.pharmacist') : t('sidebar:roles.user')}
                </p>
              </div>
              <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 z-50">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">{t('common:account')}</p>
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <UserIcon size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{user.username}</p>
                      <p className="text-xs text-slate-400 truncate">{user.email || t('sidebar:roles.user')}</p>
                    </div>
                  </div>
                </div>

                <div className="p-2">
                  <button 
                    onClick={() => setIsMessagingOpen(true)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-emerald-50 hover:text-emerald-600 transition-colors text-left"
                  >
                    <MessageSquare size={18} />
                    <span className="flex-1">{t('common:messages_label')}</span>
                    {unreadCount > 0 && <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-red-500 rounded-full">{unreadCount}</span>}
                  </button>

                  <button 
                    onClick={toggleMidnightTheme}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-slate-100 hover:text-slate-700 transition-colors text-left"
                  >
                    {isMidnightTheme ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} className="text-emerald-600" />}
                    <span>{isMidnightTheme ? t('common:light_mode') : t('common:dark_mode')}</span>
                  </button>

                  <div className="flex items-center gap-2 p-2 mt-1">
                    <button
                      onClick={() => switchLanguage('fr')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${i18n.language === 'fr' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      FR
                    </button>
                    <button
                      onClick={() => switchLanguage('en')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${i18n.language === 'en' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      EN
                    </button>
                  </div>
                </div>

                <div className="p-2 bg-slate-50 border-t border-slate-100">
                  {user.is_superuser && (
                    <button
                      onClick={() => window.location.href = '/licence?update=1'}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-amber-50 hover:text-amber-600 transition-colors text-left"
                    >
                      <Key size={18} />
                      <span className="font-semibold">{t('common:update_license')}</span>
                    </button>
                  )}
                  <button 
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors text-left"
                  >
                    <LogOut size={18} />
                    <span className="font-semibold">{t('common:logout')}</span>
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

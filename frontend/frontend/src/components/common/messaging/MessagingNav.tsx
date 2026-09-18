import type { ReactNode } from 'react';
import { Archive, Bell, Edit2, Plus, Send, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../ui/Badge';
import type { MessagingTab } from './types';

interface MessagingNavProps {
  activeTab: MessagingTab;
  onTabChange: (tab: MessagingTab) => void;
  unreadCount: number;
  supervisionCount: number;
  isAdmin: boolean;
}

interface NavItemProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  badge?: ReactNode;
  activeClass?: string;
}

function NavItem({ active, onClick, icon, label, badge, activeClass = 'bg-blue-600' }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-11 items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-xl transition-all motion-reduce:transition-none whitespace-nowrap flex-1 md:flex-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        active ? `${activeClass} text-white shadow-sm` : 'hover:bg-slate-200 text-slate-700'
      }`}
    >
      {icon}
      <span className="font-medium text-xs md:text-sm">{label}</span>
      {badge}
    </button>
  );
}

export function MessagingNav({ activeTab, onTabChange, unreadCount, supervisionCount, isAdmin }: MessagingNavProps) {
  const { t } = useTranslation('messaging');

  return (
    <nav
      aria-label={t('nav_label')}
      className="w-full md:w-56 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-100 p-2 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-y-auto no-scrollbar shrink-0"
    >
      <NavItem
        active={activeTab === 'received'}
        onClick={() => onTabChange('received')}
        icon={<Bell size={18} aria-hidden />}
        label={t('tabs.received')}
        badge={
          unreadCount > 0 ? (
            <Badge variant="error" size="sm" className="ml-auto" aria-label={t('list.unread_count', { count: unreadCount })}>
              {unreadCount}
            </Badge>
          ) : undefined
        }
      />
      <NavItem
        active={activeTab === 'sent'}
        onClick={() => onTabChange('sent')}
        icon={<Send size={18} aria-hidden />}
        label={t('tabs.sent')}
      />
      <NavItem
        active={activeTab === 'archived'}
        onClick={() => onTabChange('archived')}
        icon={<Archive size={18} aria-hidden />}
        label={t('tabs.archived')}
      />
      <NavItem
        active={activeTab === 'templates'}
        onClick={() => onTabChange('templates')}
        icon={<Edit2 size={18} aria-hidden />}
        label={t('tabs.templates')}
      />
      {isAdmin && (
        <NavItem
          active={activeTab === 'supervision'}
          onClick={() => onTabChange('supervision')}
          icon={<Shield size={18} aria-hidden />}
          label={t('tabs.supervision')}
          activeClass="bg-amber-500"
          badge={
            <Badge
              variant="warning"
              size="sm"
              className="ml-auto"
              aria-label={t('supervision.message_count', { count: supervisionCount })}
            >
              {supervisionCount}
            </Badge>
          }
        />
      )}

      <div className="hidden md:block mt-auto pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => onTabChange('new')}
          className="flex min-h-11 items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all motion-reduce:transition-none font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          <Plus size={18} aria-hidden />
          <span>{t('tabs.new')}</span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => onTabChange('new')}
        aria-label={t('tabs.new')}
        className="md:hidden flex min-h-11 min-w-11 items-center justify-center p-2 rounded-xl bg-emerald-500 text-white ml-auto hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <Plus size={20} aria-hidden />
      </button>
    </nav>
  );
}

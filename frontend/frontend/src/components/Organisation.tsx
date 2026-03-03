import { useState } from 'react';
import { LayoutGrid, Tablets, FolderTree } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CategoryManager from './common/CategoryManager';

interface OrganisationProps {
  defaultTab?: 'rayons' | 'formes' | 'groupes';
}

export default function Organisation({ defaultTab = 'rayons' }: OrganisationProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'rayons' | 'formes' | 'groupes'>(defaultTab);

  const tabs = [
    { 
      id: 'rayons', 
      label: 'Rayons', 
      icon: <FolderTree size={18} />, 
      color: 'primary',
      config: {
        type: 'rayon' as const,
        title: 'Rayon',
        icon: <FolderTree size={20} />,
        apiPath: '/api/categories/',
        hasHierarchy: true,
        hasDescription: false
      }
    },
    { 
      id: 'formes', 
      label: 'Formes Galéniques', 
      icon: <Tablets size={18} />, 
      color: 'secondary',
      config: {
        type: 'forme' as const,
        title: 'Forme',
        icon: <Tablets size={20} />,
        apiPath: '/api/formes/',
        hasHierarchy: false,
        hasDescription: true
      }
    },
    { 
      id: 'groupes', 
      label: 'Groupes de Produits', 
      icon: <LayoutGrid size={18} />, 
      color: 'accent',
      config: {
        type: 'groupe' as const,
        title: 'Groupe',
        icon: <LayoutGrid size={20} />,
        apiPath: '/api/groupes/',
        hasHierarchy: false,
        hasDescription: true
      }
    },
  ];

  const currentTab = tabs.find(t => t.id === activeTab)!;

  return (
    <div className="min-h-screen bg-base-200 p-6 space-y-6 font-sans">
      {/* Header Section (Style Ventes.tsx) */}
      <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 flex flex-col">
        <div className="p-6 border-b border-base-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
           <div>
              <h1 className="text-2xl font-bold text-base-content tracking-tight">{t('sidebar.stock.organisation', {defaultValue: 'Organisation'})}</h1>
              <p className="text-base-content/60 text-sm mt-1">Gérez l'emplacement, la forme et le regroupement de vos produits.</p>
           </div>

           {/* Tabs Navigation (Style Ventes.tsx) */}
           <div className="bg-base-50/50 p-1 rounded-xl border border-base-200 flex gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition-all ${
                    activeTab === tab.id 
                    ? `bg-${tab.color} text-${tab.color}-content shadow-sm` 
                    : 'hover:bg-base-200 opacity-60'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
           </div>
        </div>
      </div>

      {/* Main Content (Style Ventes.tsx) */}
      <div className="max-w-full mx-auto">
         <CategoryManager 
           key={activeTab} // Force remount on tab change to reset states
           {...currentTab.config}
         />
      </div>
    </div>
  );
}

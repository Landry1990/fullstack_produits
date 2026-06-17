import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import { useLicence } from '../context/LicenceContext';
import ZenithLogo from './ZenithLogo';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useReapproStats } from '../hooks/useDashboard';
import { LogOut, ChevronLeft, ChevronRight, ChevronDown, Menu, X } from 'lucide-react';
import { formatVersion } from '../version';
import { cn } from '../lib/utils';


export default function Sidebar() {
  const { t } = useTranslation(['sidebar', 'common']);
  const { user, logout } = useAuth();
  const { licence } = useLicence();
  const { isOpen, isCollapsed, toggleSidebar, closeSidebar, toggleCollapse } = useSidebar();
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const { data: reapproStats } = useReapproStats();
  
  const allMenuItems = [
    { path: '/app', label: t('dashboard'), key: 'dashboard', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    )},
    { path: '/app/manager-dashboard', label: t('manager_sidebar'), key: 'manager_sidebar', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
    )},
    {
      label: t('ventes.title'), 
      key: 'ventes', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      ),
      submenus: [
        { path: '/app/ventes', label: t('ventes.consultation'), key: 'ventes_consultation' },
        { path: '/app/historique-ventes', label: t('ventes.historique'), key: 'ventes_historique' },
        { path: '/app/journal-caisse', label: t('ventes.journal'), key: 'ventes_journal' },
        { path: '/app/historique-clotures', label: t('ventes.clotures'), key: 'ventes_clotures' },
        { path: '/app/ordonnancier', label: t('ventes.ordonnancier'), key: 'ventes_ordonnancier' },
        { path: '/app/promotions', label: t('ventes.promotions'), key: 'ventes_promotions' },
        { path: '/app/caisse-centralisee', label: t('ventes.caisse_centralisee'), key: 'caisse' } // Keeping 'caisse' as it might be a specific top-level permission
      ]
    },
    { path: '/app/facturation', label: t('facturation'), key: 'facturation', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
    )},
    { path: '/app/produits', label: t('produits'), key: 'produits', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
    )},
    { path: '/app/catalog-dci', label: t('catalog_dci'), key: 'produits', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    )},
    { path: '/app/vitrine', label: t('vitrine'), key: 'vitrine', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
    )},
    { 
      label: t('commandes.local_title'), 
      key: 'commandes_loc', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
      ),
      submenus: [
        { path: '/app/commandes/locales', label: t('commandes.new_current'), key: 'commandes_loc_current' },
        { path: '/app/historique-achats/locales', label: t('commandes.history'), key: 'commandes_loc_history' },
      ]
    },
    { 
      label: t('commandes.direct_title'), 
      key: 'commandes_dir', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
      ),
      submenus: [
        { path: '/app/commandes/directes', label: t('commandes.new_current'), key: 'commandes_dir_current' },
        { path: '/app/historique-achats/directes', label: t('commandes.history'), key: 'commandes_dir_history' },
      ]
    },
    { path: '/app/fournisseurs', label: t('fournisseurs.title'), key: 'fournisseurs', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
    )},
    { 
      label: t('clients'), 
      key: 'clients', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      ),
      submenus: [
        { path: '/app/clients', label: t('clients_consultation', 'Consultation'), key: 'clients_consultation' },
        { path: '/app/outils/imc', label: t('clients_imc', 'Calculateur IMC'), key: 'clients_imc' },
      ]
    },
    { path: '/app/creances', label: t('creances'), key: 'creances', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
    )},
    { 
      label: t('stock.title'), 
      key: 'inventaire', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
      ),
      submenus: [
        { path: '/app/inventaire', label: t('stock.inventaire.title'), key: 'inventaire_saisie' },
        { path: '/app/journal-ajustements', label: t('stock.journal'), key: 'inventaire_journal' },
        { path: '/app/stock-analysis', label: t('stock.analyse.title'), key: 'inventaire_analyse' },
        { path: '/app/ruptures', label: t('stock.ruptures.title', 'Suivi des Ruptures'), key: 'inventaire_ruptures' },
        { path: '/app/reappro-rayon', label: t('stock.reappro.title', 'Réappro Rayon'), key: 'inventaire_reappro' },
        { path: '/app/avoirs', label: t('stock.avoirs'), key: 'inventaire_avoirs' },
        { path: '/app/promis', label: t('stock.promis'), key: 'inventaire_promis' },
        { path: '/app/transformations', label: t('stock.transformations.title'), key: 'inventaire_transformations' },
        { path: '/app/perimes', label: t('stock.perimes.title'), key: 'inventaire_perimes' },
        { path: '/app/organisation', label: t('stock.organisation.title', 'Organisation'), key: 'inventaire_organisation' },
        { path: '/app/etats-inventaire', label: t('stock.etats_inventaire.title', 'États Inventaires'), key: 'inventaire_etats' },
        { path: '/app/rapport-ug', label: t('stock.rapport_ug.title', 'Rapport Unités Gratuites (UG)'), key: 'inventaire_rapport_ug' }
      ]
    },
    { 
      label: t('statistiques.title'), 
      key: 'statistiques', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
      ),
      submenus: [
        { path: '/app/centre-rapports', label: t('statistiques.rapports'), key: 'statistiques_rapports' },
        { path: '/app/analyse-abc', label: t('statistiques.abc'), key: 'statistiques_abc' },
        { path: '/app/statistiques-fournisseurs', label: t('statistiques.fournisseurs'), key: 'statistiques_fournisseurs' },
        { path: '/app/rapports-mensuels', label: t('statistiques.mensuel'), key: 'statistiques_mensuels' },
        { path: '/app/module-financier', label: t('statistiques.finances'), key: 'statistiques_finances' },
        { path: '/app/classement-vendeurs', label: t('statistiques.classement_vendeurs', 'Classement Vendeurs'), key: 'statistiques_vendeurs' },
        { path: '/app/analyse-temporelle', label: t('statistiques.analyse_temporelle', 'Analyse Temporelle'), key: 'statistiques_temporelle' },
        { path: '/app/guide-financier', label: t('statistiques.guide', 'Guide Financier 📖'), key: 'statistiques_guide' }
      ]
    },
    { 
      path: '/app/compta/dashboard',
      label: t('compta.title', 'Comptabilité'), 
      key: 'compta', 
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
      )
    },
    {
      label: t('divers.title', 'Gestion Divers'),
      key: 'divers',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      submenus: [
        { path: '/app/divers/ca', label: t('divers.ca', 'CA Divers'), key: 'divers_ca' },
        { path: '/app/divers/commandes', label: t('divers.commandes', 'Commandes Divers'), key: 'divers_commandes' }
      ]
    },
    {
      label: t('parametres.title'),
      key: 'settings',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      ),
      submenus: [
        // { path: '/app/invoice-settings', label: t('parametres.facture'), key: 'settings_facture' }, (removed)
        { path: '/app/pharmacy-settings', label: t('parametres.pharmacie'), key: 'settings_pharmacie' },
        { path: '/app/telegram-history', label: t('parametres.telegram', 'Historique Telegram'), key: 'settings_telegram' },
        { path: '/app/systeme', label: 'Administration Système', key: 'settings_systeme' },
      ]
    },
    { path: '/app/aide-formation', label: t('aide_formation'), key: 'aide_formation', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 10 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
    )},
    { path: '/app/changelog', label: t('changelog', 'Quoi de neuf ?'), key: 'changelog', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    )},
    {
      path: '/app/utilisateurs',
      label: t('utilisateurs'),
      key: 'utilisateurs',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      )
    },
    {
      path: '/app/user-sessions',
      label: t('user_sessions_sidebar'),
      key: 'user_sessions',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      )
    },
    {
      path: '/app/journal-audit',
      label: t('audit'),
      key: 'audit',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      )
    },
    {
      path: '/app/import-dci',
      label: t('import_dci', 'Import DCI & Matching'),
      key: 'import_dci',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
      )
    },
    {
      path: '/app/maintenance',
      label: t('maintenance'),
      key: 'maintenance',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      )
    },
    {
      path: '/app/sauvegardes',
      label: t('sauvegardes', 'Sauvegardes'),
      key: 'sauvegardes',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
      )
    },
    {
      path: '/app/corbeille',
      label: t('corbeille', 'Corbeille'),
      key: 'corbeille',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      )
    }
  ];

  // Logic to calculate menuItems based on authentication
  const menuItems = allMenuItems.flatMap(item => {
    if (user?.is_superuser) return [item];
    
    const allowed = (user as any)?.allowed_menus || [];
    
    // 1. Explicit parent permission
    const hasExplicitParent = allowed.includes(item.key);

    // 2. Legacy broad categories (compatibility)
    const hasLegacyCategory = 
      (item.key === 'commandes_loc' && allowed.includes('commandes')) ||
      (item.key === 'commandes_dir' && allowed.includes('commandes')) ||
      (item.key === 'vitrine' && allowed.includes('produits'));

    if (item.submenus) {
      // Filter submenus: only show if explicitly allowed OR if parent is fully allowed
      const filteredSubmenus = item.submenus.filter(sub => {
        // Direct match for submenu
        if (allowed.includes(sub.key)) return true;
        
        // Full parent access allows all children
        if (hasExplicitParent || hasLegacyCategory) return true;

        // Specific legacy mappings (one-to-one)
        if (sub.key === 'caisse' && allowed.includes('caisse')) return true;
        if (sub.key === 'inventaire_perimes' && allowed.includes('perimes')) return true;
        if (sub.key === 'inventaire_avoirs' && allowed.includes('avoirs')) return true;
        if (sub.key === 'inventaire_promis' && allowed.includes('promis')) return true;
        
        return false;
      });
      
      return filteredSubmenus.length > 0 ? [{ ...item, submenus: filteredSubmenus }] : [];
    }
    
    const adminOnlyKeys = ['utilisateurs', 'user_sessions', 'audit', 'import_dci', 'maintenance', 'corbeille'];
    if (adminOnlyKeys.includes(item.key)) return [];
    if (item.key === 'changelog') return [item];
    return (hasExplicitParent || hasLegacyCategory || allowed.includes(item.key)) ? [item] : [];
  });



  // Effect to automatically handle expansion and collapsing
  useEffect(() => {
    // Find if current location belongs to a submenu
    const parent = menuItems.find(item => 
      item.submenus?.some(sub => location.pathname === sub.path)
    );

    if (parent) {
      setOpenMenu(parent.key);
    } else {
      // If we are not in a submenu path, check if we are in a top-level path that is NOT a submenu
      const isTopLevel = menuItems.some(item => !item.submenus && item.path === location.pathname);
      if (isTopLevel) {
        setOpenMenu(null);
      }
    }
  }, []);

  const toggleMenu = (key: string) => {
    setOpenMenu(prev => prev === key ? null : key);
  }

  const userInitials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || user.username?.[0]?.toUpperCase() || '?'
    : '?';
  const userFullName = user
    ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.username
    : '';

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={toggleSidebar}
        className="fixed top-3 left-3 z-50 lg:hidden size-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-colors"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={cn(
          "flex flex-col fixed lg:sticky top-0 z-50 transition-all duration-300 ease-in-out",
          "bg-slate-900 border-r border-slate-800",
          isCollapsed ? 'w-[70px]' : 'w-screen lg:w-[260px]',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        style={{ height: '100dvh', minHeight: '100dvh' }}
      >
        {/* ── HEADER ── */}
        <div className={cn(
          "flex items-center gap-3 px-4 py-4 border-b border-white/10",
          isCollapsed && 'justify-center px-3'
        )}>
          <div className="shrink-0">
            <ZenithLogo variant={1} size={isCollapsed ? 26 : 32} />
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-black text-white tracking-widest uppercase leading-none truncate">
                {licence?.pharmacie_nom || 'Zenith'}
              </h1>
              <p className="text-[9px] font-bold text-primary uppercase tracking-[0.2em] mt-0.5 truncate">
                {licence?.pharmacien_nom || t('app_subtitle')}
              </p>
            </div>
          )}
          {/* Collapse button desktop */}
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex shrink-0 size-7 rounded-lg bg-white/10 hover:bg-white/20 text-white/50 hover:text-white items-center justify-center transition-all"
            title={isCollapsed ? 'Déplier' : 'Replier'}
          >
            {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
        </div>

        {/* ── NAV ── */}
        <nav className="flex-1 overflow-y-auto py-2 custom-scrollbar">
          <ul className={cn(
            "flex flex-col gap-1",
            isCollapsed ? 'px-2' : 'px-3'
          )}>
            {menuItems.map((item) => {
              const hasSubmenus = !!item.submenus;
              const isParentOfActive = item.submenus?.some(sub => location.pathname.startsWith(sub.path));
              const isMenuOpen = openMenu === item.key;

              if (hasSubmenus) {
                return (
                  <li key={item.key}>
                    {isCollapsed ? (
                      <div className="relative group w-full">
                        <div
                          className={cn(
                            "flex items-center justify-center w-full h-10 rounded-xl cursor-pointer transition-all",
                            isParentOfActive
                              ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800'
                          )}
                          title={item.label}
                        >
                          <span className="size-4">{item.icon}</span>
                        </div>
                        <ul className="absolute left-full top-0 z-[100] p-2 shadow-2xl shadow-black/20 bg-slate-900 border border-slate-700 rounded-2xl w-52 ml-3 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200">
                          <li className="px-3 py-2 border-b border-slate-800 mb-1">
                            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">{item.label}</span>
                          </li>
                          {item.submenus?.map((sub) => (
                            <li key={sub.path}>
                              <NavLink to={sub.path} onClick={closeSidebar}
                                className={({ isActive }) => cn(
                                  "block rounded-lg text-sm py-2 px-3 transition-all",
                                  isActive
                                    ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                )}
                              >
                                {sub.label}
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <>
                        {/* Parent button */}
                        <button
                          onClick={() => toggleMenu(item.key)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group",
                            isMenuOpen || isParentOfActive
                              ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800'
                          )}
                        >
                          <span className={cn(
                            "size-5 shrink-0 transition-colors",
                            (isMenuOpen || isParentOfActive) && 'text-emerald-400'
                          )}>
                            {item.icon}
                          </span>
                          <span className="flex-1 text-left text-sm font-medium tracking-tight truncate">{item.label}</span>
                          <ChevronDown className={cn(
                            "size-4 shrink-0 transition-transform duration-200 text-slate-500",
                            isMenuOpen && 'rotate-180'
                          )} />
                        </button>

                        {/* Submenus with vertical connector */}
                        <div className={cn(
                          "overflow-hidden transition-all duration-300 ease-in-out",
                          isMenuOpen ? 'max-h-[600px] opacity-100 mt-1' : 'max-h-0 opacity-0'
                        )}>
                          <ul className="relative ml-4 pl-3 border-l border-slate-700 flex flex-col gap-0.5 py-1">
                            {item.submenus?.map((sub) => (
                              <li key={sub.path}>
                                <NavLink
                                  to={sub.path}
                                  onClick={closeSidebar}
                                  className={({ isActive }) => cn(
                                    "flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-all",
                                    isActive
                                      ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                  )}
                                >
                                  <span className="truncate">{sub.label}</span>
                                  {sub.key === 'inventaire_reappro' && reapproStats && reapproStats.product_count > 0 && (
                                    <span className="ml-2 shrink-0 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                      {reapproStats.product_count}
                                    </span>
                                  )}
                                </NavLink>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </>
                    )}
                  </li>
                );
              }

              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path!}
                    end={item.path === '/app'}
                    onClick={closeSidebar}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive }) => cn(
                      "flex items-center rounded-xl transition-all duration-200",
                      isCollapsed
                        ? 'justify-center w-full h-10'
                        : 'gap-3 px-3 py-2.5',
                      isActive
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    )}
                  >
                    <span className={cn("shrink-0", isCollapsed ? 'size-5' : 'size-5')}>{item.icon}</span>
                    {!isCollapsed && <span className="text-sm font-medium tracking-tight truncate">{item.label}</span>}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="shrink-0 px-4 py-3 border-t border-white/10">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-primary shadow-[0_0_6px] shadow-primary/50"></div>
            <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider truncate">Zenith OS</span>
            <span className="text-[9px] text-white/30 font-mono ml-auto" title={formatVersion()}>v{formatVersion().split('.').slice(0,2).join('.')}</span>
          </div>
        </div>
      </aside>
    </>
  );
}

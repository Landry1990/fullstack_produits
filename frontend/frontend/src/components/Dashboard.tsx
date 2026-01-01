import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import type { ProduitModel, StockLot } from '../types';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface DashboardStats {
  revenue: { value: number; change: number };
  sales: { value: number; change: number };
  clients: { value: number; change: number };
  low_stock: { value: number; change: number };
  receivables: { value: number; count: number };
  discount: { value: number; change: number };
}



interface Transaction {
  id: number;
  client: string;
  amount: number;
  date: string;
  status: string;
  status_code: string;
}

interface RevenueChartData {
  labels: string[];
  data: number[];
}

interface LowStockItem {
  id: number;
  name: string;
  stock: number;
}

interface ClientDepassement {
  id: number;
  name: string;
  plafond: number;
  dette: number;
  depassement: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [revenueChart, setRevenueChart] = useState<RevenueChartData | null>(null);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [clientsDepassement, setClientsDepassement] = useState<ClientDepassement[]>([]);
  const [expiringLots, setExpiringLots] = useState<StockLot[]>([]);
  const [expirationMonths, setExpirationMonths] = useState(1); // Délai par défaut: 1 mois
  const [ugStats, setUgStats] = useState<{ug_en_stock: number; ug_recues_mois: number; valeur_economisee: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL ?? ''),
    [],
  )
  const dashboardEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/dashboard/`
    : '/api/dashboard/'
  const produitsEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/produits/`
    : '/api/produits/'
  const ugStatsEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/stats-ug/par_fournisseur/`
    : '/api/stats-ug/par_fournisseur/'
  const stockLotsEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/stock-lots/`
    : '/api/stock-lots/'


  // Transform data for Recharts
  const chartData = useMemo(() => {
    if (!revenueChart) return [];
    return revenueChart.labels.map((label, index) => ({
      jour: label,
      montant: revenueChart.data[index]
    }));
  }, [revenueChart]);

  // Fetch expiring lots based on selected period
  useEffect(() => {
    const fetchExpiringLots = async () => {
      try {
        const today = new Date();
        const futureDate = new Date();
        futureDate.setMonth(today.getMonth() + expirationMonths);
        
        const params = new URLSearchParams({
          date_expiration_lte: futureDate.toISOString().split('T')[0],
          ordering: 'date_expiration'
        });
        
        const response = await axios.get(`${stockLotsEndpoint}?${params}`);
        const lots: StockLot[] = Array.isArray(response.data) ? response.data : (response.data.results || []);
        
        // Filter out lots that have already expired
        const validLots = lots.filter(lot => {
          if (!lot.date_expiration) return false;
          const expDate = new Date(lot.date_expiration);
          return expDate > today;
        }).slice(0, 10); // Limit to 10 lots
        
        setExpiringLots(validLots);
      } catch (err) {
        console.error('Error fetching expiring lots:', err);
      }
    };
    
    fetchExpiringLots();
  }, [stockLotsEndpoint, expirationMonths]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [statsRes, transactionsRes, chartRes, lowStockRes, ugStatsRes, clientsDepassementRes] = await Promise.all([
          axios.get(`${dashboardEndpoint}stats/`),
          axios.get(`${dashboardEndpoint}recent_transactions/`),
          axios.get(`${dashboardEndpoint}revenue_chart/`),
          axios.get(`${dashboardEndpoint}low_stock/`),
          axios.get(ugStatsEndpoint).catch(() => ({ data: null })), // Ne pas bloquer si l'endpoint UG échoue
          axios.get(`${dashboardEndpoint}clients_depassement/`).catch(() => ({ data: [] })) // Ne pas bloquer si erreur
        ]);

        setStats(statsRes.data);
        setRecentTransactions(transactionsRes.data);
        setRevenueChart(chartRes.data);
        setLowStockItems(lowStockRes.data);
        // Set UG stats if available
        if (ugStatsRes.data) {
          setUgStats(ugStatsRes.data);
        }
        // Set clients depassement
        setClientsDepassement(clientsDepassementRes.data || []);
      } catch (err) {
        console.error('Erreur lors du chargement du tableau de bord:', err);
        setError('Impossible de charger les données du tableau de bord.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dashboardEndpoint, ugStatsEndpoint]);

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center h-96">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="alert alert-error shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-base-content">Tableau de bord</h1>
          <p className="text-sm text-base-content/80">Aperçu de l'activité de la pharmacie</p>
        </div>
        <div className="text-sm font-medium text-base-content/80 bg-base-100 px-4 py-2 rounded-lg shadow-sm border border-base-200">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats && [
          { 
            title: "Chiffre d'affaires", 
            value: `${Math.round(stats.revenue.value).toLocaleString('fr-FR')} F`, 
            change: `${stats.revenue.change > 0 ? '+' : ''}${stats.revenue.change}%`, 
            icon: "💰", 
            color: "bg-emerald-100 text-emerald-700", 
            isPositive: stats.revenue.change >= 0,
            details: `Dont ${Math.round(stats.discount.value).toLocaleString('fr-FR')} F de remises`
          },
          { title: "Créances Clients", value: `${Math.round(stats.receivables?.value || 0).toLocaleString('fr-FR')} F`, change: `${stats.receivables?.count || 0} factures`, icon: "credit_card", color: "bg-orange-100 text-orange-700", isPositive: false, link: '/creances' },
          { title: "Valeur Stock", value: `${Math.round((stats as any).stock_value?.value || 0).toLocaleString('fr-FR')} F`, change: "Prix d'achat", icon: "inventory", color: "bg-amber-100 text-amber-700", isPositive: true },
          { title: "Alertes Stock", value: stats.low_stock.value, change: "Produits", icon: "warning", color: "bg-red-100 text-red-700", isPositive: false },
        ].map((stat: any, index) => {
          const content = (
            <div className={`card-body p-4 flex flex-row items-center justify-between ${stat.link ? 'cursor-pointer hover:bg-base-200/30' : ''}`}>
              <div>
                <p className="text-sm font-medium text-base-content/70">{stat.title}</p>
                <h3 className="text-2xl font-bold text-base-content mt-1">{stat.value}</h3>
                <span className={`text-xs font-medium ${stat.title === 'Alertes Stock' || stat.title === 'Valeur Stock' ? 'text-base-content/60' : stat.title === 'Créances Clients' ? 'text-orange-600' : (stat.isPositive ? 'text-emerald-600' : 'text-red-600')}`}>
                  {stat.change} <span className="text-base-content/60">{stat.title === 'Alertes Stock' ? 'en rupture ou faible' : stat.title === 'Valeur Stock' ? 'valorisation' : stat.title === 'Créances Clients' ? 'en attente' : 'vs hier'}</span>
                </span>
                {stat.details && (
                  <div className="text-xs text-base-content/50 mt-1 font-medium">
                    {stat.details}
                  </div>
                )}
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${stat.color}`}>
                {stat.icon === 'shopping_cart' && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                )}
                {stat.icon === 'group' && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                )}
                {stat.icon === 'inventory' && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                )}
                {stat.icon === 'warning' && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                )}
                {stat.icon === 'credit_card' && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                )}
                {stat.icon === '💰' && <span className="text-2xl">💰</span>}
                {stat.icon === '🏷️' && <span className="text-2xl">🏷️</span>}
              </div>
            </div>
          );

          return (
            <div key={index} className="card bg-base-100 shadow-sm border border-base-200">
              {stat.link ? (
                <Link to={stat.link} className="block h-full">
                  {content}
                </Link>
              ) : (
                content
              )}
            </div>
          );
        })}
      </div>

      {/* Section Unités Gratuites (UG) */}
      {/* Section Unités Gratuites (UG) */}
      {ugStats && (ugStats as any).results && (
        <div className="card bg-base-100 shadow-sm border border-base-200 lg:w-1/2">
          <div className="card-body p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="card-title text-lg font-bold text-base-content">Statistiques UG par Fournisseur</h2>
                <p className="text-xs text-base-content/60 mt-1">Valorisation des unités gratuites acquises, vendues et restantes</p>
              </div>
              <div className="badge badge-primary badge-lg gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                UG
              </div>
            </div>
            
            <div className="overflow-x-auto max-h-60 overflow-y-auto">
              <table className="table table-zebra w-full text-sm">
                <thead>
                  <tr className="bg-base-200/50">
                    <th className="font-bold">Fournisseur</th>
                    <th className="font-bold text-right text-purple-700">Val. Acquise</th>
                    <th className="font-bold text-right text-green-700">Val. Vendue</th>
                    <th className="font-bold text-right text-blue-700">Val. Restante</th>
                  </tr>
                </thead>
                <tbody>
                  {(ugStats as any).results.map((stat: any, index: number) => (
                    <tr key={index} className="hover:bg-base-200/50">
                      <td className="font-medium">{stat.fournisseur_nom}</td>
                      <td className="text-right font-medium text-purple-900">
                        {Math.round(stat.valeur_acquise).toLocaleString('fr-FR')} F
                      </td>
                      <td className="text-right font-medium text-green-900">
                        {Math.round(stat.valeur_vendue).toLocaleString('fr-FR')} F
                      </td>
                      <td className="text-right font-medium text-blue-900">
                        {Math.round(stat.valeur_restante).toLocaleString('fr-FR')} F
                      </td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  {(ugStats as any).results.length > 0 && (
                     <tr className="bg-base-200 font-bold border-t-2 border-base-300">
                       <td>TOTAL</td>
                       <td className="text-right text-purple-700">
                         {Math.round((ugStats as any).results.reduce((sum: number, r: any) => sum + r.valeur_acquise, 0)).toLocaleString('fr-FR')} F
                       </td>
                       <td className="text-right text-green-700">
                         {Math.round((ugStats as any).results.reduce((sum: number, r: any) => sum + r.valeur_vendue, 0)).toLocaleString('fr-FR')} F
                       </td>
                       <td className="text-right text-blue-700">
                         {Math.round((ugStats as any).results.reduce((sum: number, r: any) => sum + r.valeur_restante, 0)).toLocaleString('fr-FR')} F
                       </td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Charts & Transactions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Revenue Bar Chart */}
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body p-4">
              <h2 className="card-title text-lg font-bold text-base-content mb-4">Évolution du Chiffre d'Affaires (7 derniers jours)</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="jour" 
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    stroke="#9ca3af"
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    stroke="#9ca3af"
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.5)]}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${Math.round(value).toLocaleString('fr-FR')} F`, 'Montant']}
                    contentStyle={{ 
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  />
                  <Bar 
                    dataKey="montant" 
                    fill="url(#barGradient)" 
                    radius={[8, 8, 0, 0]}
                    animationDuration={800}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revenue Line Chart (Trend) */}
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body p-4">
              <h2 className="card-title text-lg font-bold text-base-content mb-4">Tendance des Ventes (7 derniers jours)</h2>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="jour" 
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    stroke="#9ca3af"
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    stroke="#9ca3af"
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.5)]}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${Math.round(value).toLocaleString('fr-FR')} F`, 'Chiffre d\'affaires']}
                    contentStyle={{ 
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="montant" 
                    stroke="url(#lineGradient)" 
                    strokeWidth={3}
                    dot={{ fill: '#10b981', r: 5 }}
                    activeDot={{ r: 7, fill: '#059669' }}
                    animationDuration={1000}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="card-title text-lg font-bold text-base-content">Transactions Récentes</h2>
                <Link to="/ventes" className="btn btn-ghost btn-xs text-primary">Voir tout</Link>
              </div>
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr className="text-base-content/70 border-b-base-200">
                      <th>Client</th>
                      <th>Montant</th>
                      <th>Date</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-4 text-base-content/50">Aucune transaction récente</td>
                      </tr>
                    ) : (
                      recentTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-base-200/50 border-b-base-200">
                          <td className="font-medium text-base-content">{tx.client}</td>
                          <td className="font-bold text-base-content">{Math.round(Number(tx.amount)).toLocaleString('fr-FR')} F</td>
                          <td className="text-base-content/70">
                            {new Date(tx.date).toLocaleString('fr-FR', {
                              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                          <td>
                            <span className={`badge badge-sm ${
                              tx.status_code === 'PAY' ? 'badge-success text-white' : 
                              tx.status_code === 'VAL' ? 'badge-info text-white' : 
                              'badge-warning text-warning-content'
                            }`}>
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Quick Actions & Alerts */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body p-4">
              <h2 className="card-title text-lg font-bold text-base-content mb-4">Actions Rapides</h2>
              <div className="grid grid-cols-1 gap-3">
                <Link to="/facturation" className="btn btn-primary w-full justify-start gap-3 text-white shadow-md hover:shadow-lg transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                  Nouvelle Facture
                </Link>
                <Link to="/produits" className="btn btn-outline btn-primary w-full justify-start gap-3 hover:bg-primary/10">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                  Gérer Produits
                </Link>
                <Link to="/clients" className="btn btn-outline btn-primary w-full justify-start gap-3 hover:bg-primary/10">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                  Nouveau Client
                </Link>
              </div>
            </div>
          </div>

          {/* Stock Alerts */}
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="card-title text-lg font-bold text-base-content">Alertes Stock</h2>
                {stats && stats.low_stock.value > 0 && (
                  <span className="badge badge-error text-white badge-sm">{stats.low_stock.value}</span>
                )}
              </div>
              <div className="space-y-3">
                {lowStockItems.length === 0 ? (
                  <div className="text-sm text-base-content/60 text-center py-2">Aucune alerte de stock</div>
                ) : (
                  lowStockItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-error/5 border border-error/10">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-error"></div>
                        <span className="text-sm font-medium text-base-content">{item.name}</span>
                      </div>
                      <span className="text-xs font-bold text-error">
                        {item.stock <= 0 ? 'Rupture' : `Reste: ${item.stock}`}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <Link to="/produits" className="btn btn-ghost btn-sm w-full mt-2 text-error hover:bg-error/10">
                Voir tout le stock
              </Link>
            </div>
          </div>

          {/* Credit Alerts - Clients Exceeding Plafond */}
          {clientsDepassement.length > 0 && (
            <div className="card bg-base-100 shadow-sm border border-warning/30">
              <div className="card-body p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="card-title text-lg font-bold text-base-content">⚠️ Alertes Créances</h2>
                  <span className="badge badge-warning text-white badge-sm">{clientsDepassement.length}</span>
                </div>
                <div className="space-y-3">
                  {clientsDepassement.slice(0, 5).map((client, i) => (
                    <div key={i} className="flex flex-col p-2 rounded-lg bg-warning/5 border border-warning/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-warning"></div>
                          <span className="text-sm font-medium text-base-content">{client.name}</span>
                        </div>
                        <span className="text-xs font-bold text-warning">
                          +{Math.round(client.depassement).toLocaleString('fr-FR')} F
                        </span>
                      </div>
                      <div className="text-xs text-base-content/60 mt-1 ml-4">
                        Dette: {Math.round(client.dette).toLocaleString('fr-FR')} F / Plafond: {Math.round(client.plafond).toLocaleString('fr-FR')} F
                      </div>
                    </div>
                  ))}
                </div>
                <Link to="/creances" className="btn btn-ghost btn-sm w-full mt-2 text-warning hover:bg-warning/10">
                  Voir toutes les créances
                </Link>
              </div>
            </div>
          )}

          {/* Expiring Lots */}
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="card-title text-lg font-bold text-base-content">Péremption Proche</h2>
                {expiringLots.length > 0 && (
                  <span className="badge badge-error text-white badge-sm">{expiringLots.length}</span>
                )}
              </div>
              
              {/* Period Selector */}
              <div className="form-control mb-4">
                <label className="label py-1">
                  <span className="label-text text-xs">Période d'alerte</span>
                </label>
                <select 
                  className="select select-bordered select-sm w-full"
                  value={expirationMonths}
                  onChange={(e) => setExpirationMonths(Number(e.target.value))}
                >
                  <option value={1}>1 mois</option>
                  <option value={2}>2 mois</option>
                  <option value={3}>3 mois</option>
                  <option value={6}>6 mois</option>
                  <option value={12}>1 an</option>
                </select>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {expiringLots.length === 0 ? (
                  <div className="text-sm text-base-content/60 text-center py-2">Aucun lot proche de la péremption</div>
                ) : (
                  expiringLots.map((lot, i) => {
                    const daysUntilExpiry = lot.date_expiration 
                      ? Math.floor((new Date(lot.date_expiration).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                      : 0;
                    
                    return (
                      <div key={lot.id} className="flex items-center justify-between p-2 rounded-lg bg-error/5 border border-error/10">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-2 h-2 rounded-full bg-error"></div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-base-content block truncate">{lot.produit_nom}</span>
                            <div className="flex gap-2 text-xs text-base-content/60">
                              <span>Lot: {lot.lot || 'N/A'}</span>
                              <span>•</span>
                              <span>
                                {lot.date_expiration ? new Date(lot.date_expiration).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-bold whitespace-nowrap ml-2 text-error">
                          {daysUntilExpiry} j
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
              <Link to="/produits" className="btn btn-ghost btn-sm w-full mt-2 text-error hover:bg-error/10">
                Voir tous les produits
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

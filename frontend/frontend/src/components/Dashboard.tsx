import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
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

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [revenueChart, setRevenueChart] = useState<RevenueChartData | null>(null);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiBaseUrl = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL ?? ''),
    [],
  )
  const dashboardEndpoint = apiBaseUrl
    ? `${String(apiBaseUrl).replace(/\/$/, '')}/api/dashboard/`
    : '/api/dashboard/'

  // Transform data for Recharts
  const chartData = useMemo(() => {
    if (!revenueChart) return [];
    return revenueChart.labels.map((label, index) => ({
      jour: label,
      montant: revenueChart.data[index]
    }));
  }, [revenueChart]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [statsRes, transactionsRes, chartRes, lowStockRes] = await Promise.all([
          axios.get(`${dashboardEndpoint}stats/`),
          axios.get(`${dashboardEndpoint}recent_transactions/`),
          axios.get(`${dashboardEndpoint}revenue_chart/`),
          axios.get(`${dashboardEndpoint}low_stock/`)
        ]);

        setStats(statsRes.data);
        setRecentTransactions(transactionsRes.data);
        setRevenueChart(chartRes.data);
        setLowStockItems(lowStockRes.data);
      } catch (err) {
        console.error('Erreur lors du chargement du tableau de bord:', err);
        setError('Impossible de charger les données du tableau de bord.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dashboardEndpoint]);

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
          { title: "Chiffre d'affaires", value: `${Math.round(stats.revenue.value).toLocaleString('fr-FR')} F`, change: `${stats.revenue.change > 0 ? '+' : ''}${stats.revenue.change}%`, icon: "💰", color: "bg-emerald-100 text-emerald-700", isPositive: stats.revenue.change >= 0 },
          { title: "Ventes du jour", value: stats.sales.value, change: `${stats.sales.change > 0 ? '+' : ''}${stats.sales.change}%`, icon: "shopping_cart", color: "bg-blue-100 text-blue-700", isPositive: stats.sales.change >= 0 },
          { title: "Nouveaux Clients", value: stats.clients.value, change: `${stats.clients.change > 0 ? '+' : ''}${stats.clients.change}%`, icon: "group", color: "bg-purple-100 text-purple-700", isPositive: stats.clients.change >= 0 },
          { title: "Alertes Stock", value: stats.low_stock.value, change: "Produits", icon: "warning", color: "bg-red-100 text-red-700", isPositive: false }, // Pas de variation pertinente pour le stock
        ].map((stat, index) => (
          <div key={index} className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body p-4 flex flex-row items-center justify-between">
              <div>
                <p className="text-sm font-medium text-base-content/70">{stat.title}</p>
                <h3 className="text-2xl font-bold text-base-content mt-1">{stat.value}</h3>
                <span className={`text-xs font-medium ${stat.title === 'Alertes Stock' ? 'text-base-content/60' : (stat.isPositive ? 'text-emerald-600' : 'text-red-600')}`}>
                  {stat.change} <span className="text-base-content/60">{stat.title === 'Alertes Stock' ? 'en rupture ou faible' : 'vs hier'}</span>
                </span>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${stat.color}`}>
                {stat.icon === 'shopping_cart' && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                )}
                {stat.icon === 'group' && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                )}
                {stat.icon === 'warning' && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                )}
                {stat.icon === '💰' && <span className="text-2xl">💰</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

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
        </div>
      </div>
    </div>
  );
}

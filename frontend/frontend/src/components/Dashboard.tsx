import { Link } from 'react-router-dom';

export default function Dashboard() {
  // Mock data for demonstration
  const stats = [
    { title: "Chiffre d'affaires", value: "150 000 F", change: "+12%", icon: "💰", color: "bg-emerald-100 text-emerald-700" },
    { title: "Ventes du jour", value: "24", change: "+5%", icon: "shopping_cart", color: "bg-blue-100 text-blue-700" },
    { title: "Nouveaux Clients", value: "3", change: "+1", icon: "group", color: "bg-purple-100 text-purple-700" },
    { title: "Alertes Stock", value: "5", change: "-2", icon: "warning", color: "bg-red-100 text-red-700" },
  ];

  const recentTransactions = [
    { id: 1, client: "Jean Dupont", amount: "15 000 F", date: "10:30", status: "Payé" },
    { id: 2, client: "Marie Curie", amount: "8 500 F", date: "10:15", status: "Payé" },
    { id: 3, client: "Pierre Martin", amount: "22 000 F", date: "09:45", status: "En attente" },
    { id: 4, client: "Sophie Germain", amount: "5 000 F", date: "09:30", status: "Payé" },
    { id: 5, client: "Client Comptoir", amount: "3 200 F", date: "09:15", status: "Payé" },
  ];

  const lowStockItems = [
    { name: "Doliprane 1000mg", stock: 2 },
    { name: "Efferalgan 500mg", stock: 0 },
    { name: "Spasfon", stock: 5 },
    { name: "Amoxicilline", stock: 3 },
  ];

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
        {stats.map((stat, index) => (
          <div key={index} className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body p-4 flex flex-row items-center justify-between">
              <div>
                <p className="text-sm font-medium text-base-content/70">{stat.title}</p>
                <h3 className="text-2xl font-bold text-base-content mt-1">{stat.value}</h3>
                <span className={`text-xs font-medium ${stat.change.startsWith('+') ? 'text-emerald-600' : 'text-red-600'}`}>
                  {stat.change} <span className="text-base-content/60">vs hier</span>
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
          {/* Revenue Chart (Mock Visual) */}
          <div className="card bg-base-100 shadow-sm border border-base-200">
            <div className="card-body p-4">
              <h2 className="card-title text-lg font-bold text-base-content mb-4">Évolution du Chiffre d'Affaires</h2>
              <div className="h-64 flex items-end justify-between gap-2 px-2">
                {[40, 65, 45, 80, 55, 90, 70].map((height, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 w-full group cursor-pointer">
                    <div 
                      className="w-full bg-primary/20 rounded-t-lg hover:bg-primary/40 transition-all relative group-hover:shadow-lg"
                      style={{ height: `${height}%` }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-base-content text-base-100 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {height * 1500} F
                      </div>
                    </div>
                    <span className="text-xs text-base-content/60 font-medium">
                      {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][i]}
                    </span>
                  </div>
                ))}
              </div>
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
                      <th>Heure</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-base-200/50 border-b-base-200">
                        <td className="font-medium text-base-content">{tx.client}</td>
                        <td className="font-bold text-base-content">{tx.amount}</td>
                        <td className="text-base-content/70">{tx.date}</td>
                        <td>
                          <span className={`badge badge-sm ${tx.status === 'Payé' ? 'badge-success text-white' : 'badge-warning text-warning-content'}`}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
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
                <span className="badge badge-error text-white badge-sm">5</span>
              </div>
              <div className="space-y-3">
                {lowStockItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-error/5 border border-error/10">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-error"></div>
                      <span className="text-sm font-medium text-base-content">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold text-error">
                      {item.stock === 0 ? 'Rupture' : `Reste: ${item.stock}`}
                    </span>
                  </div>
                ))}
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

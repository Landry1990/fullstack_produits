import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import produitService from '../../services/produitService';
import { formatDate } from '../../utils/dateUtils';
import { 
  History, 
  ChevronLeft, 
  Download, 
  Calendar, 
  User, 
  Search,
  Eye
} from 'lucide-react';
import { Link } from 'react-router-dom';
import PremiumModal from '../common/PremiumModal';

export default function ReapproHistory() {
  const { t } = useTranslation(['stock', 'common']);
  const [history, setHistory] = useState<any>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await produitService.getReapproHistory();
      setHistory(data);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error("Erreur lors du chargement de l'historique");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDownloadPdf = async (sessionId: number) => {
    setDownloadingId(sessionId);
    try {
      const blob = await produitService.getReapproSessionPdf(sessionId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reappro_session_${sessionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("PDF téléchargé avec succès");
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error("Erreur lors de la génération du PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  const getHistoryArray = () => {
    if (Array.isArray(history)) return history;
    if (history && typeof history === 'object' && 'results' in history && Array.isArray(history.results)) {
      return history.results;
    }
    return [];
  };

  const filteredHistory = getHistoryArray().filter((h: any) => 
    h.id.toString().includes(searchQuery) || 
    (h.user_name && h.user_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-base-200 p-6 space-y-6 font-sans">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link to="/app/reappro-rayon" className="btn btn-ghost btn-circle bg-base-100 shadow-sm border border-base-300">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-600 text-white rounded-2xl shadow-lg shadow-purple-600/20">
              <History className="size-6" />
            </div>
            <div>
                <h1 className="text-2xl font-black text-base-content tracking-tight">Historique Réappro</h1>
                <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mt-0.5">Suivi des transferts Réserve &rarr; Rayon</p>
            </div>
          </div>
        </div>

        <div className="relative max-w-md w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-base-content/30" />
          <input 
            type="text" 
            placeholder="Rechercher par N° ou utilisateur..." 
            className="input input-sm h-11 w-full pl-11 bg-base-100 border-base-300 focus:border-purple-600 rounded-xl text-sm font-bold transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-base-100 rounded-3xl shadow-sm border border-base-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="bg-base-200/30 border-b border-base-200">
                <th className="bg-transparent text-[10px] font-black uppercase tracking-widest text-base-content/40">Session</th>
                <th className="bg-transparent text-[10px] font-black uppercase tracking-widest text-base-content/40">Date & Heure</th>
                <th className="bg-transparent text-[10px] font-black uppercase tracking-widest text-base-content/40">Utilisateur</th>
                <th className="bg-transparent text-[10px] font-black uppercase tracking-widest text-base-content/40 text-center">Produits</th>
                <th className="bg-transparent text-[10px] font-black uppercase tracking-widest text-base-content/40 text-center">Unités</th>
                <th className="bg-transparent text-[10px] font-black uppercase tracking-widest text-base-content/40 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
                {loading ? (
                    <tr>
                        <td colSpan={6} className="py-24 text-center">
                            <span className="loading loading-spinner loading-lg text-purple-600"></span>
                        </td>
                    </tr>
                ) : filteredHistory.length === 0 ? (
                    <tr>
                        <td colSpan={6} className="py-24 text-center">
                            <div className="flex flex-col items-center justify-center text-base-content/20">
                                <History className="size-16 mb-4" />
                                <h3 className="text-xl font-black uppercase tracking-tight">Aucun historique trouvé</h3>
                            </div>
                        </td>
                    </tr>
                ) : (
                    filteredHistory.map((session: any) => (
                        <tr key={session.id} className="hover:bg-base-200/30 transition-all border-b border-base-200/50 group">
                            <td>
                                <span className="bg-secondary/20 text-purple-700 px-3 py-1 rounded-lg text-[10px] font-black">
                                    #{session.id}
                                </span>
                            </td>
                            <td>
                                <div className="flex items-center gap-2">
                                    <Calendar className="size-3.5 text-base-content/30" />
                                    <span className="text-xs font-bold">{new Date(session.created_at).toLocaleString()}</span>
                                </div>
                            </td>
                            <td>
                                <div className="flex items-center gap-2">
                                    <div className="size-6 bg-base-200 rounded-full flex items-center justify-center">
                                        <User className="size-3 opacity-40" />
                                    </div>
                                    <span className="text-xs font-bold">{session.user_name || 'Inconnu'}</span>
                                </div>
                            </td>
                            <td className="text-center font-black text-xs">
                                {session.total_products}
                            </td>
                            <td className="text-center font-black text-xs text-purple-600">
                                {session.total_units}
                            </td>
                            <td className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <button 
                                        onClick={() => setSelectedSession(session)}
                                        className="btn btn-sm btn-ghost hover:bg-base-200 text-[10px] font-black uppercase tracking-widest gap-2 rounded-xl"
                                    >
                                        <Eye className="size-3.5" />
                                        Voir
                                    </button>
                                    <button 
                                        onClick={() => handleDownloadPdf(session.id)}
                                        className={`btn btn-sm btn-primary bg-purple-600 hover:bg-purple-700 border-none text-[10px] font-black uppercase tracking-widest gap-2 rounded-xl shadow-md shadow-purple-600/10 ${downloadingId === session.id ? 'loading' : ''}`}
                                        disabled={downloadingId === session.id}
                                    >
                                        {!downloadingId && <Download className="size-3.5" />}
                                        PDF
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <PremiumModal
        isOpen={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        title={`Détails du réappro #${selectedSession?.id}`}
        maxWidth="max-w-2xl"
      >
        <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-base-200 p-4 rounded-2xl">
                    <p className="text-[10px] font-black text-base-content/30 uppercase tracking-widest mb-1">Résumé</p>
                    <p className="text-sm font-black whitespace-pre-wrap">
                        {selectedSession?.total_products} produits transférés<br/>
                        {selectedSession?.total_units} unités au total
                    </p>
                </div>
                <div className="bg-base-200 p-4 rounded-2xl">
                    <p className="text-[10px] font-black text-base-content/30 uppercase tracking-widest mb-1">Effectué le</p>
                    <p className="text-sm font-black">
                        {selectedSession && new Date(selectedSession.created_at).toLocaleString()}
                    </p>
                </div>
            </div>

            <div className="bg-base-100 border border-base-200 rounded-2xl overflow-hidden mb-6">
                <table className="table table-compact w-full">
                    <thead>
                        <tr className="bg-base-200 text-[9px] font-black uppercase tracking-widest">
                            <th>Produit</th>
                            <th>Lot / Exp</th>
                            <th className="text-center">Qté</th>
                        </tr>
                    </thead>
                    <tbody>
                        {selectedSession?.adjustments?.map((adj: any) => (
                            <tr key={adj.id} className="border-b border-base-100 last:border-none">
                                <td className="text-xs font-bold">{adj.produit_name}</td>
                                <td className="text-[10px]">
                                    <div className="flex flex-col">
                                        <span className="font-black text-base-content/60">{adj.lot_num}</span>
                                        <span className="opacity-40">{formatDate(adj.expiry) !== '-' ? formatDate(adj.expiry) : 'N/A'}</span>
                                    </div>
                                </td>
                                <td className="text-center font-black text-xs text-purple-600">+{adj.quantity_change}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex gap-3 mt-4">
                <button 
                    className="btn btn-ghost flex-1 h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                    onClick={() => setSelectedSession(null)}
                >
                    Fermer
                </button>
                <button 
                    className="btn btn-primary flex-1 h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-purple-600/20 bg-purple-600 hover:bg-purple-700 border-none"
                    onClick={() => handleDownloadPdf(selectedSession.id)}
                >
                    Télécharger la confirmation
                </button>
            </div>
        </div>
      </PremiumModal>

    </div>
  );
}

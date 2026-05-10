import React, { useState, useEffect } from 'react';
import { Lock, Key, ShieldAlert, CheckCircle2, Copy, Send, FileUp, Info, UserCheck, Hospital, Calendar, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useLicence } from '../context/LicenceContext';

const LicenceScreen = () => {
    const [hardwareId, setHardwareId] = useState<string>('Chargement...');
    const [cle, setCle] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ is_valid: boolean; message: string; payload?: any } | null>(null);
    const [previewData, setPreviewData] = useState<any>(null);
    const { refreshLicence } = useLicence();
    const navigate = useNavigate();

    useEffect(() => {
        // Au chargement, on récupère l'empreinte matérielle pour l'afficher
        api.get('/licence/')
            .then((res) => {
                setHardwareId(res.data.hardware_id || 'UNKNOWN');
                setStatus(res.data);
                // Si la licence est déjà valide, on redirige vers l'accueil
                if (res.data.is_valid) {
                    navigate('/');
                }
            })
            .catch((err) => {
                console.error("Erreur lecture licence", err);
                setHardwareId('UNKNOWN');
            });
    }, [navigate]);

    const handleCopy = () => {
        navigator.clipboard.writeText(hardwareId);
        toast.success('ID Matériel copié ! Envoyez-le à votre administrateur.');
    };


    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            if (content) {
                // On demande une prévisualisation au backend
                setLoading(true);
                try {
                    const res = await api.post('/licence/', { cle: content.trim(), preview: true });
                    setCle(content.trim()); // <--- CRITIQUE : On mémorise la clé ici
                    setPreviewData(res.data);
                    toast.success('Informations de licence chargées !');
                } catch (error: any) {
                    toast.error(error.response?.data?.detail || 'Fichier de licence invalide ou corrompu');
                    setCle('');
                    setPreviewData(null);
                } finally {
                    setLoading(false);
                }
            }
        };
        reader.readAsText(file);
    };

    const handleConfirmActivation = async () => {
        if (!cle) return;
        setLoading(true);
        try {
            const res = await api.post('/licence/', { cle });
            toast.success(res.data.detail || 'Licence activée avec succès !');
            await refreshLicence(); // On rafraîchit les infos globales (nom pharmacie, etc)
            setTimeout(() => {
                window.location.href = '/'; 
            }, 1500);
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Erreur lors de l\'activation');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            {/* Arrière-plan dynamique */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px]" />
                <div className="absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-purple-600/20 blur-[120px]" />
            </div>

            <div className="relative w-full max-w-xl bg-slate-800/80 backdrop-blur-xl border border-slate-700 rounded-3xl shadow-2xl p-8 md:p-10">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center size-20 rounded-full bg-red-500/10 mb-4 ring-4 ring-red-500/20">
                        <Lock className="size-10 text-red-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Système Verrouillé</h1>
                    <p className="text-slate-400">
                        {status?.message || "Une licence valide est requise pour utiliser cette application."}
                    </p>
                </div>

                {/* Empreinte Matérielle Box */}
                <div className="bg-slate-900/50 rounded-2xl p-5 mb-8 border border-slate-700/50">
                    <div className="flex items-start gap-4">
                        <ShieldAlert className="size-6 text-blue-400 flex-shrink-0 mt-1" />
                        <div className="flex-1">
                            <h3 className="text-sm font-medium text-slate-300 mb-1">
                                Empreinte Matérielle de cette machine
                            </h3>
                            <p className="text-xs text-slate-500 mb-3">
                                Transmettez ce code à votre administrateur pour lier votre licence à cet ordinateur.
                            </p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 block px-3 py-2 bg-slate-950 text-blue-300 rounded-lg text-sm font-mono border border-slate-800">
                                    {hardwareId}
                                </code>
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                                    title="Copier l'ID"
                                >
                                    <Copy className="size-5" />
                                </button>
                            </div>
                            
                            {/* Bouton rapide WhatsApp */}
                            <div className="mt-3">
                                <button
                                    type="button"
                                    onClick={() => window.open(`https://wa.me/237XXXXXXXXX?text=${encodeURIComponent(`Bonjour ! Voici l'identifiant matériel de mon ordinateur pour générer ma licence de pharmacie :\n\n💻 *${hardwareId}*\n\nMerci.`)}`, '_blank')}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 rounded-md text-xs font-medium transition-colors border border-[#25D366]/20"
                                >
                                    <Send className="size-3.5" />
                                    Envoyer mon ID par WhatsApp au Technicien
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Preview Card ou Zone d'Import */}
                {previewData ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6">
                            <div className="flex items-center gap-2 text-blue-400 mb-4">
                                <Info className="size-5" />
                                <h3 className="font-bold">Détails de la licence</h3>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center gap-3">
                                    <Hospital className="size-5 text-slate-500" />
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Pharmacie</p>
                                        <p className="text-white text-sm">{previewData.pharmacie_nom}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <UserCheck className="size-5 text-slate-500" />
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Pharmacien</p>
                                        <p className="text-white text-sm">{previewData.pharmacien_nom}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <ShieldAlert className="size-5 text-slate-500" />
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Plan</p>
                                        <p className={`text-sm font-bold ${previewData.plan === 'PREMIUM' ? 'text-amber-400' : 'text-blue-400'}`}>
                                            {previewData.plan}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Calendar className="size-5 text-slate-500" />
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Expire le</p>
                                        <p className="text-white text-sm">
                                            {new Date(previewData.exp * 1000).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {!previewData.hardware_match && (
                                <div className="mt-6 flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                                    <AlertTriangle className="size-5 flex-shrink-0" />
                                    <p className="text-xs">
                                        Attention : Cette licence n'est pas prévue pour cet ordinateur. L'activation échouera.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleConfirmActivation}
                                disabled={loading || !previewData.hardware_match}
                                className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
                            >
                                {loading ? <span className="size-6 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Confirmer l'activation"}
                            </button>
                            <button
                                onClick={() => { setPreviewData(null); setCle(''); }}
                                className="w-full py-3 text-slate-400 hover:text-white text-xs transition-colors"
                            >
                                Annuler et choisir un autre fichier
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2 text-center">
                                Avez-vous reçu votre fichier de licence ?
                            </label>
                            
                            <div className="relative group">
                                <input 
                                    type="file" 
                                    accept=".lic,.txt" 
                                    onChange={handleFileUpload}
                                    disabled={loading}
                                    className="absolute inset-0 size-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed" 
                                />
                                <div className="w-full flex flex-col items-center justify-center gap-3 py-10 px-6 bg-slate-900/50 border-2 border-dashed border-slate-600 group-hover:border-blue-500 rounded-xl transition-all">
                                    {loading ? (
                                        <span className="size-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <div className="p-3 bg-blue-500/10 rounded-full text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                                <FileUp className="size-8" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-medium text-white mb-1">
                                                    Cliquez pour importer votre fichier
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    Format supporté : .lic
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-8 text-center text-xs text-slate-500">
                    <p>Protected by Advanced RSA Cryptography</p>
                </div>
            </div>
        </div>
    );
};

export default LicenceScreen;

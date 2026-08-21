import React, { useState, useEffect } from 'react';
import { Lock, ShieldAlert, Copy, Send, FileUp, Info, UserCheck, Hospital, Calendar, AlertTriangle } from 'lucide-react';
import { gooeyToast } from 'goey-toast';
import api from '../services/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLicence } from '../context/LicenceContext';
import { useTranslation } from 'react-i18next';
import { logger } from '../utils/logger'

interface PreviewData {
  pharmacie_nom: string;
  pharmacien_nom: string;
  plan: string;
  exp: number;
  hardware_match: boolean;
  install_before?: string | null;
  install_expired?: boolean;
}

const LicenceScreen = () => {
    const { t } = useTranslation('auth');
    const [hardwareId, setHardwareId] = useState<string>(t('loading', { ns: 'common' }));
    const [cle, setCle] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ is_valid: boolean; message: string; payload?: Record<string, unknown> } | null>(null);
    const [previewData, setPreviewData] = useState<PreviewData | null>(null);
    const [sudoPassword, setSudoPassword] = useState('');
    const { refreshLicence } = useLicence();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isUpdateMode = searchParams.get('update') === '1';

    useEffect(() => {
        // Au chargement, on récupère l'empreinte matérielle pour l'afficher
        api.get('/licence/')
            .then((res) => {
                setHardwareId(res.data.hardware_id || 'UNKNOWN');
                setStatus(res.data);
                // Si la licence est déjà valide, on redirige vers l'accueil
                // sauf en mode mise à jour explicite (banner "Mettre à jour")
                if (res.data.is_valid && !isUpdateMode) {
                    navigate('/');
                }
            })
            .catch((err) => {
                logger.error("Erreur lecture licence", err);
                setHardwareId('UNKNOWN');
            });
    }, [navigate, isUpdateMode]);

    const handleCopy = () => {
        navigator.clipboard.writeText(hardwareId);
        gooeyToast.success(t('licence.copy_success'));
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
                    gooeyToast.success(t('licence.file_loaded'));
                } catch (error: unknown) {
                    const detail = error && typeof error === 'object' && 'response' in error ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail : undefined;
                    gooeyToast.error(detail || t('licence.file_invalid'));
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
        if (!sudoPassword) {
            gooeyToast.error(t('licence.sudo_required', { defaultValue: 'Mot de passe ou code journalier requis' }));
            return;
        }
        setLoading(true);
        try {
            // On envoie sudo_password ET keyday — le backend valide l'un ou l'autre.
            // Si le code fait 6 caractères alphanumériques, c'est probablement un keyday.
            const isKeyday = /^[A-Z0-9]{6}$/.test(sudoPassword.trim().toUpperCase());
            const payload: Record<string, string> = { cle };
            if (isKeyday) {
                payload.keyday = sudoPassword.trim().toUpperCase();
            } else {
                payload.sudo_password = sudoPassword;
            }
            const res = await api.post('/licence/', payload);
            gooeyToast.success(res.data.detail || t('licence.activate_success'));
            await refreshLicence(); // On rafraîchit les infos globales (nom pharmacie, etc)
            setTimeout(() => {
                window.location.href = '/'; 
            }, 1500);
        } catch (error: unknown) {
            const detail = error && typeof error === 'object' && 'response' in error ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail : undefined;
            gooeyToast.error(detail || t('licence.activate_error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            {/* Arrière-plan dynamique */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px]" />
                <div className="absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-purple-600/20 blur-[120px]" />
            </div>

            <div className="relative w-full max-w-xl bg-slate-800/80 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl p-8 md:p-10">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center size-20 rounded-full bg-red-500/10 mb-4 ring-4 ring-red-500/20">
                        <Lock className="size-10 text-red-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">{t('licence.locked_title')}</h1>
                    <p className="text-base-content/50">
                        {status?.message || t('licence.locked_message')}
                    </p>
                </div>

                {/* Empreinte Matérielle Box */}
                <div className="bg-slate-900/50 rounded-2xl p-5 mb-8 border border-slate-700/50">
                    <div className="flex items-start gap-4">
                        <ShieldAlert className="size-6 text-blue-400 flex-shrink-0 mt-1" />
                        <div className="flex-1">
                            <h3 className="text-sm font-medium text-slate-300 mb-1">
                                {t('licence.hardware_id_label')}
                            </h3>
                            <p className="text-xs text-base-content/60 mb-3">
                                {t('licence.hardware_id_help')}
                            </p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 block px-3 py-2 bg-slate-950 text-blue-300 rounded-lg text-sm font-mono border border-slate-800">
                                    {hardwareId}
                                </code>
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="p-2 text-base-content/50 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                                    title={t('system_admin:licence.copy_id')}
                                >
                                    <Copy className="size-5" />
                                </button>
                            </div>
                            
                            {/* Bouton rapide WhatsApp */}
                            <div className="mt-3">
                                <button
                                    type="button"
                                    onClick={() => window.open(`https://wa.me/237XXXXXXXXX?text=${encodeURIComponent(t('licence.whatsapp_msg', { id: hardwareId }))}`, '_blank')}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 rounded-md text-xs font-medium transition-colors border border-[#25D366]/20"
                                >
                                    <Send className="size-3.5" />
                                    {t('licence.whatsapp_btn')}
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
                                <h3 className="font-bold">{t('licence.details')}</h3>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center gap-3">
                                    <Hospital className="size-5 text-base-content/60" />
                                    <div>
                                        <p className="text-[10px] text-base-content/60 uppercase font-bold">{t('licence.pharmacy')}</p>
                                        <p className="text-white text-sm">{previewData.pharmacie_nom}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <UserCheck className="size-5 text-base-content/60" />
                                    <div>
                                        <p className="text-[10px] text-base-content/60 uppercase font-bold">{t('licence.pharmacist')}</p>
                                        <p className="text-white text-sm">{previewData.pharmacien_nom}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <ShieldAlert className="size-5 text-base-content/60" />
                                    <div>
                                        <p className="text-[10px] text-base-content/60 uppercase font-bold">{t('licence.plan')}</p>
                                        <p className={`text-sm font-bold ${previewData.plan === 'PREMIUM' ? 'text-amber-400' : 'text-blue-400'}`}>
                                            {previewData.plan}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Calendar className="size-5 text-base-content/60" />
                                    <div>
                                        <p className="text-[10px] text-base-content/60 uppercase font-bold">{t('licence.expires')}</p>
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
                                        {t('licence.hardware_mismatch')}
                                    </p>
                                </div>
                            )}

                            {/* Date limite d'installation (TTL 10 jours) */}
                            {previewData.install_before && (
                                <div className={`mt-4 flex items-start gap-3 p-3 rounded-xl ${
                                    previewData.install_expired
                                        ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                                        : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                                }`}>
                                    <Calendar className="size-5 flex-shrink-0" />
                                    <p className="text-xs">
                                        {previewData.install_expired
                                            ? t('licence.install_expired', {
                                                defaultValue: `Cette licence a expiré — elle devait être installée avant le ${previewData.install_before}. Demandez une nouvelle licence.`
                                              })
                                            : t('licence.install_before_msg', {
                                                defaultValue: `À installer avant le ${previewData.install_before} (TTL 10 jours après génération)`
                                              })
                                        }
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3">
                            {/* Mot de passe admin OU code journalier requis pour activation */}
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                    {t('licence.sudo_label', { defaultValue: 'Mot de passe admin ou code journalier' })}
                                </label>
                                <input
                                    type="password"
                                    value={sudoPassword}
                                    onChange={(e) => setSudoPassword(e.target.value)}
                                    placeholder={t('licence.sudo_placeholder', { defaultValue: 'Mot de passe admin OU code à 6 caractères (support)' })}
                                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                                    autoComplete="off"
                                />
                                <p className="text-[10px] text-slate-500 mt-1">
                                    {t('licence.sudo_hint', { defaultValue: "Mot de passe admin OU code journalier fourni par le support" })}
                                </p>
                            </div>

                            <button
                                onClick={handleConfirmActivation}
                                disabled={loading || !previewData.hardware_match || !sudoPassword || previewData.install_expired}
                                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                            >
                                {loading ? <span className="size-6 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : t('licence.confirm_activation')}
                            </button>
                            <button
                                onClick={() => { setPreviewData(null); setCle(''); }}
                                className="w-full py-3 text-base-content/50 hover:text-white text-xs transition-colors"
                            >
                                {t('licence.cancel_file')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2 text-center">
                                {t('licence.file_label')}
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
                                                    {t('licence.file_click')}
                                                </p>
                                                <p className="text-xs text-base-content/60">
                                                    {t('licence.file_format')}
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-8 text-center text-xs text-base-content/60">
                    <p>{t('licence.protected_by')}</p>
                </div>
            </div>
        </div>
    );
};

export default LicenceScreen;

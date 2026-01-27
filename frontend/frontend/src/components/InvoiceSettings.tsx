import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { safeStorage } from '../utils/storage';

interface InvoiceSettings {
    id?: number;
    company_name: string;
    company_address: string;
    footer_text: string;
    header_layout: 'split' | 'left' | 'center' | 'right';
    primary_color: string;
    centralized_cash_register?: boolean;
}

const InvoiceSettings: React.FC = () => {
    const [settings, setSettings] = useState<InvoiceSettings>({
        company_name: '',
        company_address: '',
        footer_text: '',
        header_layout: 'split',
        primary_color: '#000000',
        centralized_cash_register: false
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const token = safeStorage.getItem('authToken');
            const res = await axios.get(`${apiBaseUrl}/invoice-settings/`, {
                headers: { Authorization: `Token ${token}` }
            });
            setSettings(res.data);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching settings:", err);
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const token = safeStorage.getItem('authToken');
            // Toujours utiliser PUT sur l'endpoint racine, le backend gère le singleton
            await axios.put(`${apiBaseUrl}/invoice-settings/`, settings, {
                headers: { Authorization: `Token ${token}` }
            });

            setMessage({ type: 'success', text: 'Paramètres enregistrés avec succès !' });
            // Re-fetch to ensure sync
            fetchSettings();
        } catch (err) {
            console.error("Error saving settings:", err);
            setMessage({ type: 'error', text: 'Erreur lors de l\'enregistrement.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8">Chargement...</div>;

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-800">Personnalisation de la Facture</h1>

            {message && (
                <div className={`p-4 mb-6 rounded ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Formulaire */}
                <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Informations</h2>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entreprise</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                            value={settings.company_name}
                            onChange={(e) => setSettings({...settings, company_name: e.target.value})}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Adresse & Coordonnées</label>
                        <textarea 
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 h-24"
                            value={settings.company_address}
                            onChange={(e) => setSettings({...settings, company_address: e.target.value})}
                            placeholder="Adresse, Téléphone, Email..."
                        />
                        <p className="text-xs text-gray-500 mt-1">Les sauts de ligne seront respectés.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Pied de page (Remerciements, etc.)</label>
                        <textarea 
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 h-20"
                            value={settings.footer_text}
                            onChange={(e) => setSettings({...settings, footer_text: e.target.value})}
                        />
                    </div>

                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Couleur Principale</label>
                        <div className="flex items-center space-x-3">
                            <input 
                                type="color" 
                                className="h-10 w-20 border-0 p-0 rounded cursor-pointer"
                                value={settings.primary_color}
                                onChange={(e) => setSettings({...settings, primary_color: e.target.value})}
                            />
                            <span className="text-gray-600 font-mono">{settings.primary_color}</span>
                        </div>
                        </div>

                    <div className="pt-4 border-t border-gray-100">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input 
                                type="checkbox"
                                className="toggle toggle-success"
                                checked={settings.centralized_cash_register || false}
                                onChange={(e) => setSettings({...settings, centralized_cash_register: e.target.checked})}
                            />
                            <div>
                                <span className="block text-sm font-medium text-gray-700">Mode Caisse Centralisée</span>
                                <span className="block text-xs text-gray-500">Si activé, seuls les utilisateurs autorisés peuvent encaisser. Les autres envoient les commandes en attente.</span>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Layout Selector & Preview */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-semibold mb-4 text-gray-700">Mise en page de l'en-tête</h2>
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { id: 'split', label: 'Séparé', desc: 'Logo G / Info D' },
                                { id: 'left', label: 'Gauche', desc: 'Tout aligné à gauche' },
                                { id: 'center', label: 'Centré', desc: 'Tout centré' },
                                { id: 'right', label: 'Droite', desc: 'Tout aligné à droite' },
                            ].map((layout) => (
                                <button
                                    key={layout.id}
                                    onClick={() => setSettings({...settings, header_layout: layout.id as any})}
                                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                                        settings.header_layout === layout.id 
                                        ? 'border-blue-500 bg-blue-50' 
                                        : 'border-gray-200 hover:border-blue-300'
                                    }`}
                                >
                                    <div className="font-semibold text-gray-800">{layout.label}</div>
                                    <div className="text-xs text-gray-500">{layout.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mini Preview Mockup */}
                    <div className="bg-gray-100 p-4 rounded-lg border border-gray-300">
                        <h3 className="text-xs uppercase font-bold text-gray-400 mb-2 text-center">Aperçu Simplifié (Entête)</h3>
                        <div className="bg-white p-4 shadow-sm min-h-[150px] text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
                            {/* Dynamic Layout Rendering for Preview */}
                            {settings.header_layout === 'split' && (
                                <div className="flex justify-between items-start">
                                    <div className="w-1/2">
                                        <div style={{ color: settings.primary_color, fontSize: '1.2em', fontWeight: 'bold' }}>{settings.company_name || 'Nom Société'}</div>
                                        <div className="text-xs text-gray-600 whitespace-pre-line">{settings.company_address || 'Adresse...'}</div>
                                    </div>
                                    <div className="w-1/2 text-right">
                                        <div className="font-bold">FACTURE N°...</div>
                                        <div className="text-xs">Date: ...</div>
                                    </div>
                                </div>
                            )}

                            {settings.header_layout === 'left' && (
                                <div className="text-left">
                                     <div style={{ color: settings.primary_color, fontSize: '1.2em', fontWeight: 'bold' }}>{settings.company_name || 'Nom Société'}</div>
                                     <div className="text-xs text-gray-600 whitespace-pre-line mb-4">{settings.company_address || 'Adresse...'}</div>
                                     <div className="font-bold">FACTURE N°...</div>
                                </div>
                            )}

                            {settings.header_layout === 'center' && (
                                <div className="text-center">
                                     <div style={{ color: settings.primary_color, fontSize: '1.2em', fontWeight: 'bold' }}>{settings.company_name || 'Nom Société'}</div>
                                     <div className="text-xs text-gray-600 whitespace-pre-line mb-4">{settings.company_address || 'Adresse...'}</div>
                                     <div className="font-bold">FACTURE N°...</div>
                                </div>
                            )}
                             {settings.header_layout === 'right' && (
                                <div className="text-right">
                                     <div style={{ color: settings.primary_color, fontSize: '1.2em', fontWeight: 'bold' }}>{settings.company_name || 'Nom Société'}</div>
                                     <div className="text-xs text-gray-600 whitespace-pre-line mb-4">{settings.company_address || 'Adresse...'}</div>
                                     <div className="font-bold">FACTURE N°...</div>
                                </div>
                            )}
                             <div className="mt-8 border-t pt-2">
                                <div className="h-6 w-full opacity-20 mb-1" style={{ backgroundColor: settings.primary_color }}></div>
                                <div className="h-2 w-full bg-gray-100 mb-1"></div>
                                <div className="h-2 w-full bg-gray-100"></div>
                             </div>
                        </div>
                    </div>

                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-bold hover:bg-blue-700 transition duration-200 disabled:opacity-50"
                    >
                        {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InvoiceSettings;

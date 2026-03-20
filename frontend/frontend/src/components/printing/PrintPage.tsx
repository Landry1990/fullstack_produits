
import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import InvoiceTemplate, { type InvoiceData, type PharmacySettings } from './InvoiceTemplate';
import { safeStorage } from '../../utils/storage';

const PrintPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
    const [settings, setSettings] = useState<PharmacySettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

    const [searchParams] = useSearchParams();
    const clientNameOverride = searchParams.get('client_name');
    const type = searchParams.get('type');

    useEffect(() => {
        const fetchData = async () => {
            console.log("PrintPage: fetchData called for ID:", id);
            
            // Safety timeout to prevent infinite loading
            const safetyTimeout = setTimeout(() => {
                if (loading) {
                    console.error("PrintPage: Fetch timed out");
                    setError("Délai d'attente dépassé pour le chargement de la facture.");
                    setLoading(false);
                }
            }, 10000);

            try {
                const token = safeStorage.getItem('authToken');
                console.log("PrintPage: Token present?", !!token);
                
                if (!token) {
                    setError("Authentification requise");
                    setLoading(false);
                    clearTimeout(safetyTimeout);
                    return;
                }

                const config = { headers: { Authorization: `Token ${token}` } };
                
                const endpoints = [
                    `${apiBaseUrl}/factures/${id}/print_data/`,
                    `${apiBaseUrl}/invoice-settings/`,
                    `${apiBaseUrl}/pharmacy-settings/`
                ];
                console.log("PrintPage: Fetching from endpoints:", endpoints);

                // Parallel fetch
                const [invoiceRes, invoiceSettingsRes, pharmacySettingsRes] = await Promise.all([
                    axios.get(endpoints[0], config),
                    axios.get(endpoints[1], config),
                    axios.get(endpoints[2], config)
                ]);

                console.log("PrintPage: Data received", { 
                    invoice: invoiceRes.status, 
                    invoiceSettings: invoiceSettingsRes.status,
                    pharmacySettings: pharmacySettingsRes.status 
                });

                // Merge settings: 
                // Identity from PharmacySettings (name, address, logo, niu, rc, phone, email)
                // Styling from InvoiceSettings (primaryColor, headerLayout)
                const mergedSettings: PharmacySettings = {
                    ...pharmacySettingsRes.data,
                    // Map InvoiceSettings fields if they exist and are preferred
                    primary_color: invoiceSettingsRes.data.primary_color || pharmacySettingsRes.data.primary_color,
                    // If PharmacySettings doesn't have a logo but InvoiceSettings does (rare but possible)
                    logo: pharmacySettingsRes.data.logo || invoiceSettingsRes.data.logo,
                };

                // Transform invoice data if needed, but serializer should match interface
                let data = invoiceRes.data;
                
                // Override client name logic
                const effectiveClientName = clientNameOverride || data.client_name_override;

                if (effectiveClientName) {
                    data = {
                        ...data,
                        client: {
                            ...(data.client || {}),
                            name: effectiveClientName
                        }
                    };
                }

                setInvoiceData(data);
                setSettings(mergedSettings);
                
                clearTimeout(safetyTimeout);
                setLoading(false);

            } catch (err) {
                clearTimeout(safetyTimeout);
                console.error("PrintPage: Error fetching print data:", err);
                setError("Erreur lors du chargement de la facture. " + (err instanceof Error ? err.message : String(err)));
                setLoading(false);
            }
        };

        if (id) {
            fetchData();
        } else {
            console.error("PrintPage: No ID found in params");
            setError("ID de facture manquant");
            setLoading(false);
        }
    }, [id, clientNameOverride]);

    const [isPrinting, setIsPrinting] = useState(false);

    const handlePrint = async () => {
        if (isPrinting) return;
        setIsPrinting(true);
        console.log("Print requested by user");
        
        // Small delay to let UI update and ensure browser is ready
        setTimeout(() => {
            try {
                window.focus();
                window.print();
            } catch (err) {
                console.error("Print execution failed:", err);
                alert("Impossible de lancer l'impression. Veuillez utiliser le raccourci Ctrl+P.");
            } finally {
                setIsPrinting(false);
            }
        }, 100);
    };

    // Auto-print removed to avoid freezing
    /*
    useEffect(() => {
        // ... previous auto-print logic
    }, []); 
    */

    if (loading) return <div className="flex items-center justify-center h-screen">Chargement de la facture...</div>;
    if (error) return <div className="flex items-center justify-center h-screen text-red-600 font-bold">{error}</div>;
    if (!invoiceData || !settings) return <div>Données incomplètes</div>;

    return (
        <div className="print-page bg-gray-100 min-h-screen p-8">
            <style>
                {`
                    @media print {
                        @page { margin: 10mm; size: A4; }
                        body { margin: 0; background: white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                        .no-print { display: none !important; }
                        .print-page { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    }
                `}
            </style>
            
            <div className="no-print fixed top-4 right-4 z-50 flex gap-4">
                <button 
                    onClick={handlePrint}
                    disabled={isPrinting}
                    className={`px-6 py-2 rounded-lg shadow-lg font-bold transition-colors ${
                        isPrinting 
                        ? 'bg-blue-400 cursor-wait text-white' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                >
                    {isPrinting ? 'Impression...' : 'Imprimer'}
                </button>
                <button 
                    onClick={() => window.close()}
                    className="bg-gray-600 text-white px-6 py-2 rounded-lg shadow-lg hover:bg-gray-700"
                >
                    Fermer
                </button>
            </div>

            <InvoiceTemplate 
                settings={settings} 
                data={invoiceData} 
                isBonDeLivraison={type === 'BL'}
            />
        </div>
    );
};

export default PrintPage;

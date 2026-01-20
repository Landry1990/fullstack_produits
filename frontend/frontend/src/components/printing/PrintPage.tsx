
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import InvoiceTemplate, { type InvoiceData, type PharmacySettings } from './InvoiceTemplate';

const PrintPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
    const [settings, setSettings] = useState<PharmacySettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = sessionStorage.getItem('authToken');
                if (!token) {
                    setError("Authentification requise");
                    setLoading(false);
                    return;
                }

                const config = { headers: { Authorization: `Token ${token}` } };

                // Parallel fetch
                const [invoiceRes, settingsRes] = await Promise.all([
                    axios.get(`${apiBaseUrl}/factures/${id}/print_data/`, config),
                    axios.get(`${apiBaseUrl}/invoice-settings/`, config)
                ]);

                // Transform invoice data if needed, but serializer should match interface
                setInvoiceData(invoiceRes.data);
                setSettings(settingsRes.data);
                
                setLoading(false);

                // Auto-print after a short delay to ensure rendering
                setTimeout(() => {
                    window.print();
                }, 1000);

            } catch (err) {
                console.error("Error fetching print data:", err);
                setError("Erreur lors du chargement de la facture.");
                setLoading(false);
            }
        };

        if (id) {
            fetchData();
        }
    }, [id]);

    if (loading) return <div className="flex items-center justify-center h-screen">Chargement de la facture...</div>;
    if (error) return <div className="flex items-center justify-center h-screen text-red-600 font-bold">{error}</div>;
    if (!invoiceData || !settings) return <div>Données incomplètes</div>;

    return (
        <div className="print-page bg-gray-100 min-h-screen p-8">
            <style>
                {`
                    @media print {
                        @page { margin: 0; size: auto; }
                        body { margin: 0; background: white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                        .no-print { display: none !important; }
                        .print-page { padding: 0 !important; background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    }
                `}
            </style>
            
            <div className="no-print fixed top-4 right-4 z-50 flex gap-4">
                <button 
                    onClick={() => window.print()}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow-lg hover:bg-blue-700 font-bold"
                >
                    Imprimer
                </button>
                <button 
                    onClick={() => window.close()}
                    className="bg-gray-600 text-white px-6 py-2 rounded-lg shadow-lg hover:bg-gray-700"
                >
                    Fermer
                </button>
            </div>

            <InvoiceTemplate settings={settings} data={invoiceData} />
        </div>
    );
};

export default PrintPage;

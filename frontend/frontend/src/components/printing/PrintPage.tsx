
import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import InvoiceTemplate, { type InvoiceData, type PharmacySettings } from './InvoiceTemplate';
import InventairePrintTemplate, { type InventairePrintData } from './InventairePrintTemplate';
import StockValuationTemplate, { type StockValuationData } from './StockValuationTemplate';

const PrintPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
    const [settings, setSettings] = useState<PharmacySettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [searchParams] = useSearchParams();
    const clientNameOverride = searchParams.get('client_name');
    const type = searchParams.get('type');

    const [inventoryData, setInventoryData] = useState<any>(null);
    const [stockValuationData, setStockValuationData] = useState<StockValuationData | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            console.log("PrintPage: fetchData called for ID:", id, "Type:", type);
            
            // Safety timeout to prevent infinite loading
            const safetyTimeout = setTimeout(() => {
                if (loading) {
                    console.error("PrintPage: Fetch timed out");
                    setError("Délai d'attente dépassé pour le chargement du document.");
                    setLoading(false);
                }
            }, 10000);

            try {
                // Fetch settings first (needed for both types)
                const [invoiceSettingsRes, pharmacySettingsRes] = await Promise.all([
                    api.get('invoice-settings/'),
                    api.get('pharmacy-settings/')
                ]);

                const mergedSettings: PharmacySettings = {
                    ...pharmacySettingsRes.data,
                    primary_color: invoiceSettingsRes.data.primary_color || pharmacySettingsRes.data.primary_color,
                    logo: pharmacySettingsRes.data.logo || invoiceSettingsRes.data.logo,
                };
                setSettings(mergedSettings);

                // Fetch document data based on type
                if (type === 'INVENTAIRE') {
                    // Logic for "Etat Inventaire" (rolling inventory)
                    const groupBy = searchParams.get('group_by');
                    const stockDisplay = searchParams.get('stock_display');
                    const filterId = searchParams.get('filter_id');
                    
                    let url = `produits/etat-inventaire/pdf/?format=json&group_by=${groupBy}&stock_display=${stockDisplay}`;
                    if (filterId) url += `&filter_id=${filterId}`;
                    
                    const res = await api.get(url);
                    setInventoryData({
                        ...res.data,
                        is_report: false
                    });
                } else if (type === 'INVENTAIRE_REPORT') {
                    // Specific inventory results (discrepancy report)
                    const res = await api.get(`inventaires/${id}/print_data/`);
                    setInventoryData(res.data);
                } else if (type === 'STOCK_VALUATION') {
                    const valorisation = searchParams.get('valorisation') || 'ACHAT';
                    const groupBy = searchParams.get('group_by') || '';
                    const res = await api.get(`rapports/valeur_stock_json/?valorisation=${valorisation}&group_by=${groupBy}`);
                    setStockValuationData(res.data);
                } else {
                    // Default to Invoice
                    const invoiceRes = await api.get(`factures/${id}/print_data/`);
                    
                    let data = invoiceRes.data;
                    const effectiveClientName = clientNameOverride || data.client_name_override;
                    if (effectiveClientName) {
                        data = { ...data, client: { ...(data.client || {}), name: effectiveClientName } };
                    }
                    setInvoiceData(data);
                }
                
                clearTimeout(safetyTimeout);
                setLoading(false);

            } catch (err) {
                clearTimeout(safetyTimeout);
                console.error("PrintPage: Error fetching print data:", err);
                setError("Erreur lors du chargement des données. " + (err instanceof Error ? err.message : String(err)));
                setLoading(false);
            }
        };

        fetchData();
    }, [id, clientNameOverride, type, searchParams]);

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

    if (loading) return <div className="flex items-center justify-center h-screen">Chargement du document...</div>;
    if (error) return <div className="flex items-center justify-center h-screen text-red-600 font-bold">{error}</div>;
    if (!settings || (!invoiceData && !inventoryData && !stockValuationData)) return <div>Données incomplètes</div>;

    return (
        <div className="print-page bg-base-200 min-h-screen p-8">
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

            {inventoryData ? (
                <InventairePrintTemplate 
                    settings={settings} 
                    data={inventoryData} 
                />
            ) : invoiceData ? (
                <InvoiceTemplate 
                    settings={settings} 
                    data={invoiceData} 
                    isBonDeLivraison={type === 'BL'}
                />
            ) : stockValuationData ? (
                <StockValuationTemplate 
                    settings={settings} 
                    data={stockValuationData} 
                />
            ) : null}
        </div>
    );
};

export default PrintPage;

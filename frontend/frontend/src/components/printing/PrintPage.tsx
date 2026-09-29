
import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { gooeyToast } from 'goey-toast';
import { useLicence } from '../../context/LicenceContext';
import { useDocumentLocale } from '../../context/PharmacySettingsContext';
import InvoiceTemplate, { type InvoiceData, type PharmacySettings } from './InvoiceTemplate';
import InventairePrintTemplate, { type InventairePrintData } from './InventairePrintTemplate';
import StockValuationTemplate, { type StockValuationData } from './StockValuationTemplate';
import AvoirPrintTemplate, { type AvoirData } from './AvoirPrintTemplate';
import RecapTemplate, { type RecapData } from './RecapTemplate';
import { logger } from '../../utils/logger'

const PrintPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { licence } = useLicence();
    const { lang: docLang } = useDocumentLocale();
    const { t } = useTranslation(['printing', 'common'], { lng: docLang });
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
    const [settings, setSettings] = useState<PharmacySettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [searchParams, setSearchParams] = useSearchParams();
    const clientNameOverride = searchParams.get('client_name');
    const type = searchParams.get('type');
    const formatParam = searchParams.get('format');
    const parseFormat = (v: string | null): 'A4' | 'A5' | 'A5L' => {
        if (v === 'a5l' || v === 'A5L') return 'A5L';
        if (v === 'a5' || v === 'A5') return 'A5';
        return 'A4';
    };
    const [paperSize, setPaperSize] = useState<'A4' | 'A5' | 'A5L'>(parseFormat(formatParam));

    useEffect(() => {
        const desired = paperSize === 'A4' ? undefined : paperSize === 'A5L' ? 'a5l' : 'a5';
        const current = searchParams.get('format');
        if (desired !== current) {
            const next = new URLSearchParams(searchParams);
            if (desired) next.set('format', desired);
            else next.delete('format');
            setSearchParams(next, { replace: true });
        }
    }, [paperSize, searchParams, setSearchParams]);

    const [inventoryData, setInventoryData] = useState<InventairePrintData | null>(null);
    const [stockValuationData, setStockValuationData] = useState<StockValuationData | null>(null);
    const [avoirData, setAvoirData] = useState<AvoirData | null>(null);
    const [recapData, setRecapData] = useState<RecapData | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            
            // Safety timeout — plus long pour les états d'inventaire volumineux
            const isInventaire = type === 'INVENTAIRE';
            const timeoutMs = isInventaire ? 60000 : 15000;
            const safetyTimeout = setTimeout(() => {
                if (loading) {
                    logger.error("PrintPage: Fetch timed out");
                    setError(t('printing:print_page.timeout_error'));
                    setLoading(false);
                }
            }, timeoutMs);

            try {
                // Fetch settings first (needed for both types)
                const [invoiceSettingsRes, pharmacySettingsRes] = await Promise.all([
                    api.get('invoice-settings/'),
                    api.get('pharmacy-settings/')
                ]);

                const mergedSettings: PharmacySettings = {
                    ...pharmacySettingsRes.data,
                    pharmacy_name: licence?.pharmacie_nom || pharmacySettingsRes.data.pharmacy_name,
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
                } else if (type === 'INVENTAIRE_REPORT' || type === 'INVENTAIRE_TAKE') {
                    // Specific inventory results (discrepancy report or take sheet)
                    const groupBy = searchParams.get('group_by') || 'rayon';
                    const res = await api.get(`inventaires/${id}/print_data/?group_by=${groupBy}`);
                    setInventoryData(res.data);
                } else if (type === 'STOCK_VALUATION') {
                    const valorisation = searchParams.get('valorisation') || 'ACHAT';
                    const groupBy = searchParams.get('group_by') || '';
                    const res = await api.get(`rapports/valeur_stock_json/?valorisation=${valorisation}&group_by=${groupBy}`);
                    setStockValuationData(res.data);
                } else if (type === 'AVOIR') {
                    const res = await api.get(`avoirs/${id}/print_data/`);
                    setAvoirData(res.data.avoir);
                } else if (type === 'RECAP') {
                    // Recap data is passed via sessionStorage
                    const stored = sessionStorage.getItem('recap_print_data');
                    if (stored) {
                      setRecapData(JSON.parse(stored));
                      sessionStorage.removeItem('recap_print_data');
                    } else {
                      throw new Error(t('printing:print_page.data_not_found'));
                    }
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
                logger.error("PrintPage: Error fetching print data:", err);
                setError(t('printing:print_page.load_error', { detail: err instanceof Error ? err.message : String(err) }));
                setLoading(false);
            }
        };

        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, clientNameOverride, type, searchParams]);

    const [isPrinting, setIsPrinting] = useState(false);

    const handlePrint = async () => {
        if (isPrinting) return;
        setIsPrinting(true);
        
        // Small delay to let UI update and ensure browser is ready
        setTimeout(() => {
            try {
                window.focus();
                window.print();
            } catch (err) {
                logger.error("Print execution failed:", err);
                gooeyToast.error(t('printing:print_page.print_failed'));
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

    if (loading) return <div className="flex items-center justify-center h-screen">{t('printing:print_page.loading')}</div>;
    if (error) return <div className="flex items-center justify-center h-screen text-error font-bold">{error}</div>;
    if (!settings || (!invoiceData && !inventoryData && !stockValuationData && !avoirData && !recapData)) return <div>{t('printing:print_page.incomplete_data')}</div>;

    return (
        <div className="print-page bg-base-200 min-h-screen p-8">
            <style>
                {`
                    @media print {
                        @page { margin: 10mm; size: ${paperSize === 'A4' ? 'A4' : paperSize === 'A5L' ? 'A5 landscape' : 'A5 portrait'}; }
                        html, body, #root { margin: 0; width: 100%; height: auto; overflow: visible; background: white; -webkit-print-color-adjust: economy; print-color-adjust: economy; }
                        .no-print { display: none !important; }
                        .print-page { display: block !important; min-height: 0 !important; overflow: visible !important; padding: 0 !important; background: white !important; }

                        /* Alléger les documents : moins de gras, de couleur et de bordures */
                        .font-black, .font-bold, .font-semibold, .font-extrabold { font-weight: 500 !important; }
                        .uppercase, .tracking-widest, .tracking-wider, .tracking-tighter, .tracking-tight { text-transform: none !important; letter-spacing: 0 !important; }
                        .print-page, .print-page * { background-color: transparent !important; background-image: none !important; color: #000 !important; }
                        [class*="border-2"] { border-width: 0.5px !important; }
                        [class*="border-b-2"] { border-bottom-width: 0.5px !important; }
                        [class*="border-t-2"] { border-top-width: 0.5px !important; }
                        [class*="border-l-2"] { border-left-width: 0.5px !important; }
                        [class*="border-r-2"] { border-right-width: 0.5px !important; }
                        [class*="border-slate-900"], [class*="border-black"] { border-color: #999 !important; }
                        [class*="border-base-200"], [class*="border-base-300"] { border-color: #ccc !important; }
                        [class*="shadow-sm"], [class*="shadow-md"], [class*="shadow-lg"] { box-shadow: none !important; }
                    }
                `}
            </style>
            
            <div className="no-print fixed top-4 right-4 z-50 flex gap-4">
                <div className="bg-white rounded-lg shadow-lg p-1 flex gap-1">
                    <button
                        type="button"
                        onClick={() => setPaperSize('A4')}
                        className={`px-3 py-2 rounded-md text-sm font-bold ${paperSize === 'A4' ? 'bg-info text-white' : 'text-base-content hover:bg-base-200'}`}
                    >
                        A4
                    </button>
                    <button
                        type="button"
                        onClick={() => setPaperSize('A5L')}
                        className={`px-3 py-2 rounded-md text-sm font-bold ${paperSize === 'A5L' ? 'bg-info text-white' : 'text-base-content hover:bg-base-200'}`}
                    >
                        A5 paysage
                    </button>
                    <button
                        type="button"
                        onClick={() => setPaperSize('A5')}
                        className={`px-3 py-2 rounded-md text-sm font-bold ${paperSize === 'A5' ? 'bg-info text-white' : 'text-base-content hover:bg-base-200'}`}
                    >
                        A5 portrait
                    </button>
                </div>
                <button 
                    onClick={handlePrint}
                    disabled={isPrinting}
                    className={`px-6 py-2 rounded-lg shadow-lg font-bold transition-colors ${
                        isPrinting 
                        ? 'bg-blue-400 cursor-wait text-white' 
                        : 'bg-info hover:bg-info-focus text-white'
                    }`}
                >
                    {isPrinting ? t('printing:print_page.printing') : t('common:print')}
                </button>
                <button 
                    onClick={() => window.close()}
                    className="bg-gray-600 text-white px-6 py-2 rounded-lg shadow-lg hover:bg-gray-700"
                >
                    {t('common:close')}
                </button>
            </div>

            {inventoryData ? (
                <InventairePrintTemplate 
                    settings={settings} 
                    data={inventoryData} 
                />
            ) : avoirData ? (
                <AvoirPrintTemplate
                    settings={settings}
                    data={avoirData}
                />
            ) : recapData ? (
                <RecapTemplate
                    settings={settings}
                    data={recapData}
                />
            ) : invoiceData ? (
                <InvoiceTemplate 
                    settings={settings} 
                    data={invoiceData} 
                    isBonDeLivraison={type === 'BL'}
                    paperSize={paperSize}
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

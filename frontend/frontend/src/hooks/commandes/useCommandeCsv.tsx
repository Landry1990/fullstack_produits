import type React from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import type { CommandeProduit, ProduitModel } from '../../types';
import { normalizeNumberInput } from '../../utils/formatters';
import { parseCsvPrice } from '../../utils/commandes/csvImportHelpers';
import produitService from '../../services/produitService';

export interface UseCommandeCsvProps {
    commandeProduits: CommandeProduit[];
    setCommandeProduits: (lines: CommandeProduit[] | ((prev: CommandeProduit[]) => CommandeProduit[])) => void;
    commandeType: 'LOC' | 'DIR' | 'DIV';
    tauxChange: string;
    produitsList: ProduitModel[];
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    setIsImporting: (v: boolean) => void;
}

export interface UseCommandeCsvResult {
    handleCsvImport: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    handleCsvExport: (wholesaler: 'PRINCIPAL' | 'SECONDAIRE' | 'SECONDAIRE_CIP3') => void;
}

export function useCommandeCsv({
    commandeProduits,
    setCommandeProduits,
    commandeType,
    tauxChange,
    produitsList,
    fileInputRef,
    setIsImporting,
}: UseCommandeCsvProps): UseCommandeCsvResult {
    const { t } = useTranslation(['orders', 'common']);

    const handleCsvImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImporting(true);

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (!text) {
                setIsImporting(false);
                return;
            }

            const lines = text.split(/\r\n|\n/);
            const currentList = [...commandeProduits];
            let productsFound = 0;
            let productsNotFound = 0;
            const notFoundItems: { cip: string; qty: number }[] = [];
            const rows: { cleanCip: string; qty: number; prixCession: string | null; prixPublic: string | null }[] = [];
            const seenCips = new Set<string>();

            let isFirstLine = true;
            for (const line of lines) {
                if (!line.trim()) continue;

                // Ignorer la ligne d'en-tête
                if (isFirstLine) {
                    isFirstLine = false;
                    if (line.toLowerCase().includes('cip') || line.toLowerCase().includes('libell') || line.toLowerCase().includes('ean')) {
                        continue;
                    }
                }

                const cols = line.split(';');
                const cip = cols[0];
                if (!cip) continue;

                const cleanCip = cip.trim();
                const qty = normalizeNumberInput(cols[1]) || 0;
                const prixCession = parseCsvPrice(cols[2]);
                const prixPublic = parseCsvPrice(cols[3]);

                rows.push({ cleanCip, qty, prixCession, prixPublic });
                seenCips.add(cleanCip);
            }

            if (rows.length === 0) {
                setIsImporting(false);
                return;
            }

            let matchedProducts: ProduitModel[] = [];
            try {
                matchedProducts = await produitService.getByCips(Array.from(seenCips));
            } catch (err) {
                console.error('Failed to match CSV CIPs:', err);
                toast.error(t('orders:messages.import_load_error'));
                setIsImporting(false);
                return;
            }

            const normalizeCip = (cip: string | null | undefined): string => {
                if (!cip) return '';
                return cip.trim().toUpperCase().replace(/[\s\-.]/g, '');
            };

            const matchProduct = (cleanCip: string): ProduitModel | undefined => {
                const searchCip = normalizeCip(cleanCip);
                const numericSearch = searchCip.replace(/^0+/, '');
                return matchedProducts.find(p => {
                    const norm1 = normalizeCip(p.cip1);
                    const norm2 = normalizeCip(p.cip2);
                    const norm3 = normalizeCip(p.cip3);
                    if (norm1 === searchCip || norm2 === searchCip || norm3 === searchCip) return true;
                    if (numericSearch) {
                        const num1 = norm1.replace(/^0+/, '');
                        const num2 = norm2.replace(/^0+/, '');
                        const num3 = norm3.replace(/^0+/, '');
                        if (num1 === numericSearch || num2 === numericSearch || num3 === numericSearch) return true;
                    }
                    return false;
                });
            };

            for (const row of rows) {
                const product = matchProduct(row.cleanCip);
                if (product) {
                    productsFound++;
                    const existingIndex = currentList.findIndex(
                        p => (typeof p.produit === 'object' ? p.produit.id : p.produit) === product.id
                    );

                    const priceFromSystem = product.cost_price || '0';
                    const finalPrice = row.prixCession || priceFromSystem;
                    const finalPriceCost = row.prixCession || priceFromSystem;
                    const finalSellingPrice = row.prixPublic || product.selling_price || '0';

                    if (existingIndex !== -1) {
                        const currentQty = normalizeNumberInput(String(currentList[existingIndex].quantity || 0));
                        const currentUg = normalizeNumberInput(String(currentList[existingIndex].unites_gratuites || 0));
                        const currentItem = currentList[existingIndex];
                        const currentPrice = normalizeNumberInput(String(currentItem.price || 0));
                        const currentPriceCost = normalizeNumberInput(String(currentItem.price_cost || 0));
                        const currentSellingPrice = normalizeNumberInput(String(currentItem.selling_price || 0));

                        const updatedPrice = row.prixCession || (currentPrice > 0 ? String(currentPrice) : priceFromSystem);
                        const updatedPriceCost = row.prixCession || (currentPriceCost > 0 ? String(currentPriceCost) : priceFromSystem);
                        const updatedSellingPrice = row.prixPublic || (currentSellingPrice > 0 ? String(currentSellingPrice) : (product.selling_price || '0'));

                        currentList[existingIndex] = {
                            ...currentItem,
                            quantity: currentQty + row.qty,
                            unites_gratuites: currentUg,
                            price: updatedPrice,
                            price_cost: updatedPriceCost,
                            selling_price: updatedSellingPrice,
                        };
                    } else {
                        const newCommandeProduit: CommandeProduit = {
                            id: Date.now() + Math.random(),
                            produit: product,
                            quantity: row.qty,
                            unites_gratuites: 0,
                            prix_euro: commandeType === 'DIR' ? (finalPrice ? (normalizeNumberInput(finalPrice) / normalizeNumberInput(tauxChange)).toFixed(0) : '0') : undefined,
                            price: finalPrice,
                            price_cost: finalPriceCost,
                            tva: product.tva || '0',
                            marge: product.taux_marge || '1.3',
                            selling_price: finalSellingPrice,
                            lot: '',
                            date_expiration: '',
                        };
                        currentList.push(newCommandeProduit);
                    }
                } else {
                    console.warn(`[CSV Import] CIP non trouvé: "${row.cleanCip}"`);
                    notFoundItems.push({ cip: row.cleanCip, qty: row.qty });
                    productsNotFound++;
                }
            }

            setCommandeProduits(currentList);

            if (productsNotFound > 0) {
                const txtContent = notFoundItems.map(item => `${item.cip};${item.qty}`).join('\n');
                const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
                const link = document.createElement('a');
                const importReportUrl = URL.createObjectURL(blob);
                const dateStr = new Date().toISOString().slice(0, 10);
                link.href = importReportUrl;
                link.download = `produits_non_reconnus_${dateStr}.txt`;
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(importReportUrl);

                toast.error(t('orders:messages.csv_partial_import', { found: productsFound, notFound: productsNotFound }));
            } else {
                toast.success(t('orders:messages.csv_import_success', { count: productsFound }));
            }

            if (fileInputRef.current) fileInputRef.current.value = '';
            setIsImporting(false);
        };
        reader.readAsText(file);
    };

    const handleCsvExport = (wholesaler: 'PRINCIPAL' | 'SECONDAIRE' | 'SECONDAIRE_CIP3') => {
        if (commandeProduits.length === 0) {
            toast(t('orders:messages.csv_empty_order'), { icon: <AlertTriangle className="h-4 w-4 text-amber-500" /> });
            return;
        }

        const cipLabel = wholesaler === 'PRINCIPAL' ? 'CIP1' : wholesaler === 'SECONDAIRE' ? 'CIP2' : 'CIP3';
        const dateStr = new Date().toISOString().slice(0, 10);

        let csvContent = "";
        let exportedCount = 0;
        const skippedProducts: { nom: string; qty: number }[] = [];

        commandeProduits.forEach(item => {
            const product = typeof item.produit === 'object' ? item.produit : produitsList.find(p => p.id === item.produit);
            const produitId = typeof item.produit === 'object' ? item.produit.id : item.produit;
            const nom = (typeof item.produit === 'object' ? item.produit?.name : product?.name) || t('orders:messages.product_reference', { id: String(produitId || t('common:unknown')) });
            const qty = item.quantity || 0;

            if (!product) {
                skippedProducts.push({ nom, qty });
                return;
            }

            let code = '';
            if (wholesaler === 'PRINCIPAL')           code = product.cip1 || '';
            else if (wholesaler === 'SECONDAIRE')       code = product.cip2 || '';
            else if (wholesaler === 'SECONDAIRE_CIP3')  code = product.cip3 || product.cip2 || '';

            if (code) {
                csvContent += `${code};${qty}\n`;
                exportedCount++;
            } else {
                skippedProducts.push({ nom: product.name || nom, qty });
            }
        });

        // Télécharger le CSV si au moins 1 produit exportable
        if (exportedCount > 0) {
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `commande_${wholesaler}_${dateStr}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }

        // Générer un fichier .txt listant les produits sans CIP
        if (skippedProducts.length > 0) {
            const lines = [
                t('orders:messages.csv_skipped_file_header', { wholesaler, code: cipLabel }),
                t('orders:messages.csv_skipped_file_date', { date: dateStr }),
                ``,
                ...skippedProducts.map(p => t('orders:messages.csv_skipped_file_line', { nom: p.nom, qty: p.qty }))
            ];
            const txtBlob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
            const txtLink = document.createElement("a");
            const txtUrl = URL.createObjectURL(txtBlob);
            txtLink.setAttribute("href", txtUrl);
            txtLink.setAttribute("download", `produits_sans_${cipLabel}_${dateStr}.txt`);
            txtLink.style.visibility = 'hidden';
            document.body.appendChild(txtLink);
            txtLink.click();
            document.body.removeChild(txtLink);
            URL.revokeObjectURL(txtUrl);

            if (exportedCount === 0) {
                toast(t('orders:messages.csv_no_exported', { skipped: skippedProducts.length, code: cipLabel }), { icon: <AlertTriangle className="h-4 w-4 text-amber-500" /> });
            } else {
                toast(t('orders:messages.csv_partial_exported', { exported: exportedCount, skipped: skippedProducts.length, code: cipLabel }), { icon: <AlertTriangle className="h-4 w-4 text-amber-500" /> });
            }
        } else if (exportedCount > 0) {
            toast.success(t('orders:messages.csv_export_success', { count: exportedCount, wholesaler }));
        }
    };

    return {
        handleCsvImport,
        handleCsvExport,
    };
}

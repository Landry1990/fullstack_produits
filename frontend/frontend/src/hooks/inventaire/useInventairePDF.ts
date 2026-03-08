import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Inventaire, LigneInventaire, ProduitModel } from '../../types';

// PDF Export capabilities extracted from Inventaire.tsx
interface UseInventairePDFProps {
    t: (key: string, options?: Record<string, string | number | boolean>) => string;
}

export const useInventairePDF = ({ t }: UseInventairePDFProps) => {

    const generateEtatPDF = (activeInventaire: Inventaire, lignes: LigneInventaire[]) => {
        if (!activeInventaire || !lignes.length) return;

        const doc = new jsPDF();

        // Header
        doc.setFontSize(14);
        doc.text(t('stock.inventaire.pdf.title_etat', { id: activeInventaire.id }), 14, 15);
        doc.setFontSize(10);
        doc.text(t('stock.inventaire.pdf.date', { date: new Date(activeInventaire.date).toLocaleDateString('fr-FR') }), 14, 22);
        doc.text(t('stock.inventaire.pdf.desc', { desc: activeInventaire.description || '' }), 14, 28);

        // Group lines by Rayon
        const grouped: Record<string, LigneInventaire[]> = {};
        lignes.forEach(l => {
            const rayon = (l.produit as ProduitModel).rayon_name || l.produit_rayon || "AUTRES";
            if (!grouped[rayon]) grouped[rayon] = [];
            grouped[rayon].push(l);
        });

        const sortedRayons = Object.keys(grouped).sort();
        let currentY = 40;
        let totalGlobal = 0;

        sortedRayons.forEach(rayon => {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(t('stock.inventaire.pdf.rayon', { name: rayon }), 14, currentY);
            currentY += 2;

            // Sort alphabetical within Rayon
            const rayonItems = grouped[rayon].sort((a, b) => {
                const nameA = (a.produit as any).name || a.produit_nom || '';
                const nameB = (b.produit as any).name || b.produit_nom || '';
                return nameA.localeCompare(nameB);
            });

            const tableBody = rayonItems.map(l => {
                const pmpVal = parseFloat(l.pmp_snapshot || '0');
                const val = l.ecart * pmpVal;
                totalGlobal += val;

                const prodName = (l.produit as any).name || l.produit_nom || 'Produit';

                return [
                    (l.produit as any).id?.toString() || l.produit.toString(),
                    prodName.substring(0, 50),
                    pmpVal.toFixed(0),
                    l.stock_theorique.toString(),
                    l.quantite_physique.toString(),
                    l.ecart > 0 ? `+ ${l.ecart} ` : l.ecart.toString(),
                    val > 0 ? `+ ${val.toFixed(0)} ` : val.toFixed(0)
                ];
            });

            const totalRayon = grouped[rayon].reduce((acc, l) => {
                const pmpVal = parseFloat(l.pmp_snapshot) > 0 ? parseFloat(l.pmp_snapshot) : parseFloat((l.produit as any).cost_price || '0');
                return acc + (l.ecart * pmpVal);
            }, 0);

            tableBody.push(['', '', '', '', '', t('stock.inventaire.pdf.total_rayon'), totalRayon > 0 ? `+ ${totalRayon.toFixed(0)} ` : totalRayon.toFixed(0)]);

            autoTable(doc, {
                startY: currentY,
                head: [[
                    t('stock.inventaire.pdf.col_id'),
                    t('stock.inventaire.pdf.col_product'),
                    t('stock.inventaire.pdf.col_pmp'),
                    t('stock.inventaire.pdf.col_theo'),
                    t('stock.inventaire.pdf.col_phys'),
                    t('stock.inventaire.pdf.col_gap'),
                    t('stock.inventaire.pdf.col_val')
                ]],
                body: tableBody,
                theme: 'plain',
                styles: {
                    fontSize: 8,
                    cellPadding: 1,
                    overflow: 'linebreak',
                    lineWidth: 0.1,
                    lineColor: [0, 0, 0]
                },
                headStyles: {
                    fontStyle: 'bold',
                    fillColor: false,
                    textColor: [0, 0, 0],
                    lineWidth: 0.1,
                    lineColor: [0, 0, 0]
                },
                columnStyles: {
                    0: { cellWidth: 15 },
                    1: { cellWidth: 80 },
                    2: { cellWidth: 20, halign: 'right' },
                    3: { cellWidth: 15, halign: 'right' },
                    4: { cellWidth: 15, halign: 'right' },
                    5: { cellWidth: 15, halign: 'right' },
                    6: { cellWidth: 25, halign: 'right' }
                },
            });

            currentY = (doc as any).lastAutoTable.finalY + 10;
        });

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(t('stock.inventaire.pdf.total_global', {
            sign: totalGlobal > 0 ? '+' : '',
            amount: totalGlobal.toFixed(0)
        }), 14, currentY);

        doc.save(`inventaire_${activeInventaire.id} _etat.pdf`);
    };

    const generateEcartsPDF = (activeInventaire: Inventaire, lignes: LigneInventaire[]) => {
        if (!activeInventaire || !lignes.length) return;

        const doc = new jsPDF();

        // Header
        doc.setFontSize(14);
        doc.text(t('stock.inventaire.pdf.title_ecarts', { id: activeInventaire.id }), 14, 15);
        doc.setFontSize(10);
        doc.text(t('stock.inventaire.pdf.date', { date: new Date(activeInventaire.date).toLocaleDateString('fr-FR') }), 14, 22);

        // Filter lines with discrepancies
        const linesWithGaps = lignes.filter(l => l.ecart !== 0);

        if (linesWithGaps.length === 0) {
            doc.text(t('stock.inventaire.pdf.no_gaps'), 14, 35);
            doc.save(`inventaire_${activeInventaire.id} _ecarts.pdf`);
            return;
        }

        // Group by Rayon
        const grouped: Record<string, LigneInventaire[]> = {};
        linesWithGaps.forEach(l => {
            const rayon = (l.produit as ProduitModel).rayon_name || l.produit_rayon || "AUTRES";
            if (!grouped[rayon]) grouped[rayon] = [];
            grouped[rayon].push(l);
        });

        const sortedRayons = Object.keys(grouped).sort();
        let currentY = 35;
        let totalGlobal = 0;

        sortedRayons.forEach(rayon => {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(t('stock.inventaire.pdf.rayon', { name: rayon }), 14, currentY);
            currentY += 2;

            // Sort items alphabetically within Rayon
            const rayonItems = grouped[rayon].sort((a, b) => {
                const nameA = (a.produit as any).name || a.produit_nom || '';
                const nameB = (b.produit as any).name || b.produit_nom || '';
                return nameA.localeCompare(nameB);
            });

            const tableBody = rayonItems.map(l => {
                let pmpVal = parseFloat(l.pmp_snapshot || '0');
                if (pmpVal === 0) pmpVal = parseFloat(l.produit_cost_price || '0');
                if (pmpVal === 0 && (l.produit as any).cost_price) pmpVal = parseFloat((l.produit as any).cost_price || '0');

                const val = l.ecart * pmpVal;
                totalGlobal += val;

                const prodName = (l.produit as any).name || l.produit_nom || 'Produit';

                return [
                    (l.produit as any).id?.toString() || l.produit.toString(),
                    prodName.substring(0, 50),
                    pmpVal.toFixed(0),
                    l.stock_theorique.toString(),
                    l.quantite_physique.toString(),
                    l.ecart > 0 ? `+ ${l.ecart} ` : l.ecart.toString(),
                    val > 0 ? `+ ${val.toFixed(0)} ` : val.toFixed(0)
                ];
            });

            // Total Rayon
            const totalRayon = grouped[rayon].reduce((acc, l) => {
                const pmpVal = parseFloat(l.pmp_snapshot) > 0 ? parseFloat(l.pmp_snapshot) : parseFloat((l.produit as any).cost_price || '0');
                return acc + (l.ecart * pmpVal);
            }, 0);

            tableBody.push(['', '', '', '', '', t('stock.inventaire.pdf.total_rayon'), totalRayon > 0 ? `+ ${totalRayon.toFixed(0)} ` : totalRayon.toFixed(0)]);

            autoTable(doc, {
                startY: currentY,
                head: [[
                    t('stock.inventaire.pdf.col_id'),
                    t('stock.inventaire.pdf.col_product'),
                    t('stock.inventaire.pdf.col_pmp'),
                    t('stock.inventaire.pdf.col_theo'),
                    t('stock.inventaire.pdf.col_phys'),
                    t('stock.inventaire.pdf.col_gap'),
                    t('stock.inventaire.pdf.col_val')
                ]],
                body: tableBody,
                theme: 'plain',
                styles: {
                    fontSize: 8,
                    cellPadding: 1,
                    overflow: 'linebreak',
                    lineWidth: 0.1,
                    lineColor: [0, 0, 0]
                },
                headStyles: {
                    fontStyle: 'bold',
                    fillColor: false,
                    textColor: [0, 0, 0],
                    lineWidth: 0.1,
                    lineColor: [0, 0, 0]
                },
                columnStyles: {
                    0: { cellWidth: 15 },
                    1: { cellWidth: 80 },
                    2: { cellWidth: 20, halign: 'right' },
                    3: { cellWidth: 15, halign: 'right' },
                    4: { cellWidth: 15, halign: 'right' },
                    5: { cellWidth: 15, halign: 'right' },
                    6: { cellWidth: 25, halign: 'right' }
                },
                didDrawPage: (data) => {
                    if (data.cursor) {
                        currentY = data.cursor.y + 10;
                    }
                }
            });

            currentY = (doc as any).lastAutoTable.finalY + 10;
        });

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(t('stock.inventaire.pdf.total_global', {
            sign: totalGlobal > 0 ? '+' : '',
            amount: totalGlobal.toFixed(0)
        }), 14, currentY);

        doc.save(`inventaire_${activeInventaire.id} _ecarts.pdf`);
    };

    return {
        generateEtatPDF,
        generateEcartsPDF
    };
};

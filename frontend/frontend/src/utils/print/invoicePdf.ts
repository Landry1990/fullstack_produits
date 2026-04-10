import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatNumber, formatDateFr } from '../../utils/formatters';

interface InvoicePdfData {
    numero_facture: string;
    date: string;
    client_name: string;
    client_phone?: string;
    items: Array<{
        name: string;
        quantity: number;
        price: number;
        total: number;
        tva?: number;
    }>;
    totals: {
        ht: number;
        tva: number;
        ttc: number;
        remise: number;
        net: number;
        part_assurance?: number;
        part_client?: number;
    };
    pharmacy: {
        pharmacy_name: string;
        address?: string;
        phone?: string;
        niu?: string;
        registre_commerce?: string;
    };
    user_name?: string;
}

/**
 * Génère un PDF A4 pour une facture
 */
export function generateInvoiceA4(data: InvoicePdfData): jsPDF {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Helper pour formater proprement les nombres pour le PDF
    const fmt = (val: number, dec: number = 0) => {
        return formatNumber(val, dec).replace(/[\u00A0\u202F]/g, ' ');
    };

    // --- Header ---
    doc.setFontSize(20);
    doc.text(data.pharmacy.pharmacy_name, 20, 20);

    doc.setFontSize(10);
    let currentY = 28;
    if (data.pharmacy.address) {
        doc.text(data.pharmacy.address, 20, currentY);
        currentY += 5;
    }
    if (data.pharmacy.phone) {
        doc.text(`Tél: ${data.pharmacy.phone}`, 20, currentY);
        currentY += 5;
    }
    if (data.pharmacy.niu) {
        doc.text(`NIU: ${data.pharmacy.niu}`, 20, currentY);
        currentY += 5;
    }

    // --- Invoice Info ---
    doc.setFontSize(14);
    doc.text(`FACTURE N° ${data.numero_facture}`, pageWidth - 80, 20);

    doc.setFontSize(10);
    doc.text(`Date: ${formatDateFr(data.date)}`, 15, 65);
    doc.text(`Client: ${data.client_name}`, pageWidth - 80, 34);
    if (data.client_phone) {
        doc.text(`Tél Client: ${data.client_phone}`, pageWidth - 80, 40);
    }

    // --- Table ---
    const tableData = data.items.map(item => [
        item.name,
        item.quantity.toString(),
        fmt(item.price),
        fmt(item.total)
    ]);

    autoTable(doc, {
        startY: 50,
        head: [['Désignation', 'Qté', 'P.U', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        styles: { fontSize: 9 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: 30, halign: 'right' },
            3: { cellWidth: 30, halign: 'right' }
        }
    });

    // --- Totals ---
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const totalsX = pageWidth - 90;

    doc.text(`Total HT:`, totalsX, finalY);
    doc.text(`${fmt(data.totals.ht)} F`, pageWidth - 20, finalY, { align: 'right' });

    doc.text(`Remise:`, totalsX, finalY + 6);
    doc.text(`${fmt(data.totals.remise)} F`, pageWidth - 20, finalY + 6, { align: 'right' });

    doc.text(`TVA:`, totalsX, finalY + 12);
    doc.text(`${fmt(data.totals.tva)} F`, pageWidth - 20, finalY + 12, { align: 'right' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`NET À PAYER:`, totalsX, finalY + 20);
    doc.text(`${fmt(data.totals.net)} F`, pageWidth - 20, finalY + 20, { align: 'right' });

    if (data.totals.part_assurance && data.totals.part_assurance > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Dont Assurance:`, totalsX, finalY + 28);
        doc.text(`${fmt(data.totals.part_assurance)} F`, pageWidth - 20, finalY + 28, { align: 'right' });

        doc.text(`Part Patient:`, totalsX, finalY + 34);
        doc.text(`${fmt(data.totals.part_client || 0)} F`, pageWidth - 20, finalY + 34, { align: 'right' });
    }

    // --- Footer ---
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Validé par: ${data.user_name || 'Pharmacien'}`, 20, doc.internal.pageSize.height - 20);
    doc.text(`Imprimé le ${new Date().toLocaleString()}`, pageWidth - 20, doc.internal.pageSize.height - 20, { align: 'right' });

    return doc;
}

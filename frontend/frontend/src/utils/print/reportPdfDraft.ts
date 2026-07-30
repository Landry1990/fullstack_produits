import { jsPDF } from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import { formatCurrency, formatDateFr } from '../formatters';
import { getLocale } from '../dateUtils';
import type { PharmacySettings } from '../../context/PharmacySettingsContext';

interface RapportData {
  mois: string;
  ca: {
    ca_ttc: number;
    ca_ht: number;
    nb_ventes: number;
    total_remises: number;
    part_assurance: number;
    part_client: number;
  };
  marge: {
    cout_achat: number;
    marge_brute: number;
    marge_pct: number;
  };
  encaissements: Array<{
    mode: string;
    mode_label: string;
    montant: number;
  }>;
  depots_total: number;
  coupons_total: number;
  ventes_credit: number;
  recouvrements_total: number;
  creances_a_percevoir: number;
  ca_par_tva: Array<{
    taux: number;
    ca_ht: number;
    montant_tva: number;
    ca_ttc: number;
  }>;
  achats_par_fournisseur: Array<{
    fournisseur_id: number;
    fournisseur_nom: string;
    montant_total: number;
    nb_commandes: number;
  }>;
  clients_professionnels: {
    ca_total: number;
    montant_paye: number;
    reste_a_payer: number;
    taux_recouvrement_pct: number;
    nb_factures: number;
    top_clients: Array<{
      client_id: number;
      client_nom: string;
      ca_total: number;
      montant_paye: number;
      reste_a_payer: number;
    }>;
  };
  unites_gratuites: {
    valeur_totale: number;
    quantite_totale: number;
    pct_du_ca: number;
    nb_produits_distincts: number;
    top_produits: Array<{
      produit_id: number;
      produit_nom: string;
      quantite_gratuite: number;
      valeur_totale: number;
    }>;
  };
  mouvements_caisse: {
    total_entrees: number;
    total_sorties: number;
    solde: number;
    liste: Array<{
        id: number;
        date: string;
        type: string;
        montant: number;
        motif: string;
        user: string;
    }>;
  };
}

export async function generateMonthlyReportPdfDraft(
  data: RapportData,
  settings: PharmacySettings,
  periodeLabel: string,
  t: (key: string, options?: unknown) => string
) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const currentLocale = getLocale();
  const currencySymbol = settings.currency_symbol || 'FCFA';

  const fmt = (val: number) => {
    return formatCurrency(Math.round(val), currentLocale, currencySymbol)
      .replace(/[\u00A0\u202F]/g, ' ');
  };

  // Header
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text(settings.pharmacy_name.toUpperCase(), margin, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  let headerY = 26;
  if (settings.address) { doc.text(settings.address, margin, headerY); headerY += 4; }
  if (settings.phone) { doc.text(`Tel: ${settings.phone}`, margin, headerY); headerY += 4; }
  if (settings.niu) { doc.text(`NIU: ${settings.niu}`, margin, headerY); headerY += 4; }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text("RAPPORT D'ACTIVITE", pageWidth - margin, 20, { align: 'right' });
  doc.setFontSize(9);
  doc.text(`Periode : ${periodeLabel}`, pageWidth - margin, 26, { align: 'right' });

  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.line(margin, 36, pageWidth - margin, 36);

  // KPIs Section
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('RESUME DES PERFORMANCES', margin, 44);

  const kpiY = 48;
  const kpiBoxWidth = (pageWidth - 2 * margin - 16) / 5;

  const panierMoyen = data.ca.nb_ventes > 0 ? data.ca.ca_ttc / data.ca.nb_ventes : 0;

  const kpis = [
    { label: "CA TTC", value: fmt(data.ca.ca_ttc) },
    { label: "REM. TOTALES", value: fmt(data.ca.total_remises) },
    { label: "MARGE BRUTE", value: fmt(data.marge.marge_brute) },
    { label: "COUT ACHAT", value: fmt(data.marge.cout_achat) },
    { label: "PANIER MOYEN", value: fmt(panierMoyen) }
  ];

  kpis.forEach((kpi, i) => {
    const x = margin + i * (kpiBoxWidth + 4);
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.2);
    doc.rect(x, kpiY, kpiBoxWidth, 18, 'S');

    doc.setFontSize(6);
    doc.setTextColor(80, 80, 80);
    doc.text(kpi.label, x + kpiBoxWidth / 2, kpiY + 5, { align: 'center' });

    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(kpi.value, x + kpiBoxWidth / 2, kpiY + 12, { align: 'center' });
  });

  let currentY = kpiY + 24;

  // TVA
  const tvaTableBody: unknown[][] = data.ca_par_tva.map(tva => [
    `${tva.taux}%`,
    fmt(tva.ca_ht),
    fmt(tva.montant_tva),
    fmt(tva.ca_ttc)
  ]);
  const totalHT = data.ca_par_tva.reduce((sum, t) => sum + t.ca_ht, 0);
  const totalTax = data.ca_par_tva.reduce((sum, t) => sum + t.montant_tva, 0);
  const totalTTC = data.ca_par_tva.reduce((sum, t) => sum + t.ca_ttc, 0);
  tvaTableBody.push([
    { content: 'TOTAL', styles: { fontStyle: 'normal' } },
    { content: fmt(totalHT), styles: { fontStyle: 'normal' } },
    { content: fmt(totalTax), styles: { fontStyle: 'normal' } },
    { content: fmt(totalTTC), styles: { fontStyle: 'normal' } }
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [[t('tva.rate'), t('tva.ht'), t('tva.tax'), t('tva.ttc')]],
    body: tvaTableBody as unknown as RowInput[],
    theme: 'plain',
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'normal' },
    margin: { left: margin, right: margin },
    styles: { fontSize: 8 }
  });
  currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Encaissements
  const encTableBody: unknown[][] = data.encaissements.map(e => [e.mode_label, fmt(e.montant)]);
  encTableBody.push([
    { content: 'TOTAL ENCAISSEMENTS', styles: { fontStyle: 'normal' } },
    { content: fmt(data.encaissements.reduce((sum, e) => sum + e.montant, 0) + data.depots_total), styles: { fontStyle: 'normal' } }
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [[t('encaissements.mode'), t('encaissements.amount')]],
    body: encTableBody as unknown as RowInput[],
    theme: 'plain',
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'normal' },
    margin: { left: margin, right: margin, bottom: 20 },
    styles: { fontSize: 8 }
  });
  currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Fournisseurs
  if (data.achats_par_fournisseur.length > 0) {
    if (currentY > 250) { doc.addPage(); currentY = 20; }

    const supplierBody: unknown[][] = data.achats_par_fournisseur.map(f => [f.fournisseur_nom, f.nb_commandes, fmt(f.montant_total)]);
    supplierBody.push([
        { content: 'TOTAL ACHATS', styles: { fontStyle: 'normal' } },
        { content: data.achats_par_fournisseur.reduce((sum, f) => sum + f.nb_commandes, 0).toString(), styles: { fontStyle: 'normal' } },
        { content: fmt(data.achats_par_fournisseur.reduce((sum, f) => sum + f.montant_total, 0)), styles: { fontStyle: 'normal' } }
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [[t('suppliers.name'), t('suppliers.orders'), t('suppliers.amount')]],
      body: supplierBody as unknown as RowInput[],
      theme: 'plain',
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'normal' },
      margin: { left: margin, right: margin, bottom: 20 },
      styles: { fontSize: 8 }
    });
    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // Clients Pro
  if (data.clients_professionnels.top_clients.length > 0) {
    if (currentY > 250) { doc.addPage(); currentY = 20; }

    const proBody: unknown[][] = data.clients_professionnels.top_clients.map(c => [c.client_nom, fmt(c.ca_total), fmt(c.montant_paye), fmt(c.reste_a_payer)]);
    proBody.push([
        { content: 'TOTAL CLIENTS PRO', styles: { fontStyle: 'normal' } },
        { content: fmt(data.clients_professionnels.top_clients.reduce((sum, c) => sum + c.ca_total, 0)), styles: { fontStyle: 'normal' } },
        { content: fmt(data.clients_professionnels.top_clients.reduce((sum, c) => sum + c.montant_paye, 0)), styles: { fontStyle: 'normal' } },
        { content: fmt(data.clients_professionnels.top_clients.reduce((sum, c) => sum + c.reste_a_payer, 0)), styles: { fontStyle: 'normal' } }
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [[t('pro_clients.title'), t('pro_clients.ca_total'), t('pro_clients.paid'), t('pro_clients.balance')]],
      body: proBody as unknown as RowInput[],
      theme: 'plain',
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'normal' },
      margin: { left: margin, right: margin, bottom: 20 },
      styles: { fontSize: 8 }
    });
    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // Unites Gratuites
  if (data.unites_gratuites.top_produits.length > 0) {
    if (currentY > 250) { doc.addPage(); currentY = 20; }

    const freeBody: unknown[][] = data.unites_gratuites.top_produits.map(p => [p.produit_nom, p.quantite_gratuite, fmt(p.valeur_totale)]);
    freeBody.push([
        { content: 'TOTAL UNITES GRATUITES', styles: { fontStyle: 'normal' } },
        { content: data.unites_gratuites.top_produits.reduce((sum, p) => sum + p.quantite_gratuite, 0).toString(), styles: { fontStyle: 'normal' } },
        { content: fmt(data.unites_gratuites.top_produits.reduce((sum, p) => sum + p.valeur_totale, 0)), styles: { fontStyle: 'normal' } }
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["UNITES GRATUITES (TOP PRODUITS)", t('free_units.qty'), t('free_units.value')]],
      body: freeBody as unknown as RowInput[],
      theme: 'plain',
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'normal' },
      margin: { left: margin, right: margin, bottom: 20 },
      styles: { fontSize: 8 }
    });
    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // Mouvements Caisse
  if (data.mouvements_caisse.liste.length > 0) {
    if (currentY > 250) { doc.addPage(); currentY = 20; }
    autoTable(doc, {
      startY: currentY,
      head: [[t('caisse_mvts.date'), t('caisse_mvts.type'), t('caisse_mvts.reason'), t('encaissements.amount')]],
      body: data.mouvements_caisse.liste.map(m => [
        formatDateFr(m.date),
        m.type,
        m.motif,
        fmt(m.montant)
      ]) as unknown as RowInput[],
      theme: 'plain',
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'normal' },
      margin: { left: margin, right: margin, bottom: 20 },
      styles: { fontSize: 7 }
    });
  }

  // Footers
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Document genere le ${new Date().toLocaleString('fr-FR')} - Page ${i} / ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  const filename = data.mois ? `rapport_mensuel_${data.mois}.pdf` : `rapport_${periodeLabel.replace(/ /g, '_')}.pdf`;
  doc.save(filename);
}

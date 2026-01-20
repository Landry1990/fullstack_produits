
import React from 'react';

// Interfaces matching FacturePrintSerializer
export interface InvoiceClient {
  id?: number;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  niu?: string;
}

export interface InvoiceItem {
  produit_nom: string;
  produit_id?: number;
  quantity: number;
  selling_price: number; // TTC
  discount: number; // Remise unitaire
  tva: number;
  total_ligne?: number;
  cip?: string; // Code13Ref
  stock_lot?: any;
}

export interface TvaAnalysisItem {
  taux: number; // ou string
  base_ht: number;
  montant_tva: number;
}

export interface InvoiceData {
  id: number;
  numero_facture: string;
  date: string;
  client: InvoiceClient | null;
  produits: InvoiceItem[];
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  remise: number;
  vendeur_nom?: string;
  type: string;
  status: string; // Added status
  montant_recu?: number;
  montant_rendu?: number;
  mode_reglement?: string;
  tva_analysis?: TvaAnalysisItem[];
  total_lettres?: string; // Added total_lettres
  notes?: string;
}

export interface PharmacySettings {
  pharmacy_name: string;
  address: string;
  phone?: string;
  email?: string;
  ticket_footer_message: string;
  niu?: string;
  registre_commerce?: string;
  logo?: string;
  primary_color?: string;
}

interface InvoiceTemplateProps {
  settings: PharmacySettings;
  data: InvoiceData;
}

const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ settings, data }) => {
  const primaryColor = settings.primary_color || '#10b981'; // Emerald-500 default

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(price);
  };
  
  const formatNumber = (num: number, decimals = 2) => {
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Helper to calculate HT Unit from TTC and Tax
  const calculateHTUnit = (priceTTC: number, tva: number) => {
    // priceTTC is the selling price (brut). Discount is amount reduced? 
    // Assuming discount is amount per unit.
    // In backend serializer we computed Base HT differently.
    // Here we need to display "HT U Brut".
    // HT U Brut = PriceTTC / (1 + TVA)
    return priceTTC / (1 + (Number(tva) || 0) / 100);
  };

  const totalQuantity = data.produits.reduce((acc, item) => acc + item.quantity, 0);


  return (
    <div className="bg-white p-8 max-w-[210mm] mx-auto text-slate-900 font-sans text-xs leading-tight shadow-none print:shadow-none" style={{ minHeight: '297mm' }}>
      
      {/* HEADER SECTION - MODERN */}
      <div className="flex justify-between items-start mb-10">
        
        {/* Left: Pharmacy Info & Logo */}
        <div className="flex-1">
             {settings.logo ? (
                <img src={settings.logo} alt="Logo" className="h-20 mb-4 object-contain" />
              ) : (
                <div style={{ color: primaryColor }} className="text-2xl font-bold mb-3 uppercase tracking-tighter">
                    {settings.pharmacy_name}
                </div>
              )}
            
            <div className="space-y-1 text-slate-600">
                <div className="font-bold text-slate-800 uppercase">{settings.pharmacy_name}</div>
                <div className="whitespace-pre-line leading-snug">
                    {settings.address}
                </div>
                <div className="flex flex-col gap-0.5 mt-1">
                    {settings.phone && <div><span className="font-semibold text-slate-700">Tél:</span> {settings.phone}</div>}
                    {settings.email && <div><span className="font-semibold text-slate-700">Email:</span> {settings.email}</div>}
                </div>
                
                
                {/* 
                <div className="flex gap-3 mt-3 text-[10px] text-slate-400 uppercase tracking-widest">
                    {settings.niu && <div>NIU: {settings.niu}</div>}
                    {settings.registre_commerce && <div>RC: {settings.registre_commerce}</div>}
                </div> 
                */}
            </div>
        </div>

        {/* Right: Invoice Info & Client */}
        <div className="w-1/3 flex flex-col items-end text-right">
            
            <div className="mb-6">
                <h1 className="text-3xl font-light tracking-tight text-slate-900 mb-1">
                    {data.type === 'DEVIS' || data.status === 'PROFORMA' ? 'PROFORMA' : 'FACTURE'}
                </h1>
                <div className="text-sm font-bold text-slate-500">#{data.numero_facture || data.id}</div>
                <div className="text-sm text-slate-500 mt-1">{formatDate(data.date)}</div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 w-full text-right">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">Facturé à</div>
                
                <div className="font-bold text-base text-slate-900 mb-1">{data.client?.name || "CLIENT COMPTOIR"}</div>
                
                <div className="text-slate-600 space-y-0.5">
                    {data.client?.address && <div>{data.client.address}</div>}
                    {data.client?.phone && <div>{data.client.phone}</div>}
                    {data.client?.niu && <div>NIU: {data.client.niu}</div>}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200 text-[10px] text-slate-400">
                    Ref Client: {data.client?.id || '-'}
                </div>
            </div>

        </div>
      </div>

      {/* METADATA BAR */}
      <div className="bg-slate-50 rounded-lg p-3 flex justify-between border border-slate-100 mb-6 text-[10px] text-slate-600">
          <div>
              <span className="uppercase tracking-wider font-bold text-slate-400 mr-2">Vendeur</span>
              <span className="font-semibold text-slate-900 uppercase">{data.vendeur_nom}</span>
          </div>
          <div>
              <span className="uppercase tracking-wider font-bold text-slate-400 mr-2">Mode de règlement</span>
              <span className="font-semibold text-slate-900">{data.mode_reglement || 'Non défini'}</span>
          </div>
          <div>
              <span className="uppercase tracking-wider font-bold text-slate-400 mr-2">Echéance</span>
              <span className="font-semibold text-slate-900">À réception</span>
          </div>
      </div>

      {/* PRODUCTS TABLE - CLEAN MODERN */}
      <table className="w-full mb-6">
          <thead>
              <tr className="border-b-2 border-slate-800 text-slate-800 text-[10px] uppercase tracking-wider">
                  <th className="py-2 px-3 text-left font-bold">Désignation</th>
                  <th className="py-2 px-3 text-center font-bold w-16">Qté</th>
                  <th className="py-2 px-3 text-right font-bold w-24">P.U HT</th>
                  <th className="py-2 px-3 text-right font-bold w-20">Rem.</th>
                  <th className="py-2 px-3 text-right font-bold w-24">Total HT</th>
              </tr>
          </thead>
          <tbody className="text-[10px] text-slate-700">
              {data.produits.map((item, idx) => {
                  const htUnit = calculateHTUnit(item.selling_price, item.tva);
                  // Total line net HT = (PriceTTC - Discount) * Qty / (1+TVA)
                  const totalLineNetHT = ((Number(item.selling_price) - Number(item.discount)) * item.quantity) / (1 + (Number(item.tva)||0)/100);
                  
                  return (
                    <tr key={idx} className="border-b border-slate-100 last:border-0 odd:bg-slate-50/50">
                        <td className="py-2 px-3">
                            <div className="font-semibold text-slate-900">{item.produit_nom}</div>
                            {item.cip && <div className="text-[9px] text-slate-400 font-mono tracking-tighter">{item.cip}</div>}
                        </td>
                        <td className="py-2 px-3 text-center align-top pt-2.5 font-medium">{item.quantity}</td>
                        <td className="py-2 px-3 text-right align-top pt-2.5">{formatNumber(htUnit, 0)}</td>
                        <td className="py-2 px-3 text-right align-top pt-2.5 text-slate-400">{item.discount > 0 ? formatNumber(item.discount, 0) : '-'}</td>
                        <td className="py-2 px-3 text-right align-top pt-2.5 font-bold text-slate-900">{formatNumber(totalLineNetHT, 0)}</td>
                    </tr>
                  );
              })}
          </tbody>
      </table>
      
      <div className="mb-6 text-[10px] uppercase font-bold text-slate-400 tracking-wider flex justify-end gap-6">
           <span>Nombre de lignes : {data.produits.length}</span>
           <span>Quantité Totale : {totalQuantity}</span>
      </div>

      {/* FOOTER SECTION: VAT & TOTALS */}
      <div className="flex gap-8 items-start border-t border-slate-200 pt-6">
          
          {/* VAT Analysis - Compact */}
          <div className="w-1/2">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">Analyse TVA</div>
              <table className="w-full text-[9px] text-slate-600">
                  <thead className="border-b border-slate-200">
                      <tr>
                          <th className="py-1 text-left font-semibold">Taux</th>
                          <th className="py-1 text-right font-semibold">Base HT</th>
                          <th className="py-1 text-right font-semibold">TVA</th>
                      </tr>
                  </thead>
                  <tbody>
                      {data.tva_analysis && data.tva_analysis.length > 0 ? (
                          data.tva_analysis.map((line, idx) => (
                              <tr key={idx} className="border-b border-slate-100 last:border-0">
                                  <td className="py-1 text-left">{formatNumber(Number(line.taux), 2)}%</td>
                                  <td className="py-1 text-right">{formatNumber(line.base_ht, 0)}</td>
                                  <td className="py-1 text-right">{formatNumber(line.montant_tva, 0)}</td>
                              </tr>
                          ))
                      ) : (
                        <tr>
                            <td className="py-1 text-left">0.0%</td>
                            <td className="py-1 text-right">{formatNumber(data.total_ht, 0)}</td>
                            <td className="py-1 text-right">0</td>
                        </tr>
                      )}
                  </tbody>
              </table>
              
              <div className="mt-6 text-[11px] text-slate-600">
                  Arrêté la présente facture à la somme de :<br/>
                  <div className="font-bold italic text-slate-900 mt-1 uppercase leading-snug">
                     {data.total_lettres || '---'}
                  </div>
              </div>
          </div>

          {/* Grand Totals Box - Clean */}
          <div className="w-1/2 flex flex-col gap-2">
              <div className="flex justify-between items-center py-1 text-slate-600">
                  <span className="text-xs">Total HT</span>
                  <span className="font-mono font-bold">{formatPrice(data.total_ht)}</span>
              </div>
              <div className="flex justify-between items-center py-1 text-slate-600">
                  <span className="text-xs">Total TVA</span>
                  <span className="font-mono font-bold">{formatPrice(data.total_tva)}</span>
              </div>
              
              {data.remise > 0 && (
                <div className="flex justify-between items-center py-1 text-red-500">
                    <span className="text-xs font-semibold">Remise</span>
                    <span className="font-mono font-bold">-{formatPrice(data.remise)}</span>
                </div>
              )}
              
              <div className="border-t-2 border-slate-900 mt-2 pt-2 flex justify-between items-center">
                  <span className="text-sm font-bold uppercase text-slate-900">Net à Payer</span>
                  <span style={{ color: primaryColor }} className="text-2xl font-bold font-mono tracking-tight">{formatPrice(data.total_ttc)}</span>
              </div>
          </div>
      </div>

      {/* FOOTER MESSAGE & LEGAL */}
      <div className="mt-auto pt-6 border-t border-slate-300 text-center text-[10px] text-slate-500">
          <p className="font-medium text-slate-700 mb-1">{settings.ticket_footer_message}</p>
          <p className="mb-2">Merci de votre confiance.</p>
          
          <div className="flex justify-center gap-6 text-[9px] uppercase tracking-wider text-slate-400">
             {settings.niu && <div>NIU: {settings.niu}</div>}
             {settings.registre_commerce && <div>RC: {settings.registre_commerce}</div>}
          </div>
      </div>

    </div>
  );
};

export default InvoiceTemplate;

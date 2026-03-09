
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
  const primaryColor = settings.primary_color || '#10b981';

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

  const calculateHTUnit = (priceTTC: number, tva: number) => {
    return priceTTC / (1 + (Number(tva) || 0) / 100);
  };

  const totalQuantity = data.produits.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="bg-white p-12 max-w-[210mm] mx-auto text-slate-900 font-sans text-[11px] leading-relaxed shadow-none print:shadow-none print:p-8" style={{ minHeight: '297mm', display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER SECTION - PREMIUM */}
      <div className="flex justify-between items-start mb-12 border-b-2 border-slate-100 pb-8">
        
        {/* Left: Pharmacy Info & Logo */}
        <div className="flex-1">
             {settings.logo ? (
                <img src={settings.logo} alt="Logo" className="h-24 mb-4 object-contain" />
              ) : (
                <div style={{ color: primaryColor }} className="text-3xl font-black mb-2 uppercase tracking-tight">
                    {settings.pharmacy_name}
                </div>
              )}
            
            <div className="space-y-1.5 text-slate-600 max-w-sm">
                <div className="font-bold text-slate-800 uppercase text-sm tracking-wide">{settings.pharmacy_name}</div>
                <div className="whitespace-pre-line leading-relaxed italic">
                    {settings.address}
                </div>
                <div className="grid grid-cols-1 gap-1 mt-3">
                    {settings.phone && (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-400 text-[10px] uppercase tracking-widest w-8">Tél</span>
                        <span className="text-slate-700 font-medium">{settings.phone}</span>
                      </div>
                    )}
                    {settings.email && (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-400 text-[10px] uppercase tracking-widest w-8">Email</span>
                        <span className="text-slate-700 font-medium lowercase">{settings.email}</span>
                      </div>
                    )}
                </div>
            </div>
        </div>

        {/* Right: Invoice Info & Client */}
        <div className="w-1/3 flex flex-col items-end">
            <div className="mb-8 text-right">
                <h1 className="text-4xl font-light tracking-tighter text-slate-900 leading-none">
                    {data.type === 'DEVIS' || data.status === 'PROFORMA' ? 'PROFORMA' : 'FACTURE'}
                </h1>
                <div className="mt-2 flex flex-col items-end gap-1">
                  <div className="bg-slate-900 text-white px-3 py-1 text-xs font-bold rounded">
                    N° {data.numero_facture || data.id}
                  </div>
                  <div className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">
                    Émis le {formatDate(data.date)}
                  </div>
                </div>
            </div>

            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 w-full relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-slate-200/50 rotate-45 translate-x-8 -translate-y-8"></div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400 mb-3 border-b border-slate-200 pb-2">Destinataire</div>
                
                <div className="font-black text-lg text-slate-900 mb-1 leading-tight">{data.client?.name || "CLIENT COMPTOIR"}</div>
                
                <div className="text-slate-600 space-y-1 mt-2">
                    {data.client?.address && <div className="flex items-start gap-2"><span className="text-slate-300">📍</span> {data.client.address}</div>}
                    {data.client?.phone && <div className="flex items-start gap-2"><span className="text-slate-300">📞</span> {data.client.phone}</div>}
                    {data.client?.niu && <div className="text-[10px] bg-white px-2 py-0.5 rounded border border-slate-100 inline-block mt-1">NIU: {data.client.niu}</div>}
                </div>
            </div>
        </div>
      </div>

      {/* METADATA BAR */}
      <div className="bg-slate-50/50 rounded-xl p-4 flex justify-between border border-slate-100 mb-8 text-[10px]">
          <div className="flex flex-col gap-1">
              <span className="uppercase tracking-widest font-black text-slate-400">Vendeur</span>
              <span className="font-bold text-slate-900 uppercase text-xs">{data.vendeur_nom || '---'}</span>
          </div>
          <div className="flex flex-col gap-1 px-8 border-x border-slate-200">
              <span className="uppercase tracking-widest font-black text-slate-400">Règlement</span>
              <span className="font-bold text-slate-900 text-xs">{data.mode_reglement || 'Non défini'}</span>
          </div>
          <div className="flex flex-col gap-1 text-right">
              <span className="uppercase tracking-widest font-black text-slate-400">Échéance</span>
              <span className="font-bold text-slate-900 text-xs text-emerald-600">À RÉCEPTION</span>
          </div>
      </div>

      {/* PRODUCTS TABLE - PREMIUM COMPACT */}
      <div className="flex-grow">
        <table className="w-full mb-8 border-collapse">
            <thead>
                <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-[0.15em]">
                    <th className="py-4 px-4 text-left font-black rounded-l-lg">Désignation</th>
                    <th className="py-4 px-2 text-center font-black w-16">Qté</th>
                    <th className="py-4 px-2 text-right font-black w-24">P.U HT</th>
                    <th className="py-4 px-2 text-right font-black w-20">Rem.</th>
                    <th className="py-4 px-4 text-right font-black w-28 rounded-r-lg">Total HT</th>
                </tr>
            </thead>
            <tbody className="text-[11px]">
                {data.produits.map((item, idx) => {
                    const htUnit = calculateHTUnit(item.selling_price, item.tva);
                    const totalLineNetHT = ((Number(item.selling_price) - Number(item.discount)) * item.quantity) / (1 + (Number(item.tva)||0)/100);
                    
                    return (
                      <tr key={idx} className="group border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                          <td className="py-4 px-4">
                              <div className="font-bold text-slate-800 text-xs">{item.produit_nom}</div>
                              {item.cip && <div className="text-[9px] text-slate-400 font-mono mt-0.5 tracking-tight">CIP: {item.cip}</div>}
                          </td>
                          <td className="py-4 px-2 text-center align-middle font-bold text-slate-900">{item.quantity}</td>
                          <td className="py-4 px-2 text-right align-middle text-slate-600 font-medium">{formatNumber(htUnit, 0)}</td>
                          <td className="py-4 px-2 text-right align-middle text-red-400/80 font-medium">{item.discount > 0 ? `-${formatNumber(item.discount, 0)}` : '—'}</td>
                          <td className="py-4 px-4 text-right align-middle font-black text-slate-900 text-xs px-4">{formatNumber(totalLineNetHT, 0)}</td>
                      </tr>
                    );
                })}
            </tbody>
        </table>
        
        <div className="px-4 py-3 bg-slate-50 rounded-lg flex justify-between items-center text-[10px] uppercase font-bold text-slate-400 tracking-widest">
             <div className="flex gap-8">
               <span>Lignes : <span className="text-slate-900">{data.produits.length}</span></span>
               <span>Articles : <span className="text-slate-900">{totalQuantity}</span></span>
             </div>
             <div className="text-slate-300 italic">Document généré numériquement</div>
        </div>
      </div>

      {/* FOOTER AREA */}
      <div className="mt-12">
        <div className="flex gap-12 items-start border-t-2 border-slate-900 pt-8">
            
            {/* VAT Analysis & Text Amount */}
            <div className="flex-1">
                <div className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-3 ml-1">Analyse des taxes (TVA)</div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-8">
                  <table className="w-full text-[10px]">
                      <thead>
                          <tr className="text-slate-400 font-bold border-b border-slate-200">
                              <th className="py-2 text-left pb-2">Code TVA</th>
                              <th className="py-2 text-right pb-2">Taux</th>
                              <th className="py-2 text-right pb-2">Base HT</th>
                              <th className="py-2 text-right pb-2">Montant TVA</th>
                          </tr>
                      </thead>
                      <tbody>
                          {data.tva_analysis && data.tva_analysis.length > 0 ? (
                              data.tva_analysis.map((line, idx) => (
                                  <tr key={idx} className="text-slate-700">
                                      <td className="py-2 text-left font-bold">TVA-{idx+1}</td>
                                      <td className="py-2 text-right">{formatNumber(Number(line.taux), 1)}%</td>
                                      <td className="py-2 text-right font-medium">{formatNumber(line.base_ht, 0)}</td>
                                      <td className="py-2 text-right font-bold">{formatNumber(line.montant_tva, 0)}</td>
                                  </tr>
                              ))
                          ) : (
                            <tr className="text-slate-700">
                                <td className="py-2 text-left font-bold">TVA-EXO</td>
                                <td className="py-2 text-right">0.0%</td>
                                <td className="py-2 text-right font-medium">{formatNumber(data.total_ht, 0)}</td>
                                <td className="py-2 text-right font-bold">0</td>
                            </tr>
                          )}
                      </tbody>
                  </table>
                </div>
                
                <div className="bg-emerald-50/30 border border-emerald-100 rounded-xl p-5">
                    <div className="text-[9px] uppercase tracking-[0.2em] font-black text-emerald-800/40 mb-2">Montant en toutes lettres</div>
                    <div className="font-bold italic text-slate-900 text-sm uppercase leading-snug tracking-tight">
                       {data.total_lettres || '---'}
                    </div>
                </div>
            </div>

            {/* Totals & Signature */}
            <div className="w-72">
                <div className="space-y-3 mb-10">
                    <div className="flex justify-between items-center px-2 py-1 text-slate-500">
                        <span className="text-[10px] uppercase font-bold tracking-widest">Total HT</span>
                        <span className="font-mono font-bold text-slate-900">{formatPrice(data.total_ht)}</span>
                    </div>
                    <div className="flex justify-between items-center px-2 py-1 text-slate-500">
                        <span className="text-[10px] uppercase font-bold tracking-widest">Taxes (TVA)</span>
                        <span className="font-mono font-bold text-slate-900">{formatPrice(data.total_tva)}</span>
                    </div>
                    
                    {data.remise > 0 && (
                      <div className="flex justify-between items-center px-2 py-2 bg-red-50 rounded-lg text-red-600">
                          <span className="text-[10px] uppercase font-black tracking-widest">Remise commerciale</span>
                          <span className="font-mono font-black text-sm">-{formatPrice(data.remise)}</span>
                      </div>
                    )}
                    
                    <div className="bg-slate-900 text-white rounded-xl p-4 shadow-xl shadow-slate-200 mt-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rotate-45 translate-x-12 -translate-y-12"></div>
                        <div className="text-[10px] uppercase font-black tracking-[0.3em] text-white/40 mb-1">Net à Payer</div>
                        <div className="text-3xl font-black font-mono tracking-tighter text-white flex justify-between items-baseline">
                          {formatNumber(data.total_ttc, 0)}
                          <span className="text-sm font-light ml-1 opacity-60">FCFA</span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col items-center">
                    <div className="text-[9px] uppercase font-black tracking-widest text-slate-400 mb-12">Cachet & Signature</div>
                    <div className="w-48 h-24 border-2 border-dashed border-slate-100 rounded-2xl flex items-center justify-center text-[9px] text-slate-200 bg-slate-50/30">
                        EMPLACEMENT CACHET
                    </div>
                </div>
            </div>
        </div>

        {/* LEGAL FOOTER */}
        <div className="mt-16 pt-8 border-t border-slate-200 text-center">
            <p className="font-bold text-slate-800 text-[11px] mb-2">{settings.ticket_footer_message || 'Merci de votre confiance.'}</p>
            
            <div className="flex justify-center flex-wrap gap-x-12 gap-y-2 text-[9px] uppercase tracking-[0.15em] font-bold text-slate-400">
               {settings.niu && <div className="flex items-center gap-1.5"><span className="text-slate-300">●</span> NIU: <span className="text-slate-600">{settings.niu}</span></div>}
               {settings.registre_commerce && <div className="flex items-center gap-1.5"><span className="text-slate-300">●</span> RC: <span className="text-slate-600">{settings.registre_commerce}</span></div>}
               <div className="flex items-center gap-1.5"><span className="text-slate-300">●</span> LOGICIEL: <span className="text-slate-600">ANTIGRAVITY POS</span></div>
            </div>
        </div>
      </div>

    </div>
  );
};

export default InvoiceTemplate;

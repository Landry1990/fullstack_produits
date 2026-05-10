import { formatDate as formatLocaleDate } from '../../utils/dateUtils';
import { formatNumber, formatCurrency } from '../../utils/formatters';

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
  lot?: string;
  date_expiration?: string;
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
  validated_by_name?: string;
  type: string;
  status: string; // Added status
  montant_recu?: number;
  montant_rendu?: number;
  mode_reglement?: string;
  tva_analysis?: TvaAnalysisItem[];
  total_lettres?: string; // Added total_lettres
  notes?: string;
  client_name_override?: string;
  part_client?: number;
  part_assurance?: number;
  ayant_droit_details?: {
    nom: string;
    matricule: string;
    societe?: string;
  };
  client_solde_depot?: string;
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
  isBonDeLivraison?: boolean;
}

const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ settings, data, isBonDeLivraison }) => {

  
  // Standardized formatting used below

  const formatDate = (dateStr: string) => {
    return formatLocaleDate(dateStr);
  };

  const formatExpiryDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${year}`;
  };

  const calculateHTUnit = (priceTTC: number, tva: number) => {
    return priceTTC / (1 + (Number(tva) || 0) / 100);
  };

  const totalQuantity = data.produits.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div data-theme="light" className="bg-base-100 p-4 max-w-[210mm] mx-auto text-base-content font-sans text-[11px] leading-tight shadow-none print:shadow-none print:max-w-none print:w-full" style={{ display: 'flex', flexDirection: 'column' }}>
      
      {/* HEADER SECTION - SYNCED WITH IMAGE */}
      <div className="flex justify-between items-start mb-6 border-b-2 border-slate-900 pb-4">
        
        {/* Left: Pharmacy Info */}
        <div className="flex-1">
            <h1 className="text-2xl font-black uppercase tracking-tight text-base-content mb-1 leading-none">
                {settings.pharmacy_name}
            </h1>
            
            <div className="space-y-1 text-base-content/60 max-w-sm text-[11px]">
                <div className="whitespace-pre-line leading-tight italic">
                    {settings.address}
                </div>
                <div className="flex flex-col gap-0.5 mt-2 font-bold text-base-content/90">
                    {settings.phone && (
                      <div className="flex items-center gap-1">
                        <span>Tél : {settings.phone} |</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 uppercase">
                        {settings.niu && <span>NIU : {settings.niu} |</span>}
                        {settings.registre_commerce && <span>RC : {settings.registre_commerce}</span>}
                    </div>
                </div>
            </div>
        </div>

        {/* Right: Invoice Info Boxed */}
        <div className="text-right">
            <div className="border-2 border-slate-900 text-base-content px-6 py-2 rounded-sm text-xl font-black mb-2 inline-block uppercase tracking-wider">
                {isBonDeLivraison ? 'BON DE LIVRAISON' : (data.type === 'DEVIS' || data.status === 'PROFORMA' ? 'PROFORMA' : 'FACTURE')}
            </div>
            <div className="text-base-content/60 font-bold text-[10px] uppercase tracking-widest">
                Réf : {data.numero_facture || data.id}
            </div>
        </div>
      </div>

      {/* METADATA BOXES - SYNCED WITH IMAGE */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-base-100 p-4 rounded-xl border border-base-200">
            <div className="text-[9px] uppercase tracking-widest font-black text-base-content/40 mb-2 border-b border-slate-100 pb-1.5">
                Client
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-bold text-base-content uppercase">{data.client_name_override || data.client?.name || 'Client de passage'}</p>
              {data.ayant_droit_details && (
                <p className="font-medium text-blue-700">Ayant-droit: {data.ayant_droit_details.nom}</p>
              )}
              {data.client?.address && <p>{data.client.address}</p>}
              {data.client?.phone && <p>Tél : {data.client.phone}</p>}
              {data.client_solde_depot && Number(data.client_solde_depot) > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Solde Dépôt Restant</span>
                    <span className="font-black text-slate-900 text-sm">{formatCurrency(Number(data.client_solde_depot))}</span>
                </div>
              )}
            </div>
        </div>

        <div className="bg-base-100 p-4 rounded-xl border border-base-200">
            <div className="text-[9px] uppercase tracking-widest font-black text-base-content/40 mb-2 border-b border-slate-100 pb-1.5">
                Détails de Facturation
            </div>
            <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                    <span className="text-base-content/60">Date :</span>
                    <span className="font-bold">{formatDate(data.date)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1 mt-1">
                    <span className="text-base-content/60">Saisie par :</span>
                    <span className="font-bold uppercase">{data.vendeur_nom || 'N/A'}</span>
                </div>
                {data.validated_by_name && (
                  <div className="flex justify-between">
                      <span className="text-base-content/60">Validé par :</span>
                      <span className="font-bold uppercase">{data.validated_by_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                    <span className="text-base-content/60">Règlement :</span>
                    <span className="font-bold uppercase text-emerald-600">{data.mode_reglement || 'COMPTANT'}</span>
                </div>
            </div>
        </div>
      </div>


      {/* PRODUCTS TABLE - PREMIUM COMPACT */}
      <div className="flex-grow">
        <table className="w-full mb-4 border-collapse">
            <thead className="table-header-group">
                <tr className="bg-base-200/50 text-base-content border-b-2 border-slate-900 text-[9px] uppercase tracking-[0.1em]">
                    <th className="py-2.5 px-3 text-left font-black rounded-l">Désignation</th>
                    <th className="py-2.5 px-2 text-center font-black w-12">Qté</th>
                    <th className="py-2.5 px-2 text-right font-black w-24">P.U HT</th>
                    <th className="py-2.5 px-2 text-right font-black w-20">Rem.</th>
                    <th className="py-2.5 px-3 text-right font-black w-28 rounded-r">Total HT</th>
                </tr>
            </thead>
            <tbody className="text-[10px]">
                {data.produits.map((item, idx) => {
                    const htUnit = calculateHTUnit(item.selling_price, item.tva);
                    const totalLineNetHT = ((Number(item.selling_price) - Number(item.discount)) * item.quantity) / (1 + (Number(item.tva)||0)/100);
                    
                    return (
                      <tr key={idx} className="group border-b border-slate-50 hover:bg-slate-50/30 transition-colors break-inside-avoid">
                          <td className="py-2 px-3">
                              <div className="font-bold text-base-content text-[10.5px] uppercase leading-tight">{item.produit_nom}</div>
                              {item.cip && <div className="text-[8.5px] text-base-content/40 font-mono mt-0.5 tracking-tight inline-block mr-3">CIP: {item.cip}</div>}
                              {(item.lot || item.date_expiration) && (
                                <div className="text-[7.5px] text-base-content/60 font-mono mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                                    {item.lot && <span>LOT: {item.lot}</span>}
                                    {item.date_expiration && <span>EXP: {formatExpiryDate(item.date_expiration)}</span>}
                                </div>
                              )}
                          </td>
                          <td className="py-2 px-2 text-center align-middle font-bold text-base-content">{item.quantity}</td>
                          <td className="py-2 px-2 text-right align-middle text-base-content/80 font-medium">{formatNumber(htUnit, 0)}</td>
                          <td className="py-2 px-2 text-right align-middle text-red-400 font-medium">{item.discount > 0 ? `-${formatNumber(item.discount, 0)}` : '—'}</td>
                          <td className="py-2 px-3 text-right align-middle font-black text-base-content text-[10.5px]">{formatNumber(totalLineNetHT, 0)}</td>
                      </tr>
                    );
                })}
            </tbody>
        </table>
        
        <div className="px-3 py-2 bg-base-200/50 rounded-lg flex justify-between items-center text-[9px] uppercase font-bold text-base-content/40 tracking-widest">
             <div className="flex gap-6">
               <span>Lignes : <span className="text-base-content">{data.produits.length}</span></span>
               <span>Articles : <span className="text-base-content">{totalQuantity}</span></span>
             </div>
             <div className="text-base-content/30 italic">Document système certifié</div>
        </div>
      </div>

      {/* FOOTER AREA */}
      <div className="mt-6">
        <div className="flex gap-8 items-start border-t-2 border-slate-900 pt-4">
            
            {/* VAT Analysis & Text Amount */}
            <div className="flex-1">
                <div className="text-[9px] uppercase tracking-widest font-black text-base-content/40 mb-2 ml-1">Analyse des taxes (TVA)</div>
                <div className="bg-base-200/50 rounded-lg p-3 border border-slate-100 mb-4">
                  <table className="w-full text-[9.5px]">
                      <thead>
                          <tr className="text-base-content/40 font-bold border-b border-base-200">
                              <th className="py-1 text-left pb-1">Code TVA</th>
                              <th className="py-1 text-right pb-1">Taux</th>
                              <th className="py-1 text-right pb-1">Base HT</th>
                              <th className="py-1 text-right pb-1">Montant TVA</th>
                          </tr>
                      </thead>
                      <tbody className="leading-tight">
                          {data.tva_analysis && data.tva_analysis.length > 0 ? (
                              data.tva_analysis.map((line, idx) => (
                                  <tr key={idx} className="text-base-content/90">
                                      <td className="py-1 text-left font-bold uppercase">TVA-{idx+1}</td>
                                      <td className="py-1 text-right font-medium">{formatNumber(Number(line.taux), 2)}%</td>
                                      <td className="py-1 text-right">{formatNumber(line.base_ht, 0)}</td>
                                      <td className="py-1 text-right font-bold text-base-content">{formatNumber(line.montant_tva, 0)}</td>
                                  </tr>
                              ))
                          ) : (
                            <tr className="text-base-content/90">
                                <td className="py-1 text-left font-bold">TVA-EXO</td>
                                <td className="py-1 text-right">0.0%</td>
                                <td className="py-1 text-right">{formatNumber(data.total_ht, 0)}</td>
                                <td className="py-1 text-right font-bold">0</td>
                            </tr>
                          )}
                      </tbody>
                  </table>
                </div>
                
                <div className="bg-base-200/50 border border-slate-100 rounded-lg p-3">
                    <div className="text-[8.5px] uppercase tracking-[0.2em] font-black text-base-content/40 mb-1.5">Montant en toutes lettres</div>
                    <div className="font-bold italic text-base-content text-[12.5px] uppercase leading-snug tracking-tight">
                       {data.total_lettres || '---'}
                    </div>
                </div>
            </div>

            {/* Totals & Signature */}
            <div className="w-64">
                <div className="space-y-1 mt-4 p-0">
                    {/* Rows use grid-cols-[1fr,115px] to have a fixed amount area */}
                    
                    {/* Total HT */}
                    <div className="grid grid-cols-[1fr,115px] items-center px-1 text-base-content/60">
                        <span className="text-[9px] uppercase font-bold tracking-widest pl-1">Total HT</span>
                        <div className="text-right font-mono font-bold text-base-content pr-2">
                          {formatCurrency(data.total_ht)}
                        </div>
                    </div>

                    {data.total_tva > 0 && (
                      <div className="grid grid-cols-[1fr,115px] items-center px-1 text-base-content/60">
                          <span className="text-[9px] uppercase font-bold tracking-widest pl-1">Taxes (TVA)</span>
                          <div className="text-right font-mono font-bold text-base-content pr-2">
                            {formatCurrency(data.total_tva)}
                          </div>
                      </div>
                    )}
                    
                    {data.remise > 0 && (
                      <div className="grid grid-cols-[1fr,115px] items-center px-1 py-1 bg-red-50/50 rounded-md text-red-600 border border-red-100/50">
                          <span className="text-[9px] uppercase font-black tracking-widest pl-1">Remise</span>
                          <div className="text-right font-mono font-black pr-2">
                            -{formatCurrency(data.remise)}
                          </div>
                      </div>
                    )}

                    <div className="border-t border-base-200 my-1 mx-2"></div>
                    
                    {/* Bloc TOTAL GÉNÉRAL / NET À PAYER */}
                    <div className={`mx-0 rounded-lg py-2.5 shadow-sm transition-all overflow-hidden relative ${
                      isBonDeLivraison && (data.part_assurance ?? 0) > 0 
                        ? 'bg-base-200/50 border border-base-200 text-base-content' 
                        : 'bg-slate-900 text-white'
                    }`}>
                        <div className="grid grid-cols-[1fr,115px] items-center px-1">
                          <span className={`text-[8px] uppercase font-black tracking-[0.2em] pl-1 ${
                            isBonDeLivraison && (data.part_assurance ?? 0) > 0 ? 'text-base-content/40' : 'text-base-content/40'
                          }`}>
                            {isBonDeLivraison && (data.part_assurance ?? 0) > 0 ? 'TOTAL GÉNÉRAL' : 'NET À PAYER'}
                          </span>
                          <div className={`text-right font-black font-mono tracking-tighter pr-2 ${
                             isBonDeLivraison && (data.part_assurance ?? 0) > 0 ? 'text-lg' : 'text-xl'
                          }`}>
                            {formatCurrency(data.total_ttc)}
                          </div>
                        </div>
                    </div>

                    {/* Bloc Tiers-Payant (Patient/Assurance) */}
                    {isBonDeLivraison && (data.part_assurance ?? 0) > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="grid grid-cols-[1fr,115px] items-center px-1 py-0.5 text-base-content/80">
                          <span className="text-[9px] uppercase font-bold tracking-widest pl-1">PART PATIENT</span>
                          <div className="text-right font-mono font-bold text-base-content text-base pr-2 text-right">
                            {formatCurrency(data.part_client ?? 0)}
                          </div>
                        </div>
                        <div className="bg-emerald-600 rounded-lg shadow-sm text-white grid grid-cols-[1fr,115px] items-center px-1 py-2.5 ring-1 ring-emerald-700/10">
                          <span className="text-[9px] uppercase font-black tracking-[0.1em] pl-1">PART ASSURANCE</span>
                          <div className="text-right font-mono font-black text-lg leading-none pr-2 text-right">
                            {formatCurrency(data.part_assurance ?? 0)}
                          </div>
                        </div>
                      </div>
                    )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col items-center">
                    <div className="text-[8px] uppercase font-black tracking-widest text-base-content/40 mb-6 text-center">Cachet & Signature</div>
                    <div className="w-full h-20 border-2 border-dashed border-slate-100 rounded-xl flex items-center justify-center text-[8px] text-slate-200 bg-slate-50/10 italic">
                        EMPLACEMENT CACHET
                    </div>
                </div>
            </div>
        </div>

        {/* LEGAL FOOTER */}
        <div className="mt-8 pt-4 border-t border-base-200 text-center">
            <p className="font-bold text-base-content text-[10.5px] mb-1.5">{settings.ticket_footer_message || 'Merci de votre confiance.'}</p>
            
            <div className="flex justify-center flex-wrap gap-x-8 gap-y-1 text-[8.5px] uppercase tracking-[0.1em] font-bold text-base-content/30">
               {settings.niu && <div className="flex items-center gap-1">NIU: <span className="text-base-content/80">{settings.niu}</span></div>}
               {settings.registre_commerce && <div className="flex items-center gap-1">RC: <span className="text-base-content/80">{settings.registre_commerce}</span></div>}
               <div className="flex items-center gap-1">LOGICIEL: <span className="text-base-content/80 uppercase">ZENITH</span></div>
            </div>
        </div>
      </div>

    </div>
  );
};

export default InvoiceTemplate;

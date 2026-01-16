import React from 'react';
import type { ProduitModel } from '../../types';

interface PharmacySettings {
  pharmacy_name: string;
  address: string;
  phone: string;
  email: string;
  ticket_footer_message: string;
  niu?: string;
  registre_commerce?: string;
  logo?: string;
}

interface InvoiceClient {
  id?: number;
  nom?: string;
  prenom?: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  niu?: string;
}

interface InvoiceItem {
  produit_nom: string;
  quantite: number;
  prix_unitaire: number;
  total_ligne: number;
  cip?: string;
}

interface InvoiceData {
  id_facture?: number;
  date: string;
  client: InvoiceClient | null;
  items: InvoiceItem[];
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  remise_globale?: number;
  montant_recu?: number;
  monnaie_rendue?: number;
  vendeur?: string;
  type_facture: 'VENTE' | 'DEVIS' | 'CREDIT';
}

interface InvoiceTemplateProps {
  settings: PharmacySettings;
  data: InvoiceData;
}

const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ settings, data }) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF' }).format(price);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white p-8 max-w-4xl mx-auto text-slate-800 font-sans" style={{ minHeight: '297mm', width: '210mm' }}>
      {/* HEADER */}
      <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
        <div>
          {settings.logo ? (
            <img src={settings.logo} alt="Logo" className="h-16 mb-2 object-contain" />
          ) : (
            <h1 className="text-3xl font-bold text-emerald-700 tracking-tight uppercase">{settings.pharmacy_name}</h1>
          )}
          <div className="text-sm text-slate-500 mt-2 space-y-1">
            <p className="flex items-center gap-2">
              📍 {settings.address || 'Adresse non configurée'}
            </p>
            <p className="flex items-center gap-2">
              📞 {settings.phone || 'N/A'}
            </p>
            {settings.email && (
              <p className="flex items-center gap-2">
                ✉️ {settings.email}
              </p>
            )}
          </div>
          <div className="mt-4 text-xs text-slate-400 space-y-0.5">
            {settings.niu && <p>NIU: {settings.niu}</p>}
            {settings.registre_commerce && <p>RC: {settings.registre_commerce}</p>}
          </div>
        </div>

        <div className="text-right">
          <h2 className="text-4xl font-light text-slate-300 uppercase tracking-widest mb-2">
            {data.type_facture === 'DEVIS' ? 'PROFORMA' : 'FACTURE'}
          </h2>
          <p className="text-lg font-bold text-slate-700">#{data.id_facture || 'N/A'}</p>
          <p className="text-sm text-slate-500 mb-4">{formatDate(data.date)}</p>
          
          {data.vendeur && (
            <div className="inline-block bg-slate-50 px-3 py-1 rounded border border-slate-100 text-xs">
              Vendeur: <span className="font-semibold">{data.vendeur}</span>
            </div>
          )}
        </div>
      </div>

      {/* CLIENT & INFO */}
      <div className="flex justify-between mb-8 gap-8">
        <div className="w-1/2">
           {/* Espace libre pour notes ou info vendeur si besoin */}
        </div>
        <div className="w-1/2 bg-slate-50 rounded-lg p-5 border border-slate-100">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-200 pb-1">Facturé à</h3>
          {data.client ? (
            <div className="text-sm space-y-1">
              <p className="font-bold text-lg text-slate-800">{data.client.nom} {data.client.prenom}</p>
              {data.client.adresse && <p>{data.client.adresse}</p>}
              {data.client.telephone && <p>Tél: {data.client.telephone}</p>}
              {data.client.niu && <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">NIU Client: {data.client.niu}</p>}
            </div>
          ) : (
            <p className="italic text-slate-500">Client Comptoir (Anonyme)</p>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-800 text-slate-800">
              <th className="py-3 px-4 text-left font-bold uppercase tracking-wider w-12">#</th>
              <th className="py-3 px-4 text-left font-bold uppercase tracking-wider">Désignation</th>
              <th className="py-3 px-4 text-right font-bold uppercase tracking-wider">P.U</th>
              <th className="py-3 px-4 text-right font-bold uppercase tracking-wider">Qté</th>
              <th className="py-3 px-4 text-right font-bold uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody className="text-slate-600">
            {data.items.map((item, index) => (
              <tr key={index} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4 text-slate-400">{index + 1}</td>
                <td className="py-3 px-4 font-medium text-slate-800">
                  {item.produit_nom}
                  {item.cip && <span className="block text-[10px] text-slate-400 font-mono">{item.cip}</span>}
                </td>
                <td className="py-3 px-4 text-right font-mono">{formatPrice(item.prix_unitaire)}</td>
                <td className="py-3 px-4 text-right">{item.quantite}</td>
                <td className="py-3 px-4 text-right font-bold text-slate-800 font-mono">{formatPrice(item.total_ligne)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* TOTALS */}
      <div className="flex justify-end mb-12">
        <div className="w-64 space-y-2">
          <div className="flex justify-between text-sm text-slate-500">
            <span>Sous-total HT</span>
            <span>{formatPrice(data.total_ht)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-500">
            <span>TVA</span>
            <span>{formatPrice(data.total_tva)}</span>
          </div>
          {data.remise_globale ? (
            <div className="flex justify-between text-sm text-emerald-600 font-medium">
              <span>Remise</span>
              <span>- {formatPrice(data.remise_globale)}</span>
            </div>
          ) : null}
          <div className="flex justify-between items-center pt-3 border-t-2 border-slate-800 mt-2">
            <span className="text-base font-bold text-slate-800 uppercase">Total TTC</span>
            <span className="text-xl font-bold text-emerald-700 font-mono">{formatPrice(data.total_ttc)}</span>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="mt-auto pt-8 border-t border-slate-100 text-center text-sm text-slate-500">
        <p className="font-medium text-slate-700 mb-1">{settings.ticket_footer_message}</p>
        <p className="text-xs text-slate-400">
          Les marchandises vendues ne sont ni reprises ni échangées au-delà de 3 jours.
          <br />
          Merci de votre confiance.
        </p>
      </div>
    </div>
  );
};

export default InvoiceTemplate;

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import InvoiceTemplate from './InvoiceTemplate';
import { usePharmacySettings } from '../../hooks/usePharmacySettings';

// Mock data fetcher - in real app would call API
const fetchInvoiceData = async (id: string) => {
    try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/factures/${id}/`);
        if (!response.ok) throw new Error('Facture introuvable');
        const data = await response.json();
        
        // Transform API data to InvoiceTemplate format
        return {
            id_facture: data.id,
            date: data.created_at,
            client: data.client ? {
                id: data.client.id,
                nom: data.client.nom,
                prenom: data.client.prenom,
                telephone: data.client.telephone,
                email: data.client.email,
                adresse: data.client.adresse,
                niu: data.client.niu
            } : null,
            items: data.lignes_facture.map((l: any) => ({
                produit_nom: l.produit_details?.name || 'Produit',
                quantite: l.quantite,
                prix_unitaire: Number(l.prix_unitaire),
                total_ligne: Number(l.total_ligne),
                cip: l.produit_details?.cip1
            })),
            total_ht: Number(data.total_ttc) / 1.1925, // Approx HT if not provided
            total_tva: 0, // Simplified for now, backend should provide detail
            total_ttc: Number(data.total_ttc),
            remise_globale: Number(data.remise_globale || 0),
            montant_recu: Number(data.montant_recu || 0),
            monnaie_rendue: Number(data.monnaie_rendue || 0),
            vendeur: data.vendeur_name,
            type_facture: data.statut === 'PROFORMA' ? 'DEVIS' : 'VENTE' as any
        };
    } catch (err) {
        console.error("Error fetching invoice:", err);
        return null;
    }
};

const PrintPage = () => {
    const [searchParams] = useSearchParams();
    const id = searchParams.get('id');
    const [invoiceData, setInvoiceData] = useState<any>(null);
    const { settings } = usePharmacySettings();

    useEffect(() => {
        if (id) {
            fetchInvoiceData(id).then(data => {
                if (data) {
                    setInvoiceData(data);
                    // Auto print when data is ready
                    setTimeout(() => window.print(), 1000);
                }
            });
        }
    }, [id]);

    if (!id) return <div>ID de facture manquant</div>;
    if (!invoiceData) return <div>Chargement de la facture...</div>;
    if (!settings) return <div>Chargement des paramètres...</div>;

    return (
        <InvoiceTemplate 
            settings={{
                pharmacy_name: settings.pharmacy_name || 'Ma Pharmacie',
                address: settings.address || '',
                phone: settings.phone || '',
                email: settings.email || '',
                ticket_footer_message: settings.ticket_footer_message || 'Merci de votre visite',
                niu: settings.niu,
                registre_commerce: settings.registre_commerce,
                logo: settings.logo
            }}
            data={invoiceData}
        />
    );
};

export default PrintPage;

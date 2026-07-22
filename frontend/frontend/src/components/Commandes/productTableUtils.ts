import type { CommandeProduit, ProduitModel } from '../../types';
import React from 'react';

export interface FieldConfig {
    name: string;
    editable: boolean;
}

export type SortBy = 'chrono' | 'stock' | 'name' | 'qty';
export type FieldType = 'quantity' | 'unites_gratuites' | 'price' | 'tva' | 'marge' | 'selling_price' | 'lot' | 'date_expiration' | 'prix_euro';

export const normalizeExpiryMMYY = (raw: string) => {
    const cleaned = String(raw ?? '').replace(/\s/g, '').replace(/[^0-9/]/g, '');
    if (cleaned === '') return '';
    const digits = cleaned.replace(/\//g, '').slice(0, 4);
    if (digits.length <= 2) {
        return digits;
    }
    const mm = digits.slice(0, 2);
    const yy = digits.slice(2);
    return `${mm}/${yy}`;
};

export const finalizeExpiryMMYY = (raw: string) => {
    const normalized = normalizeExpiryMMYY(raw);
    const match = normalized.match(/^(\d{1,2})(?:\/(\d{0,2}))?$/);
    if (!match) return '';
    const mmRaw = match[1] || '';
    const yyRaw = match[2] || '';
    if (mmRaw.length === 0) return '';
    const mmNum = Number(mmRaw);
    if (!Number.isFinite(mmNum) || mmNum < 1 || mmNum > 12) return '';
    if (yyRaw.length !== 2) return `${String(mmNum).padStart(2, '0')}${yyRaw ? `/${yyRaw}` : ''}`;
    return `${String(mmNum).padStart(2, '0')}/${yyRaw}`;
};

export const handleSelectAll = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
};

export interface ResolvedProductInfo {
    produitName: string;
    cip: string;
    isExclusive: boolean;
    supplierName: string;
    isDeleted: boolean;
    produitId: number | undefined;
}

export function resolveProductInfo(
    p: CommandeProduit,
    produitsList: ProduitModel[],
    t: (key: string, options?: Record<string, unknown>) => string
): ResolvedProductInfo {
    let produitName = '';
    let cip = '';
    let isExclusive = false;
    let supplierName = '';

    const isObjectProduit = p.produit && typeof p.produit === 'object';
    const produitId = isObjectProduit ? (p.produit as ProduitModel).id : (p.produit as number);

    if (isObjectProduit && (p.produit as ProduitModel).name) {
        produitName = (p.produit as ProduitModel).name;
        cip = (p.produit as ProduitModel).cip1 || '';
        isExclusive = (p.produit as ProduitModel).is_supplier_exclusive || false;
        supplierName = (p.produit as ProduitModel).fournisseur_name || '';
    } else {
        const found = produitId ? produitsList.find(prod => prod.id === produitId) : null;
        if (found) {
            produitName = found.name;
            cip = found.cip1 || '';
            isExclusive = found.is_supplier_exclusive || false;
            supplierName = found.fournisseur_name || '';
        } else if (p.produit_nom) {
            produitName = p.produit_nom;
            cip = p.produit_cip || p.produit_ref || '';
        } else if (p.produit === null) {
            produitName = t('common:unknown_product_deleted', { defaultValue: 'Produit inconnu (supprimé)' });
        } else {
            produitName = t('orders:product_table.unknown_product_id', { id: produitId, defaultValue: `Produit #${produitId}` });
        }
    }

    const isDeleted = p.produit === null || produitName.includes('(supprimé)');

    return { produitName, cip, isExclusive, supplierName, isDeleted, produitId };
}

export function resolveCip(p: CommandeProduit, produitsList: ProduitModel[]): string {
    if (p.produit && typeof p.produit === 'object' && p.produit.cip1) return p.produit.cip1;
    const produitId = (p.produit && typeof p.produit === 'object') ? p.produit.id : p.produit;
    const found = produitsList.find(prod => prod.id === produitId);
    if (found && found.cip1) return found.cip1;
    const flatCip = p.produit_cip || p.produit_ref;
    if (flatCip && flatCip !== p.produit_nom) return flatCip;
    return '-';
}

export function resolveStock(p: CommandeProduit): number {
    return (p.produit && typeof p.produit === 'object' && p.produit.stock !== undefined)
        ? p.produit.stock
        : p.produit_stock ?? 0;
}

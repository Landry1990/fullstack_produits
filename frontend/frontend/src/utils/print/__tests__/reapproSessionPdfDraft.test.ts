import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import i18next from 'i18next';

import frPrinting from '../../../../public/locales/fr/printing.json';
import enPrinting from '../../../../public/locales/en/printing.json';

vi.unmock('jspdf');
vi.unmock('jspdf-autotable');

import { setDocumentLanguage } from '../../documentLang';
import {
  generateReapproSessionPdfDraft,
  type ReapproSessionData,
} from '../reapproSessionPdfDraft';
import type { PharmacySettings } from '../../../hooks/usePharmacySettings';

const settings = {
  pharmacy_name: 'Pharmacie Test',
  address: 'Douala, Cameroun',
  phone: '600000000',
  locale: 'fr-FR',
} as PharmacySettings;

const session: ReapproSessionData = {
  id: 42,
  created_at: '2026-09-22T14:30:00Z',
  user_name: 'Jean Dupont',
  total_products: 2,
  total_units: 8,
  adjustments: [
    {
      id: 1,
      produit_name: 'Paracétamol 500 mg',
      lot_num: 'LOT-001',
      expiry: '2027-12-31',
      quantity_change: 5,
    },
    {
      id: 2,
      produit_name: 'Ibuprofène 400 mg',
      lot_num: null,
      expiry: null,
      quantity_change: 3,
    },
  ],
};

const pdfHeader = (buffer: ArrayBuffer) =>
  String.fromCharCode(...new Uint8Array(buffer).slice(0, 4));

beforeAll(async () => {
  await i18next.init({
    lng: 'fr',
    fallbackLng: 'fr',
    resources: {
      fr: { printing: frPrinting },
      en: { printing: enPrinting },
    },
  });
});

afterEach(() => setDocumentLanguage('fr-FR'));

describe('generateReapproSessionPdfDraft', () => {
  it('génère un PDF A4 valide à partir des données JSON de session', () => {
    setDocumentLanguage('fr-FR');

    const doc = generateReapproSessionPdfDraft(session, settings);
    const output = doc.output('arraybuffer');

    expect(pdfHeader(output)).toBe('%PDF');
    expect(output.byteLength).toBeGreaterThan(1000);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('accepte la langue documentaire anglaise et les valeurs de lot manquantes', () => {
    setDocumentLanguage('en-US');

    const doc = generateReapproSessionPdfDraft(
      { ...session, user_name: null },
      { ...settings, locale: 'en-US' } as PharmacySettings,
    );

    expect(pdfHeader(doc.output('arraybuffer'))).toBe('%PDF');
  });

  it('gère automatiquement les sessions longues sur plusieurs pages', () => {
    const adjustments = Array.from({ length: 120 }, (_, index) => ({
      id: index + 1,
      produit_name: `Produit de réapprovisionnement ${index + 1}`,
      lot_num: `LOT-${String(index + 1).padStart(3, '0')}`,
      expiry: '2028-06-30',
      quantity_change: index + 1,
    }));

    const doc = generateReapproSessionPdfDraft(
      {
        ...session,
        total_products: adjustments.length,
        total_units: adjustments.reduce((total, item) => total + item.quantity_change, 0),
        adjustments,
      },
      settings,
    );

    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(pdfHeader(doc.output('arraybuffer'))).toBe('%PDF');
  });
});

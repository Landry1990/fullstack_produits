import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { createInstance } from 'i18next';
import { PharmacyContactBlock } from './PharmacyContactBlock';
import fr from '../../../public/locales/fr/printing.json';
import en from '../../../public/locales/en/printing.json';

const i18n = createInstance();
await i18n.init({ resources: { fr: { printing: fr }, en: { printing: en } }, defaultNS: 'printing', lng: 'fr' });

describe('PharmacyContactBlock', () => {
  it.each([['fr', 'BP'], ['en', 'PO Box']])('affiche les coordonnées en %s', (lang, label) => {
    const { container } = render(
      <PharmacyContactBlock settings={{ post_box: '1234', city: 'Yaoundé' }} t={i18n.getFixedT(lang, 'printing')} />
    );
    expect(container).toHaveTextContent(`${label}: 1234 — Yaoundé`);
  });

  it('affiche la ville seule sans séparateur', () => {
    const { container } = render(<PharmacyContactBlock settings={{ city: 'Douala' }} t={i18n.getFixedT('fr')} />);
    expect(container.textContent).toBe('Douala');
  });

  it('affiche la boîte postale seule sans séparateur', () => {
    const { container } = render(<PharmacyContactBlock settings={{ post_box: '1234' }} t={i18n.getFixedT('fr')} />);
    expect(container.textContent).toBe('BP: 1234');
  });

  it('masque les coordonnées absentes', () => {
    const { container } = render(<PharmacyContactBlock settings={{ post_box: '', city: '' }} t={i18n.getFixedT('fr')} />);
    expect(container.textContent).toBe('');
  });
});

import type { TFunction } from 'i18next';

interface PharmacyContactInfo {
  address?: string;
  phone?: string;
  phone2?: string;
  email?: string;
  niu?: string;
  registre_commerce?: string;
}

export function PharmacyContactBlock({ settings, t }: { settings: PharmacyContactInfo; t: TFunction }) {
  return (
    <div className="space-y-1 text-base-content/60 max-w-sm text-label">
      <div className="whitespace-pre-line leading-tight italic">
        {settings.address}
      </div>
      <div className="flex flex-col gap-0.5 mt-2 font-bold text-base-content/90">
        {(settings.phone || settings.phone2) && (
          <div className="flex items-center gap-1">
            <span>{t('invoice.tel')} : {settings.phone}{settings.phone2 ? ` | ${settings.phone2}` : ''}</span>
          </div>
        )}
        {settings.email && (
          <div className="flex items-center gap-1">
            <span>{t('invoice.email', { defaultValue: 'Email' })} : {settings.email}</span>
          </div>
        )}
        <div className="flex items-center gap-1 uppercase">
          {settings.niu && <span>{t('invoice.niu')} : {settings.niu} |</span>}
          {settings.registre_commerce && <span>{t('invoice.rc')} : {settings.registre_commerce}</span>}
        </div>
      </div>
    </div>
  );
}

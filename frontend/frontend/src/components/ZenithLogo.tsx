import { useTranslation } from 'react-i18next';

interface ZenithLogoProps {
  variant?: 1 | 2 | 3;
  className?: string;
  size?: number;
}

export default function ZenithLogo({ className = '', size = 48 }: ZenithLogoProps) {
  const { t } = useTranslation('common');
  return (
    <img
      src="/logo.png"
      alt={t('aria.zenith_logo', { defaultValue: 'Zenith Pharma' })}
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  );
}

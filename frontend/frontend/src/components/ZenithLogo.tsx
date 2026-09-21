interface ZenithLogoProps {
  variant?: 1 | 2 | 3;
  className?: string;
  size?: number;
}

export default function ZenithLogo({ className = '', size = 48 }: ZenithLogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Zenith Pharma"
      className={className}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  );
}




interface ZenithLogoProps {
  variant?: 1 | 2 | 3;
  className?: string;
  size?: number;
}

export default function ZenithLogo({ variant = 1, className = '', size = 48 }: ZenithLogoProps) {
  const getLogo = () => {
    switch (variant) {
      case 1:
        // Concept 1: Modern "Z" integrating a medical cross
        return (
          <svg viewBox="0 0 100 100" className={className} style={{ width: size, height: size }}>
            <defs>
              <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#059669', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#064e3b', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            {/* Background Z shape */}
            <path 
              d="M25 25 H75 L25 75 H75" 
              fill="none" 
              stroke="url(#grad1)" 
              strokeWidth="12" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            {/* Integrated Cross */}
            <rect x="44" y="35" width="12" height="30" fill="#ffffff" opacity="0.9" rx="2" />
            <rect x="35" y="44" width="30" height="12" fill="#ffffff" opacity="0.9" rx="2" />
          </svg>
        );
      case 2:
        // Concept 2: Pinnacle/Apex with healthcare element
        return (
          <svg viewBox="0 0 100 100" className={className} style={{ width: size, height: size }}>
            <defs>
              <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#1e3a8a', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#1e40af', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            {/* Pinnacle shape */}
            <path 
              d="M50 15 L85 85 H15 L50 15Z" 
              fill="url(#grad2)" 
            />
            {/* Gold Accent (Peak highlight) */}
            <path 
              d="M50 15 L65 45 L50 35 L35 45 Z" 
              fill="#fbbf24" 
            />
            {/* Stylized Pill at base */}
            <rect x="35" y="65" width="30" height="12" rx="6" fill="#ffffff" opacity="0.8" />
            <line x1="50" y1="65" x2="50" y2="77" stroke="url(#grad2)" strokeWidth="1" />
          </svg>
        );
      case 3:
        // Concept 3: Dynamic Tech-Forward Apex
        return (
          <svg viewBox="0 0 100 100" className={className} style={{ width: size, height: size }}>
            <defs>
              <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#06b6d4', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#1d4ed8', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            {/* Abstract dynamic shape */}
            <path 
              d="M20 80 L50 20 L80 80" 
              fill="none" 
              stroke="url(#grad3)" 
              strokeWidth="10" 
              strokeLinecap="round"
            />
            <circle cx="50" cy="20" r="12" fill="url(#grad3)" />
            {/* Medical Pulse line integrated at the bottom */}
            <path 
              d="M30 80 H40 L45 70 L55 90 L60 80 H70" 
              fill="none" 
              stroke="#cbd5e1" 
              strokeWidth="4" 
              strokeLinecap="round"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  return getLogo();
}



interface PharmaCrossLogoProps {
  className?: string;
  size?: number;
}

export default function PharmaCrossLogo({ className = '', size = 48 }: PharmaCrossLogoProps) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={className}
      style={{ width: size, height: size }}
    >
      {/* Cercle extérieur */}
      <circle 
        cx="50" 
        cy="50" 
        r="45" 
        stroke="#22c55e" 
        strokeWidth="2" 
        fill="none" 
        opacity="0.2"
      />
      
      {/* Croix verticale */}
      <rect 
        x="42" 
        y="20" 
        width="16" 
        height="60" 
        fill="#22c55e" 
        rx="2"
      />
      
      {/* Croix horizontale */}
      <rect 
        x="20" 
        y="42" 
        width="60" 
        height="16" 
        fill="#22c55e" 
        rx="2"
      />
      
      {/* Point central pour effet 3D */}
      <circle 
        cx="50" 
        cy="50" 
        r="8" 
        fill="#16a34a"
      />
    </svg>
  );
}

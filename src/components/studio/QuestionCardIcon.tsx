export function QuestionCardIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 720 620" className={className} aria-hidden="true">
      <defs>
        <filter id="questionCardShadow" x="-25%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#2c3e50" floodOpacity=".15" />
        </filter>
      </defs>

      <g filter="url(#questionCardShadow)">
        <rect x="185" y="115" width="350" height="390" rx="34" fill="#fff" stroke="#2c3e50" strokeWidth="8" />
      </g>

      <circle cx="360" cy="225" r="52" fill="#E8A598" />
      <path
        d="M340 211c3-21 37-27 48-8 11 21-17 31-17 48"
        fill="none"
        stroke="#fff"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle cx="371" cy="269" r="5" fill="#fff" />

      <rect x="245" y="330" width="230" height="18" rx="9" fill="#dcd5d1" />
      <rect x="245" y="366" width="175" height="15" rx="7.5" fill="#c7bdb8" />

      <circle cx="255" cy="430" r="14" fill="#E8A598" stroke="#2c3e50" strokeWidth="5" />
      <path
        d="M247 430l7 7 13-16"
        fill="none"
        stroke="#fff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="290" y="421" width="145" height="16" rx="8" fill="#c7bdb8" />
    </svg>
  )
}

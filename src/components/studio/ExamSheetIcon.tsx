export function ExamSheetIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 720 760" className={className} aria-hidden="true">
      <defs>
        <filter id="examSheetShadow" x="-25%" y="-25%" width="150%" height="160%">
          <feDropShadow dx="0" dy="16" stdDeviation="15" floodColor="#2c3e50" floodOpacity=".16" />
        </filter>
      </defs>
      <g filter="url(#examSheetShadow)">
        <rect x="135" y="75" width="420" height="590" rx="30" fill="#fff" stroke="#2c3e50" strokeWidth="8" />
      </g>
      <rect x="190" y="130" width="235" height="20" rx="10" fill="#EAE4E2" />
      <g>
        <rect x="185" y="205" width="320" height="78" rx="20" fill="#F2EFED" />
        <circle cx="220" cy="244" r="14" fill="#fff" stroke="#2c3e50" strokeWidth="5" />
        <rect x="255" y="225" width="180" height="15" rx="7.5" fill="#dcd5d1" />
        <rect x="255" y="250" width="135" height="13" rx="6.5" fill="#c7bdb8" />

        <rect x="185" y="310" width="320" height="78" rx="20" fill="#F2EFED" />
        <circle cx="220" cy="349" r="14" fill="#E8A598" stroke="#2c3e50" strokeWidth="5" />
        <path
          d="M212 349l7 7 13-16"
          fill="none"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="255" y="330" width="195" height="15" rx="7.5" fill="#dcd5d1" />
        <rect x="255" y="355" width="155" height="13" rx="6.5" fill="#c7bdb8" />

        <rect x="185" y="415" width="320" height="78" rx="20" fill="#F2EFED" />
        <circle cx="220" cy="454" r="14" fill="#fff" stroke="#2c3e50" strokeWidth="5" />
        <rect x="255" y="435" width="170" height="15" rx="7.5" fill="#dcd5d1" />
        <rect x="255" y="460" width="145" height="13" rx="6.5" fill="#c7bdb8" />
      </g>
      <rect x="205" y="545" width="280" height="64" rx="20" fill="#fff0ec" />
      <circle cx="240" cy="577" r="12" fill="#E8A598" />
      <rect x="270" y="567" width="155" height="18" rx="9" fill="#e6b9ae" />
    </svg>
  )
}

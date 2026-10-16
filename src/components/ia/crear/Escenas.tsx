import type { CSSProperties } from 'react'

// Escenas animadas de las opciones de «Crear con IA» (una por opción). Son SVG con clases a-*: sin la
// clase cia-play en el contenedor se ve el fotograma final; con ella, la escena (ver crearIA.css y
// OpcionAnimada en Kit.tsx). Los textos son de ejemplo: ilustran la opción, no el documento.

const d = (s: number) => ({ '--d': `${s}s` }) as CSSProperties
const INK = '#2C3E50'

/** Mapa: el nodo raíz, tres ramas que se dibujan y sus hojas; «rico», cada hoja con un segundo dato. */
export function EscenaMapa({ rico }: { rico: boolean }) {
  const hojas = rico
    ? [['Clínica: lumbalgia', 'HLA-B27 en el 90 %'], ['RM: edema óseo', 'Rx: sindesmofitos'], ['AINE a dosis plenas', 'Anti-TNF si fracasan']]
    : [['Clínica'], ['RM'], ['AINE']]
  return (
    <svg viewBox="0 0 170 74" width="170" height="74" aria-hidden="true">
      <g className="a-pop" style={d(0)}>
        <rect x="4" y="29" width="40" height="16" rx="6" fill="var(--cia-acc)" stroke={INK} strokeWidth="1.5" />
        <text x="9" y="40" fontSize="6.5" fontWeight="900" fill="#fff">Esquema</text>
      </g>
      {hojas.map((h, i) => {
        const y = 6 + i * 22
        return (
          <g key={i}>
            <path className="a-draw" style={d(0.35 + i * 0.4)} d={`M44 37 C 56 37, 54 ${y + 8}, 66 ${y + 8}`} fill="none" stroke="var(--cia-acc-d)" strokeWidth="1.6" />
            <g className="a-pop" style={d(0.65 + i * 0.4)}>
              <rect x="66" y={y} width={rico ? 98 : 46} height={rico ? 19 : 15} rx="5" fill="#fff" stroke={INK} strokeWidth="1.5" />
              <text x="71" y={y + (rico ? 8 : 10)} fontSize={rico ? 6.5 : 7} fontWeight="700" fill={INK}>{h[0]}</text>
            </g>
            {rico && (
              <text className="a-fade" style={d(1.9 + i * 0.3)} x="71" y={y + 16} fontSize="6" fontWeight="500" fill="#7D8A96">{h[1]}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** Flashcards: caen `n` tarjetas al montón y la de arriba se «gira» de la pregunta a la respuesta. */
export function EscenaMonton({ n }: { n: number }) {
  const x = 56 + (n - 1) * 2
  const y = 36 - (n - 1) * 4
  const rotTop = ((n - 1) / 2) * 3
  const t = n * 0.22 + 0.5
  return (
    <svg viewBox="0 0 170 74" width="170" height="74" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <g key={i} transform={`rotate(${(i - (n - 1) / 2) * 3} 85 46)`}>
          <rect className="a-card" style={d(i * 0.22)} x={56 + i * 2} y={36 - i * 4} width="58" height="34" rx="6" fill="#fff" stroke={INK} strokeWidth="1.5" />
        </g>
      ))}
      <g transform={`rotate(${rotTop} 85 46)`}>
        <g className="a-fadeout" style={d(t + 0.6)}>
          <rect className="a-fade" style={d(t)} x={x + 6} y={y + 6} width="22" height="4" rx="2" fill="var(--cia-acc)" />
          <text className="a-fade" style={d(t)} x={x + 24} y={y + 25} fontSize="13" fontWeight="900" fill={INK}>?</text>
        </g>
        <rect className="a-fade" style={d(t + 0.8)} x={x + 8} y={y + 12} width="36" height="4" rx="2" fill={INK} />
        <rect className="a-fade" style={d(t + 0.95)} x={x + 8} y={y + 20} width="26" height="4" rx="2" fill="#C9D1D8" />
      </g>
    </svg>
  )
}

/** Resumen: se escriben los renglones y se abren los huecos; «literal», se copian del original. */
export function EscenaParrafo({ literal }: { literal: boolean }) {
  if (literal) {
    return (
      <svg viewBox="0 0 170 74" width="170" height="74" aria-hidden="true">
        <rect x="10" y="8" width="60" height="58" rx="6" fill="#fff" stroke="#C9D1D8" strokeWidth="1.5" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x="16" y={16 + i * 12} width={i === 3 ? 30 : 48} height="4" rx="2" fill="#C9D1D8" />
        ))}
        <rect className="a-scan" style={d(0.2)} x="13" y="12" width="54" height="10" rx="3" fill="var(--cia-acc)" fillOpacity=".35" />
        <path d="M76 37 h12" stroke="var(--cia-acc-d)" strokeWidth="2" strokeLinecap="round" />
        <path d="M84 33 l4 4 -4 4" fill="none" stroke="var(--cia-acc-d)" strokeWidth="2" strokeLinecap="round" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} className="a-line" style={d(0.45 + i * 0.4)} x="96" y={16 + i * 12} width={i === 3 ? 30 : 60} height="4" rx="2" fill={INK} />
        ))}
      </svg>
    )
  }
  const lineas = [[46, 30, 58], [64, 38, 30], [38, 30, 52]]
  return (
    <svg viewBox="0 0 170 74" width="170" height="74" aria-hidden="true">
      {lineas.map((l, r) => {
        let x = 10
        const y = 16 + r * 20
        return l.map((w, j) => {
          const el = j === 1
            ? <rect key={`${r}-${j}`} className="a-gap" style={d(1.5 + r * 0.35)} x={x} y={y - 6} width={w} height="11" rx="5.5" fill="var(--cia-soft)" stroke="var(--cia-acc-d)" strokeDasharray="3 2" />
            : <rect key={`${r}-${j}`} className="a-line" style={d(0.1 + (r * 2 + (j === 2 ? 1 : 0)) * 0.17)} x={x} y={y - 3} width={w} height="5" rx="2.5" fill="#C9D1D8" />
          x += w + 6
          return el
        })
      })}
    </svg>
  )
}

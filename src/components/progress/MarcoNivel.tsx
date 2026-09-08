'use client'

/* ════════════════════════════════════════════════════════════════════════
   El marco de nivel: la "skin" de la insignia.

   Antes la insignia era un cuadrado del color del rango. Ahora es una ficha
   de cartón: fondo crema, filo dorado y un cosido de puntos por dentro. Se
   dibuja en línea, no como <img>: así hereda el tamaño exacto que le pidan,
   escala sin pixelarse y no gasta una petición.

   DOS REGLAS DE GEOMETRÍA, que son lo único delicado de este archivo:

   1. El SVG mide 132 y el marco dibujado va de 0 a 120 (queda un respiro de 6
      por lado para que el filo no se corte). El marco ocupa por tanto el
      90,9 % del hueco, centrado.
   2. El cosido de puntos va de 9 a 111, o sea el 77,3 % del hueco. TODO lo que
      se escriba tiene que caber dentro de eso, que es lo que se pidió. Por eso
      el contenido vive en una caja del 75 % y los cuerpos de letra salen de
      una proporción del tamaño, no de valores fijos: con tres cifras (nivel
      100) es cuando más apurado va.
═══════════════════════════════════════════════════════════════════════════ */

/** Del hueco total, cuánto ocupa la zona segura de dentro del cosido. */
const DENTRO = 0.75

/** Marrón cálido para el rótulo. El color del rango se reserva para la cifra:
    a 9 px, un gris de rango sobre crema se lee mal. */
const TINTA_ROTULO = '#7A5943'

/** Tinta del kit visual, a la que se arrima el color del rango. */
const TINTA = { r: 0x2c, g: 0x3e, b: 0x50 }

/* Los colores de rango se eligieron para pintar sobre BLANCO. Sobre el crema
   del marco, el más claro —el gris de Novato, que es justo el que ve todo el
   mundo el primer día— se queda en 2,7:1 de contraste, por debajo del 3:1 que
   pide una cifra grande. Arrimarlos un 28 % a la tinta los baja lo justo: el
   rango se sigue reconociendo y la cifra se lee. Los rangos ya oscuros apenas
   se enteran. */
function haciaLaTinta(hex: string, cuanto = 0.28): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const mezcla = (canal: number, tinta: number) =>
    Math.round(canal * (1 - cuanto) + tinta * cuanto)
  const r = mezcla((n >> 16) & 0xff, TINTA.r)
  const g = mezcla((n >> 8) & 0xff, TINTA.g)
  const b = mezcla(n & 0xff, TINTA.b)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export function FondoNivel({ className }: { className?: string }) {
  return (
    <svg viewBox="-6 -6 132 132" className={className} aria-hidden focusable="false">
      <rect x="0" y="0" width="120" height="120" rx="12" ry="12" fill="#F5EBCE" />
      <rect
        x="0"
        y="0"
        width="120"
        height="120"
        rx="12"
        ry="12"
        fill="none"
        stroke="#DEBB7E"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect
        x="9"
        y="9"
        width="102"
        height="102"
        rx="8"
        ry="8"
        fill="none"
        stroke="#C4856A"
        strokeWidth="2.5"
        strokeDasharray="7 5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function MarcoNivel({
  nivel,
  tamano,
  color,
  className,
}: {
  nivel: number
  /** Lado en píxeles. Se respetan los que ya había: 64 en las tarjetas, 96 en
      la celebración. */
  tamano: number
  /** Color del rango, solo para la cifra. */
  color: string
  className?: string
}) {
  const rotulo = Math.max(9, Math.round(tamano * 0.13))
  /* Con tres cifras (el nivel 100, el último) el cuerpo baja: medido, un "100"
     al 0,36 dejaba 3,6 px de aire hasta el cosido y eso ya se lee como que
     roza. Al 0,30 respira. Es el único caso, así que no merece más lógica. */
  const cifra = Math.round(tamano * (nivel >= 100 ? 0.3 : 0.36))

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className ?? ''}`}
      style={{ width: tamano, height: tamano }}
    >
      <FondoNivel className="absolute inset-0 h-full w-full" />

      <span
        className="relative flex flex-col items-center justify-center text-center leading-none"
        style={{ width: `${DENTRO * 100}%`, height: `${DENTRO * 100}%` }}
      >
        <span
          className="font-black uppercase tracking-[0.14em]"
          style={{ fontSize: rotulo, color: TINTA_ROTULO }}
        >
          Nivel
        </span>
        <span
          className="font-black tabular-nums"
          style={{ fontSize: cifra, lineHeight: 1, color: haciaLaTinta(color) }}
        >
          {nivel}
        </span>
      </span>
    </span>
  )
}

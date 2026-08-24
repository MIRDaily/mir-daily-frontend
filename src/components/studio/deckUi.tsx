'use client'

/* ════════════════════════════════════════════════════════════════════════
   Kit visual de la pantalla de un mazo (Studio).

   Mismo lenguaje que la Academia de Electros, Flashcards y Perfil —borde de
   tinta, sombra dura y una textura que "explica" de qué va la pantalla— pero
   aquí la textura es la de una ficha de seguimiento: una trama de puntos,
   como un cuaderno de repaso, en vez de las rayas de las flashcards o el
   guilloche del carné. El adorno de cabecera es una pila de fichas con un
   anillo de progreso que marca el % de dominio del mazo — el dato central de
   toda esta pantalla. Todo se pinta con gradientes y SVG: escala a cualquier
   tamaño y no cuesta una imagen.
═══════════════════════════════════════════════════════════════════════════ */
import type { CSSProperties } from 'react'
import { motion } from 'framer-motion'

// Las primitivas del lenguaje (tarjeta, portada, botones…) son compartidas:
// se reexportan para que la pantalla de mazos importe de un solo sitio.
export {
  GhostButton,
  Hero,
  INK,
  SectionLabel,
  StatChip,
  StickerButton,
  StickerCard,
} from '@/components/ui/sticker'

import { INK } from '@/components/ui/sticker'

export const MUTED = '#7D8A96'

/** Paleta de estado, compartida por chips, opciones y filtros de prioridad. */
export const STATUS_TONE = {
  new: { fg: '#5D7A93', bg: '#EAF0F5', border: '#CBD9E3' },
  failed: { fg: '#C4655A', bg: '#FFF1EE', border: '#F1C6BD' },
  learning: { fg: '#B4831F', bg: '#FBF3E1', border: '#EBD6A3' },
  mastered: { fg: '#5C7A59', bg: '#EAF2E8', border: '#CFE0CC' },
} as const

export type StatusKey = keyof typeof STATUS_TONE

/** Trama de puntos: como una ficha de seguimiento, en vez de renglones. */
export function trackerPaper(tint: string = MUTED, opacity = 0.16): CSSProperties {
  return {
    backgroundColor: '#fff',
    backgroundImage: [
      `radial-gradient(${hexToRgba(tint, opacity)} 1.4px, transparent 1.6px)`,
      `linear-gradient(135deg, ${hexToRgba(tint, 0.08)} 0%, transparent 55%)`,
    ].join(','),
    backgroundSize: '15px 15px, 100% 100%',
    backgroundPosition: '3px 3px, 0 0',
  }
}

/** Misma trama, pero pensada para fondos de página completos (muy tenue). */
export function trackerBackdropStyle(): CSSProperties {
  return {
    backgroundImage: `radial-gradient(rgba(125,138,150,0.14) 1.3px, transparent 1.6px)`,
    backgroundSize: '18px 18px',
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const int = Number.parseInt(full, 16)
  if (Number.isNaN(int)) return hex
  const r = (int >> 16) & 255
  const g = (int >> 8) & 255
  const b = int & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/* ─── Arte decorativo: fichas apiladas + anillo de dominio ─────────────── */
export function DeckProgressArt({
  accent = '#E8A598',
  percent = null,
}: {
  accent?: string
  /** null cuando aún no hay datos suficientes: dibuja el anillo apagado. */
  percent?: number | null
}) {
  const known = percent != null
  const clamped = known ? Math.max(0, Math.min(100, percent)) : 0
  const radius = 32
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)

  return (
    <motion.svg
      viewBox="0 0 200 150"
      className="h-28 w-36 lg:h-36 lg:w-48"
      aria-hidden
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* fichas de detrás, apenas asomando */}
      <motion.g
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        transform="translate(10 16) rotate(-6 90 70)"
      >
        <rect x="24" y="18" width="136" height="100" rx="14" fill="#FFF5F2" stroke={INK} strokeWidth="4" />
      </motion.g>
      <motion.g
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        transform="translate(4 8) rotate(3 90 70)"
      >
        <rect x="24" y="18" width="136" height="100" rx="14" fill="#FFFFFF" stroke={INK} strokeWidth="4" />
      </motion.g>

      {/* ficha de delante, con el anillo de dominio */}
      <motion.g
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <rect x="24" y="18" width="136" height="100" rx="14" fill="#FFFFFF" stroke={INK} strokeWidth="4" />
        <circle cx="92" cy="66" r={radius} fill="none" stroke="#EFEAE7" strokeWidth="9" />
        {known ? (
          <motion.circle
            cx="92"
            cy="66"
            r={radius}
            fill="none"
            stroke={accent}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circumference}
            transform="rotate(-90 92 66)"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          />
        ) : (
          <text x="92" y="72" textAnchor="middle" fontSize="15" fontWeight="900" fill="#B9B2AD">
            ?
          </text>
        )}
        {known ? (
          <text x="92" y="73" textAnchor="middle" fontSize="24" fontWeight="900" fill={INK}>
            {Math.round(clamped)}%
          </text>
        ) : null}
        <rect x="46" y="98" width="92" height="9" rx="4.5" fill="#EFEAE7" />
      </motion.g>
    </motion.svg>
  )
}

/**
 * Insignia de dominio, para la esquina de la portada de un mazo: un disco de
 * cristal (fondo blanco esmerilado + borde de tinta, como el resto del kit)
 * con el anillo de progreso y el % dentro — una sola pieza en vez de la
 * ilustración de fichas + una pastilla de texto suelta debajo. Más compacta,
 * y se lee igual de bien sobre cualquier fondo de portada.
 */
export function DeckMasteryBadge({ percent }: { percent: number | null }) {
  const known = percent != null
  const clamped = known ? Math.max(0, Math.min(100, percent)) : 0
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center gap-1.5 rounded-2xl border-2 bg-white/90 px-3.5 py-3 backdrop-blur-sm"
      style={{ borderColor: INK, boxShadow: '3px 3px 0 0 #2c3e50' }}
    >
      <svg viewBox="0 0 72 72" className="h-14 w-14 lg:h-16 lg:w-16" aria-hidden>
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#EFEAE7" strokeWidth="7" />
        {known ? (
          <motion.circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            stroke="#E8A598"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            transform="rotate(-90 36 36)"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          />
        ) : null}
        <text x="36" y="42" textAnchor="middle" fontSize={known ? 18 : 20} fontWeight="900" fill={INK}>
          {known ? `${Math.round(clamped)}%` : '–'}
        </text>
      </svg>
      <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#7D8A96]">Dominio</span>
    </motion.div>
  )
}

/**
 * Resalta, "subrayado con marcador", las coincidencias de una búsqueda dentro
 * de un texto — para localizar de un vistazo qué parte de la pregunta encajó.
 */
export function HighlightedText({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim()
  if (!trimmed) return <>{text}</>

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark key={i} className="rounded-[3px] bg-[#FDE68A] px-0.5 font-black text-[#2C3E50]">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  )
}

/**
 * Brillo premium: una franja de luz diagonal que recorre el botón de lado a
 * lado, como un reflejo pasando sobre cristal o metal pulido. Quieta por
 * defecto; solo se dispara cuando `burstKey` cambia (se incrementa en cada
 * click desde el padre). El `key={burstKey}` fuerza el remount en cada
 * click, así el barrido se reproduce entero de cero en vez de encadenarse.
 * El contenedor que la use necesita `position: relative` y `overflow-hidden`
 * para que la franja quede recortada dentro de la forma del botón.
 */
export function PremiumShimmer({ burstKey = 0 }: { burstKey?: number }) {
  if (burstKey <= 0) return null

  return (
    <motion.span
      key={`shimmer-${burstKey}`}
      aria-hidden
      className="pointer-events-none absolute inset-y-0 w-1/4"
      style={{
        background:
          'linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.05) 30%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.05) 70%, transparent 100%)',
      }}
      initial={{ left: '-45%' }}
      animate={{ left: '115%' }}
      transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
    />
  )
}

/* ─── Gradientes de la portada de un mazo ──────────────────────────────────
   Cada preset son tres colores (claro / oscuro / medio) que se pintan como
   una malla de manchas difuminadas que van a la deriva muy despacio. Todo el
   movimiento es `transform` sobre capas absolutas, así que no toca el layout
   de la tarjeta ni provoca reflow por mucho que se mueva.
─────────────────────────────────────────────────────────────────────────── */
export type DeckGradientId = 'apricot' | 'slate' | 'ember' | 'violet' | 'inferno' | 'sage'

export const DECK_GRADIENTS: Record<
  DeckGradientId,
  { label: string; light: string; dark: string; mid: string }
> = {
  apricot: { label: 'Albaricoque', light: '#FFDAB9', dark: '#4E2C23', mid: '#E2725B' },
  slate: { label: 'Pizarra', light: '#E5E4E2', dark: '#0A0A0A', mid: '#536878' },
  ember: { label: 'Brasa', light: '#FFD700', dark: '#800020', mid: '#FF4500' },
  violet: { label: 'Violeta', light: '#E6E6FA', dark: '#240A24', mid: '#9932CC' },
  inferno: { label: 'Carmesí', light: '#FAFBFD', dark: '#AA0003', mid: '#BFB4DC' },
  sage: { label: 'Salvia', light: '#F0E5DE', dark: '#6F1D1B', mid: '#ADBDAB' },
}

export const DECK_GRADIENT_IDS = Object.keys(DECK_GRADIENTS) as DeckGradientId[]

export const DEFAULT_DECK_GRADIENT: DeckGradientId = 'apricot'

export function isDeckGradientId(value: unknown): value is DeckGradientId {
  return typeof value === 'string' && value in DECK_GRADIENTS
}

/**
 * Bandas de color: elipses SÓLIDAS mucho más grandes que la tarjeta y con
 * desenfoque. Es lo que da el corte curvo y suave entre tonos de las
 * referencias — un `radial-gradient` que se desvanece no lo consigue, porque
 * difumina el color en vez de dejar una frontera limpia y curva.
 *
 * En las referencias las bandas van en vertical (oscuro arriba → claro
 * abajo). Aquí el banner es ancho y bajo, así que la composición se gira: el
 * claro ocupa la izquierda (donde vive el título, que sigue en tinta) y el
 * oscuro florece por la derecha.
 */
type GradientBand = {
  tone: 'light' | 'dark' | 'mid'
  /** Caja de la elipse, en % de la tarjeta. Se sale por todos lados. */
  box: { left: string; top: string; width: string; height: string }
  drift: { x: string[]; y: string[]; rotate: number[]; scale: number[] }
  duration: number
}

// Se pintan en orden: primero el medio, y encima el oscuro. Las elipses no
// son enormes de más: si se pasan de alto, su borde cruza la tarjeta casi
// recto y se pierde la curva; estas alturas dejan ver el arco.
const GRADIENT_BANDS: GradientBand[] = [
  {
    tone: 'mid',
    box: { left: '30%', top: '-115%', width: '205%', height: '330%' },
    drift: { x: ['0%', '-4%', '2%'], y: ['0%', '3%', '-2%'], rotate: [-9, -3, -7], scale: [1, 1.06, 0.98] },
    duration: 10.5,
  },
  {
    tone: 'dark',
    box: { left: '76%', top: '-135%', width: '205%', height: '370%' },
    drift: { x: ['0%', '4%', '-2%'], y: ['0%', '-4%', '2%'], rotate: [7, 2, 5], scale: [1, 1.05, 0.99] },
    duration: 8.5,
  },
]

/** Grano fino: rompe las bandas de color y las hace menos "plásticas". */
const GRAIN_DATA_URI =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.85'/%3E%3C/svg%3E\")"

/**
 * Fondo animado de la portada de un mazo: tres tonos en bandas curvas que van
 * a la deriva muy despacio, más un velo de grano.
 */
export function DeckBannerGradient({ id }: { id: DeckGradientId }) {
  const palette = DECK_GRADIENTS[id] ?? DECK_GRADIENTS[DEFAULT_DECK_GRADIENT]

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      // La base es el tono claro: asoma allí donde no llega ninguna banda.
      style={{ backgroundColor: palette.light, isolation: 'isolate' }}
    >
      {GRADIENT_BANDS.map((band, index) => (
        <motion.div
          key={`${id}-${index}`}
          className="absolute"
          style={{
            left: band.box.left,
            top: band.box.top,
            width: band.box.width,
            height: band.box.height,
            borderRadius: '48%',
            backgroundColor: palette[band.tone],
            filter: 'blur(38px)',
            willChange: 'transform',
          }}
          animate={band.drift}
          transition={{
            duration: band.duration,
            repeat: Infinity,
            repeatType: 'mirror',
            ease: 'easeInOut',
            delay: index * 1.2,
          }}
        />
      ))}

      <div
        className="absolute inset-0"
        style={{ backgroundImage: GRAIN_DATA_URI, opacity: 0.05, mixBlendMode: 'soft-light' }}
      />
    </div>
  )
}

/**
 * Versión estática (sin blur ni animación) del mismo degradado, para sitios
 * donde puede haber muchas tarjetas a la vez — la galería general de mazos,
 * por ejemplo. Un `linear-gradient` de CSS es esencialmente gratis de pintar
 * incluso multiplicado por decenas de tarjetas; las manchas con `blur()` y
 * `framer-motion` de `DeckBannerGradient` no lo son.
 */
export function getStaticDeckGradientStyle(id: DeckGradientId): CSSProperties {
  const palette = DECK_GRADIENTS[id] ?? DECK_GRADIENTS[DEFAULT_DECK_GRADIENT]
  return {
    backgroundImage: `linear-gradient(135deg, ${palette.light} 0%, ${palette.mid} 55%, ${palette.dark} 100%)`,
  }
}

/** Muestra circular de un preset, para el selector. */
export function DeckGradientSwatch({ id, size = 22 }: { id: DeckGradientId; size?: number }) {
  const palette = DECK_GRADIENTS[id] ?? DECK_GRADIENTS[DEFAULT_DECK_GRADIENT]
  return (
    <span
      aria-hidden
      className="block shrink-0 rounded-full border-2 border-[#2c3e50]"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 25%, ${palette.light} 0%, ${palette.mid} 55%, ${palette.dark} 100%)`,
      }}
    />
  )
}

/** Anillo de dominio pequeño, para usarlo suelto en tarjetas de estadística. */
export function MiniRing({
  percent,
  color = '#E8A598',
  size = 44,
}: {
  percent: number | null
  color?: string
  size?: number
}) {
  const known = percent != null
  const clamped = known ? Math.max(0, Math.min(100, percent)) : 0
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)
  const c = size / 2

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
      <circle cx={c} cy={c} r={radius} fill="none" stroke="#EFEAE7" strokeWidth="5" />
      {known ? (
        <circle
          cx={c}
          cy={c}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${c} ${c})`}
        />
      ) : null}
    </svg>
  )
}

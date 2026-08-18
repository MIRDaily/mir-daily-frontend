'use client'

/* ════════════════════════════════════════════════════════════════════════
   Kit visual del perfil.

   Mismo lenguaje que la Academia de Electros, Flashcards y Simulacros
   —borde de tinta, sombra dura y una textura que "explica" de qué va la
   pantalla— pero aquí la textura es la de un carné plastificado: guilloche
   (el entramado de líneas finas de los documentos acreditativos), campos
   rotulados y un brillo de laminado que cruza muy de vez en cuando. Todo
   pintado con gradientes: escala a cualquier tamaño y no cuesta una imagen.
═══════════════════════════════════════════════════════════════════════════ */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Las primitivas del lenguaje (tarjeta, botones, rótulos…) son compartidas:
// se reexportan para que los módulos del perfil importen de un solo sitio.
export {
  GhostButton,
  INK,
  SectionLabel,
  StatChip,
  StickerButton,
  StickerCard,
} from '@/components/ui/sticker'

import { INK } from '@/components/ui/sticker'

export const ACCENT = '#E8A598'
export const MUTED = '#7D8A96'

/** Fondo de carné: guilloche cruzado + viñeta tenue del color de marca. */
export function laminatedPaper(tint: string = ACCENT): CSSProperties {
  return {
    backgroundColor: '#fff',
    backgroundImage: [
      `repeating-linear-gradient(56deg, ${tint}1a 0 1px, transparent 1px 10px)`,
      `repeating-linear-gradient(-56deg, ${tint}14 0 1px, transparent 1px 10px)`,
      `radial-gradient(circle at 84% 6%, ${tint}2e 0, transparent 42%)`,
      `radial-gradient(circle at 4% 96%, ${tint}1f 0, transparent 38%)`,
      'linear-gradient(135deg, #ffffff 0%, #FFFCFB 55%, #FFF4EF 100%)',
    ].join(','),
  }
}

/** Brillo del plastificado: una banda diagonal que cruza muy de vez en cuando.
 *
 *  Es la única animación en bucle del perfil, así que se porta bien: se apaga
 *  con `prefers-reduced-motion`, mientras la tarjeta no está en pantalla y
 *  mientras hay un diálogo abierto encima (animar debajo de un `backdrop-blur`
 *  obliga a recomponer el desenfoque en cada fotograma). */
export function LaminateSheen({ paused = false }: { paused?: boolean }) {
  const reduced = useReducedMotion()
  const hostRef = useRef<HTMLDivElement>(null)
  const [onScreen, setOnScreen] = useState(true)

  useEffect(() => {
    const node = hostRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { threshold: 0 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const running = !reduced && onScreen && !paused

  return (
    <div ref={hostRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {running ? (
        <motion.div
          className="absolute inset-y-[-40%] left-[-45%] w-1/3"
          style={{
            // Coral translúcido en vez de `mix-blend-mode`: sobre una tarjeta
            // clara se ve igual y ahorra recomponer la mezcla en cada
            // fotograma. Se mueve con `x` (transform) y no con `left`, que
            // recalcularía el layout. La diagonal la da el ángulo del
            // gradiente: una utilidad `skew-*` la pisaría framer al animar.
            background:
              'linear-gradient(100deg, transparent 0%, rgba(232,165,152,0.20) 42%, rgba(255,255,255,0.75) 56%, transparent 100%)',
            willChange: 'transform',
          }}
          initial={{ x: '0%' }}
          animate={{ x: ['0%', '560%'] }}
          transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 7, ease: 'easeInOut' }}
        />
      ) : null}
    </div>
  )
}

/* ─── Campos y distintivos del documento ───────────────────────────────── */

/** Rótulo diminuto arriba y valor debajo, como los campos de un carné. */
export function Field({
  icon,
  label,
  value,
  accent = ACCENT,
}: {
  icon: string
  label: string
  value: ReactNode
  accent?: string
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="flex h-4 w-4 items-center justify-center" style={{ color: accent }}>
          <span className="material-symbols-outlined" style={{ fontSize: 15 }} aria-hidden>
            {icon}
          </span>
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7D8A96]/80">
          {label}
        </span>
      </div>
      <p
        className="mt-0.5 truncate text-sm font-bold text-[#2C3E50]"
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </p>
    </div>
  )
}

/** Pastilla con icono, para estados y metadatos del carné. */
export function DocChip({
  icon,
  children,
  tone = 'neutral',
}: {
  icon?: string
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'success' | 'ink'
}) {
  const tones = {
    neutral: { bg: '#ffffff', fg: '#7D8A96', border: '#EAE4E2' },
    accent: { bg: '#FFF4EF', fg: '#B9705F', border: '#F1D3C9' },
    success: { bg: '#EAF2E8', fg: '#5F7E5C', border: '#CFE0CC' },
    ink: { bg: INK, fg: '#ffffff', border: INK },
  } as const
  const t = tones[tone]

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-[11px] font-bold"
      style={{ backgroundColor: t.bg, color: t.fg, borderColor: t.border }}
    >
      {icon ? (
        <span className="flex h-4 w-4 items-center justify-center">
          <span className="material-symbols-outlined" style={{ fontSize: 14 }} aria-hidden>
            {icon}
          </span>
        </span>
      ) : null}
      {children}
    </span>
  )
}

/* ─── Código de barras ─────────────────────────────────────────────────── */

function hashSeed(seed: string) {
  // FNV-1a: barajado barato y estable para derivar el código del id.
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Barras deterministas: el mismo usuario ve siempre su mismo código. */
export function SerialBarcode({ seed, height = 26 }: { seed: string; height?: number }) {
  const bars = useMemo(
    () => Array.from({ length: 42 }, (_, i) => 1 + (hashSeed(`${seed}:${i}`) % 3)),
    [seed],
  )

  return (
    <span className="flex items-end gap-[2px]" aria-hidden style={{ height }}>
      {bars.map((width, i) => (
        <span
          key={i}
          style={{
            width,
            height: i % 5 === 0 ? height : height - 5,
            backgroundColor: i % 2 === 0 ? INK : 'transparent',
            borderRadius: 1,
          }}
        />
      ))}
    </span>
  )
}

/** Serie legible del carné, derivada del mismo id. */
export function serialOf(seed: string) {
  return hashSeed(seed).toString(36).toUpperCase().padStart(7, '0').slice(-7)
}

/* ─── Controles ────────────────────────────────────────────────────────── */

/** Interruptor con borde de tinta, para las preferencias. */
export function InkSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 border-[#2c3e50] transition-colors"
      style={{ backgroundColor: checked ? ACCENT : '#EFEAE7' }}
    >
      <motion.span
        className="block h-5 w-5 rounded-full border-2 border-[#2c3e50] bg-white"
        animate={{ x: checked ? 28 : 4 }}
        transition={{ type: 'spring', stiffness: 520, damping: 34 }}
      />
    </button>
  )
}

/** Campo de texto con el mismo trazo que el resto del sistema. */
export function InkInput({
  value,
  onChange,
  onKeyDown,
  disabled,
  maxLength,
  prefix,
  placeholder,
  ariaLabel,
  autoFocus,
  invalid,
}: {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  disabled?: boolean
  maxLength?: number
  prefix?: string
  placeholder?: string
  ariaLabel: string
  autoFocus?: boolean
  invalid?: boolean
}) {
  return (
    <div
      className={`flex w-full items-center gap-1 rounded-2xl border-2 bg-white px-4 py-3 transition-colors focus-within:border-[#2c3e50] ${
        invalid ? 'border-[#E6B0A6]' : 'border-[#EAE4E2]'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      {prefix ? <span className="text-sm font-black text-[#7D8A96]">{prefix}</span> : null}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="w-full bg-transparent text-sm font-bold text-[#2C3E50] outline-none placeholder:font-medium placeholder:text-[#B9B2AD]"
      />
    </div>
  )
}

'use client'

/* ════════════════════════════════════════════════════════════════════════
   Kit visual de flashcards.

   Mismo lenguaje que la Academia de Electros —borde de tinta, sombra dura y
   una textura que "explica" de qué va la herramienta— pero con la ficha de
   cartulina rayada en lugar del papel milimetrado del ECG. Todo se pinta con
   gradientes repetidos: escala a cualquier tamaño y no cuesta una imagen.
═══════════════════════════════════════════════════════════════════════════ */
import type { CSSProperties, ReactNode } from 'react'
import { motion } from 'framer-motion'

export const INK = '#2c3e50'

/** Cartulina rayada: renglones y margen, como una ficha de estudio de verdad. */
export function ruledPaper(line = 'rgba(125,138,150,0.16)', step = 28): CSSProperties {
  return {
    backgroundColor: '#fff',
    backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${step - 1}px, ${line} ${step - 1}px ${step}px)`,
    backgroundPosition: '0 6px',
  }
}

/** Variante teñida con el color de la asignatura, para las caras de tarjeta. */
export function tintedPaper(tint: string, step = 30): CSSProperties {
  return {
    backgroundColor: '#fff',
    backgroundImage: [
      `repeating-linear-gradient(to bottom, transparent 0 ${step - 1}px, rgba(125,138,150,0.13) ${step - 1}px ${step}px)`,
      `linear-gradient(135deg, ${tint}14 0%, transparent 55%)`,
    ].join(','),
    backgroundPosition: '0 8px, 0 0',
  }
}

/**
 * Tarjeta con borde de tinta y sombra dura: la pieza base de todo el rediseño,
 * la misma que usan las tarjetas del Studio y los escenarios de la Academia.
 */
export function StickerCard({
  children,
  className = '',
  depth = 5,
  as: Tag = 'div',
  style,
}: {
  children: ReactNode
  className?: string
  depth?: number
  as?: 'div' | 'section' | 'article' | 'aside'
  style?: CSSProperties
}) {
  const Comp = Tag
  return (
    <Comp
      className={`rounded-3xl border-2 border-[#2c3e50] bg-white ${className}`}
      style={{ boxShadow: `${depth}px ${depth}px 0 0 ${INK}`, ...style }}
    >
      {children}
    </Comp>
  )
}

/** Cabecera de sección: distintivo, título grande y hueco para acciones. */
export function Hero({
  badge,
  badgeIcon,
  title,
  subtitle,
  accent = '#E8A598',
  actions,
  aside,
  children,
}: {
  badge: string
  badgeIcon?: string
  title: ReactNode
  subtitle?: ReactNode
  accent?: string
  actions?: ReactNode
  aside?: ReactNode
  children?: ReactNode
}) {
  return (
    <motion.header
      className="relative overflow-hidden rounded-3xl border-2 border-[#2c3e50] bg-gradient-to-br from-white via-[#FFFBFA] to-[#FFF2ED] px-6 py-7 sm:px-9 sm:py-8"
      style={{ boxShadow: `7px 7px 0 0 ${INK}` }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 max-w-2xl">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
            style={{ backgroundColor: `${accent}26`, color: accent }}
          >
            {badgeIcon ? <span className="material-symbols-outlined text-sm">{badgeIcon}</span> : null}
            {badge}
          </span>
          <h1 className="mt-3 truncate text-3xl font-black leading-[1.05] tracking-tight text-[#2C3E50] sm:text-4xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-base font-light leading-relaxed text-[#7D8A96] sm:text-lg">{subtitle}</p>
          ) : null}
          {children}
        </div>

        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>

      {actions ? <div className="relative z-10 mt-6 flex flex-wrap gap-3">{actions}</div> : null}
    </motion.header>
  )
}

/** Botón sólido con borde de tinta. */
export function StickerButton({
  children,
  onClick,
  color = '#E8A598',
  icon,
  disabled,
  type = 'button',
  className = '',
  title,
}: {
  children: ReactNode
  onClick?: () => void
  color?: string
  icon?: string
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
  title?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center justify-center gap-2 rounded-2xl border-2 border-[#2c3e50] px-5 py-3 text-sm font-black text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 ${className}`}
      style={{ backgroundColor: color, boxShadow: `4px 4px 0 0 ${INK}` }}
    >
      {icon ? <span className="material-symbols-outlined text-lg">{icon}</span> : null}
      {children}
    </button>
  )
}

/** Botón secundario: mismo peso, sin relleno. */
export function GhostButton({
  children,
  onClick,
  icon,
  disabled,
  className = '',
  title,
}: {
  children: ReactNode
  onClick?: () => void
  icon?: string
  disabled?: boolean
  className?: string
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center justify-center gap-2 rounded-2xl border-2 border-[#EAE4E2] bg-white px-5 py-3 text-sm font-bold text-[#7D8A96] transition-all hover:-translate-y-0.5 hover:border-[#2c3e50] hover:text-[#2C3E50] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:border-[#EAE4E2] ${className}`}
    >
      {icon ? <span className="material-symbols-outlined text-lg">{icon}</span> : null}
      {children}
    </button>
  )
}

/** Rótulo de sección con línea, para separar bloques sin cargar la vista. */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7D8A96]/70">{children}</span>
      <div className="h-px flex-1 bg-[#E6DEDA]" />
      {right}
    </div>
  )
}

/** Contador redondo, para las cifras de la portada. */
export function StatChip({ value, label, color = '#E8A598' }: { value: ReactNode; label: string; color?: string }) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-xl border-2 border-[#EAE4E2] bg-white px-3 py-2">
      <span className="text-lg font-black tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-wide text-[#7D8A96]/70">{label}</span>
    </div>
  )
}

/* ─── Arte decorativo: una pila de fichas ──────────────────────────────── */
export function CardStackArt({ accent = '#E8A598' }: { accent?: string }) {
  const sheets = [
    { x: 14, y: 18, rot: -7, fill: '#FFF5F2', delay: 0 },
    { x: 7, y: 9, rot: 4, fill: '#FFFFFF', delay: 0.08 },
    { x: 0, y: 0, rot: -2, fill: '#FFFFFF', delay: 0.16 },
  ]

  return (
    <motion.svg
      viewBox="0 0 200 150"
      className="h-32 w-40 lg:h-40 lg:w-52"
      aria-hidden
      animate={{ y: [0, -7, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
    >
      {sheets.map((s, i) => (
        <motion.g
          key={i}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: s.delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          transform={`translate(${s.x} ${s.y}) rotate(${s.rot} 90 70)`}
        >
          <rect x="22" y="16" width="140" height="102" rx="12" fill={s.fill} stroke={INK} strokeWidth="4" />
          {i === sheets.length - 1 ? (
            <>
              <line x1="40" y1="52" x2="144" y2="52" stroke="#D9D2CE" strokeWidth="3.5" strokeLinecap="round" />
              <line x1="40" y1="72" x2="126" y2="72" stroke="#D9D2CE" strokeWidth="3.5" strokeLinecap="round" />
              <line x1="40" y1="92" x2="108" y2="92" stroke="#D9D2CE" strokeWidth="3.5" strokeLinecap="round" />
              <rect x="40" y="30" width="42" height="11" rx="5.5" fill={accent} />
            </>
          ) : null}
        </motion.g>
      ))}
    </motion.svg>
  )
}

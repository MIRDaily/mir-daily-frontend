'use client'

/* ════════════════════════════════════════════════════════════════════════
   Primitivas del lenguaje visual de la web: borde de tinta, sombra dura y
   tipografía de marca. Nacieron en la Academia de Electros y las comparten
   flashcards, el creador de simulacros y lo que venga, para no acabar con
   tres copias del mismo botón.
═══════════════════════════════════════════════════════════════════════════ */
import type { CSSProperties, ReactNode } from 'react'
import { motion } from 'framer-motion'

export const INK = '#2c3e50'

/** Tarjeta con borde de tinta y sombra dura. */
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

/** Cabecera de página: distintivo, título grande, acciones y arte opcional. */
export function Hero({
  badge,
  badgeIcon,
  title,
  subtitle,
  accent = '#E8A598',
  actions,
  aside,
  children,
  backdrop,
}: {
  /** Opcional: si la pantalla ya se explica sola, el distintivo sobra. */
  badge?: string
  badgeIcon?: string
  title: ReactNode
  subtitle?: ReactNode
  accent?: string
  actions?: ReactNode
  aside?: ReactNode
  children?: ReactNode
  /** Capa de fondo opcional (se pinta bajo el contenido, dentro del recorte). */
  backdrop?: ReactNode
}) {
  return (
    <motion.header
      className="relative overflow-hidden rounded-3xl border-2 border-[#2c3e50] bg-gradient-to-br from-white via-[#FFFBFA] to-[#FFF2ED] px-6 py-7 sm:px-9 sm:py-8"
      style={{ boxShadow: `7px 7px 0 0 ${INK}` }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {backdrop}
      <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        {/* flex-1: sin esto, un título corto (o sin chips debajo) hacía que
            este bloque se encogiera al ancho de su contenido en vez de
            ocupar el hueco disponible en la fila — y cualquier hijo `w-full`
            (el textarea de la bio, por ejemplo) heredaba ese ancho diminuto. */}
        <div className="min-w-0 max-w-2xl flex-1">
          {badge ? (
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
              // Con un fondo propio detrás, el distintivo translúcido de
              // siempre se perdía sobre los tonos saturados: pasa a blanco
              // sólido para seguir leyéndose sin cambiar de color de marca.
              style={
                backdrop
                  ? { backgroundColor: 'rgba(255,255,255,0.9)', color: accent }
                  : { backgroundColor: `${accent}26`, color: accent }
              }
            >
              {badgeIcon ? <span className="material-symbols-outlined text-sm">{badgeIcon}</span> : null}
              {badge}
            </span>
          ) : null}
          <h1
            className={`truncate text-3xl font-black leading-[1.05] tracking-tight text-[#2C3E50] sm:text-4xl ${
              badge ? 'mt-3' : ''
            }`}
          >
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

/** Rótulo de sección con línea. */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7D8A96]/70">{children}</span>
      <div className="h-px flex-1 bg-[#E6DEDA]" />
      {right}
    </div>
  )
}

/** Cifra con etiqueta, para los resúmenes de portada. */
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

/** Distintivo numerado de paso, para formularios por pasos. */
export function StepBadge({ n, active, color = '#E8A598' }: { n: number; active?: boolean; color?: string }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[#2c3e50] text-sm font-black transition-colors"
      style={{
        backgroundColor: active ? color : '#fff',
        color: active ? '#fff' : INK,
        boxShadow: `2px 2px 0 0 ${INK}`,
      }}
    >
      {n}
    </span>
  )
}

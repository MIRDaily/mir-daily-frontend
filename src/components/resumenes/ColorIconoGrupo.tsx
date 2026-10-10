'use client'

// Color e icono de un grupo de resúmenes, con la misma paleta que las asignaturas de flashcards: una
// fila de 8 muestras redondas y una rejilla de 16 iconos. Las dos son grupos de radio (flechas para
// moverse, como un radio del navegador). Y la baldosa con el icono sobre el color, para pintar un grupo.

import { useId, useRef, type KeyboardEvent } from 'react'
import { SUBJECT_COLORS, SUBJECT_ICONS, resolveColor } from '@/lib/flashcardTheme'
import { iconoGrupo } from '@/lib/resumenes/grupo'

const INK = '#2C3E50'

const NOMBRE_ICONO: Record<string, string> = {
  style: 'Tarjetas',
  cardiology: 'Corazón',
  neurology: 'Cerebro',
  pulmonology: 'Pulmones',
  gastroenterology: 'Digestivo',
  orthopedics: 'Hueso',
  medication: 'Medicación',
  vaccines: 'Vacuna',
  psychology: 'Psicología',
  biotech: 'Laboratorio',
  healing: 'Tirita',
  science: 'Ciencia',
  bloodtype: 'Sangre',
  coronavirus: 'Virus',
  dentistry: 'Diente',
  menu_book: 'Libro',
}

/** El icono del grupo sobre su color, con borde de tinta. */
export function BaldosaGrupo({ color, icon, tam = 'md' }: { color?: string | null; icon?: string | null; tam?: 'sm' | 'md' | 'lg' }) {
  const c = resolveColor(color)
  const caja = tam === 'sm' ? 'h-8 w-8 rounded-lg' : tam === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-10 w-10 rounded-xl'
  const letra = tam === 'sm' ? 'text-[18px]' : tam === 'lg' ? 'text-[28px]' : 'text-[22px]'
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center text-white ${caja}`}
      style={{ background: c.bg, border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}
    >
      <span className={`material-symbols-outlined ${letra}`}>{iconoGrupo(icon)}</span>
    </span>
  )
}

/** Flechas, Inicio y Fin dentro de un grupo de radio: elige el de al lado y le pasa el foco. */
function moverConTeclas<T>(e: KeyboardEvent, opciones: T[], actual: T, elegir: (v: T) => void, cont: HTMLElement | null) {
  const k = Math.max(0, opciones.indexOf(actual))
  const sig =
    e.key === 'ArrowRight' || e.key === 'ArrowDown'
      ? (k + 1) % opciones.length
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
        ? (k - 1 + opciones.length) % opciones.length
        : e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? opciones.length - 1
            : null
  if (sig === null) return
  e.preventDefault()
  elegir(opciones[sig])
  cont?.querySelectorAll<HTMLElement>('[role="radio"]')[sig]?.focus()
}

export function ColorIconoGrupo({
  color,
  icon,
  onChange,
}: {
  color: string | null
  icon: string | null
  onChange: (v: { color: string; icon: string }) => void
}) {
  const c = resolveColor(color)
  const ic = iconoGrupo(icon)
  const colores = useRef<HTMLDivElement>(null)
  const iconos = useRef<HTMLDivElement>(null)
  const idColor = useId()
  const idIcono = useId()
  const claves = SUBJECT_COLORS.map((x) => x.key)

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p id={idColor} className="mb-1.5 text-[0.68rem] font-extrabold uppercase tracking-wide text-[#7D8A96]">
          Color
        </p>
        <div
          ref={colores}
          role="radiogroup"
          aria-labelledby={idColor}
          className="flex flex-wrap gap-2.5"
          onKeyDown={(e) => moverConTeclas(e, claves, c.key, (k) => onChange({ color: k, icon: ic }), colores.current)}
        >
          {SUBJECT_COLORS.map((x) => {
            const sel = x.key === c.key
            return (
              <button
                key={x.key}
                type="button"
                role="radio"
                aria-checked={sel}
                aria-label={x.label}
                title={x.label}
                tabIndex={sel ? 0 : -1}
                onClick={() => onChange({ color: x.key, icon: ic })}
                className="h-8 w-8 rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2C3E50]"
                style={{ background: x.bg, boxShadow: sel ? `0 0 0 2px #fff, 0 0 0 4px ${INK}` : `inset 0 0 0 2px rgba(44,62,80,0.15)` }}
              />
            )
          })}
        </div>
      </div>
      <div>
        <p id={idIcono} className="mb-1.5 text-[0.68rem] font-extrabold uppercase tracking-wide text-[#7D8A96]">
          Icono
        </p>
        <div
          ref={iconos}
          role="radiogroup"
          aria-labelledby={idIcono}
          className="grid max-w-md grid-cols-8 gap-1.5"
          onKeyDown={(e) => moverConTeclas(e, SUBJECT_ICONS, ic, (v) => onChange({ color: c.key, icon: v }), iconos.current)}
        >
          {SUBJECT_ICONS.map((x) => {
            const sel = x === ic
            return (
              <button
                key={x}
                type="button"
                role="radio"
                aria-checked={sel}
                aria-label={NOMBRE_ICONO[x] ?? x}
                title={NOMBRE_ICONO[x] ?? x}
                tabIndex={sel ? 0 : -1}
                onClick={() => onChange({ color: c.key, icon: x })}
                className={`flex h-9 items-center justify-center rounded-lg border-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2C3E50] ${
                  sel ? 'text-white' : 'border-[#EAE4E2] bg-white text-[#7D8A96] hover:bg-[#F7F4F2]'
                }`}
                style={sel ? { background: c.bg, borderColor: INK } : undefined}
              >
                <span className="material-symbols-outlined text-[20px]">{x}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

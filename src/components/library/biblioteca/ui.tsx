'use client'

/* ════════════════════════════════════════════════════════════════════════
   Piezas de la Biblioteca (carpetas del material, fase 2). Reexporta el kit
   sticker (borde de tinta y sombra dura) y añade su textura: lomos de
   archivador, porque cada asignatura es un estante con sus carpetas.
═══════════════════════════════════════════════════════════════════════════ */
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { INK } from '@/components/ui/sticker'
import { subjectVisual } from '@/lib/subjectVisuals'
import type { AsignaturaCatalogo } from '@/lib/carpetas/sugerir'
import { rutasElemento, type Cuenta, type ElementoMaterial, type TipoElemento } from '@/lib/carpetas/biblioteca'

export { GhostButton, Hero, INK, SectionLabel, StickerButton, StickerCard } from '@/components/ui/sticker'

/** Lomos de archivador: franjas verticales finas con una más marcada cada cinco. */
export const TEXTURA_LOMOS: CSSProperties = {
  backgroundImage: [
    'repeating-linear-gradient(90deg, transparent 0 118px, rgba(44,62,80,0.07) 118px 120px)',
    'repeating-linear-gradient(90deg, transparent 0 22px, rgba(44,62,80,0.035) 22px 24px)',
  ].join(','),
}

/** Color e icono de la asignatura (por su nombre, como en flashcards); la sigla es la del catálogo. */
export function visualAsignatura(a: Pick<AsignaturaCatalogo, 'nombre'>) {
  const v = subjectVisual(a.nombre)
  return { color: v.color, icon: v.icon, category: v.category }
}

export function Sigla({ asignatura, grande = false }: { asignatura: AsignaturaCatalogo; grande?: boolean }) {
  const { color } = visualAsignatura(asignatura)
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl border-2 border-[#2c3e50] font-black text-white ${
        grande ? 'h-14 w-14 text-xl' : 'h-10 w-10 text-sm'
      }`}
      style={{ backgroundColor: color.bg, boxShadow: `${grande ? 3 : 2}px ${grande ? 3 : 2}px 0 0 ${INK}` }}
      aria-hidden
    >
      {asignatura.sigla ?? asignatura.nombre.slice(0, 2).toUpperCase()}
    </span>
  )
}

export const TIPO: Record<TipoElemento, { icono: string; nombre: string; color: string }> = {
  mapa: { icono: 'account_tree', nombre: 'Mapa', color: '#7BA7C4' },
  flashcards: { icono: 'style', nombre: 'Flashcards', color: '#E8A598' },
  resumenes: { icono: 'notes', nombre: 'Resumen', color: '#8BA888' },
}

/** Tres cifras pequeñas (mapas, flashcards, resúmenes); sin nada, un guion. */
export function CifrasMaterial({ cuenta, compacto = false }: { cuenta: Cuenta; compacto?: boolean }) {
  if (!cuenta.total) return <span className="text-xs font-bold text-[#7D8A96]/70">Sin material</span>
  const items: [TipoElemento, number][] = [
    ['mapa', cuenta.mapas],
    ['flashcards', cuenta.flashcards],
    ['resumenes', cuenta.resumenes],
  ]
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {items
        .filter(([, n]) => n > 0)
        .map(([t, n]) => (
          <span
            key={t}
            title={`${n} · ${TIPO[t].nombre}`}
            className={`inline-flex items-center gap-1 rounded-full border border-[#EAE4E2] bg-white font-black tabular-nums text-[#2C3E50] ${compacto ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs'}`}
          >
            <span className="material-symbols-outlined text-[14px]" style={{ color: TIPO[t].color }}>
              {TIPO[t].icono}
            </span>
            {n}
          </span>
        ))}
    </span>
  )
}

/** «Preguntas MIR»: cuántas hay y el acierto del usuario (de /api/analytics, lo de siempre). */
export function CifrasPreguntas({
  preguntas,
  acierto,
  respondidas,
  soloAcierto = false,
}: {
  preguntas: number | null
  acierto: number | null
  respondidas: number
  /** Sin el número de preguntas (la portada no lo pide). */
  soloAcierto?: boolean
}) {
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-[#7D8A96]">
      {soloAcierto ? null : (
        <span className="inline-flex items-center gap-1 rounded-full border border-[#EAE4E2] bg-white px-2 py-0.5 font-black tabular-nums text-[#2C3E50]" title="Preguntas MIR">
          <span className="material-symbols-outlined text-[14px] text-[#7D8A96]">quiz</span>
          {preguntas ?? '—'}
        </span>
      )}
      {respondidas > 0 && acierto !== null ? (
        <span className="tabular-nums">
          <b className="font-black" style={{ color: colorAcierto(acierto) }}>
            {Math.round(acierto)} %
          </b>{' '}
          de acierto
        </span>
      ) : (
        <span className="text-[#7D8A96]/70">sin responder</span>
      )}
    </span>
  )
}

export const colorAcierto = (p: number) => (p >= 70 ? '#5C7A59' : p >= 50 ? '#B8862E' : '#B5675A')

/** Sin la señal de dominio (la base de datos aún no la calcula): se dice, en vez de enseñar un 0. */
export function HuecoDominio({ compacto = false }: { compacto?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-2xl border-2 border-dashed border-[#D9CFC9] bg-[#FAF7F4] text-[#7D8A96] ${compacto ? 'px-3 py-2 text-[11px]' : 'px-4 py-3 text-xs'}`}
      data-f3="dominio"
    >
      <span className="material-symbols-outlined text-[18px]">psychology_alt</span>
      <span>
        <b className="font-black text-[#2C3E50]">Dominio del material</b> · todavía no disponible: cuánto recordarías hoy de lo que has estudiado aquí.
      </span>
    </div>
  )
}

function fecha(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

/** Una fila de material: icono, título, cuántas tarjetas, abrir y estudiar; y lo que añada quien la usa. */
export function FilaElemento({
  e,
  inicio,
  extra,
  acciones,
}: {
  e: ElementoMaterial
  /** Antes del icono (la casilla de selección). */
  inicio?: ReactNode
  /** Debajo del título (la sugerencia). */
  extra?: ReactNode
  /** Botones a la derecha, además de abrir y estudiar. */
  acciones?: ReactNode
}) {
  const t = TIPO[e.tipo]
  const r = rutasElemento(e)
  const cuando = fecha(e.actualizado)
  const detalle = [
    t.nombre,
    e.elementos !== null ? `${e.elementos} ${e.tipo === 'flashcards' ? (e.elementos === 1 ? 'tarjeta' : 'tarjetas') : e.elementos === 1 ? 'párrafo' : 'párrafos'}` : null,
    cuando,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <li className="flex flex-col gap-2 rounded-2xl border-2 border-[#EAE4E2] bg-white px-3 py-2.5 transition-colors hover:border-[#2c3e50]/40 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {inicio}
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-[#2c3e50] bg-white"
          style={{ boxShadow: `2px 2px 0 0 ${INK}` }}
          aria-hidden
        >
          <span className="material-symbols-outlined text-[20px]" style={{ color: t.color }}>
            {t.icono}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <Link href={r.abrir} className="block truncate text-sm font-black text-[#2C3E50] hover:text-[#C97D6F]" title={e.titulo}>
            {e.titulo}
          </Link>
          <p className="truncate text-[11px] font-semibold text-[#7D8A96]">{detalle}</p>
          {extra}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-12 sm:pl-0">
        {acciones}
        <Link
          href={r.abrir}
          className="inline-flex items-center gap-1 rounded-xl border-2 border-[#EAE4E2] bg-white px-2.5 py-1.5 text-xs font-extrabold text-[#7D8A96] hover:border-[#2c3e50] hover:text-[#2C3E50]"
        >
          <span className="material-symbols-outlined text-[16px]">open_in_new</span>
          Abrir
        </Link>
        {r.estudiar ? (
          <Link
            href={r.estudiar}
            className="inline-flex items-center gap-1 rounded-xl border-2 border-[#2c3e50] px-2.5 py-1.5 text-xs font-black text-white"
            style={{ backgroundColor: t.color, boxShadow: `2px 2px 0 0 ${INK}` }}
          >
            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
            Estudiar
          </Link>
        ) : null}
      </div>
    </li>
  )
}

/** Mensaje de carga o de error dentro de una tarjeta. */
export function Estado({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <p role={error ? 'alert' : undefined} className={`py-10 text-center text-sm font-bold ${error ? 'text-[#B04A5E]' : 'text-[#7D8A96]'}`}>
      {children}
    </p>
  )
}

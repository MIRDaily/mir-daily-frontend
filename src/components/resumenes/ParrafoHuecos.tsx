'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LEVEL_INFO } from '@/lib/studioFlashcards'
import {
  alternarPalabra,
  cambiarNivel,
  crearHueco,
  NIVELES,
  quitarHueco,
  segmentos,
  type Hueco,
  type Nivel,
} from '@/lib/resumenes/huecos'

// Un párrafo con sus huecos, para VER o para EDITAR los huecos (vista previa, lista del grupo y la
// edición en pleno estudio). Editando:
//   - tocar una palabra que no está tapada la convierte en hueco (con el nivel elegido);
//   - seleccionar un trozo con el ratón crea un hueco con él (ajustado a palabras enteras);
//   - tocar un hueco abre su menú: cambiar el nivel (1-4) o quitarlo (teclas 1-4 y Supr también).
// El texto es siempre texto de React (nunca HTML): lo que venga de la IA no puede inyectar nada.

export const INK = '#2C3E50'

type Token = { t: string; pos: number; espacio: boolean }
const tokens = (t: string, desde: number): Token[] =>
  [...t.matchAll(/\s+|[^\s]+/g)].map((m) => ({ t: m[0], pos: desde + (m.index ?? 0), espacio: /^\s/.test(m[0]) }))

/** Posición en el texto de un punto de la selección del DOM (por el data-pos de su palabra). */
function posicionDe(nodo: Node | null, offset: number): number | null {
  let el: Node | null = nodo
  while (el && !(el instanceof HTMLElement && el.dataset.pos !== undefined)) el = el.parentNode
  if (!el || !(el instanceof HTMLElement)) return null
  const base = Number(el.dataset.pos)
  return nodo && nodo.nodeType === Node.TEXT_NODE ? base + offset : base + (offset > 0 ? (el.textContent ?? '').length : 0)
}

export const ParrafoHuecos = memo(function ParrafoHuecos({
  texto,
  huecos,
  onChange,
  nivel = 2,
  editable = false,
  className = '',
  onAviso,
}: {
  texto: string
  huecos: Hueco[]
  onChange?: (huecos: Hueco[]) => void
  /** Nivel de los huecos nuevos. */
  nivel?: Nivel
  editable?: boolean
  className?: string
  /** Para avisar de algo que no se ha podido hacer (más de 8 huecos…). */
  onAviso?: (msg: string) => void
}) {
  const [abierto, setAbierto] = useState<number | null>(null)
  // El menú se abre hacia la izquierda si el hueco está en la mitad derecha (si no, se sale de la caja).
  const [aLaDerecha, setALaDerecha] = useState(false)
  const caja = useRef<HTMLParagraphElement>(null)
  const abrirMenu = (k: number, el: HTMLElement) => {
    const c = caja.current?.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    setALaDerecha(!!c && r.left - c.left > c.width / 2)
    setAbierto((x) => (x === k ? null : k))
  }
  const segs = useMemo(() => segmentos(texto, huecos), [texto, huecos])
  const pos0 = useMemo(() => {
    const out: number[] = []
    let p = 0
    for (const s of segs) {
      out.push(p)
      p += s.t.length
    }
    return out
  }, [segs])

  const aplicar = useCallback(
    (r: { huecos: Hueco[]; error?: string }) => {
      if (r.error) onAviso?.(r.error)
      else onChange?.(r.huecos)
    },
    [onChange, onAviso],
  )

  // Cerrar el menú del hueco al tocar fuera.
  useEffect(() => {
    if (abierto === null) return
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(null)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  const onMouseUp = () => {
    if (!editable) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !caja.current || !caja.current.contains(sel.anchorNode) || !caja.current.contains(sel.focusNode)) return
    const a = posicionDe(sel.anchorNode, sel.anchorOffset)
    const b = posicionDe(sel.focusNode, sel.focusOffset)
    sel.removeAllRanges()
    if (a === null || b === null || a === b) return
    setAbierto(null)
    aplicar(crearHueco(texto, huecos, Math.min(a, b), Math.max(a, b), nivel))
  }

  const tocarPalabra = (pos: number) => {
    if (!editable) return
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed) return // la selección la trata onMouseUp
    setAbierto(null)
    aplicar(alternarPalabra(texto, huecos, pos, nivel))
  }

  const tecla = (e: React.KeyboardEvent, k: number) => {
    if (!editable) return
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      e.stopPropagation()
      setAbierto(null)
      onChange?.(quitarHueco(huecos, k))
    } else if (['1', '2', '3', '4'].includes(e.key)) {
      e.preventDefault()
      e.stopPropagation()
      onChange?.(cambiarNivel(huecos, k, Number(e.key) as Nivel))
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      setAbierto(null)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      abrirMenu(k, e.currentTarget as HTMLElement)
    }
  }

  return (
    <p
      ref={caja}
      onMouseUp={onMouseUp}
      className={`relative whitespace-pre-wrap text-[0.95rem] leading-[1.9] text-[#2C3E50] ${editable ? 'select-text' : ''} ${className}`}
    >
      {segs.map((s, j) => {
        if (s.k === undefined) {
          return tokens(s.t, pos0[j]).map((tk) =>
            tk.espacio || !editable ? (
              <span key={tk.pos} data-pos={tk.pos}>
                {tk.t}
              </span>
            ) : (
              <span
                key={tk.pos}
                data-pos={tk.pos}
                onClick={() => tocarPalabra(tk.pos)}
                className="cursor-pointer rounded-[3px] transition-colors hover:bg-[#E8A598]/20"
              >
                {tk.t}
              </span>
            ),
          )
        }
        const k = s.k
        const h = huecos[k]
        const info = LEVEL_INFO[h.n]
        return (
          <span key={`h${k}`} className="relative">
            <span
              role={editable ? 'button' : undefined}
              tabIndex={editable ? 0 : undefined}
              aria-label={editable ? `Hueco de nivel ${info.name}: ${s.t}` : undefined}
              onClick={(e) => {
                if (!editable) return
                const sel = window.getSelection()
                if (sel && !sel.isCollapsed) return
                e.stopPropagation()
                abrirMenu(k, e.currentTarget)
              }}
              onKeyDown={(e) => tecla(e, k)}
              className={`rounded-md px-[3px] py-[1px] font-semibold ${editable ? 'cursor-pointer outline-none focus-visible:ring-2' : ''}`}
              style={{ background: info.soft, color: info.color, boxShadow: `inset 0 -2px 0 ${info.color}`, ['--tw-ring-color' as string]: info.color }}
            >
              {tokens(s.t, pos0[j]).map((tk) => (
                <span key={tk.pos} data-pos={tk.pos}>
                  {tk.t}
                </span>
              ))}
              <sup className="ml-[1px] text-[0.6rem] font-black" aria-hidden>
                {h.n}
              </sup>
            </span>
            {editable && abierto === k && (
              <span
                role="menu"
                className={`absolute ${aLaDerecha ? 'right-0' : 'left-0'} top-full z-30 mt-1 flex items-center gap-1 whitespace-nowrap rounded-xl bg-white p-1.5 text-xs leading-none`}
                style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {NIVELES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="menuitemradio"
                    aria-checked={h.n === n}
                    title={`Nivel ${LEVEL_INFO[n].name} (${n})`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onChange?.(cambiarNivel(huecos, k, n))
                      setAbierto(null)
                    }}
                    className="rounded-lg px-2 py-1 font-extrabold"
                    style={{ background: h.n === n ? LEVEL_INFO[n].color : LEVEL_INFO[n].soft, color: h.n === n ? '#fff' : LEVEL_INFO[n].color }}
                  >
                    {LEVEL_INFO[n].name}
                  </button>
                ))}
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation()
                    setAbierto(null)
                    onChange?.(quitarHueco(huecos, k))
                  }}
                  className="ml-1 flex items-center gap-1 rounded-lg px-2 py-1 font-bold text-[#B04A5E] hover:bg-[#FAEAED]"
                >
                  <span className="material-symbols-outlined text-[15px] leading-none">ink_eraser</span>
                  Quitar hueco
                </button>
              </span>
            )}
          </span>
        )
      })}
    </p>
  )
})

/** Selector del nivel con el que se marcan los huecos nuevos. */
export function NivelNuevo({ nivel, onChange }: { nivel: Nivel; onChange: (n: Nivel) => void }) {
  return (
    <span className="inline-flex items-center gap-1" role="radiogroup" aria-label="Nivel de los huecos nuevos">
      {NIVELES.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={nivel === n}
          onClick={() => onChange(n)}
          className="rounded-lg px-2 py-0.5 text-[0.72rem] font-extrabold"
          style={{
            background: nivel === n ? LEVEL_INFO[n].color : LEVEL_INFO[n].soft,
            color: nivel === n ? '#fff' : LEVEL_INFO[n].color,
          }}
        >
          {LEVEL_INFO[n].name}
        </button>
      ))}
    </span>
  )
}

/** Recuento de huecos por nivel («2 fácil · 1 demencial»). */
export function ResumenHuecos({ huecos }: { huecos: Hueco[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {NIVELES.map((n) => {
        const c = huecos.filter((h) => h.n === n).length
        return c ? (
          <span key={n} className="rounded-md px-1.5 py-0.5 text-[0.66rem] font-extrabold" style={{ background: LEVEL_INFO[n].soft, color: LEVEL_INFO[n].color }}>
            {c} {LEVEL_INFO[n].name.toLowerCase()}
          </span>
        ) : null
      })}
    </span>
  )
}

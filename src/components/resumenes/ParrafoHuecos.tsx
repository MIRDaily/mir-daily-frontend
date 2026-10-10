'use client'

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
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
import { NIVEL_CORTO, TINTA_NIVEL } from '@/lib/resumenes/accesible'
import { seHaMovido, trozoEntre } from '@/lib/resumenes/gestos'

// Un párrafo con sus huecos, para VER o para EDITAR los huecos (vista previa, lista del grupo y la
// edición en pleno estudio). Editando:
//   - tocar una palabra que no está tapada la convierte en hueco (con el nivel elegido);
//   - un trozo: con el ratón, seleccionarlo; con el dedo, MANTENER sobre la primera palabra y
//     ARRASTRAR hasta la última, o mantener la primera, soltar y TOCAR la última («tocar inicio y fin»);
//     se ajusta a palabras enteras;
//   - tocar un hueco abre su menú: cambiar el nivel (1-4) o quitarlo (teclas 1-4 y Supr también). El
//     menú flota por encima de todo y se recoloca para no salirse nunca de la pantalla.
// En pantallas táctiles cada palabra tiene una zona de toque de ~44 px de alto y los botones del menú
// también. El nivel va con su color Y su etiqueta corta («Fác», «Med», «Dif», «Dem»), y el texto con la
// tinta AA de su nivel. El texto es siempre texto de React (nunca HTML): lo que venga de la IA no puede
// inyectar nada.

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

/** La palabra (fuera de los huecos) bajo un punto de la pantalla: { pos, largo } o null. */
function palabraEn(x: number, y: number, caja: HTMLElement | null): { pos: number; largo: number } | null {
  const el = document.elementFromPoint(x, y)
  if (!(el instanceof HTMLElement) || !caja?.contains(el) || el.dataset.palabra === undefined) return null
  return { pos: Number(el.dataset.pos), largo: (el.textContent ?? '').length }
}

// ¿Pantalla táctil? (puntero «grueso»). Al servidor se le dice que no.
const consultaTactil = () => window.matchMedia('(pointer: coarse)')
function suscribirTactil(cb: () => void) {
  const m = consultaTactil()
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}
export function useTactil(): boolean {
  return useSyncExternalStore(suscribirTactil, () => consultaTactil().matches, () => false)
}

const MANTENER_MS = 380

/** El menú de un hueco: flota (portal, posición fija) y se coloca dentro de la pantalla. */
function MenuHueco({
  ancla,
  nivel,
  onNivel,
  onQuitar,
  onCerrar,
  menuRef,
}: {
  ancla: HTMLElement
  nivel: Nivel
  onNivel: (n: Nivel) => void
  onQuitar: () => void
  onCerrar: () => void
  menuRef: React.RefObject<HTMLDivElement | null>
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  // Colocarlo: debajo del hueco (o encima si no cabe), sin pasarse de los bordes (8 px de margen).
  useLayoutEffect(() => {
    const m = menuRef.current
    if (!m) return
    const r = ancla.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    const w = m.offsetWidth
    const h = m.offsetHeight
    const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), Math.max(8, vw - w - 8))
    let top = r.bottom + 6
    if (top + h > vh - 8) top = r.top - h - 6
    setPos({ left, top: Math.min(Math.max(8, top), Math.max(8, vh - h - 8)) })
  }, [ancla, menuRef])
  // Al desplazar o girar la pantalla el hueco se mueve: el menú se cierra (no se queda flotando lejos).
  useEffect(() => {
    window.addEventListener('scroll', onCerrar, true)
    window.addEventListener('resize', onCerrar)
    return () => {
      window.removeEventListener('scroll', onCerrar, true)
      window.removeEventListener('resize', onCerrar)
    }
  }, [onCerrar])
  // El foco entra en el menú (el nivel elegido) para poder seguir con el teclado o el lector.
  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus({ preventScroll: true })
  }, [menuRef])

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Nivel del hueco"
      className="fixed z-[80] flex max-w-[calc(100vw-16px)] flex-wrap items-center gap-1 rounded-xl bg-white p-1.5 text-xs leading-none"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
      data-menu-hueco
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onCerrar()
          ancla.focus()
        } else if (['1', '2', '3', '4'].includes(e.key)) {
          e.preventDefault()
          e.stopPropagation()
          onNivel(Number(e.key) as Nivel)
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          e.stopPropagation()
          onQuitar()
        }
      }}
    >
      {NIVELES.map((n) => (
        <button
          key={n}
          type="button"
          role="menuitemradio"
          aria-checked={nivel === n}
          title={`Nivel ${LEVEL_INFO[n].name} (${n})`}
          onClick={(e) => {
            e.stopPropagation()
            onNivel(n)
          }}
          className="min-h-[36px] rounded-lg px-2.5 py-1 font-extrabold [@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:px-3"
          style={{
            background: nivel === n ? TINTA_NIVEL[n] : LEVEL_INFO[n].soft,
            color: nivel === n ? '#fff' : TINTA_NIVEL[n],
            border: `1.5px solid ${nivel === n ? INK : LEVEL_INFO[n].color}`,
          }}
        >
          {LEVEL_INFO[n].name}
        </button>
      ))}
      <button
        type="button"
        role="menuitem"
        onClick={(e) => {
          e.stopPropagation()
          onQuitar()
        }}
        className="flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 py-1 font-bold text-[#8E3346] hover:bg-[#FAEAED] [@media(pointer:coarse)]:min-h-[44px]"
      >
        <span className="material-symbols-outlined text-[16px] leading-none" aria-hidden>
          ink_eraser
        </span>
        Quitar hueco
      </button>
    </div>,
    document.body,
  )
}

export const ParrafoHuecos = memo(function ParrafoHuecos({
  texto,
  huecos,
  onChange,
  nivel = 2,
  editable = false,
  className = '',
  onAviso,
  seleccionado,
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
  /** Índice del hueco seleccionado con el teclado (vista previa): solo se le pinta un anillo. */
  seleccionado?: number
}) {
  const [abierto, setAbierto] = useState<{ k: number; el: HTMLElement } | null>(null)
  // Con el dedo: el trozo que se está marcando (mantener + arrastrar) o la primera palabra ya marcada
  // («tocar inicio y fin»: falta tocar la última).
  const [trozo, setTrozo] = useState<{ i: number; f: number; fijo: boolean } | null>(null)
  const caja = useRef<HTMLParagraphElement>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const tactil = useTactil()
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
  const cerrarMenu = useCallback(() => setAbierto(null), [])
  const abrirMenu = (k: number, el: HTMLElement) => setAbierto((x) => (x?.k === k ? null : { k, el }))

  // Cerrar el menú del hueco al tocar fuera (fuera del párrafo y del propio menú, que va en un portal).
  useEffect(() => {
    if (abierto === null) return
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node
      if (caja.current?.contains(t) || menuRef.current?.contains(t)) return
      setAbierto(null)
    }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [abierto])

  // Mantener y arrastrar con el dedo (eventos táctiles nativos: el `touchmove` tiene que poder cancelar
  // el desplazamiento de la página mientras se marca, y React los registra como pasivos).
  const estadoToque = useRef<{ x: number; y: number; desde: { pos: number; largo: number } | null; timer: number | null; activo: boolean; movido: boolean } | null>(null)
  const trozoRef = useRef(trozo)
  useEffect(() => {
    trozoRef.current = trozo
  }, [trozo])
  useEffect(() => {
    const el = caja.current
    if (!el || !editable || !tactil) return
    const limpiar = () => {
      const s = estadoToque.current
      if (s?.timer) window.clearTimeout(s.timer)
      estadoToque.current = null
    }
    const inicio = (e: TouchEvent) => {
      if (e.touches.length !== 1) return limpiar()
      const t = e.touches[0]
      const desde = palabraEn(t.clientX, t.clientY, el)
      const s = { x: t.clientX, y: t.clientY, desde, timer: null as number | null, activo: false, movido: false }
      estadoToque.current = s
      if (!desde) return
      s.timer = window.setTimeout(() => {
        // Mantenido sin moverse: empieza el trozo en esa palabra.
        s.activo = true
        setAbierto(null)
        setTrozo({ i: desde.pos, f: desde.pos + desde.largo, fijo: false })
        navigator.vibrate?.(12)
      }, MANTENER_MS)
    }
    const mover = (e: TouchEvent) => {
      const s = estadoToque.current
      if (!s) return
      const t = e.touches[0]
      if (!s.activo) {
        // Se mueve antes de tiempo: es desplazar la página, no marcar.
        if (seHaMovido(t.clientX - s.x, t.clientY - s.y)) limpiar()
        return
      }
      e.preventDefault()
      s.movido = true
      const hasta = palabraEn(t.clientX, t.clientY, el)
      if (hasta && s.desde) setTrozo({ ...trozoEntre(s.desde, hasta), fijo: false })
    }
    const fin = (e: TouchEvent) => {
      const s = estadoToque.current
      limpiar()
      if (!s?.activo) return
      // Que el toque largo no acabe en un «clic» sobre la palabra.
      e.preventDefault()
      const t = trozoRef.current
      if (!t) return
      if (s.movido && t.f - t.i > (s.desde?.largo ?? 0)) {
        setTrozo(null)
        aplicar(crearHueco(texto, huecos, t.i, t.f, nivel))
      } else {
        // Soltado sin arrastrar: queda marcada la primera palabra; falta tocar la última.
        setTrozo({ ...t, fijo: true })
      }
    }
    const cancelar = () => {
      limpiar()
      setTrozo((t) => (t && !t.fijo ? null : t))
    }
    el.addEventListener('touchstart', inicio, { passive: true })
    el.addEventListener('touchmove', mover, { passive: false })
    el.addEventListener('touchend', fin, { passive: false })
    el.addEventListener('touchcancel', cancelar)
    return () => {
      limpiar()
      el.removeEventListener('touchstart', inicio)
      el.removeEventListener('touchmove', mover)
      el.removeEventListener('touchend', fin)
      el.removeEventListener('touchcancel', cancelar)
    }
  }, [editable, tactil, texto, huecos, nivel, aplicar])

  const onMouseUp = () => {
    if (!editable || tactil) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !caja.current || !caja.current.contains(sel.anchorNode) || !caja.current.contains(sel.focusNode)) return
    const a = posicionDe(sel.anchorNode, sel.anchorOffset)
    const b = posicionDe(sel.focusNode, sel.focusOffset)
    sel.removeAllRanges()
    if (a === null || b === null || a === b) return
    setAbierto(null)
    aplicar(crearHueco(texto, huecos, Math.min(a, b), Math.max(a, b), nivel))
  }

  const tocarPalabra = (pos: number, largo: number) => {
    if (!editable) return
    const sel = window.getSelection()
    if (!tactil && sel && !sel.isCollapsed) return // la selección la trata onMouseUp
    setAbierto(null)
    // «Tocar inicio y fin»: con la primera palabra marcada, este toque es la última.
    if (trozo?.fijo) {
      setTrozo(null)
      if (pos === trozo.i) return // tocar la misma palabra lo cancela
      const r = trozoEntre({ pos: trozo.i, largo: trozo.f - trozo.i }, { pos, largo })
      aplicar(crearHueco(texto, huecos, r.i, r.f, nivel))
      return
    }
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

  const enTrozo = (pos: number) => !!trozo && pos >= trozo.i && pos < trozo.f
  const hAbierto = abierto ? huecos[abierto.k] : undefined

  return (
    <>
      <p
        ref={caja}
        onMouseUp={onMouseUp}
        onContextMenu={editable && tactil ? (e) => e.preventDefault() : undefined}
        className={`relative whitespace-pre-wrap text-[0.95rem] leading-[1.9] text-[#2C3E50] ${
          editable ? (tactil ? 'select-none leading-[2.9] [-webkit-touch-callout:none]' : 'select-text') : ''
        } ${className}`}
        data-editable={editable || undefined}
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
                  data-palabra
                  onClick={() => tocarPalabra(tk.pos, tk.t.length)}
                  // En táctil, el relleno vertical agranda la zona de toque (44 px) sin mover las líneas (con interlineado de 2,9).
                  className={`cursor-pointer rounded-[3px] transition-colors hover:bg-[#E8A598]/20 ${tactil ? 'py-[0.85em]' : ''}`}
                  style={enTrozo(tk.pos) ? { background: trozo?.fijo ? '#E8A59866' : '#E8A59844', boxShadow: 'inset 0 -2px 0 #B04A5E' } : undefined}
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
            <span
              key={`h${k}`}
              data-hueco={k}
              data-nivel={h.n}
              role={editable ? 'button' : undefined}
              tabIndex={editable ? 0 : undefined}
              aria-haspopup={editable ? 'menu' : undefined}
              aria-expanded={editable ? abierto?.k === k : undefined}
              aria-label={editable ? `Hueco de nivel ${info.name}: ${s.t}. Toca para cambiar el nivel o quitarlo` : undefined}
              onClick={(e) => {
                if (!editable) return
                const sel = window.getSelection()
                if (!tactil && sel && !sel.isCollapsed) return
                e.stopPropagation()
                setTrozo(null)
                abrirMenu(k, e.currentTarget)
              }}
              onKeyDown={(e) => tecla(e, k)}
              className={`rounded-md px-[3px] font-semibold ${editable ? 'cursor-pointer outline-none focus-visible:ring-2' : ''} ${editable && tactil ? 'py-[0.8em]' : 'py-[1px]'}`}
              style={{
                background: info.soft,
                color: TINTA_NIVEL[h.n],
                boxShadow: `inset 0 -2px 0 ${info.color}`,
                ['--tw-ring-color' as string]: info.color,
                ...(seleccionado === k || abierto?.k === k ? { outline: `2px solid ${info.color}`, outlineOffset: 2 } : {}),
              }}
              {...(seleccionado === k ? { 'data-seleccionado': true } : {})}
            >
              {tokens(s.t, pos0[j]).map((tk) => (
                <span key={tk.pos} data-pos={tk.pos}>
                  {tk.t}
                </span>
              ))}
              <sup className="ml-[2px] text-[0.58rem] font-black uppercase tracking-wide" aria-hidden>
                {NIVEL_CORTO[h.n]}
              </sup>
              {!editable && <span className="sr-only"> (hueco, nivel {info.name.toLowerCase()})</span>}
            </span>
          )
        })}
      </p>
      {editable && trozo?.fijo && (
        <p className="mt-1 text-xs font-bold text-[#8E3346]" role="status" data-trozo-pendiente>
          Toca la última palabra del trozo (o la misma para cancelar).
        </p>
      )}
      {editable && abierto && hAbierto && (
        <MenuHueco
          ancla={abierto.el}
          nivel={hAbierto.n}
          menuRef={menuRef}
          onCerrar={cerrarMenu}
          onNivel={(n) => {
            onChange?.(cambiarNivel(huecos, abierto.k, n))
            setAbierto(null)
          }}
          onQuitar={() => {
            setAbierto(null)
            onChange?.(quitarHueco(huecos, abierto.k))
          }}
        />
      )}
    </>
  )
})

/** Selector del nivel con el que se marcan los huecos nuevos. */
export function NivelNuevo({ nivel, onChange }: { nivel: Nivel; onChange: (n: Nivel) => void }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Nivel de los huecos nuevos">
      {NIVELES.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={nivel === n}
          onClick={() => onChange(n)}
          className="rounded-lg px-2 py-0.5 text-[0.72rem] font-extrabold [@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:px-3"
          style={{
            background: nivel === n ? TINTA_NIVEL[n] : LEVEL_INFO[n].soft,
            color: nivel === n ? '#fff' : TINTA_NIVEL[n],
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
          <span key={n} className="rounded-md px-1.5 py-0.5 text-[0.66rem] font-extrabold" style={{ background: LEVEL_INFO[n].soft, color: TINTA_NIVEL[n] }}>
            {c} {LEVEL_INFO[n].name.toLowerCase()}
          </span>
        ) : null
      })}
    </span>
  )
}

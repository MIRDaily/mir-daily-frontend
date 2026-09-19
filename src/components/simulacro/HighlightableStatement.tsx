'use client'

// Enunciado en el que se puede subrayar (réplica web del
// `HighlightableStatement` de la app).
//
// - Clic sobre una palabra: la marca o la desmarca.
// - Arrastrar: marca el tramo por el que pasas. Si empiezas sobre algo YA
//   marcado, el arrastre borra en vez de pintar; el sentido se decide al
//   empezar (ir alternando palabra por palabra dejaría un damero). Al volver
//   sobre tus pasos sin soltar, el tramo se encoge como una selección normal.
// - En pantalla táctil un arrastre a secas es hacer scroll, así que ahí hay
//   que mantener pulsado antes de arrastrar (como en la app). Un toque corto
//   sigue marcando una palabra.
//
// El estado (qué palabras están marcadas) vive fuera, en el runner: hay que
// poder limpiarlo al cambiar de pregunta y saber si hay algo marcado.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

type Props = {
  text: string
  /** Índices de las palabras marcadas. */
  highlighted: ReadonlySet<number>
  /** Sin onChange es de solo lectura: pinta lo marcado y el texto se puede
   *  seleccionar con normalidad (p. ej. el repaso de resultados). */
  onChange?: (next: Set<number>) => void
  className?: string
}

/** Tiempo que hay que mantener pulsado en táctil para empezar a subrayar. */
const LONG_PRESS_MS = 350
/** Lo que se puede mover el dedo antes de que cuente como scroll. */
const TOUCH_SLOP_PX = 10

type Drag = {
  pointerId: number
  pointerType: string
  startIndex: number
  /** Lo marcado al empezar: el tramo se aplica sobre esto, no sobre lo último. */
  base: Set<number>
  /** El arrastre borra (empezó sobre algo marcado) en vez de pintar. */
  erase: boolean
  /** Ya ha pasado a otra palabra (o, en táctil, ya se mantuvo pulsado). */
  active: boolean
  startX: number
  startY: number
  timer: ReturnType<typeof setTimeout> | null
  lastIndex: number
}

export default function HighlightableStatement({
  text,
  highlighted,
  onChange,
  className,
}: Props) {
  // Palabras y separadores en orden. Solo las palabras llevan índice.
  const tokens = useMemo(() => {
    let word = 0
    return text
      .split(/(\s+)/)
      .filter((t) => t.length > 0)
      .map((t) => (/^\s+$/.test(t) ? { text: t, index: -1 } : { text: t, index: word++ }))
  }, [text])

  const containerRef = useRef<HTMLSpanElement | null>(null)
  const dragRef = useRef<Drag | null>(null)
  // Copia al día de lo marcado, para leerla desde los listeners de ventana.
  const highlightedRef = useRef(highlighted)
  const onChangeRef = useRef(onChange)
  useLayoutEffect(() => {
    highlightedRef.current = highlighted
    onChangeRef.current = onChange
  })

  const wordAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest('[data-w]') as HTMLElement | null
    if (!el || !containerRef.current?.contains(el)) return null
    const n = Number(el.dataset.w)
    return Number.isFinite(n) ? n : null
  }

  const applyRange = useCallback((drag: Drag, to: number) => {
    const next = new Set(drag.base)
    const [from, until] = drag.startIndex <= to ? [drag.startIndex, to] : [to, drag.startIndex]
    for (let i = from; i <= until; i++) {
      if (drag.erase) next.delete(i)
      else next.add(i)
    }
    onChangeRef.current?.(next)
  }, [])

  const endDrag = useCallback(() => {
    const drag = dragRef.current
    if (drag?.timer) clearTimeout(drag.timer)
    dragRef.current = null
  }, [])

  const toggle = useCallback((index: number) => {
    const next = new Set(highlightedRef.current)
    if (!next.delete(index)) next.add(index)
    onChangeRef.current?.(next)
  }, [])

  const readOnly = onChange == null

  const onPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (readOnly) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const index = wordAt(e.clientX, e.clientY)
    if (index == null) return
    endDrag()
    const drag: Drag = {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startIndex: index,
      base: new Set(highlightedRef.current),
      erase: highlightedRef.current.has(index),
      active: false,
      startX: e.clientX,
      startY: e.clientY,
      timer: null,
      lastIndex: index,
    }
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      // En táctil, mantener pulsado arranca el subrayado (y marca la palabra
      // de inicio, para que se note que ha empezado).
      drag.timer = setTimeout(() => {
        if (dragRef.current !== drag) return
        drag.active = true
        applyRange(drag, drag.startIndex)
        navigator.vibrate?.(10)
      }, LONG_PRESS_MS)
    }
    dragRef.current = drag
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || e.pointerId !== drag.pointerId) return
      if (drag.pointerType !== 'mouse' && !drag.active) {
        // Se mueve antes de mantener pulsado: es scroll, no subrayado.
        if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > TOUCH_SLOP_PX) {
          endDrag()
        }
        return
      }
      const index = wordAt(e.clientX, e.clientY)
      if (index == null || index === drag.lastIndex) return
      drag.lastIndex = index
      drag.active = true
      applyRange(drag, index)
    }
    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || e.pointerId !== drag.pointerId) return
      // Sin arrastre: es un clic/toque sobre la palabra de inicio.
      if (!drag.active) toggle(drag.startIndex)
      endDrag()
    }
    const onCancel = (e: PointerEvent) => {
      if (dragRef.current?.pointerId === e.pointerId) endDrag()
    }
    // En táctil, una vez empezado el subrayado el dedo no debe hacer scroll.
    // Tiene que ser un listener no pasivo sobre touchmove: `touch-action` no
    // se puede cambiar a mitad del gesto.
    const onTouchMove = (e: TouchEvent) => {
      if (dragRef.current?.active) e.preventDefault()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('touchmove', onTouchMove)
      endDrag()
    }
  }, [applyRange, endDrag, toggle])

  return (
    <span
      ref={containerRef}
      onPointerDown={onPointerDown}
      // Sin selección nativa: pintaría su azul encima del amarillo. Y sin el
      // menú de "copiar/buscar" de iOS al mantener pulsado.
      onContextMenu={(e) => {
        if (dragRef.current) e.preventDefault()
      }}
      className={`${readOnly ? '' : 'cursor-text select-none [-webkit-touch-callout:none]'} ${className ?? ''}`}
    >
      {tokens.map((token, i) => {
        if (token.index < 0) {
          // El espacio entre dos palabras marcadas también se pinta: así dos
          // palabras seguidas salen como UN bloque, no como dos manchas.
          const prev = tokens[i - 1]
          const next = tokens[i + 1]
          const joined =
            prev != null && next != null && highlighted.has(prev.index) && highlighted.has(next.index)
          return (
            <span key={i} className={joined ? 'bg-[#FFE082]' : undefined}>
              {token.text}
            </span>
          )
        }
        const on = highlighted.has(token.index)
        const startsRun = on && !highlighted.has(token.index - 1)
        const endsRun = on && !highlighted.has(token.index + 1)
        return (
          <span
            key={i}
            data-w={token.index}
            className={
              on
                ? `bg-[#FFE082] [box-decoration-break:clone] [-webkit-box-decoration-break:clone] ${
                    startsRun ? 'rounded-l-md pl-0.5 -ml-0.5' : ''
                  } ${endsRun ? 'rounded-r-md pr-0.5 -mr-0.5' : ''}`
                : undefined
            }
          >
            {token.text}
          </span>
        )
      })}
    </span>
  )
}

/** Botón "Limpiar subrayado". Solo se ve si hay algo marcado; aparece y
 *  desaparece sin mover lo de alrededor si se coloca a la IZQUIERDA del
 *  marcador de guardar (que va pegado al borde). */
export function ClearHighlightButton({
  visible,
  onClear,
  compact = false,
  className,
}: {
  visible: boolean
  onClear: () => void
  /** Más pequeño (32 px), para filas bajas como un rótulo. */
  compact?: boolean
  className?: string
}) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.15 }}
          onClick={onClear}
          className={`flex ${compact ? 'h-8 w-8 rounded-xl' : 'h-11 w-11 rounded-2xl'} shrink-0 items-center justify-center border border-[#E9E4E1] bg-white text-[#7D8A96] shadow-sm transition-colors hover:border-[#E8A598]/40 hover:text-[#C4655A] ${className ?? ''}`}
          aria-label="Limpiar subrayado"
          title="Limpiar subrayado"
        >
          <span className={`material-symbols-outlined ${compact ? 'text-[17px]' : 'text-[20px]'}`}>format_clear</span>
        </motion.button>
      ) : null}
    </AnimatePresence>
  )
}

const NO_HIGHLIGHTS: ReadonlySet<number> = new Set()

/**
 * Subrayado de varias preguntas durante una sesión (en memoria, por clave de
 * pregunta). Volver a una pregunta la encuentra como la dejaste; se pierde al
 * desmontar o recargar. Las preguntas sin nada marcado no ocupan sitio.
 */
export function useSessionHighlights() {
  const [byKey, setByKey] = useState<Record<string, ReadonlySet<number>>>({})
  const get = useCallback(
    (key: string | number | null | undefined): ReadonlySet<number> =>
      key == null ? NO_HIGHLIGHTS : (byKey[String(key)] ?? NO_HIGHLIGHTS),
    [byKey],
  )
  const set = useCallback((key: string | number, next: ReadonlySet<number>) => {
    setByKey((prev) => {
      const copy = { ...prev }
      if (next.size > 0) copy[String(key)] = next
      else delete copy[String(key)]
      return copy
    })
  }, [])
  const reset = useCallback(() => setByKey({}), [])
  return { byKey, get, set, reset }
}

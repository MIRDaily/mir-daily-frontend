'use client'

import { useEffect, useRef, useState } from 'react'
import type { ZenPinned } from '@/hooks/useZenRoom'

// El post-it flota por encima de todo (también en pantalla completa) y lo
// coloca cada uno donde no le estorbe. Su sitio, su opacidad y si está
// escondido son decisiones locales: no viajan a nadie más.
const POS_KEY = 'zen_note_pos'
const OPACITY_KEY = 'zen_note_opacity'
const HIDDEN_KEY = 'zen_note_hidden'

/** Tres niveles en vez de un deslizador: es un gesto de un clic. */
const OPACITY_STEPS = [0.3, 0.55, 0.85] as const
const NOTE_W = 208
const NOTE_H = 132

type Pos = { x: number; y: number }

function clampToViewport(p: Pos): Pos {
  const maxX = Math.max(8, window.innerWidth - NOTE_W - 8)
  const maxY = Math.max(8, window.innerHeight - NOTE_H - 8)
  return {
    x: Math.min(Math.max(8, p.x), maxX),
    y: Math.min(Math.max(8, p.y), maxY),
  }
}

export default function ZenPinnedNote({
  pinned,
  onUnpin,
}: {
  pinned: ZenPinned
  onUnpin: () => void
}) {
  const [pos, setPos] = useState<Pos | null>(null)
  const [opacityIdx, setOpacityIdx] = useState(1)
  const [hiddenFor, setHiddenFor] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  // El hover se lleva en JS y no en CSS: con una regla `:hover` la nota estaba
  // siempre al 100 % mientras pulsabas el botón de transparencia, así que el
  // cambio no se veía y parecía que el botón no hacía nada.
  const [hovering, setHovering] = useState(false)
  // Tras tocar la transparencia se ignora el hover un momento, para que veas
  // el nivel que acabas de elegir sin tener que apartar el ratón.
  const [previewing, setPreviewing] = useState(false)
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (previewTimer.current) clearTimeout(previewTimer.current)
  }, [])
  const noteRef = useRef<HTMLDivElement>(null)
  const dragOffset = useRef<Pos>({ x: 0, y: 0 })

  // Estado inicial en un efecto: depende de localStorage y del tamaño de la
  // ventana, que no existen al renderizar en el servidor. Leerlo en el
  // inicializador de useState desincronizaría el HTML del servidor con el
  // primer render del cliente, así que aquí la regla no aplica.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = localStorage.getItem(POS_KEY)
    let next: Pos | null = null
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Pos
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          next = clampToViewport(parsed)
        }
      } catch {
        next = null
      }
    }
    // Por defecto arriba a la derecha, en el margen, sin tapar la sala.
    setPos(next ?? clampToViewport({ x: window.innerWidth - NOTE_W - 24, y: 96 }))

    // Ojo: sin comprobar el null primero, `Number(null)` da 0 y la nota
    // arrancaba siempre en la opacidad mínima en vez de en la de por defecto.
    const rawOpacity = localStorage.getItem(OPACITY_KEY)
    if (rawOpacity !== null) {
      const savedOpacity = Number(rawOpacity)
      if (Number.isInteger(savedOpacity) && savedOpacity >= 0 && savedOpacity < OPACITY_STEPS.length) {
        setOpacityIdx(savedOpacity)
      }
    }
    setHiddenFor(localStorage.getItem(HIDDEN_KEY))
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Se guarda QUÉ mensaje ocultaste, no un booleano: así un fijado nuevo
  // reaparece solo, sin necesidad de un efecto que lo reinicie.
  const text = pinned?.text ?? null
  const hidden = text !== null && hiddenFor === text

  useEffect(() => {
    if (!dragging) return

    function onMove(e: PointerEvent) {
      const next = clampToViewport({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      })
      setPos(next)
    }
    function onUp() {
      setDragging(false)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragging])

  // Guardar la posición al soltar, no en cada píxel del arrastre.
  useEffect(() => {
    if (dragging || !pos) return
    localStorage.setItem(POS_KEY, JSON.stringify(pos))
  }, [dragging, pos])

  if (!pinned || !pos) return null

  function startDrag(e: React.PointerEvent<HTMLElement>) {
    const rect = noteRef.current?.getBoundingClientRect()
    if (!rect) return
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    setDragging(true)
    e.preventDefault()
  }

  function cycleOpacity() {
    const next = (opacityIdx + 1) % OPACITY_STEPS.length
    setOpacityIdx(next)
    localStorage.setItem(OPACITY_KEY, String(next))
    setPreviewing(true)
    if (previewTimer.current) clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(() => setPreviewing(false), 1100)
  }

  function hide() {
    if (!text) return
    setHiddenFor(text)
    localStorage.setItem(HIDDEN_KEY, text)
  }

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => {
          setHiddenFor(null)
          localStorage.removeItem(HIDDEN_KEY)
        }}
        title="Volver a mostrar el mensaje fijado"
        className="fixed right-5 top-24 z-[70] flex h-9 w-9 items-center justify-center rounded-full border border-[#E2C36B] bg-[#FDF3C7] text-[#8a6d1f] opacity-40 shadow-md transition-opacity hover:opacity-100"
      >
        <span className="material-symbols-outlined text-[18px]">push_pin</span>
      </button>
    )
  }

  return (
    <div
      ref={noteRef}
      className="zen-pinned-note fixed z-[70] select-none"
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      style={{
        left: pos.x,
        top: pos.y,
        width: NOTE_W,
        // Al arrastrar se muestra entero: si no, cuesta ver dónde lo sueltas.
        opacity: dragging || (hovering && !previewing) ? 1 : OPACITY_STEPS[opacityIdx],
        cursor: dragging ? 'grabbing' : undefined,
      }}
    >
      <div className="rounded-[10px] border border-[#E2C36B]/70 bg-[#FDF3C7] shadow-[3px_4px_14px_rgba(120,95,30,0.22)]">
        <header
          onPointerDown={startDrag}
          className="flex cursor-grab items-center gap-1 rounded-t-[10px] border-b border-[#E2C36B]/50 bg-[#F6E7A8] px-2 py-1.5 active:cursor-grabbing"
        >
          <span className="material-symbols-outlined text-[15px] text-[#8a6d1f]">push_pin</span>
          <span className="flex-1 truncate text-[10px] font-bold uppercase tracking-wider text-[#8a6d1f]">
            Fijado
          </span>
          <button
            type="button"
            onClick={cycleOpacity}
            title={`Transparencia: ${Math.round(OPACITY_STEPS[opacityIdx] * 100)} %. Pulsa para cambiarla.`}
            className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[#8a6d1f]/70 transition-colors hover:bg-[#E2C36B]/40 hover:text-[#8a6d1f]"
          >
            <span className="material-symbols-outlined text-[15px]">opacity</span>
            {/* El nivel, a la vista: el cambio se nota aunque tengas el ratón
                encima y la nota esté momentáneamente opaca. */}
            <span className="text-[9px] font-bold tabular-nums">
              {Math.round(OPACITY_STEPS[opacityIdx] * 100)}
            </span>
          </button>
          <button
            type="button"
            onClick={hide}
            title="Ocultar la nota"
            className="rounded p-0.5 text-[#8a6d1f]/70 transition-colors hover:bg-[#E2C36B]/40 hover:text-[#8a6d1f]"
          >
            <span className="material-symbols-outlined text-[15px]">visibility_off</span>
          </button>
          <button
            type="button"
            onClick={onUnpin}
            title="Quitar el fijado para toda la sala"
            className="rounded p-0.5 text-[#8a6d1f]/70 transition-colors hover:bg-[#E2C36B]/40 hover:text-[#c4655a]"
          >
            <span className="material-symbols-outlined text-[15px]">close</span>
          </button>
        </header>

        <div className="px-3 py-2.5">
          <p className="break-words text-[13px] font-semibold leading-snug text-[#4a3c10]">
            {pinned.text}
          </p>
          <p className="mt-1.5 text-[10px] text-[#8a6d1f]/80">— {pinned.byName}</p>
        </div>
      </div>
    </div>
  )
}

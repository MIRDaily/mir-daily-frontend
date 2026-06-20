'use client'

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
  type WheelEvent as RWheelEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'

type QuestionImageProps = {
  url: string
  alt?: string
  /** Altura del marco (px) de la imagen revelada / placeholder. */
  height?: number
}

const ZOOM_MIN = 1
const ZOOM_MAX = 5
const ZOOM_STEP = 0.5

// ----- Lightbox con varios niveles de zoom + arrastre para mover -----
function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const clamp = (s: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(s * 2) / 2))
  const zoomTo = (s: number) => {
    const ns = clamp(s)
    setScale(ns)
    if (ns === 1) setPos({ x: 0, y: 0 })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === '+' || e.key === '=') zoomTo(scale + ZOOM_STEP)
      else if (e.key === '-') zoomTo(scale - ZOOM_STEP)
      else if (e.key === '0') zoomTo(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale])

  // Bloquea el scroll del fondo mientras el lightbox está abierto, para que la
  // rueda (zoom) no desplace la pregunta/página de detrás.
  useEffect(() => {
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
    }
  }, [])

  const onWheel = (e: RWheelEvent) => {
    zoomTo(scale + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP))
  }
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (scale === 1) return
    drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    setPos({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) })
  }
  const onPointerUp = () => {
    drag.current = null
  }

  const btn =
    'flex h-9 w-9 items-center justify-center rounded-full text-[#2D3748] transition-colors hover:bg-[#F2EFED] disabled:cursor-not-allowed disabled:opacity-30'

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#1F2937]/85 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div
        className="absolute inset-0 overflow-hidden"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={url}
          alt="Imagen ampliada"
          draggable={false}
          className="absolute left-1/2 top-1/2 max-h-[88vh] max-w-[92vw] select-none rounded-lg object-contain shadow-2xl"
          style={{
            transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            cursor: scale > 1 ? (drag.current ? 'grabbing' : 'grab') : 'default',
            transition: drag.current ? 'none' : 'transform 0.12s ease-out',
          }}
        />
      </div>

      {/* Controles de zoom */}
      <div
        className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/95 px-2 py-1.5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={btn} onClick={() => zoomTo(scale - ZOOM_STEP)} disabled={scale <= ZOOM_MIN} aria-label="Alejar">
          <span className="material-symbols-outlined">remove</span>
        </button>
        <span className="w-12 text-center text-xs font-bold text-[#2D3748]">{Math.round(scale * 100)}%</span>
        <button type="button" className={btn} onClick={() => zoomTo(scale + ZOOM_STEP)} disabled={scale >= ZOOM_MAX} aria-label="Acercar">
          <span className="material-symbols-outlined">add</span>
        </button>
        <button type="button" className={btn} onClick={() => zoomTo(1)} disabled={scale === 1} aria-label="Restablecer zoom">
          <span className="material-symbols-outlined">restart_alt</span>
        </button>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#2D3748] shadow-lg transition-colors hover:bg-white"
      >
        <span className="material-symbols-outlined">close</span>
      </button>
    </motion.div>
  )
}

// ----- Imagen ampliable (sin placeholder): muestra la imagen y abre el lightbox -----
export function ZoomableImage({
  url,
  alt = 'Imagen de la pregunta',
  className = '',
}: {
  url: string
  alt?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ampliar imagen"
        className="group relative block"
      >
        <img src={url} alt={alt} className={className} />
        <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
          <span className="material-symbols-outlined text-sm">zoom_in</span>
          Ampliar
        </span>
      </button>
      {mounted
        ? createPortal(
            <AnimatePresence>{open ? <Lightbox url={url} onClose={() => setOpen(false)} /> : null}</AnimatePresence>,
            document.body,
          )
        : null}
    </>
  )
}

// ----- Imagen "revelable" (voltea para mostrar) + abrir lightbox -----
export default function QuestionImage({ url, alt = 'Imagen de la pregunta', height = 320 }: QuestionImageProps) {
  const [revealed, setRevealed] = useState(false)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const hidden = { backfaceVisibility: 'hidden' as const, WebkitBackfaceVisibility: 'hidden' as const }

  return (
    <div className="mt-5" style={{ perspective: 1200 }}>
      <motion.div
        className="relative w-full"
        style={{ height, transformStyle: 'preserve-3d' }}
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Cara frontal: placeholder (la imagen está oculta hasta que el usuario la revela) */}
        <button
          type="button"
          onClick={() => setRevealed(true)}
          aria-label="Revelar imagen de la pregunta"
          className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[#E8A598]/50 bg-[#FAF7F4] text-[#7D8A96] transition-colors hover:bg-[#fff0ec]"
          style={hidden}
        >
          <span className="material-symbols-outlined text-3xl text-[#E8A598]">visibility</span>
          <span className="text-sm font-bold text-[#2D3748]">Toca para revelar la imagen</span>
          <span className="text-xs">Pensado para verla después de leer el enunciado</span>
        </button>

        {/* Cara trasera: la imagen real */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ampliar imagen"
          className="group absolute inset-0 overflow-hidden rounded-2xl border border-[#E9E4E1] bg-white"
          style={{ ...hidden, transform: 'rotateY(180deg)' }}
        >
          <img src={url} alt={alt} className="h-full w-full object-contain" />
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
            <span className="material-symbols-outlined text-sm">zoom_in</span>
            Ampliar
          </span>
        </button>
      </motion.div>

      {mounted
        ? createPortal(
            <AnimatePresence>{open ? <Lightbox url={url} onClose={() => setOpen(false)} /> : null}</AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  )
}

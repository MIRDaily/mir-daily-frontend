'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import MascotBubble from '@/components/tutorial/MascotBubble'
import { useAnchorRect } from '@/components/tutorial/useAnchorRect'
import { desbloquearVoz } from '@/lib/tutorials/mascotAudio'
import type { TutorialStep } from '@/lib/tutorials/types'

/* ════════════════════════════════════════════════════════════════════════
   La capa del tutorial.

   Va por encima de todo (la celebración de logros usa z-[100]) pero por
   debajo de nada que importe: si algo tiene que interrumpir a esto, es que
   algo se ha montado mal.

   El foco no son cuatro divs recortando el hueco, es UNA sombra gigante:
   `box-shadow: 0 0 0 9999px`. Respeta el border-radius, es una sola capa y no
   se descuadra al hacer scroll, que es donde fallan las otras dos técnicas.
═══════════════════════════════════════════════════════════════════════════ */

const MARGEN_FOCO = 10
// Alto estimado del bocadillo, generoso a propósito: en móvil se apila la
// mascota sobre el texto y crece. Pasarse solo empuja hacia la colocación
// anclada abajo, que siempre es segura; quedarse corto lo saca de pantalla.
const ALTO_BOCADILLO = 260
const ANCHO_BOCADILLO = 440
const HUECO = 24
// Sitio para los puntos y el botón "Saltar" cuando el bocadillo va abajo.
const ALTO_BARRA = 72

type Props = {
  paso: TutorialStep
  indice: number
  total: number
  onAvanzar: () => void
  onSaltar: () => void
}

export default function TutorialOverlay({ paso, indice, total, onAvanzar, onSaltar }: Props) {
  /* En qué paso se terminó de escribir el texto. Guardar el índice en vez de
     un booleano evita tener que reiniciarlo desde un efecto cada vez que se
     avanza: al cambiar de paso deja de coincidir y vuelve a ser "escribiendo"
     él solo. */
  const [completoEn, setCompletoEn] = useState<number | null>(null)
  const textoCompleto = completoEn === indice

  const rect = useAnchorRect(paso.placement === 'centro' ? undefined : paso.anchor, true)

  /** Un toque completa el texto; el segundo avanza. Como en Animal Crossing:
      es la diferencia entre encantador e insufrible. */
  const avanzar = useCallback(() => {
    void desbloquearVoz()
    if (!textoCompleto) {
      window.dispatchEvent(new Event('tutorial:completar-texto'))
      return
    }
    onAvanzar()
  }, [textoCompleto, onAvanzar])

  useEffect(() => {
    const teclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSaltar()
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        avanzar()
      }
    }
    window.addEventListener('keydown', teclado)
    return () => window.removeEventListener('keydown', teclado)
  }, [avanzar, onSaltar])

  // El overlay solo se monta cuando el provider ya ha decidido en un efecto,
  // así que en el servidor nunca llega aquí; la guarda es por si acaso.
  if (typeof document === 'undefined') return null

  const hayFoco = rect !== null && rect.width > 0 && rect.height > 0

  /* Tres colocaciones, no ocho: debajo del objetivo, encima si debajo no cabe,
     y anclado al fondo de la pantalla cuando no cabe en ninguno de los dos.
     El tercer caso no es rebuscado —es el normal en móvil, donde el foco del
     sobre ocupa casi toda la pantalla— y sin él el bocadillo se salía por
     arriba con la mascota cortada por el borde. */
  const espacioDebajo = hayFoco ? window.innerHeight - (rect.top + rect.height) : 0
  const espacioEncima = hayFoco ? rect.top : 0
  const cabeDebajo = hayFoco && espacioDebajo >= ALTO_BOCADILLO + HUECO
  const cabeEncima = hayFoco && espacioEncima >= ALTO_BOCADILLO + HUECO

  const centroX = hayFoco ? rect.left + rect.width / 2 : 0
  const mirandoIzquierda = hayFoco && centroX > window.innerWidth * 0.6

  const posicionVertical = cabeDebajo
    ? { top: rect.top + rect.height + HUECO }
    : cabeEncima
      ? { bottom: window.innerHeight - rect.top + HUECO }
      : { bottom: ALTO_BARRA }

  return createPortal(
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-live="polite">
      {/* Capa oscura. Con foco es la sombra del recorte; sin foco, un velo. */}
      {hayFoco ? (
        <motion.div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-[#E8A598]"
          initial={false}
          animate={{
            top: rect.top - MARGEN_FOCO,
            left: rect.left - MARGEN_FOCO,
            width: rect.width + MARGEN_FOCO * 2,
            height: rect.height + MARGEN_FOCO * 2,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          style={{ boxShadow: '0 0 0 9999px rgba(44, 62, 80, 0.55)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-[#2C3E50]/55 backdrop-blur-[2px]" />
      )}

      {/* Toda la capa avanza al tocarla: obligar a acertar un botón pequeño
          justo cuando la persona todavía no sabe dónde está nada es lo
          contrario de lo que hace un tutorial. */}
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-pointer"
        onClick={avanzar}
        aria-label={textoCompleto ? 'Siguiente' : 'Ver el texto completo'}
      />

      <AnimatePresence mode="wait">
        {/* Centrar con flex y NO con `translate(-50%,-50%)`: framer anima `y`
            en este mismo elemento, así que escribe su propio `transform` y se
            comería el nuestro —que es justo lo que pasaba: el bocadillo se
            clavaba por la esquina en el centro de la pantalla. */}
        <motion.div
          key={indice}
          className={
            hayFoco
              ? 'pointer-events-none absolute'
              : 'pointer-events-none absolute inset-0 flex items-center justify-center'
          }
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          style={
            hayFoco
              ? {
                  ...posicionVertical,
                  left: Math.min(
                    Math.max(centroX - ANCHO_BOCADILLO / 2, 16),
                    Math.max(window.innerWidth - ANCHO_BOCADILLO - 16, 16),
                  ),
                }
              : undefined
          }
        >
          <MascotBubble
            texto={paso.text}
            pose={paso.pose}
            mirandoIzquierda={mirandoIzquierda}
            onTextoCompleto={() => setCompletoEn(indice)}
          />
        </motion.div>
      </AnimatePresence>

      {/* Saltar, siempre visible y siempre en el mismo sitio. */}
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-4">
        <div className="flex items-center gap-1.5" aria-hidden>
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`size-1.5 rounded-full transition-colors ${
                i === indice ? 'bg-white' : 'bg-white/40'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onSaltar}
          className="rounded-full bg-white/15 px-4 py-2 text-xs font-bold text-white backdrop-blur transition-colors hover:bg-white/25"
        >
          Saltar
        </button>
      </div>
    </div>,
    document.body,
  )
}

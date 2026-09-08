'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { Logro } from '@/lib/logros'

/* ════════════════════════════════════════════════════════════════════════
   Avisos de desafío completado.

   Un desafío cumplido no merece tapar la pantalla: se anuncia y se va solo.
   Las metas gordas —subir de nivel, cambiar de rango, un hito de racha— sí se
   quedan, y para eso está CelebracionLogros.

   Los dos no conviven a la vez a propósito: si hay algo gordo que celebrar,
   los desafíos van listados DENTRO de esa tarjeta. Un aviso flotando sobre un
   modal con el fondo atenuado se lee como un error de montaje.
═══════════════════════════════════════════════════════════════════════════ */

const numberFormat = new Intl.NumberFormat('es-ES')

/** Lo que tarda cada aviso en irse solo. */
const VIDA_MS = 4600
/** Separación entre uno y el siguiente, para que no entren en bloque. */
const ESCALON_MS = 450

type Aviso = { id: number; logro: Extract<Logro, { tipo: 'desafio' }> }

export default function AvisosDesafio({
  desafios,
  onVistos,
}: {
  desafios: Extract<Logro, { tipo: 'desafio' }>[]
  /** Se llama cuando ya se han entregado todos: la cola puede vaciarse. */
  onVistos: () => void
}) {
  const reduceMotion = useReducedMotion()
  const [visibles, setVisibles] = useState<Aviso[]>([])

  // Sin guardia de "ya montado". Había una y era justo lo que rompía el
  // componente en desarrollo: React monta, limpia y vuelve a montar, así que
  // el primer pase marcaba la bandera y programaba los temporizadores, la
  // limpieza los cancelaba, y el segundo pase salía por el return temprano sin
  // programar nada. No aparecía ningún aviso.
  //
  // No hace falta: las dependencias ya evitan reprogramar mientras la lista no
  // cambie, y el efecto es idempotente porque parte de cero cada vez.
  useEffect(() => {
    if (desafios.length === 0) return

    const avisos = desafios.map((logro, id) => ({ id, logro }))
    const temporizadores: ReturnType<typeof setTimeout>[] = []

    avisos.forEach((a, i) => {
      // Entran escalonados, y cada uno se va por su cuenta pasado su tiempo.
      // El primero REEMPLAZA la lista en vez de añadirse: si llegan desafíos
      // nuevos mientras aún hay avisos en pantalla, los identificadores
      // vuelven a empezar en cero y chocarían con los que ya estaban.
      temporizadores.push(
        setTimeout(
          () => setVisibles((prev) => (i === 0 ? [a] : [...prev, a])),
          i * ESCALON_MS,
        ),
        setTimeout(
          () => setVisibles((prev) => prev.filter((v) => v.id !== a.id)),
          i * ESCALON_MS + VIDA_MS,
        ),
      )
    })

    // La cola se da por entregada en cuanto están todos en pantalla: si el
    // usuario se va a mitad, no queremos que le vuelvan a saltar los mismos
    // avisos la próxima vez que abra el perfil.
    temporizadores.push(
      setTimeout(onVistos, (avisos.length - 1) * ESCALON_MS + VIDA_MS + 400),
    )

    return () => temporizadores.forEach(clearTimeout)
  }, [desafios, onVistos])

  if (visibles.length === 0) return null

  return (
    <div
      // Debajo de la cabecera pegajosa, que mide unos 72 px.
      className="pointer-events-none fixed right-4 top-20 z-[90] flex w-[min(88vw,20rem)] flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {visibles.map(({ id, logro }) => (
          <motion.div
            key={id}
            layout
            className="pointer-events-auto flex items-center gap-3 rounded-2xl border-2 border-[#2c3e50] bg-white px-3.5 py-3"
            style={{ boxShadow: '4px 4px 0 0 #2c3e50' }}
            /* Entrada con rebote y estela.

               El desenfoque de movimiento real no existe en la web, pero se
               finge bien: el filtro va de 10 px a 0 en menos de lo que tarda el
               muelle en asentarse, así que la estela se disipa justo cuando la
               pieza frena y el ojo lo lee como velocidad. Se anima aparte del
               resto (transición propia) porque con el muelle rebotaría también
               el desenfoque, y eso se ve como un fallo de render.

               El muelle va poco amortiguado a propósito (damping 14): pasa de
               largo y vuelve. Con el 30 de antes solo se deslizaba. */
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: 72, scale: 0.88, filter: 'blur(10px)' }
            }
            animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: 56, scale: 0.94, filter: 'blur(6px)' }
            }
            transition={{
              default: { type: 'spring', stiffness: 520, damping: 14, mass: 0.9 },
              filter: { duration: 0.26, ease: 'easeOut' },
              opacity: { duration: 0.16 },
            }}
            onClick={() => setVisibles((prev) => prev.filter((v) => v.id !== id))}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-[#2c3e50] bg-[#8BA888]/14">
              <span className="material-symbols-outlined text-[20px] text-[#6E8D6B]">
                task_alt
              </span>
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7D8A96]">
                {logro.scope === 'weekly' ? 'Desafío semanal' : 'Desafío completado'}
              </p>
              <p className="truncate text-sm font-bold leading-tight text-[#2c3e50]">
                {logro.titulo}
              </p>
            </div>

            <span className="shrink-0 rounded-lg bg-[#8BA888] px-2 py-1 text-[11px] font-black text-white">
              +{numberFormat.format(logro.xp)}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

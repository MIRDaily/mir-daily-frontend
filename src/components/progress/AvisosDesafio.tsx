'use client'

import { useEffect, useRef } from 'react'
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

   CADA AVISO SE APAGA SOLO. Antes había un lote de temporizadores compartidos
   en el padre y traía dos problemas: al llegar un aviso nuevo se cancelaban
   los del lote anterior (los que ya estaban en pantalla se quedaban clavados),
   y los avisos reutilizaban identificadores desde cero, así que React
   reciclaba el nodo y cambiaba el texto SIN ANIMAR. Parecía que la entrada no
   existiera. Ahora cada uno tiene identidad propia y su propio reloj.
═══════════════════════════════════════════════════════════════════════════ */

const numberFormat = new Intl.NumberFormat('es-ES')

/** Lo que tarda cada aviso en irse solo. */
const VIDA_MS = 4600
type Desafio = Extract<Logro, { tipo: 'desafio' }>

function Aviso({ logro, onIr }: { logro: Desafio; onIr: () => void }) {
  const reduceMotion = useReducedMotion()

  // Su propio reloj, y atado SOLO a su montaje.
  //
  // Antes el plazo dependía de la posición en la lista, y eso lo rompía: al
  // desaparecer un aviso los de debajo cambiaban de índice, el efecto se
  // volvía a ejecutar y reiniciaban la cuenta atrás. Con avisos llegando
  // seguidos, alguno no se habría ido nunca.
  //
  // `onIr` se guarda en una referencia para que un cambio de identidad de la
  // función tampoco reinicie el reloj.
  const irRef = useRef(onIr)
  useEffect(() => {
    irRef.current = onIr
  }, [onIr])

  useEffect(() => {
    const t = setTimeout(() => irRef.current(), VIDA_MS)
    return () => clearTimeout(t)
  }, [])

  return (
    <motion.div
      layout
      className="pointer-events-auto flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-[#2c3e50] bg-white px-3.5 py-3"
      style={{ boxShadow: '4px 4px 0 0 #2c3e50' }}
      /* Entrada con rebote y estela.

         El desenfoque de movimiento real no existe en la web, pero se finge
         bien: el filtro va de 10 px a 0 en menos de lo que tarda el muelle en
         asentarse, así que la estela se disipa justo cuando la pieza frena y el
         ojo lo lee como velocidad.

         El filtro se anima con su PROPIA transición y no con la del muelle: con
         el muelle rebotaría también el desenfoque, y un borroso que va y viene
         se lee como un fallo de render, no como movimiento.

         El muelle va poco amortiguado a propósito (damping 13): pasa de largo y
         vuelve. */
      initial={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, x: 90, scale: 0.86, filter: 'blur(12px)' }
      }
      animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
      exit={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, x: 64, scale: 0.92, filter: 'blur(8px)' }
      }
      transition={{
        default: {
          type: 'spring',
          stiffness: 520,
          damping: 13,
          mass: 0.9,
        },
        filter: { duration: 0.3, ease: 'easeOut' },
        opacity: { duration: 0.18 },
      }}
      onClick={onIr}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-[#2c3e50] bg-[#8BA888]/14">
        <span className="material-symbols-outlined text-[20px] text-[#6E8D6B]">task_alt</span>
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7D8A96]">
          {logro.scope === 'weekly' ? 'Desafío semanal' : 'Desafío completado'}
        </p>
        <p className="truncate text-sm font-bold leading-tight text-[#2c3e50]">{logro.titulo}</p>
      </div>

      <span className="shrink-0 rounded-lg bg-[#8BA888] px-2 py-1 text-[11px] font-black text-white">
        +{numberFormat.format(logro.xp)}
      </span>
    </motion.div>
  )
}

export default function AvisosDesafio({
  desafios,
  onDescartar,
}: {
  desafios: Desafio[]
  /** Quita ese aviso de la cola: se ha visto o se ha ido solo. */
  onDescartar: (id: string) => void
}) {
  if (desafios.length === 0) return null

  return (
    <div
      // Debajo de la cabecera pegajosa, que mide unos 72 px.
      className="pointer-events-none fixed right-4 top-20 z-[90] flex w-[min(88vw,20rem)] flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {/* SIN `initial={false}`. Lo llevaba, y era justo lo que dejaba el primer
          aviso sin animación: esa bandera le dice a framer que no anime a los
          hijos ya presentes cuando el propio AnimatePresence se monta, y como
          este componente devuelve null mientras no hay avisos, al llegar el
          primero se monta de cero CON el aviso ya dentro. Los siguientes sí
          animaban, porque el contenedor ya existía. */}
      <AnimatePresence mode="popLayout">
        {desafios.map((logro) => (
          <Aviso key={logro.id} logro={logro} onIr={() => onDescartar(logro.id)} />
        ))}
      </AnimatePresence>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion'
import {
  costeNivel,
  nivelParaXp,
  rankForLevel,
  xpParaNivel,
} from '@/lib/levels'
import MarcoNivel from '@/components/progress/MarcoNivel'
import ChispasDeNivel from '@/components/progress/ChispasDeNivel'

/* ════════════════════════════════════════════════════════════════════════
   El salto de nivel, contado en directo.

   No enseña el resultado: enseña el RECORRIDO. Arranca en el XP que tenías
   antes del último evento, cuenta hacia arriba, la barra se llena, y al
   completarse el nivel salta y la barra vuelve a empezar. Si el tramo cruza
   dos peldaños, se ven los dos.

   Cómo está hecho, que aquí importa: el XP es un MotionValue y la anchura de
   la barra sale de él con useTransform. Eso significa que la barra y el
   contador se actualizan FUERA de React, sin un render por fotograma. Solo se
   toca el estado cuando cambia el nivel, que pasa una o dos veces en toda la
   secuencia.
═══════════════════════════════════════════════════════════════════════════ */

const numberFormat = new Intl.NumberFormat('es-ES')

/** Cuánto dura el recorrido. Acotado para que ni se pase ni se quede corto. */
function duracionDe(delta: number) {
  return Math.min(2.6, Math.max(1.1, 0.9 + delta / 260))
}

export default function SubidaDeNivel({
  xpAntes,
  xpDespues,
  onNivelNuevo,
}: {
  xpAntes: number
  xpDespues: number
  /** Se avisa en cada peldaño cruzado, para disparar el confeti fuera. */
  onNivelNuevo?: (nivel: number) => void
}) {
  const reduceMotion = useReducedMotion()

  const nivelInicial = nivelParaXp(xpAntes)
  const nivelFinal = nivelParaXp(xpDespues)
  const ganado = Math.max(0, xpDespues - xpAntes)

  const xp = useMotionValue(reduceMotion ? xpDespues : xpAntes)
  const [nivel, setNivel] = useState(reduceMotion ? nivelFinal : nivelInicial)
  // Sube al cruzar y baja sola: es lo que dispara el golpe de la insignia.
  const [saltando, setSaltando] = useState(0)

  // La barra: de MotionValue a anchura, sin pasar por React.
  const anchura = useTransform(xp, (v) => {
    const n = nivelParaXp(v)
    const base = xpParaNivel(n)
    const pct = ((v - base) / costeNivel(n)) * 100
    return `${Math.max(0, Math.min(100, pct))}%`
  })

  const contador = useTransform(xp, (v) => numberFormat.format(Math.round(v)))

  // La pista de la barra: las chispas la miden para saber contra qué chocan.
  const pistaRef = useRef<HTMLDivElement | null>(null)

  // El aviso al padre vive en una referencia. Si dependiera de la identidad de
  // la función, un padre que la escriba en línea reiniciaría la animación en
  // cada render suyo: la barra volvería a empezar sola a mitad de recorrido.
  const avisarRef = useRef(onNivelNuevo)
  useEffect(() => {
    avisarRef.current = onNivelNuevo
  }, [onNivelNuevo])

  useEffect(() => {
    if (reduceMotion) {
      avisarRef.current?.(nivelFinal)
      return
    }

    let ultimo = nivelParaXp(xpAntes)
    const dejarDeMirar = xp.on('change', (v) => {
      const n = nivelParaXp(v)
      if (n !== ultimo) {
        ultimo = n
        // Solo aquí se toca el estado: una o dos veces en toda la secuencia.
        setNivel(n)
        setSaltando((s) => s + 1)
        avisarRef.current?.(n)
      }
    })

    const controles = animate(xp, xpDespues, {
      duration: duracionDe(ganado),
      // Arranca con brío y frena al final, que es como se lee "esto va
      // subiendo" y no "esto se desliza".
      ease: [0.16, 0.85, 0.3, 1],
      delay: 0.35,
    })

    return () => {
      dejarDeMirar()
      controles.stop()
    }
  }, [xp, xpAntes, xpDespues, ganado, nivelFinal, reduceMotion])

  const rango = rankForLevel(nivel)

  return (
    <div className="relative flex flex-col items-center">
      {/* Las chispas van aquí arriba, hermanas de todo lo demás, para poder
          volar por encima de la insignia. Miden la barra en vivo por su ref:
          chocan con donde está de verdad, no con una posición supuesta. */}
      <ChispasDeNivel
        salva={saltando}
        barraRef={pistaRef}
        colores={[rango.color, '#DEBB7E', '#EDB53F', '#C4856A']}
      />
      {/* La insignia. Da un golpe en cada peldaño cruzado. */}
      <div className="relative mb-4 flex h-24 w-24 items-center justify-center">
        {/* Onda que sale disparada al saltar. Calca el filo del marco: el
            recuadro va del 4,55 % al 95,45 % del hueco y su radio es el 10 %
            de su propio lado (12 sobre 120 en el SVG). */}
        {saltando > 0 && !reduceMotion ? (
          <motion.span
            key={`onda-${saltando}`}
            className="absolute rounded-[10%] border-[3px]"
            style={{ inset: '4.55%', borderColor: '#DEBB7E' }}
            initial={{ scale: 1, opacity: 0.95 }}
            animate={{ scale: 2.1, opacity: 0 }}
            transition={{ duration: 0.75, ease: 'easeOut' }}
          />
        ) : null}

        <motion.span
          className="block"
          animate={
            saltando > 0 && !reduceMotion
              ? { scale: [1, 1.34, 0.94, 1], rotate: [0, -6, 4, 0] }
              : {}
          }
          key={`insignia-${saltando}`}
          transition={{ duration: 0.62, ease: 'easeOut' }}
        >
          <MarcoNivel nivel={nivel} tamano={96} color={rango.color} />
        </motion.span>
      </div>

      {/* El XP ganado, que es el protagonista del momento. */}
      {ganado > 0 ? (
        <motion.p
          className="mb-3 rounded-full border-2 border-[#2c3e50] bg-[#2c3e50] px-3 py-1 text-sm font-black text-white"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.7 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 460, damping: 15, delay: 0.12 }}
        >
          +{numberFormat.format(ganado)} XP
        </motion.p>
      ) : null}

      {/* La barra. */}
      <div className="w-full">
        <div
          ref={pistaRef}
          className="relative h-4 w-full overflow-hidden rounded-full border-2 border-[#2c3e50] bg-[#F3EFED]"
        >
          <motion.div
            className="h-full rounded-r-full"
            style={{ width: anchura, backgroundColor: rango.color }}
          />

          {/* Destello blanco que barre la barra en cada peldaño: es lo que
              hace que el cruce se lea como un golpe y no como un reinicio. */}
          {saltando > 0 && !reduceMotion ? (
            <motion.span
              key={`destello-${saltando}`}
              className="pointer-events-none absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white to-transparent"
              initial={{ left: '-20%', opacity: 0.95 }}
              animate={{ left: '110%', opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            />
          ) : null}
        </div>

        <div className="mt-1.5 flex items-baseline justify-between text-xs text-[#7D8A96]">
          <span className="font-bold text-[#2c3e50]">{rango.name}</span>
          <span className="tabular-nums">
            <motion.span className="font-bold text-[#2c3e50]">{contador}</motion.span> XP
          </span>
        </div>
      </div>
    </div>
  )
}

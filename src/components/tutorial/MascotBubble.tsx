'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { blip, vozActual } from '@/lib/tutorials/mascotAudio'
import type { MascotPose } from '@/lib/tutorials/types'

/* La mascota todavía no está exportada. Hasta que lo esté, cada pose apunta a
   un fichero que puede no existir: el <Image> falla en silencio y queda el
   bocadillo solo, que se lee perfectamente. Sustituir por los PNG definitivos
   en /public/img/mascota no requiere tocar nada más de este fichero. */
const POSE_SRC: Record<MascotPose, string> = {
  saludo: '/img/mascota/saludo.png',
  senalando: '/img/mascota/senalando.png',
  hablando: '/img/mascota/hablando.png',
  despedida: '/img/mascota/despedida.png',
}

const MS_POR_CARACTER = 28
/** Cada toque durante el tecleo divide el retardo por esto. */
const FACTOR_ACELERACION = 4
/** Suelo: por debajo el texto ya aparece de golpe y no se lee el avance. */
const MS_MINIMO = 4
/** Separación mínima entre blips. Sin esto, acelerar suena a metralleta. */
const MS_ENTRE_BLIPS = 55

type Props = {
  texto: string
  pose: MascotPose
  /** Volteada cuando el bocadillo cae a la derecha del objetivo. */
  mirandoIzquierda?: boolean
  /**
   * Fuerza la disposición de móvil —mascota encima del texto— también en
   * escritorio. El overlay la pide cuando hay maqueta del modo en pantalla:
   * en fila el conjunto mide 556 px y en columna 384, y esos 172 px son la
   * diferencia entre que la maqueta quepa al lado o no quepa.
   */
  apilada?: boolean
  /** Se llama una vez, cuando ya está escrito del todo. */
  onTextoCompleto?: () => void
}

/**
 * La mascota y su cuadro de texto, escribiéndose letra a letra.
 *
 * Se remonta en cada paso (el overlay le pone `key`), así que el estado
 * inicial ya es el correcto y no hace falta reiniciarlo desde un efecto.
 *
 * El tecleo va con `setTimeout` encadenado y NO con `setInterval`: el ritmo
 * cambia en caliente cuando el usuario toca para acelerar, y un intervalo ya
 * programado no cambia de periodo — habría que destruirlo y recrearlo en cada
 * toque, con el salto de tiempo que eso mete.
 *
 * Con "reduce motion" activado no hay máquina de escribir ni blips: el texto
 * sale entero. No es una degradación, es lo correcto — quien pide menos
 * movimiento no quiere que el texto le baile.
 */
export default function MascotBubble({
  texto,
  pose,
  mirandoIzquierda,
  apilada = false,
  onTextoCompleto,
}: Props) {
  const reduceMotion = useReducedMotion()
  const [visibles, setVisibles] = useState(() => (reduceMotion ? texto.length : 0))
  const avisoRef = useRef(onTextoCompleto)
  const retardoRef = useRef(MS_POR_CARACTER)

  const completo = visibles >= texto.length

  useEffect(() => {
    avisoRef.current = onTextoCompleto
  }, [onTextoCompleto])

  useEffect(() => {
    if (reduceMotion) {
      const id = requestAnimationFrame(() => avisoRef.current?.())
      return () => cancelAnimationFrame(id)
    }

    // Cada paso vuelve a empezar a velocidad normal: acelerar es una decisión
    // sobre ESTA frase, no un ajuste que se arrastra el resto del tutorial.
    retardoRef.current = MS_POR_CARACTER

    let i = 0
    let id: number

    const escribir = () => {
      i += 1
      setVisibles(i)

      /* Ni en los espacios ni en cada letra. La cadencia se calcula sobre el
         retardo actual y no es fija: a velocidad normal sale uno de cada dos
         caracteres —que es lo que suena a voz—, y cuanto más se acelera, más
         caracteres se salta, de modo que el ritmo de los blips se mantiene
         aunque el texto vuele. */
      const c = texto[i - 1]
      const cadencia = Math.max(
        vozActual().cadencia,
        Math.round(MS_ENTRE_BLIPS / retardoRef.current),
      )
      if (c && c.trim() && i % cadencia === 0) blip(i + c.charCodeAt(0))

      if (i >= texto.length) {
        avisoRef.current?.()
        return
      }
      id = window.setTimeout(escribir, retardoRef.current)
    }

    id = window.setTimeout(escribir, retardoRef.current)
    return () => window.clearTimeout(id)
  }, [texto, reduceMotion])

  /* Acelerar. Va por el DOM para no tener que subir un ref hasta el overlay
     solo para esto.

     Acelerar y NO completar de golpe es deliberado: el salto instantáneo se
     come la frase entera —y con ella los blips— justo cuando la persona ha
     tocado porque quiere ir más rápido, no porque quiera dejar de leer. */
  useEffect(() => {
    const acelerar = () => {
      retardoRef.current = Math.max(MS_MINIMO, retardoRef.current / FACTOR_ACELERACION)
    }
    window.addEventListener('tutorial:acelerar', acelerar)
    return () => window.removeEventListener('tutorial:acelerar', acelerar)
  }, [])

  // En móvil se apilan: la mascota arriba y el bocadillo debajo. Al lado no
  // caben —una caja de 384 px más la mascota se salía de un viewport de 375— y
  // encogiendo la caja el texto quedaba en una columna estrechísima. Apilados,
  // el bocadillo recupera el ancho entero y la mascota no tiene que menguar.
  //
  // La mascota se queda del lado hacia el que mira, que en vertical es lo único
  // que queda de la relación izquierda/derecha que en horizontal da el orden.
  return (
    <div
      className={`flex max-w-[calc(100vw-2rem)] flex-col gap-2 ${
        apilada ? '' : 'sm:flex-row sm:items-end sm:gap-3'
      } ${
        mirandoIzquierda
          ? `items-end ${apilada ? '' : 'sm:flex-row-reverse'}`
          : 'items-start'
      }`}
    >
      {/* El volteo va por `scaleX` de framer, NO por un `transform` en `style`:
          framer escribe ese mismo `transform` para animar la entrada, así que
          un transform propio se lo comería —o al revés—. Va también en
          `initial` para que la mascota no entre girando sobre sí misma. */}
      <motion.div
        aria-hidden
        className="relative size-32 shrink-0 sm:size-40"
        initial={reduceMotion ? false : { y: 8, opacity: 0, scaleX: mirandoIzquierda ? -1 : 1 }}
        animate={{ y: 0, opacity: 1, scaleX: mirandoIzquierda ? -1 : 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <Image src={POSE_SRC[pose]} alt="" fill sizes="160px" className="object-contain" />
      </motion.div>

      <div className="relative min-w-0 max-w-sm rounded-3xl border border-[#E8A598]/30 bg-white px-5 py-4 shadow-[0_18px_40px_rgba(125,138,150,0.22)]">
        {/* Tres capas, cada una con su trabajo:
            1. el texto completo OCULTO pero ocupando sitio, que reserva el
               tamaño final de la caja — si no, el bocadillo crece letra a
               letra mientras teclea y da un tembleque horrible;
            2. el texto que se va escribiendo, encima;
            3. el texto completo para los lectores de pantalla, que no deben
               tener que esperar a que termine la animación para leerlo. */}
        <p className="relative text-[15px] font-medium leading-relaxed text-[#2D3748]">
          <span aria-hidden className="invisible">{texto}</span>
          <span aria-hidden className="absolute inset-0">{texto.slice(0, visibles)}</span>
          <span className="sr-only">{texto}</span>
        </p>

        {/* La señal de "ya puedes seguir".

            Antes no hacía falta: cualquier toque avanzaba, tarde o temprano.
            Ahora que el primer toque solo acelera, sin esta marca no hay forma
            de saber cuándo el siguiente toque pasa de página. */}
        {completo && (
          <motion.span
            aria-hidden
            className="absolute -bottom-2 -right-2 flex size-6 items-center justify-center rounded-full border border-[#E8A598]/40 bg-white text-[#E8A598] shadow-sm"
            initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
            animate={
              reduceMotion
                ? { scale: 1, opacity: 1 }
                : { scale: 1, opacity: 1, y: [0, 2, 0] }
            }
            transition={
              reduceMotion
                ? { duration: 0 }
                : { y: { repeat: Infinity, duration: 1.1, ease: 'easeInOut' }, duration: 0.2 }
            }
          >
            <svg viewBox="0 0 10 10" className="size-2.5 fill-current">
              <path d="M1 1 L9 5 L1 9 Z" />
            </svg>
          </motion.span>
        )}
      </div>
    </div>
  )
}

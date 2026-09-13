'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { blip } from '@/lib/tutorials/mascotAudio'
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

type Props = {
  texto: string
  pose: MascotPose
  /** Volteada cuando el bocadillo cae a la derecha del objetivo. */
  mirandoIzquierda?: boolean
  /** Se llama una vez, cuando ya está escrito del todo. */
  onTextoCompleto?: () => void
}

/**
 * La mascota y su cuadro de texto, escribiéndose letra a letra.
 *
 * Se remonta en cada paso (el overlay le pone `key`), así que el estado
 * inicial ya es el correcto y no hace falta reiniciarlo desde un efecto.
 *
 * Con "reduce motion" activado no hay máquina de escribir ni blips: el texto
 * sale entero. No es una degradación, es lo correcto — quien pide menos
 * movimiento no quiere que el texto le baile.
 */
export default function MascotBubble({ texto, pose, mirandoIzquierda, onTextoCompleto }: Props) {
  const reduceMotion = useReducedMotion()
  const [visibles, setVisibles] = useState(() => (reduceMotion ? texto.length : 0))
  const avisoRef = useRef(onTextoCompleto)

  useEffect(() => {
    avisoRef.current = onTextoCompleto
  }, [onTextoCompleto])

  useEffect(() => {
    if (reduceMotion) {
      const id = requestAnimationFrame(() => avisoRef.current?.())
      return () => cancelAnimationFrame(id)
    }

    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setVisibles(i)

      // Ni en los espacios ni en cada letra: uno de cada dos caracteres
      // visibles suena a voz, uno por letra satura.
      const c = texto[i - 1]
      if (c && c.trim() && i % 2 === 0) blip(i + c.charCodeAt(0))

      if (i >= texto.length) {
        window.clearInterval(id)
        avisoRef.current?.()
      }
    }, MS_POR_CARACTER)

    return () => window.clearInterval(id)
  }, [texto, reduceMotion])

  // Saltarse el tecleo. Va por el DOM para no tener que subir un ref hasta el
  // overlay solo para esto.
  useEffect(() => {
    const completar = () => {
      setVisibles(texto.length)
      avisoRef.current?.()
    }
    window.addEventListener('tutorial:completar-texto', completar)
    return () => window.removeEventListener('tutorial:completar-texto', completar)
  }, [texto])

  return (
    <div className={`flex items-end gap-3 ${mirandoIzquierda ? 'flex-row-reverse' : ''}`}>
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

      <div className="relative max-w-sm rounded-3xl border border-[#E8A598]/30 bg-white px-5 py-4 shadow-[0_18px_40px_rgba(125,138,150,0.22)]">
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
      </div>
    </div>
  )
}

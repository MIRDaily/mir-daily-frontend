'use client'

/* ════════════════════════════════════════════════════════════════════════
   Píldoras de filtro con contador (nacieron en la galería de la Biblioteca).
   - La píldora oscura del filtro activo viaja de uno a otro (layoutId).
   - El contador tiene SIEMPRE su hueco y con ancho fijo (en em: cabe «99»):
     la píldora no cambia de tamaño al llegar los datos ni al pasar de una a
     dos cifras, y la oscura no se mueve sola. Sin datos, «–».
   - En móvil la tira se desplaza en horizontal y trae a la vista la elegida
     (solo la tira: scrollIntoView movería también la página).
═══════════════════════════════════════════════════════════════════════════ */
import { useEffect, useRef, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { NumeroAnimado } from '@/components/ui/movimiento'

export type OpcionFiltro<T extends string> = {
  valor: T
  etiqueta: ReactNode
  /** null mientras no se sabe. */
  cuenta: number | null
}

export function PildorasFiltro<T extends string>({
  opciones,
  valor,
  onElegir,
  idPildora,
  etiqueta,
  className = '',
}: {
  opciones: OpcionFiltro<T>[]
  valor: T
  onElegir: (valor: T) => void
  /** layoutId de la píldora oscura: único en la pantalla. */
  idPildora: string
  /** aria-label del grupo. */
  etiqueta: string
  className?: string
}) {
  const reducir = useReducedMotion()
  const tiraRef = useRef<HTMLDivElement | null>(null)
  const montado = useRef(false)

  useEffect(() => {
    const tira = tiraRef.current
    const boton = tira?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (tira && boton) {
      const izq = boton.offsetLeft - tira.offsetLeft
      const der = izq + boton.offsetWidth
      const destino = izq < tira.scrollLeft ? izq : der > tira.scrollLeft + tira.clientWidth ? der - tira.clientWidth : null
      if (destino !== null) tira.scrollTo({ left: destino, behavior: montado.current && !reducir ? 'smooth' : 'instant' })
    }
    montado.current = true
  }, [valor, reducir])

  return (
    <motion.div ref={tiraRef} layoutScroll className={`no-scrollbar flex gap-2 overflow-x-auto pb-1 ${className}`} role="group" aria-label={etiqueta}>
      {opciones.map((o) => {
        const activo = valor === o.valor
        const n = o.cuenta
        return (
          <button
            key={o.valor}
            type="button"
            onClick={() => onElegir(o.valor)}
            aria-pressed={activo}
            className={`relative shrink-0 rounded-full border-2 px-4 py-1.5 text-sm font-extrabold transition-colors duration-200 motion-reduce:transition-none ${
              activo ? 'border-transparent text-white' : 'border-[#EAE4E2] bg-white text-[#7D8A96] hover:border-[#2c3e50] hover:text-[#2C3E50]'
            }`}
          >
            {/* La píldora oscura va por encima del fondo blanco de las demás (z-1) y por debajo de los textos
                (z-2), para que no la tape el botón por el que pasa. */}
            {activo ? (
              <motion.span
                layoutId={idPildora}
                className="absolute -inset-[2px] z-[1] rounded-full bg-[#2C3E50]"
                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                aria-hidden
              />
            ) : null}
            <span className="relative z-[2] inline-flex items-center gap-1.5 transition-transform duration-150 active:scale-95 motion-reduce:transition-none">
              {o.etiqueta}
              <span
                className={`inline-flex w-[2.6em] justify-center rounded-full text-[11px] leading-[1.15rem] font-black transition-colors duration-200 ${
                  activo ? 'bg-white/20 text-white' : n === 0 ? 'bg-[#F5F1EE] text-[#7D8A96]/50' : 'bg-[#F5F1EE] text-[#7D8A96]'
                }`}
              >
                {n === null ? <span className="opacity-40">–</span> : <NumeroAnimado valor={n} />}
              </span>
            </span>
          </button>
        )
      })}
    </motion.div>
  )
}

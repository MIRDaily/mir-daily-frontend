'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useReducedMotion } from 'framer-motion'
import { useCreditosIA } from '@/hooks/useCreditosIA'
import { MonedaIA } from '@/components/ia/MonedaIA'
import { diasHasta, fechaCorta, fraccionGastada } from '@/lib/ia/creditosTexto'

// Precio de una generación junto a su botón: «Usará 14 créditos · te quedan 1.240», con lo que se
// gasta a la vista: una pila de monedas que crece con el precio y la barra del saldo con el trozo que
// se lleva esta generación (y lo que quedará). Se recalcula al cambiar las opciones (lo calcula el
// diálogo con precioIA y la tarifa del servidor). Si no llega, las alternativas (§5.3 de la
// especificación): nunca un «no» seco. Con los créditos apagados no pinta nada (el diálogo enseña el
// cupo de hoy, como siempre).

const INK = '#2C3E50'
const ORO = '#E2A52A'
const ORO_OSCURO = '#9A6508'
const fmt = (n: number) => n.toLocaleString('es-ES')

/** Una cifra que cuenta hasta su valor cuando cambia. */
export function CifraIA({ valor }: { valor: number }) {
  const reducir = useReducedMotion()
  const [n, setN] = useState(valor)
  const previo = useRef(valor)
  useEffect(() => {
    const desde = previo.current
    previo.current = valor
    if (reducir || desde === valor) {
      const id = requestAnimationFrame(() => setN(valor))
      return () => cancelAnimationFrame(id)
    }
    const c = animate(desde, valor, { duration: 0.6, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setN(Math.round(v)) })
    return () => c.stop()
  }, [valor, reducir])
  return <span className="tabular-nums">{fmt(n)}</span>
}

/** Monedas de la pila: crece con el precio (1 a 6, en escala logarítmica: 3 → 2, 14 → 4, 90 → 6). */
const monedasPara = (precio: number) => Math.max(1, Math.min(6, Math.ceil(Math.log2(precio + 1) * 0.9)))

function PilaMonedas({ precio }: { precio: number }) {
  const reducir = useReducedMotion()
  const n = monedasPara(precio)
  return (
    <span aria-hidden className="relative inline-block h-[2.1rem] w-[1.9rem] shrink-0">
      <AnimatePresence initial={false}>
        {Array.from({ length: n }, (_, i) => (
          <motion.span
            key={i}
            className="absolute left-0 block"
            style={{ bottom: `${i * 0.28}rem`, zIndex: i }}
            initial={reducir ? false : { y: -14, opacity: 0, rotate: -25 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={reducir ? { opacity: 0 } : { y: -10, opacity: 0, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 22, delay: reducir ? 0 : (i - n + 1) * -0.03 }}
          >
            <MonedaIA tam="1.6rem" cara={i === n - 1} />
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  )
}

/** La barra del saldo: lo que queda tras generar (oro) y lo que se lleva esta generación (rayado). */
function BarraGasto({ precio, total }: { precio: number; total: number }) {
  const reducir = useReducedMotion()
  const llega = precio <= total
  // Proporción del saldo que se lleva; lo mínimo se ve (si no, 3 de 1.000 no se distinguiría).
  const parte = total > 0 ? Math.min(1, precio / total) : 1
  const visible = llega ? Math.max(0.035, parte) : 1
  return (
    <div className="mt-1.5">
      <div className="relative h-2.5 overflow-hidden rounded-full bg-[#F1ECE8]" style={{ border: `1.5px solid ${INK}` }}>
        {llega && (
          <motion.div
            className="absolute inset-y-0 left-0 rounded-l-full"
            style={{ background: `linear-gradient(180deg, #FFE08A, ${ORO})` }}
            animate={{ width: `${(1 - visible) * 100}%` }}
            transition={{ type: 'spring', stiffness: 140, damping: 20 }}
          />
        )}
        <motion.div
          className="absolute inset-y-0 right-0"
          style={{
            backgroundImage: llega
              ? `repeating-linear-gradient(45deg, #F6C9BE 0 0.3rem, #E8A598 0.3rem 0.6rem)`
              : `repeating-linear-gradient(45deg, #F2B8AE 0 0.3rem, #D4667A 0.3rem 0.6rem)`,
            borderLeft: llega ? `1.5px solid ${INK}` : undefined,
          }}
          animate={{ width: `${visible * 100}%`, opacity: reducir ? 1 : [1, 0.65, 1] }}
          transition={{ width: { type: 'spring', stiffness: 140, damping: 20 }, opacity: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } }}
        />
      </div>
      <p className="mt-1 flex justify-between text-[0.7rem] font-semibold text-[#7D8A96]">
        <span>
          {llega ? (
            <>
              Te quedarán <b className="text-[#2C3E50]"><CifraIA valor={total - precio} /></b>
            </>
          ) : (
            <>
              Te faltan <b className="text-[#B04A5E]"><CifraIA valor={precio - total} /></b>
            </>
          )}
        </span>
        <span>{llega ? `${Math.max(1, Math.round(parte * 100))} % de tu saldo` : 'no llega'}</span>
      </p>
    </div>
  )
}

export function PrecioIA({
  precio,
  alternativas = [],
  className = '',
  accion = 'Usará',
}: {
  /** Créditos que costará (null: todavía no se puede calcular). */
  precio: number | null
  /** Lo que el usuario puede cambiar en ESTE diálogo para que cueste menos. */
  alternativas?: string[]
  className?: string
  accion?: string
}) {
  const { activo, saldo } = useCreditosIA()
  if (!activo || !saldo || precio === null) return null

  if (!saldo.puede_usar) {
    return (
      <div className={`rounded-2xl bg-[#FAEAED] px-4 py-3 text-[0.82rem] text-[#B04A5E] ${className}`} role="alert">
        <p className="font-extrabold">Necesitas un plan con IA para generar.</p>
        <p className="mt-0.5">
          {saldo.prueba_disponible ? 'Pronto podrás empezar con una prueba de 7 días.' : 'Tu plan no está activo.'}{' '}
          <Link href="/profile/creditos" className="font-bold underline">Ver mis créditos</Link>
        </p>
      </div>
    )
  }

  const total = saldo.total
  const llega = saldo.ilimitado || precio <= total
  const gastado = fraccionGastada(saldo)
  const prueba = saldo.plan === 'prueba'

  return (
    <div className={className}>
      <div
        className="rounded-2xl bg-white px-3 py-2 text-[0.82rem] text-[#7D8A96]"
        style={{ border: `2px solid ${llega ? INK : '#D4667A'}`, boxShadow: llega ? `2px 2px 0 0 ${INK}` : 'none' }}
        aria-live="polite"
        data-precio-ia={precio}
      >
        <div className="flex items-center gap-2.5">
          {precio > 0 ? <PilaMonedas precio={precio} /> : <MonedaIA tam="1.6rem" />}
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-1.5">
              {precio === 0 ? (
                <span className="font-extrabold text-[#2C3E50]">Gratis: no gasta créditos</span>
              ) : (
                <>
                  <span className="font-extrabold text-[#2C3E50]">{accion}</span>
                  <span className="text-[1.15rem] font-black leading-none" style={{ color: llega ? ORO_OSCURO : '#B04A5E' }}>
                    <CifraIA valor={precio} />
                  </span>
                  <span className="font-extrabold text-[#2C3E50]">{precio === 1 ? 'crédito' : 'créditos'}</span>
                </>
              )}
            </p>
            <p className="text-[0.74rem]">
              {saldo.ilimitado ? (
                'Cuenta sin límite: se apunta, no se descuenta'
              ) : (
                <>
                  Tienes <b className="text-[#2C3E50]"><CifraIA valor={total} /></b>
                  {prueba ? ` · prueba: ${diasHasta(saldo.periodo_fin)} días` : ''}
                </>
              )}
            </p>
          </div>
        </div>
        {precio > 0 && !saldo.ilimitado && <BarraGasto precio={precio} total={total} />}
      </div>
      {llega && !saldo.ilimitado && gastado >= 0.8 && (
        <p className="mt-1 text-[0.75rem] text-[#8A6418]">
          Llevas gastado el {Math.round(gastado * 100)} % de los créditos del mes; se renuevan el {fechaCorta(saldo.periodo_fin)}.
        </p>
      )}
      {!llega && <SinCreditosIA precio={precio} alternativas={alternativas} />}
    </div>
  )
}

/** Sin créditos suficientes: qué se puede hacer (y que no se pierde nada). */
export function SinCreditosIA({ precio, alternativas = [] }: { precio: number; alternativas?: string[] }) {
  const { saldo } = useCreditosIA()
  if (!saldo) return null
  const prueba = saldo.plan === 'prueba'
  return (
    <div className="mt-2 rounded-2xl bg-[#FBF3E1] px-4 py-3 text-[0.8rem] text-[#6B5418]" role="alert" data-sin-creditos>
      <p className="font-extrabold text-[#8A6418]">
        Hacen falta {fmt(precio)} créditos y te {saldo.total === 1 ? 'queda' : 'quedan'} {fmt(saldo.total)}. Puedes:
      </p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
        {alternativas.map((a) => (
          <li key={a}>{a}</li>
        ))}
        <li>
          {prueba ? 'Esperar al final de la prueba' : 'Esperar a la renovación'}: tus créditos{' '}
          {prueba ? 'de la prueba acaban' : 'se renuevan'} el <strong>{fechaCorta(saldo.periodo_fin)}</strong>.
        </li>
        <li>
          {saldo.puede_recargar
            ? 'Recargar créditos desde la web (muy pronto).'
            : 'Las recargas llegarán a partir de tu segundo mes de plan.'}
        </li>
      </ul>
      <p className="mt-1.5">
        No pierdes nada: el documento sigue cargado aquí.{' '}
        <Link href="/profile/creditos" className="font-bold underline">Ver mis créditos</Link>
      </p>
    </div>
  )
}

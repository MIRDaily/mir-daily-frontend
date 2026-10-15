'use client'

import Link from 'next/link'
import { useCreditosIA } from '@/hooks/useCreditosIA'
import { diasHasta, fechaCorta, fraccionGastada } from '@/lib/ia/creditosTexto'

// Precio de una generación junto a su botón: «Usará 14 créditos · te quedan 1.240». Se recalcula al
// cambiar las opciones (lo calcula el diálogo con precioIA y la tarifa del servidor). Si no llega,
// las alternativas (§5.3 de la especificación): nunca un «no» seco. Con los créditos apagados no
// pinta nada (el diálogo enseña el cupo de hoy, como siempre).

const INK = '#2C3E50'
const fmt = (n: number) => n.toLocaleString('es-ES')

function Icono({ nombre, color }: { nombre: string; color: string }) {
  return (
    <span aria-hidden className="inline-block shrink-0 leading-none" style={{ color }}>
      <span className="material-symbols-outlined text-[1.05rem] leading-none">{nombre}</span>
    </span>
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
      <p
        className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-white px-3 py-2 text-[0.82rem] text-[#7D8A96]"
        style={{ border: `2px solid ${llega ? INK : '#D4667A'}` }}
        aria-live="polite"
        data-precio-ia={precio}
      >
        <Icono nombre="toll" color={llega ? '#E8A598' : '#D4667A'} />
        {precio === 0 ? (
          <span className="font-extrabold text-[#2C3E50]">Gratis: no gasta créditos</span>
        ) : (
          <span className="font-extrabold text-[#2C3E50]">
            {accion} {fmt(precio)} {precio === 1 ? 'crédito' : 'créditos'}
          </span>
        )}
        <span>
          ·{' '}
          {saldo.ilimitado
            ? 'cuenta sin límite (se apunta, no se descuenta)'
            : `te ${total === 1 ? 'queda' : 'quedan'} ${fmt(total)}${prueba ? ` · prueba: ${diasHasta(saldo.periodo_fin)} días` : ''}`}
        </span>
      </p>
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

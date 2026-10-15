'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCreditosIA } from '@/hooks/useCreditosIA'
import { MonedaIA } from '@/components/ia/MonedaIA'
import { CifraIA } from '@/components/ia/PrecioIA'
import { bolsaDelMes, diasHasta, fechaCorta, type Bolsa } from '@/lib/ia/creditosTexto'
import { headerPopIn } from '@/lib/headerEntrance'

/* ════════════════════════════════════════════════════════════════════════
   Los créditos de IA en la cabecera, siempre a mano: la moneda con el saldo.
   Al gastar (o al devolverse algo) la cifra cuenta y asoma un «−6» flotando.
   Al pulsarla, el desglose: lo del mes con su barra y su renovación, las demás
   bolsas con su caducidad, las cancelaciones gratis y el enlace al historial.

   Solo con los créditos encendidos y con plan; si no, no se pinta nada (en una
   cabecera fija, un hueco que aparece y desaparece salta más que no tenerlo).
═══════════════════════════════════════════════════════════════════════════ */

const INK = '#2C3E50'
const fmt = (n: number) => n.toLocaleString('es-ES')
const NOMBRE_BOLSA: Record<Bolsa['tipo'], string> = { periodo: 'Del mes', regalo: 'Regalo del primer mes', prueba: 'Prueba', recarga: 'Recarga', ajuste: 'Regalo del equipo' }
const NOMBRE_PLAN: Record<string, string> = { prueba: 'Prueba', mensual: 'Mensual', anual: 'Anual', admin: 'Equipo' }

export default function HeaderCreditos({
  open,
  onToggle,
  onClose,
  containerRef,
}: {
  open: boolean
  onToggle: () => void
  onClose: () => void
  containerRef: RefObject<HTMLDivElement | null>
}) {
  const { activo, saldo, refrescar } = useCreditosIA()
  const reducir = useReducedMotion()
  const total = saldo?.total ?? 0
  // El «−6» que flota al cambiar el saldo (no en la primera carga).
  const [delta, setDelta] = useState<{ n: number; k: number } | null>(null)
  const previo = useRef<number | null>(null)
  useEffect(() => {
    if (!activo || !saldo || saldo.ilimitado) return
    const antes = previo.current
    previo.current = total
    if (antes === null || antes === total) return
    const id = requestAnimationFrame(() => setDelta({ n: total - antes, k: Date.now() }))
    return () => cancelAnimationFrame(id)
  }, [activo, saldo, total])
  useEffect(() => {
    if (!delta) return
    const t = setTimeout(() => setDelta(null), 1800)
    return () => clearTimeout(t)
  }, [delta])
  // Al abrir el desglose, saldo al día.
  useEffect(() => {
    if (open) void refrescar()
  }, [open, refrescar])

  if (!activo || !saldo || !saldo.plan) return null

  const mes = bolsaDelMes(saldo)
  const otras = saldo.bolsas.filter((b) => b.tipo !== 'periodo' && b.saldo > 0)
  const llenado = mes && mes.iniciales > 0 ? Math.min(1, mes.saldo / mes.iniciales) : 0
  const bajo = !saldo.ilimitado && saldo.puede_usar && mes !== null && llenado < 0.2
  const titulo = saldo.ilimitado ? 'Créditos de IA: sin límite' : `${fmt(total)} créditos de IA`

  return (
    <motion.div className="relative" ref={containerRef} {...headerPopIn(reducir, 0.03)} data-header-creditos>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={titulo}
        title={titulo}
        className={`relative flex h-10 items-center gap-1.5 rounded-full border-2 border-white pl-1.5 pr-3 text-[0.9rem] font-black text-[#2C3E50] shadow-[0_10px_22px_rgba(125,138,150,0.2),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#E2A52A]/40 active:scale-95 ${
          open ? 'bg-[#FFF6DC] ring-2 ring-[#E2A52A]/30' : 'bg-white/90 hover:-translate-y-0.5 hover:bg-[#FFFBEF] hover:ring-2 hover:ring-[#E2A52A]/25'
        }`}
      >
        <motion.span
          key={delta?.k ?? 0}
          className="inline-block"
          initial={reducir || !delta ? false : { rotate: -25, scale: 1.25 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 14 }}
        >
          <MonedaIA tam="1.55rem" cara={false} />
        </motion.span>
        <span className={`tabular-nums ${bajo ? 'text-[#B04A5E]' : ''}`}>{saldo.ilimitado ? '∞' : <CifraIA valor={total} />}</span>
        {!saldo.puede_usar && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#B04A5E]" aria-hidden />}
      </button>

      {/* Lo gastado (o devuelto), flotando sobre la píldora. */}
      <AnimatePresence>
        {delta && !reducir && (
          <motion.span
            key={delta.k}
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-full z-[60] -ml-6 mt-1 flex w-12 items-center justify-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.75rem] font-black text-white"
            style={{ background: delta.n < 0 ? '#C4655A' : '#5E8C5A', border: `2px solid ${INK}` }}
            initial={{ opacity: 0, y: -6, scale: 0.6 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 20 }}
          >
            {delta.n > 0 ? '+' : '−'}
            {fmt(Math.abs(delta.n))}
          </motion.span>
        )}
      </AnimatePresence>

      {/* En móvil, a lo ancho de la cabecera (la nav tiene backdrop-filter: el «fixed» se mide desde ella). */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-full z-50 mt-3 w-[19rem] rounded-3xl bg-white p-4 text-left max-sm:fixed max-sm:inset-x-4 max-sm:top-[4.6rem] max-sm:mt-0 max-sm:w-auto"
            style={{ border: `2px solid ${INK}`, boxShadow: `5px 5px 0 0 ${INK}`, transformOrigin: 'top right' }}
            initial={reducir ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reducir ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -4, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            role="dialog"
            aria-label="Créditos de IA"
          >
            <div className="flex items-center gap-3">
              <MonedaIA tam="2.6rem" />
              <div className="min-w-0">
                <p className="text-[0.66rem] font-black uppercase tracking-[0.16em] text-[#9A6508]">Créditos de IA</p>
                <p className="text-[1.5rem] font-black leading-tight text-[#2C3E50]">
                  {saldo.ilimitado ? 'Sin límite' : <CifraIA valor={total} />}
                </p>
                <p className="text-[0.75rem] text-[#7D8A96]">
                  Plan {NOMBRE_PLAN[saldo.plan] ?? saldo.plan}
                  {saldo.plan === 'prueba' && saldo.puede_usar ? ` · quedan ${diasHasta(saldo.periodo_fin)} días` : ''}
                  {!saldo.puede_usar ? ' · no activo' : ''}
                </p>
              </div>
            </div>

            {mes && !saldo.ilimitado && (
              <div className="mt-3">
                <div className="flex items-baseline justify-between text-[0.75rem]">
                  <span className="font-extrabold text-[#2C3E50]">
                    {fmt(mes.saldo)} de {fmt(mes.iniciales)}
                  </span>
                  <span className="text-[#7D8A96]">se renuevan el {fechaCorta(mes.caduca_at)}</span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#F1ECE8]" style={{ border: `1.5px solid ${INK}` }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: llenado < 0.2 ? '#D4667A' : 'linear-gradient(180deg, #FFE08A, #E2A52A)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(llenado * 100)}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                  />
                </div>
              </div>
            )}

            {otras.length > 0 && (
              <ul className="mt-3 space-y-1">
                {otras.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 text-[0.75rem]">
                    <span className="flex min-w-0 items-center gap-1.5 font-bold text-[#2C3E50]">
                      <MonedaIA tam="0.95rem" />
                      <span className="truncate">{NOMBRE_BOLSA[b.tipo]}</span>
                    </span>
                    <span className="shrink-0 text-[#7D8A96]">
                      <b className="text-[#2C3E50]">{fmt(b.saldo)}</b> · {b.congelada ? 'congelados' : `hasta el ${fechaCorta(b.caduca_at)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {!saldo.ilimitado && (
              <p className="mt-3 rounded-xl bg-[#FAF7F4] px-3 py-2 text-[0.72rem] text-[#7D8A96]">
                Cancelaciones gratis este mes: <b className="text-[#2C3E50]">{saldo.cancelaciones_gratis_restantes}</b> de {saldo.cancelaciones_gratis_mes}. Estudiar nunca gasta créditos.
              </p>
            )}

            <Link
              href="/profile/creditos"
              onClick={onClose}
              className="mt-3 flex items-center justify-center gap-1.5 rounded-2xl bg-[#E2A52A] px-4 py-2 text-[0.85rem] font-black text-white transition-transform hover:-translate-y-0.5"
              style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
            >
              Ver historial y precios
              <span aria-hidden className="inline-block leading-none">
                <span className="material-symbols-outlined text-[1.05rem] leading-none">arrow_forward</span>
              </span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

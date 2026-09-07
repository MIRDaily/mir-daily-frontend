'use client'

import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { Challenge } from '@/services/progressService'

const numberFormat = new Intl.NumberFormat('es-ES')

/* ════════════════════════════════════════════════════════════════════════
   Popup de desafíos de la cabecera.

   Es lo único que hace el botón del nivel: enseñar qué queda por hacer hoy y
   esta semana. El progreso completo (nivel, XP, racha, rangos) vive en el
   perfil; meterlo también aquí duplicaría la misma información en dos sitios
   y ninguno sería el bueno.

   Mismo patrón que NotificationsPopup: el que abre se encarga del clic fuera
   y del Escape, aquí solo se pinta.
═══════════════════════════════════════════════════════════════════════════ */

function Fila({ c }: { c: Challenge }) {
  const pct = Math.max(0, Math.min(100, Math.round((c.progress / Math.max(1, c.target)) * 100)))

  return (
    <li
      className={`rounded-xl border px-3 py-2.5 ${
        c.completed ? 'border-[#8BA888]/40 bg-[#8BA888]/8' : 'border-[#EAE4E2] bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1 text-[13px] font-bold leading-tight text-[#2c3e50]">
          {c.completed ? (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              <span className="material-symbols-outlined text-[16px] text-[#8BA888]">
                check_circle
              </span>
            </span>
          ) : null}
          <span className="truncate">{c.title}</span>
        </p>
        <span
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black ${
            c.completed ? 'bg-[#8BA888] text-white' : 'bg-[#F3EFED] text-[#7D8A96]'
          }`}
        >
          +{numberFormat.format(c.xpReward)}
        </span>
      </div>

      <p className="mt-0.5 truncate text-[11px] text-[#7D8A96]">{c.description}</p>

      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F3EFED]">
          <div
            className={`h-full rounded-full ${c.completed ? 'bg-[#8BA888]' : 'bg-[#d18d80]'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 text-[10px] font-bold tabular-nums text-[#7D8A96]">
          {numberFormat.format(c.progress)}/{numberFormat.format(c.target)}
        </span>
      </div>
    </li>
  )
}

export default function ChallengesPopup({
  open,
  onClose,
  daily,
  weekly,
  loading,
}: {
  open: boolean
  onClose: () => void
  daily: Challenge[]
  weekly: Challenge[]
  loading: boolean
}) {
  const reduceMotion = useReducedMotion()

  // "Día redondo" es el bono por completar los otros, no un desafío más.
  const reales = daily.filter((c) => c.metric !== 'all_daily')
  const hechos = reales.filter((c) => c.completed).length

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-label="Desafíos"
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-[#EAE4E2] bg-white shadow-[0_18px_40px_rgba(125,138,150,0.22)]"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.2, 0.9, 0.2, 1] }}
        >
          <div className="flex items-center justify-between border-b border-[#EAE4E2] px-4 py-3">
            <p className="text-sm font-black text-[#2c3e50]">Desafíos</p>
            {reales.length > 0 ? (
              <span className="text-xs font-bold text-[#7D8A96]">
                {hechos}/{reales.length} hoy
              </span>
            ) : null}
          </div>

          <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
            {loading && daily.length === 0 && weekly.length === 0 ? (
              <p className="py-4 text-center text-sm text-[#7D8A96]">Cargando…</p>
            ) : daily.length === 0 && weekly.length === 0 ? (
              <p className="py-4 text-center text-sm text-[#7D8A96]">
                Empieza a estudiar y aquí aparecerán tus desafíos.
              </p>
            ) : (
              <div className="space-y-4">
                {daily.length > 0 ? (
                  <section>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#7D8A96]/80">
                      Hoy
                    </p>
                    <ul className="space-y-2">
                      {daily.map((c) => (
                        <Fila key={c.code} c={c} />
                      ))}
                    </ul>
                  </section>
                ) : null}

                {weekly.length > 0 ? (
                  <section>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#7D8A96]/80">
                      Esta semana
                    </p>
                    <ul className="space-y-2">
                      {weekly.map((c) => (
                        <Fila key={c.code} c={c} />
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            )}
          </div>

          <div className="border-t border-[#EAE4E2] px-4 py-2.5">
            <Link
              href="/profile"
              onClick={onClose}
              className="flex items-center justify-center gap-1 text-xs font-bold text-[#7D8A96] transition-colors hover:text-[#E8A598]"
            >
              Ver tu progreso completo
              <span className="flex h-4 w-4 items-center justify-center">
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </span>
            </Link>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

'use client'

// Panel de progreso de las flashcards: qué te espera y cómo lo llevas.
//
// Los gráficos van a mano, como el resto del proyecto: son barras y una barra
// apilada, y meter una librería de charts por esto añadiría cien kilobytes y un
// segundo lenguaje visual al lado del "sticker".

import { useMemo } from 'react'
import { STATUS_TONE } from '@/components/studio/deckUi'
import { SectionLabel } from '@/components/flashcards/ui'
import type { FlashcardForecast, FlashcardStats } from '@/lib/studioFlashcards'

const MADURA_DESDE = 21

const TRAMOS = [
  { key: 'new', label: 'Nuevas', color: STATUS_TONE.new.fg },
  { key: 'learning', label: 'Aprendiendo', color: STATUS_TONE.learning.fg },
  { key: 'young', label: 'Jóvenes', color: '#7BA7C4' },
  { key: 'mature', label: 'Maduras', color: STATUS_TONE.mastered.fg },
] as const

export default function ProgressPanel({
  forecast,
  stats,
  accent,
}: {
  forecast: FlashcardForecast | null
  stats: FlashcardStats | null
  accent: string
}) {
  const maxDia = useMemo(
    () => Math.max(1, ...(forecast?.days ?? []).map((d) => d.count)),
    [forecast],
  )

  const totalTarjetas = stats
    ? TRAMOS.reduce((n, t) => n + stats.maturity[t.key], 0)
    : 0

  if (!forecast && !stats) return null

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {/* ── Previsión ─────────────────────────────────────────────────── */}
      <section className="rounded-3xl border-2 border-[#E4DCD8] bg-white px-4 py-3">
        <SectionLabel
          right={
            forecast && forecast.overdue > 0 ? (
              <span
                className="rounded-lg border px-2 py-0.5 text-[11px] font-black tabular-nums"
                style={{
                  color: STATUS_TONE.failed.fg,
                  background: STATUS_TONE.failed.bg,
                  borderColor: STATUS_TONE.failed.border,
                }}
              >
                {forecast.overdue} atrasadas
              </span>
            ) : null
          }
        >
          Próximos 30 días
        </SectionLabel>

        {forecast && forecast.days.some((d) => d.count > 0) ? (
          <>
            <div className="flex h-24 items-end gap-[2px]" role="img" aria-label="Repasos previstos por día">
              {forecast.days.map((d, i) => (
                <div
                  key={d.date}
                  className="group relative flex-1 rounded-t-[2px] transition-opacity hover:opacity-80"
                  style={{
                    height: `${Math.max(d.count > 0 ? 6 : 2, (d.count / maxDia) * 100)}%`,
                    background: d.count > 0 ? accent : '#EFEAE7',
                  }}
                  title={`${formatDia(d.date)}: ${d.count} ${d.count === 1 ? 'tarjeta' : 'tarjetas'}`}
                >
                  {i === 0 && d.count > 0 ? (
                    <span className="pointer-events-none absolute -top-5 left-0 whitespace-nowrap text-[10px] font-black text-[#2C3E50]">
                      hoy {d.count}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] font-bold uppercase tracking-wide text-[#B0B8BF]">
              <span>hoy</span>
              <span>
                {forecast.days.reduce((n, d) => n + d.count, 0)} en total
              </span>
              <span>+30 d</span>
            </div>
          </>
        ) : (
          <p className="py-6 text-center text-xs font-semibold text-[#B0B8BF]">
            Nada programado todavía. Estudia una tarjeta y aquí verás cuándo te toca repasarla.
          </p>
        )}
      </section>

      {/* ── Estado de las tarjetas ────────────────────────────────────── */}
      <section className="rounded-3xl border-2 border-[#E4DCD8] bg-white px-4 py-3">
        <SectionLabel
          right={
            stats?.retention.rate !== null && stats?.retention.rate !== undefined ? (
              <span className="text-[11px] font-black tabular-nums text-[#2C3E50]">
                {Math.round(stats.retention.rate * 100)}% de retención
              </span>
            ) : null
          }
        >
          Tus tarjetas
        </SectionLabel>

        {stats && totalTarjetas > 0 ? (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full border border-[#E4DCD8]">
              {TRAMOS.map((t) => {
                const n = stats.maturity[t.key]
                if (n === 0) return null
                return (
                  <div
                    key={t.key}
                    style={{ width: `${(n / totalTarjetas) * 100}%`, background: t.color }}
                    title={`${t.label}: ${n}`}
                  />
                )
              })}
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
              {TRAMOS.map((t) => (
                <div key={t.key} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: t.color }}
                  />
                  <span className="text-xs font-black tabular-nums text-[#2C3E50]">
                    {stats.maturity[t.key]}
                  </span>
                  <span className="truncate text-[10px] font-bold uppercase tracking-wide text-[#7D8A96]/70">
                    {t.label}
                  </span>
                </div>
              ))}
            </div>

            <p className="mt-2.5 border-t border-[#F0ECEA] pt-2 text-[11px] font-semibold leading-snug text-[#9CA3AF]">
              {stats.retention.reviews === 0 ? (
                <>
                  La retención se calcula sobre tarjetas que ya tenían fecha de repaso. Aún no has
                  repasado ninguna.
                </>
              ) : (
                <>
                  {stats.retention.passed} de {stats.retention.reviews}{' '}
                  {stats.retention.reviews === 1 ? 'repaso recordado' : 'repasos recordados'}.
                  Maduras son las que ya te aguantan {MADURA_DESDE} días o más.
                </>
              )}
            </p>
          </>
        ) : (
          <p className="py-6 text-center text-xs font-semibold text-[#B0B8BF]">
            Todavía no hay tarjetas que medir.
          </p>
        )}
      </section>
    </div>
  )
}

function formatDia(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

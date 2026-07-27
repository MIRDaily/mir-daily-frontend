'use client'

// Heatmap-calendario de simulacros: 12 meses naturales (enero-diciembre) del
// año elegido, hasta 3 años de histórico, como tarjetas SEPARADAS — cada mes
// es un mini-calendario real (semanas en filas, días en columnas
// lunes→domingo: si el día 1 cae en domingo, va en la última columna de la
// primera fila). Coloreado de rojo pastel (bajo acierto) a verde pastel
// (alto acierto).

import { useEffect, useMemo, useState } from 'react'
import { fetchSimulacroCalendar } from '@/lib/simulacro/queries'
import type { SimulacroCalendarDay } from '@/lib/simulacro/types'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const

const CELL_PX = 9
const GAP_PX = 2
const CARD_WIDTH_PX = 108 // 7 * (CELL_PX + GAP_PX) - GAP_PX
const MAX_YEARS_BACK = 2 // 3 años de histórico en total (año actual + 2 atrás)

const RED_PASTEL = { r: 0xf3, g: 0xb7, b: 0xae }
const GREEN_PASTEL = { r: 0xb9, g: 0xdc, b: 0xb4 }

function accuracyToColor(pct: number): string {
  const t = Math.max(0, Math.min(1, pct / 100))
  const r = Math.round(RED_PASTEL.r + (GREEN_PASTEL.r - RED_PASTEL.r) * t)
  const g = Math.round(RED_PASTEL.g + (GREEN_PASTEL.g - RED_PASTEL.g) * t)
  const b = Math.round(RED_PASTEL.b + (GREEN_PASTEL.b - RED_PASTEL.b) * t)
  return `rgb(${r}, ${g}, ${b})`
}

function isoDateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Semanas (filas) de un mes real: lunes en la 1ª columna, domingo en la 7ª.
// Huecos (null) antes del día 1 y después del último día para completar
// semanas de 7 — así el día 1 en domingo cae en la última columna de la
// primera fila, como un calendario de verdad.
function buildMonthWeeks(year: number, month: number): (Date | null)[][] {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leading = (new Date(year, month, 1).getDay() + 6) % 7
  const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7

  const cells: (Date | null)[] = []
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - leading + 1
    cells.push(dayNum >= 1 && dayNum <= daysInMonth ? new Date(year, month, dayNum) : null)
  }

  const weeks: (Date | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

type SimulacroCalendarHeatmapProps = {
  onOpenSession: (sessionId: string) => void
}

export default function SimulacroCalendarHeatmap({
  onOpenSession,
}: SimulacroCalendarHeatmapProps) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [days, setDays] = useState<SimulacroCalendarDay[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [picker, setPicker] = useState<SimulacroCalendarDay | null>(null)

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  useEffect(() => {
    let active = true
    const from = `${year}-01-01`
    const to = year === currentYear ? isoDateLocal(today) : `${year}-12-31`
    fetchSimulacroCalendar(from, to)
      .then((data) => {
        if (!active) return
        setDays(data)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'No se pudo cargar el calendario.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])

  const byDay = useMemo(() => {
    const map = new Map<string, SimulacroCalendarDay>()
    for (const d of days ?? []) map.set(d.day, d)
    return map
  }, [days])

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, m) => ({ month: m, weeks: buildMonthWeeks(year, m) })),
    [year],
  )

  const hasAnyData = (days ?? []).length > 0

  const handleDayClick = (entry: SimulacroCalendarDay) => {
    if (entry.session_ids.length === 1) {
      onOpenSession(entry.session_ids[0])
      return
    }
    setPicker(entry)
  }

  const changeYear = (next: number) => {
    setLoading(true)
    setYear(next)
  }

  return (
    <div className="mb-8 rounded-2xl border border-[#F0EBE8] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-[#374151]">Calendario de simulacros</h3>
          <p className="mt-1 text-xs text-[#7D8A96]">Un cuadrito por día.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={year <= currentYear - MAX_YEARS_BACK}
            onClick={() => changeYear(year - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E9E4E1] text-[#7D8A96] transition-colors hover:border-[#E8A598]/40 hover:text-[#2D3748] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Año anterior"
          >
            <span className="material-symbols-outlined text-lg">chevron_left</span>
          </button>
          <span className="w-12 text-center text-sm font-bold text-[#2c3e50]">{year}</span>
          <button
            type="button"
            disabled={year >= currentYear}
            onClick={() => changeYear(year + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E9E4E1] text-[#7D8A96] transition-colors hover:border-[#E8A598]/40 hover:text-[#2D3748] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Año siguiente"
          >
            <span className="material-symbols-outlined text-lg">chevron_right</span>
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-[#E8A598]/30 bg-[#FFF8F6] px-4 py-3 text-sm font-semibold text-[#C4655A]">
          {error}
        </p>
      ) : loading ? (
        <div className="mt-5 flex gap-2 overflow-x-hidden">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-28 shrink-0 animate-pulse rounded-lg bg-[#F2EEEB]"
              style={{ width: CARD_WIDTH_PX }}
            />
          ))}
        </div>
      ) : (
        <>
          {!hasAnyData ? (
            <p className="mt-4 text-xs text-[#7D8A96]">
              Sin simulacros guardados en {year}.
            </p>
          ) : null}

          <div className="mt-5 overflow-x-auto pb-2">
            <div className="flex gap-2">
              {months.map(({ month, weeks }) => (
              <div key={month} className="shrink-0" style={{ width: CARD_WIDTH_PX }}>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#7D8A96]/80">
                  {MONTH_NAMES[month].slice(0, 3)}
                </p>

                <div className="flex flex-col" style={{ gap: GAP_PX }}>
                  {weeks.map((week, wi) => (
                    <div key={wi} className="flex" style={{ gap: GAP_PX }}>
                      {week.map((date, di) => {
                        if (!date || date > today) {
                          return <div key={di} style={{ width: CELL_PX, height: CELL_PX }} />
                        }

                        const iso = isoDateLocal(date)
                        const entry = byDay.get(iso)
                        const tooltip = entry
                          ? `${formatDayLabel(iso)} · ${entry.total_questions} preguntas · ${entry.accuracy}% aciertos${entry.session_count > 1 ? ` (${entry.session_count} simulacros)` : ''}`
                          : formatDayLabel(iso)

                        return (
                          <div key={di} className="group/cell relative">
                            <button
                              type="button"
                              disabled={!entry}
                              onClick={() => entry && handleDayClick(entry)}
                              className={`block rounded-[3px] transition-transform ${entry ? 'hover:scale-125' : 'cursor-default'}`}
                              style={{
                                width: CELL_PX,
                                height: CELL_PX,
                                backgroundColor: entry ? accuracyToColor(entry.accuracy) : '#EDE8E5',
                              }}
                              aria-label={tooltip}
                            />
                            <span className="pointer-events-none absolute -top-2 left-1/2 z-20 w-max -translate-x-1/2 -translate-y-full rounded bg-[#374151] px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover/cell:opacity-100">
                              {tooltip}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="mt-5 flex items-center gap-2 text-[10px] font-semibold text-[#7D8A96]">
        <span>Menos aciertos</span>
        <span
          className="h-2.5 w-24 rounded-full"
          style={{ background: `linear-gradient(90deg, ${accuracyToColor(0)}, ${accuracyToColor(50)}, ${accuracyToColor(100)})` }}
        />
        <span>Más aciertos</span>
      </div>

      {picker ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D3748]/40 p-4 backdrop-blur-sm"
          onClick={() => setPicker(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[#F0EBE8] bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-1 text-sm font-bold text-[#2D3748]">
              {formatDayLabel(picker.day)}
            </p>
            <p className="mb-4 text-xs text-[#7D8A96]">
              Hiciste {picker.session_count} simulacros ese día. Elige cuál repasar:
            </p>
            <div className="flex flex-col gap-2">
              {picker.session_ids.map((id, i) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setPicker(null)
                    onOpenSession(id)
                  }}
                  className="flex items-center justify-between rounded-xl border border-[#EAE4E2] px-4 py-3 text-left text-sm font-semibold text-[#2c3e50] transition-colors hover:border-[#E8A598]/40 hover:bg-[#FAF7F4]"
                >
                  {i === 0 ? 'Simulacro más reciente' : `Simulacro anterior ${i + 1}`}
                  <span className="material-symbols-outlined text-[#7D8A96]">chevron_right</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPicker(null)}
              className="mt-4 w-full rounded-xl border border-[#7D8A96]/30 bg-white px-4 py-2.5 text-sm font-medium text-[#7D8A96] transition-colors hover:bg-[#F2EFED]"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

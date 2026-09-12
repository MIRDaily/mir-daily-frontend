'use client'

/* ════════════════════════════════════════════════════════════════════════
   Calendario de la cabecera del Studio: icono → popover, un mes real a la
   vez. No es un componente nuevo desde cero: reutiliza `fetchSimulacroCalendar`
   y el degradado rojo→verde por acierto que ya usa `SimulacroCalendarHeatmap`
   en Historial/Panel (ver `lib/simulacro/calendarView.ts`), solo que aquí se
   dibuja como cuadrícula de mes en vez de tira estilo GitHub.

   La cuenta atrás al examen vive como línea de texto al pie en vez de un
   chip aparte en la cabecera: es la misma información que se propuso como
   "chip volteable", pero sin gastar un segundo hueco permanente.
═══════════════════════════════════════════════════════════════════════════ */

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchSimulacroCalendar } from '@/lib/simulacro/queries'
import { accuracyToColor, buildMonthWeeks, isoDateLocal } from '@/lib/simulacro/calendarView'
import { NEXT_MIR_DATE } from '@/lib/examDate'
import type { SimulacroCalendarDay } from '@/lib/simulacro/types'

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const
const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

function startOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

export default function StudioCalendarButton() {
  const [open, setOpen] = useState(false)
  const today = useMemo(() => startOfDay(new Date()), [])
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [days, setDays] = useState<SimulacroCalendarDay[] | null>(null)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const monthStart = new Date(view.getFullYear(), view.getMonth(), 1)
    const monthEnd = new Date(view.getFullYear(), view.getMonth() + 1, 0)
    if (monthStart > today) {
      // Mes por completo en el futuro: no hay nada que pedir.
      setDays([])
      return
    }
    const to = monthEnd > today ? today : monthEnd
    let active = true
    setLoading(true)
    fetchSimulacroCalendar(isoDateLocal(monthStart), isoDateLocal(to))
      .then((data) => {
        if (active) setDays(data)
      })
      .catch(() => {
        if (active) setDays([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, view, today])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const byDay = useMemo(() => {
    const map = new Map<string, SimulacroCalendarDay>()
    for (const d of days ?? []) map.set(d.day, d)
    return map
  }, [days])

  const weeks = useMemo(() => buildMonthWeeks(view.getFullYear(), view.getMonth()), [view])

  const daysLeft = Math.max(0, Math.ceil((NEXT_MIR_DATE.getTime() - Date.now()) / 86_400_000))
  const examLabel = NEXT_MIR_DATE.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label="Calendario de simulacros"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex size-10 items-center justify-center rounded-full border-2 border-white bg-white/90 shadow-[0_10px_22px_rgba(125,138,150,0.2),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-150 active:translate-y-0 active:scale-95 ${
          open
            ? 'text-[#d18d80] ring-2 ring-[#E8A598]/30'
            : 'text-[#7D8A96] hover:text-[#d18d80] hover:bg-[#FAF7F4] hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(125,138,150,0.24),inset_0_1px_0_rgba(255,255,255,0.92)]'
        }`}
      >
        <span className="material-symbols-outlined text-[20px] leading-none">calendar_month</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Calendario de simulacros"
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(90vw,19rem)] overflow-hidden rounded-2xl border border-[#EAE4E2] bg-white p-4 shadow-[0_18px_40px_rgba(125,138,150,0.22)]"
        >
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[13px] font-bold capitalize text-[#2c3e50]">
              {MONTH_NAMES[view.getMonth()]} {view.getFullYear()}
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Mes anterior"
                onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
                className="flex size-6 items-center justify-center rounded-md text-[#7D8A96] hover:bg-[#FAF7F4] hover:text-[#d18d80]"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              <button
                type="button"
                aria-label="Mes siguiente"
                onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
                className="flex size-6 items-center justify-center rounded-md text-[#7D8A96] hover:bg-[#FAF7F4] hover:text-[#d18d80]"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DOW.map((d) => (
              <div key={d} className="pb-0.5 text-center text-[9.5px] font-bold text-[#b6bcc0]">
                {d}
              </div>
            ))}
            {weeks.flatMap((week, wi) =>
              week.map((date, di) => {
                if (!date) return <div key={`${wi}-${di}`} className="aspect-square" />

                const iso = isoDateLocal(date)
                const isFuture = date > today
                const isToday = date.getTime() === today.getTime()
                const entry = !isFuture ? byDay.get(iso) : undefined
                const label = entry
                  ? `${formatDayLabel(iso)} · ${entry.total_questions} preguntas · ${entry.accuracy}% aciertos`
                  : formatDayLabel(iso)

                return (
                  <div
                    key={iso}
                    title={label}
                    className={`flex aspect-square items-center justify-center rounded-md text-[10.5px] font-semibold ${
                      isToday ? 'ring-2 ring-[#2c3e50]' : ''
                    } ${isFuture ? 'text-[#c7cdd1]' : entry ? 'text-[#2c3e50]/80' : 'bg-[#EDE8E5] text-[#a39b96]'}`}
                    style={entry ? { backgroundColor: accuracyToColor(entry.accuracy) } : undefined}
                  >
                    {date.getDate()}
                  </div>
                )
              }),
            )}
          </div>

          <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold text-[#7D8A96]">
            <span>Menos aciertos</span>
            <span
              className="h-2 w-16 rounded-full"
              style={{ background: `linear-gradient(90deg, ${accuracyToColor(0)}, ${accuracyToColor(50)}, ${accuracyToColor(100)})` }}
            />
            <span>Más</span>
            {loading ? <span className="ml-auto animate-pulse text-[#c7cdd1]">cargando…</span> : null}
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-[#EAE4E2] pt-3">
            <span className="material-symbols-outlined text-[16px] text-[#d18d80]">flag</span>
            <p className="text-[11px] leading-snug text-[#7D8A96]">
              <span className="font-bold text-[#2c3e50]">{examLabel}</span> · examen MIR — {daysLeft} días
            </p>
          </div>

          <Link
            href="/studio/simulacro/historial"
            onClick={() => setOpen(false)}
            className="mt-2 flex items-center justify-center gap-1 rounded-xl py-1.5 text-xs font-bold text-[#7D8A96] transition-colors hover:text-[#E8A598]"
          >
            Ver historial completo
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </Link>
        </div>
      ) : null}
    </div>
  )
}

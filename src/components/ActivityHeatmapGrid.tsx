'use client'

import { useMemo } from 'react'
import type {
  ActivityHeatmapDay,
  ActivityHeatmapResponse,
} from '@/services/activityHeatmap'

type ActivityHeatmapGridProps = {
  data: ActivityHeatmapResponse | null
  loading: boolean
  error: string | null
  onRetry: () => void
}

const WEEK_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const
const CELL_COUNT = 30

function getLevelStyle(level: number): string {
  if (level === 2) return 'bg-[#8BA888]'
  if (level === 1) return 'bg-[#E8A598]'
  return 'bg-[#EDE8E5]'
}

function getActivityLabel(level: number): string {
  if (level === 2) return 'Daily completado'
  if (level === 1) return 'Login'
  return 'Sin actividad'
}

function formatDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeZone: 'Europe/Madrid',
  }).format(parsed)
}

export default function ActivityHeatmapGrid({
  data,
  loading,
  error,
  onRetry,
}: ActivityHeatmapGridProps) {
  const cells = useMemo(() => {
    const days = data?.days ?? []
    return Array.from({ length: CELL_COUNT }, (_, index) => days[index] ?? null)
  }, [data?.days])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[#F0EBE8] p-6 shadow-sm animate-pulse">
        <div className="h-4 w-40 rounded bg-[#EDE8E5]" />
        <div className="mt-2 h-3 w-56 rounded bg-[#F2EEEB]" />
        <div className="mt-4 grid grid-cols-7 gap-2">
          {Array.from({ length: CELL_COUNT }).map((_, index) => (
            <div
              key={`activity-heatmap-skeleton-${index}`}
              className="h-8 rounded-md bg-[#EFEAE7]"
            />
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`activity-heatmap-skeleton-stat-${index}`}
              className="h-12 rounded-lg bg-[#F2EEEB]"
            />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[#FFF8F6] rounded-2xl border border-[#E8A598]/30 p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#C4655A]">
          No se pudo cargar tu actividad.
        </p>
        <p className="mt-1 text-xs text-[#7D8A96]">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center rounded-lg bg-[#E8A598] px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="group/card relative bg-white rounded-2xl border border-[#F0EBE8] p-6 shadow-sm">
      <h3 className="text-lg font-bold text-[#374151]">Actividad reciente</h3>
      <p className="mt-1 text-xs text-[#7D8A96]">
        Del {formatDate(data.range.from)} al {formatDate(data.range.to)}
      </p>

      <div className="mt-4 grid grid-cols-7 gap-2">
        {WEEK_LABELS.map((label) => (
          <span
            key={`activity-heatmap-label-${label}`}
            className="text-center text-[10px] font-bold uppercase tracking-widest text-[#7D8A96]"
          >
            {label}
          </span>
        ))}

        {cells.map((day, index) => {
          const currentDay: ActivityHeatmapDay | null = day
          const level = currentDay?.level ?? 0
          const tooltip = `${currentDay ? formatDate(currentDay.date) : 'Sin fecha'} • ${getActivityLabel(level)}`

          return (
            <div key={`activity-heatmap-cell-${index}`} className="group/cell relative">
              <div
                className={`h-8 rounded-md ${getLevelStyle(level)} transition-transform duration-150 group-hover/cell:scale-[1.03]`}
                aria-label={tooltip}
              />
              <span className="pointer-events-none absolute left-1/2 top-[-8px] z-20 w-max -translate-x-1/2 -translate-y-full rounded bg-[#374151] px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover/cell:opacity-100">
                {tooltip}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="group/badge relative flex h-12 items-center justify-center gap-1 rounded-lg border border-[#E8A598]/45 bg-[#FAF7F4]">
          <span className="material-symbols-outlined text-[18px] text-[#C4655A]" aria-hidden>
            local_fire_department
          </span>
          <span className="text-sm font-bold text-[#374151]">
            {data.stats.currentStreak}
          </span>
          <span className="pointer-events-none absolute -top-2 left-1/2 z-20 w-max -translate-x-1/2 -translate-y-full rounded bg-[#374151] px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover/badge:opacity-100">
            Racha actual: {data.stats.currentStreak}
          </span>
        </div>
        <div className="group/badge relative flex h-12 items-center justify-center gap-1 rounded-lg border border-[#E8A598]/45 bg-[#FAF7F4]">
          <span className="material-symbols-outlined text-[18px] text-[#E8A598]" aria-hidden>
            military_tech
          </span>
          <span className="text-sm font-bold text-[#374151]">
            {data.stats.longestStreak}
          </span>
          <span className="pointer-events-none absolute -top-2 left-1/2 z-20 w-max -translate-x-1/2 -translate-y-full rounded bg-[#374151] px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover/badge:opacity-100">
            Mejor racha: {data.stats.longestStreak}
          </span>
        </div>
        <div className="group/badge relative flex h-12 items-center justify-center gap-1 rounded-lg border border-[#E8A598]/45 bg-[#FAF7F4]">
          <span className="material-symbols-outlined text-[18px] text-[#7D8A96]" aria-hidden>
            calendar_month
          </span>
          <span className="text-sm font-bold text-[#374151]">
            {data.stats.totalActiveDays}
          </span>
          <span className="pointer-events-none absolute -top-2 left-1/2 z-20 w-max -translate-x-1/2 -translate-y-full rounded bg-[#374151] px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover/badge:opacity-100">
            Días activos: {data.stats.totalActiveDays}
          </span>
        </div>
        <div className="group/badge relative flex h-12 items-center justify-center gap-1 rounded-lg border border-[#E8A598]/45 bg-[#FAF7F4]">
          <span className="material-symbols-outlined text-[18px] text-[#8BA888]" aria-hidden>
            check_circle
          </span>
          <span className="text-sm font-bold text-[#374151]">
            {data.stats.totalDailyDays}
          </span>
          <span className="pointer-events-none absolute -top-2 left-1/2 z-20 w-max -translate-x-1/2 -translate-y-full rounded bg-[#374151] px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover/badge:opacity-100">
            Días con daily: {data.stats.totalDailyDays}
          </span>
        </div>
      </div>
    </div>
  )
}

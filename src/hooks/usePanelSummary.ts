'use client'

import { useCallback, useEffect, useState } from 'react'
import { getUserSummary } from '@/services/resultsService'

type UsePanelSummaryOptions = {
  enabled?: boolean
}

type PanelSummary = {
  avgPercentage: number | null
  totalQuestions: number | null
  trend: number | null
  avgTimeSeconds: number | null
  state: string | null
  trendType: string | null
}

type UsePanelSummaryResult = {
  data: PanelSummary | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function normalizeSummary(payload: unknown): PanelSummary {
  const source = payload as Record<string, unknown> | null
  const avgPercentage = toNumber(source?.avgPercentage)
  const totalQuestions = toNumber(source?.totalQuestions)
  const trend = toNumber(source?.trend)
  const avgTimeSeconds =
    toNumber(source?.avgTimeSeconds) ??
    toNumber(source?.avgTime) ??
    toNumber(source?.averageTimeSeconds) ??
    toNumber(source?.averageTime) ??
    toNumber(source?.meanTimeSeconds) ??
    toNumber(source?.meanTime)

  return {
    avgPercentage,
    totalQuestions,
    trend,
    avgTimeSeconds,
    state: typeof source?.state === 'string' ? source.state : null,
    trendType: typeof source?.trendType === 'string' ? source.trendType : null,
  }
}

export function usePanelSummary(
  options: UsePanelSummaryOptions = {},
): UsePanelSummaryResult {
  const { enabled = true } = options
  const [data, setData] = useState<PanelSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)

    try {
      const payload = await getUserSummary(signal)
      setData(normalizeSummary(payload))
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(
        err instanceof Error ? err.message : 'No se pudo cargar el resumen.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [enabled, load])

  const refetch = useCallback(async () => {
    await load()
  }, [load])

  return { data, loading, error, refetch }
}

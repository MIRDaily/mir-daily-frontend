'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  fetchTimeSeries,
  type TimeSeriesResponse,
} from '@/services/resultsService'

type UseTimeSeriesOptions = {
  enabled?: boolean
}

type UseTimeSeriesResult = {
  data: TimeSeriesResponse | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useTimeSeries(
  options: UseTimeSeriesOptions = {},
): UseTimeSeriesResult {
  const { enabled = true } = options
  const [data, setData] = useState<TimeSeriesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)

    try {
      const payload = await fetchTimeSeries(signal)
      setData(payload)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar la serie temporal.',
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

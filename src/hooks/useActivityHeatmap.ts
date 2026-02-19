'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  fetchActivityHeatmap,
  type ActivityHeatmapResponse,
} from '@/services/activityHeatmap'

type UseActivityHeatmapOptions = {
  enabled?: boolean
}

type UseActivityHeatmapResult = {
  data: ActivityHeatmapResponse | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useActivityHeatmap(
  options: UseActivityHeatmapOptions = {},
): UseActivityHeatmapResult {
  const { enabled = true } = options
  const [data, setData] = useState<ActivityHeatmapResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)

    try {
      const result = await fetchActivityHeatmap(signal)
      setData(result)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el mapa de actividad.',
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

'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  fetchEffort,
  fetchSubjectHeatmap,
  fetchSubjectTrend,
  fetchTopicHeatmap,
  fetchWeakPoints,
  type AnalyticsMode,
  type AnalyticsWindow,
  type EffortResponse,
  type SubjectHeatmapResponse,
  type SubjectTrendResponse,
  type TopicHeatmapResponse,
  type WeakPointsResponse,
} from '@/services/analyticsService'

type AsyncState<T> = {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

// Mapa de calor por asignatura para una ventana y modo dados.
export function useSubjectHeatmap(
  window: AnalyticsWindow,
  mode: AnalyticsMode = 'all',
): AsyncState<SubjectHeatmapResponse> {
  const [data, setData] = useState<SubjectHeatmapResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setError(null)
      try {
        setData(await fetchSubjectHeatmap(window, mode, signal))
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'No se pudo cargar el mapa.')
      } finally {
        setLoading(false)
      }
    },
    [window, mode],
  )

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  return { data, loading, error, refetch: () => load() }
}

// Mapa de calor por tema de una asignatura (drill-down). subjectId null = inactivo.
export function useTopicHeatmap(
  subjectId: number | null,
  window: AnalyticsWindow,
  mode: AnalyticsMode = 'all',
): AsyncState<TopicHeatmapResponse> {
  const [data, setData] = useState<TopicHeatmapResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (subjectId == null) {
        setData(null)
        return
      }
      setLoading(true)
      setError(null)
      try {
        setData(await fetchTopicHeatmap(subjectId, window, mode, signal))
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los temas.')
      } finally {
        setLoading(false)
      }
    },
    [subjectId, window, mode],
  )

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  return { data, loading, error, refetch: () => load() }
}

// Puntos débiles (las tres ventanas semana/mes/global en una respuesta).
export function useWeakPoints(): AsyncState<WeakPointsResponse> {
  const [data, setData] = useState<WeakPointsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchWeakPoints(signal))
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los puntos débiles.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  return { data, loading, error, refetch: () => load() }
}

// Evolución diaria de una asignatura (línea de precisión). subjectId null = inactivo.
export function useSubjectTrend(
  subjectId: number | null,
  window: AnalyticsWindow,
): AsyncState<SubjectTrendResponse> {
  const [data, setData] = useState<SubjectTrendResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (subjectId == null) {
        setData(null)
        return
      }
      setLoading(true)
      setError(null)
      try {
        setData(await fetchSubjectTrend(subjectId, window, signal))
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'No se pudo cargar la evolución.')
      } finally {
        setLoading(false)
      }
    },
    [subjectId, window],
  )

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  return { data, loading, error, refetch: () => load() }
}

// Esfuerzo (volumen y distribución) para una ventana.
export function useEffort(window: AnalyticsWindow): AsyncState<EffortResponse> {
  const [data, setData] = useState<EffortResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setError(null)
      try {
        setData(await fetchEffort(window, signal))
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'No se pudo cargar el esfuerzo.')
      } finally {
        setLoading(false)
      }
    },
    [window],
  )

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  return { data, loading, error, refetch: () => load() }
}

'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuthContext } from '@/providers/AuthProvider'
import { fetchProgress, type ProgressResponse } from '@/services/progressService'

type ProgressContextValue = {
  data: ProgressResponse | null
  loading: boolean
  error: string | null
  /** Recargar después de terminar una sesión de estudio. */
  refresh: () => void
}

const ProgressContext = createContext<ProgressContextValue | null>(null)

/**
 * Nivel, XP, racha y desafíos, compartidos por toda la app.
 *
 * Vive en un provider y no en un hook suelto porque hay al menos dos
 * consumidores simultáneos (la insignia de la cabecera, que sale en cada
 * página, y el bloque del Studio). Con un hook por consumidor serían dos
 * peticiones idénticas en cada navegación, y cada una arrastra una
 * sincronización de desafíos en el servidor.
 */
export function ProgressProvider({ children }: { children: React.ReactNode }) {
  // El provider envuelve la app entera, landings incluidas. Sin esto pedía el
  // progreso también a quien no ha entrado, y se llevaba un 401 en cada visita
  // a la portada.
  const { user } = useAuthContext()
  const userId = user?.id ?? null

  const [data, setData] = useState<ProgressResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    if (!userId) {
      setData(null)
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    try {
      setData(await fetchProgress(controller.signal))
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'No se pudo cargar tu progreso.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
    return () => abortRef.current?.abort()
  }, [load])

  const value = useMemo<ProgressContextValue>(
    () => ({ data, loading, error, refresh: () => void load() }),
    [data, loading, error, load],
  )

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}

/** Devuelve null fuera del provider, para que un componente suelto no reviente. */
export function useProgressContext(): ProgressContextValue {
  return (
    useContext(ProgressContext) ?? {
      data: null,
      loading: false,
      error: null,
      refresh: () => {},
    }
  )
}

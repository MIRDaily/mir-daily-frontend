import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabaseBrowser'
import { consultarEstadoIA, suscribirEstadosIA, valorEstadoIA, type FamiliaIA } from '@/lib/ia/estadoIACache'

// El `/estado` de cada familia de IA, compartido y recordado (la lógica, en estadoIACache.ts): lo último
// que se supo se pinta al instante, se vuelve a preguntar por detrás y un fallo de red no esconde la IA.

export { caducarEstadosIA, type FamiliaIA } from '@/lib/ia/estadoIACache'

/** El estado de una familia para el usuario de la sesión (ver consultarEstadoIA). */
export async function estadoIA<T>(familia: FamiliaIA, pedir: () => Promise<T | null>, o?: { fresco?: boolean }): Promise<T | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const uid = session?.user.id
  if (!uid) return null
  return consultarEstadoIA(familia, uid, pedir, o)
}

const sinValor = () => null

/**
 * El estado para pintar: lo guardado al instante y lo del servidor en cuanto llega. Arranca el pedido
 * al montarse, sin esperar a los datos de la página. `refrescar` pregunta sin mirar la memoria.
 */
export function useEstadoIA<T>(
  familia: FamiliaIA,
  consultar: (o?: { fresco?: boolean }) => Promise<T | null>,
  activo = true,
): { estado: T | null; refrescar: () => Promise<void> } {
  const estado = useSyncExternalStore(
    suscribirEstadosIA,
    () => (activo ? (valorEstadoIA(familia) as T | null) : null),
    sinValor,
  )
  useEffect(() => {
    if (activo) void consultar()
  }, [activo, consultar])
  const refrescar = useCallback(async () => {
    await consultar({ fresco: true })
  }, [consultar])
  return { estado, refrescar }
}

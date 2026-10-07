import { supabase } from '@/lib/supabaseBrowser'
import { IAError, type EstadoIA, type ModoIA, type Seccion } from './types'
import { cuerpoOError, leerRespuesta, type EventoIA } from '@/lib/mapas/ia/stream'
import type { StoredDoc } from '@/lib/mapas/graph'

// Llamadas a /api/admin/mapas-ia. El permiso (rol admin, interruptor y cupos)
// lo valida SIEMPRE el backend; aquí solo se pinta lo que devuelva.

async function abrir(path: string, init: RequestInit = {}, accept = 'application/json'): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new IAError('Inicia sesión para usar la IA', 401)

  try {
    return await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/mapas-ia${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Accept: accept, Authorization: `Bearer ${token}` },
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new IAError('No se pudo conectar con el servidor')
  }
}

async function llamar(path: string, init: RequestInit = {}) {
  return cuerpoOError(await abrir(path, init))
}

/** null si la función no está disponible para este usuario (no admin, apagada…). */
export async function iaEstado(): Promise<EstadoIA | null> {
  try {
    const e = (await llamar('/estado')) as EstadoIA
    return e?.disponible ? e : null
  } catch {
    return null
  }
}

export type MapaGenerado = {
  titulo: string
  doc: StoredDoc
  generadoPorIA: true
  stats: { modo: ModoIA; caracteres: number; nodos: number; tablas?: number; dudosos?: number }
}

/**
 * Genera el mapa. Con `onEvento`, en streaming: el diálogo enseña las fases y las ramas según
 * llegan; el resultado es el mismo mapa validado de siempre.
 */
export async function iaGenerar(
  input: { titulo: string; modo: ModoIA; secciones: Seccion[]; paginas: number; tablas?: true; unidad?: 'diapositiva' },
  signal?: AbortSignal,
  onEvento?: (e: EventoIA) => void,
): Promise<MapaGenerado> {
  const init: RequestInit = { method: 'POST', body: JSON.stringify(input), signal }
  if (!onEvento) return (await llamar('', init)) as MapaGenerado
  const res = await abrir('', init, 'application/x-ndjson')
  return (await leerRespuesta(res, onEvento)) as unknown as MapaGenerado
}

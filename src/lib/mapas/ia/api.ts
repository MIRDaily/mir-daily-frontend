import { supabase } from '@/lib/supabaseBrowser'
import { IAError, type EstadoIA, type ModoIA, type Seccion } from './types'
import type { StoredDoc } from '@/lib/mapas/graph'

// Llamadas a /api/admin/mapas-ia. El permiso (rol admin, interruptor y cupos)
// lo valida SIEMPRE el backend; aquí solo se pinta lo que devuelva.

async function llamar(path: string, init: RequestInit = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new IAError('Inicia sesión para usar la IA', 401)

  let res: Response
  try {
    res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/mapas-ia${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new IAError('No se pudo conectar con el servidor')
  }
  const cuerpo = await res.json().catch(() => null)
  if (!res.ok) {
    throw new IAError(
      typeof cuerpo?.error === 'string' ? cuerpo.error : 'No se pudo completar la operación',
      res.status,
      typeof cuerpo?.codigo === 'string' ? cuerpo.codigo : typeof cuerpo?.motivo === 'string' ? cuerpo.motivo : '',
    )
  }
  return cuerpo
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

export async function iaGenerar(
  input: { titulo: string; modo: ModoIA; secciones: Seccion[]; paginas: number; tablas?: true; unidad?: 'diapositiva' },
  signal?: AbortSignal,
): Promise<MapaGenerado> {
  return (await llamar('', { method: 'POST', body: JSON.stringify(input), signal })) as MapaGenerado
}

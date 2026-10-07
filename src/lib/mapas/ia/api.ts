import { supabase } from '@/lib/supabaseBrowser'
import { IAError, type EstadoIA, type ModoIA, type Seccion } from './types'
import { cuerpoOError, leerRespuesta, type EventoIA } from '@/lib/mapas/ia/stream'
import type { StoredDoc } from '@/lib/mapas/graph'
import { resumenParaIndice, sanitizeTemas, type TemaIndice } from '@/lib/mapas/ia/libro'

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

/** Documento largo tema a tema: un mapa por tema y los temas que no salieron. */
export type LibroGenerado = {
  titulo: string
  temas: { i: number; titulo: string; doc: StoredDoc; stats: { nodos: number; tablas?: number; dudosos?: number } }[]
  fallidos: { i: number; titulo: string; motivo: string }[]
  generadoPorIA: true
  stats: { modo: ModoIA; caracteres: number; nodos: number; tablas?: number; dudosos?: number }
}

/**
 * Índice de un documento largo (una llamada barata en el servidor). Solo viaja el principio de
 * cada sección y su tamaño, no el documento entero.
 */
export async function iaIndice(input: { titulo: string; secciones: Seccion[] }, signal?: AbortSignal): Promise<TemaIndice[]> {
  const r = (await llamar('/indice', {
    method: 'POST',
    body: JSON.stringify({ titulo: input.titulo, secciones: resumenParaIndice(input.secciones) }),
    signal,
  })) as { temas?: unknown }
  return sanitizeTemas(r?.temas, input.secciones.length)
}

/**
 * Genera el mapa. Con `onEvento`, en streaming: el diálogo enseña las fases y las ramas según
 * llegan; el resultado es el mismo mapa validado de siempre.
 */
export type PeticionGenerar = {
  titulo: string
  modo: ModoIA
  secciones: Seccion[]
  paginas: number
  tablas?: true
  unidad?: 'diapositiva'
  /** Documento largo: cada tema como rango [desde, hasta] de `secciones`. */
  temas?: { titulo: string; desde: number; hasta: number }[]
}

export async function iaGenerar(input: PeticionGenerar & { temas?: undefined }, signal?: AbortSignal, onEvento?: (e: EventoIA) => void): Promise<MapaGenerado>
export async function iaGenerar(input: PeticionGenerar & { temas: NonNullable<PeticionGenerar['temas']> }, signal?: AbortSignal, onEvento?: (e: EventoIA) => void): Promise<LibroGenerado>
export async function iaGenerar(
  input: PeticionGenerar,
  signal?: AbortSignal,
  onEvento?: (e: EventoIA) => void,
): Promise<MapaGenerado | LibroGenerado> {
  const init: RequestInit = { method: 'POST', body: JSON.stringify(input), signal }
  if (!onEvento) return (await llamar('', init)) as MapaGenerado
  const res = await abrir('', init, 'application/x-ndjson')
  return (await leerRespuesta(res, onEvento)) as unknown as MapaGenerado | LibroGenerado
}

export type RamaGenerada = {
  doc: StoredDoc
  generadoPorIA: true
  stats: { accion: string; antes: number; nodos: number; dudosos?: number }
}

/**
 * Rehace, amplía o resume una rama. Viajan la rama (texto plano), el camino, las ramas vecinas y
 * solo el FRAGMENTO del documento de donde sale. En streaming, como el mapa entero.
 */
export async function iaRama(
  input: {
    accion: 'detalle' | 'resumir' | 'rehacer'
    modo: ModoIA
    titulo: string
    ruta: string[]
    rama: { d: number; t: string }[]
    vecinos: string[]
    secciones: Seccion[]
    unidad?: 'diapositiva'
  },
  signal?: AbortSignal,
  onEvento?: (e: EventoIA) => void,
): Promise<RamaGenerada> {
  const init: RequestInit = { method: 'POST', body: JSON.stringify(input), signal }
  if (!onEvento) return (await llamar('/rama', init)) as RamaGenerada
  const res = await abrir('/rama', init, 'application/x-ndjson')
  return (await leerRespuesta(res, onEvento)) as unknown as RamaGenerada
}

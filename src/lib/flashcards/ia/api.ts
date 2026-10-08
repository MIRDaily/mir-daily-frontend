import { supabase } from '@/lib/supabaseBrowser'
import { IAError, type Seccion } from '@/lib/mapas/ia/types'
import { cuerpoOError, leerRespuesta, type EventoIA } from '@/lib/mapas/ia/stream'
import { resumenParaIndice, sanitizeTemas, type TemaIndice } from '@/lib/mapas/ia/libro'
import type { FlashcardLevel } from '@/lib/studioFlashcards'
import { sanitizeTarjetas, type Densidad, type EstadoFlashcardsIA, type TarjetaIA } from './tarjetas'

// Llamadas a /api/admin/flashcards-ia. El permiso (rol admin, interruptor y cupos) lo valida
// SIEMPRE el backend; aquí solo se pinta lo que devuelva. Las tarjetas NO se guardan aquí: se
// guardan después, con la vista previa aprobada (createFlashcardsBulk).

async function abrir(path: string, init: RequestInit = {}, accept = 'application/json'): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new IAError('Inicia sesión para usar la IA', 401)
  try {
    return await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/flashcards-ia${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Accept: accept, Authorization: `Bearer ${token}` },
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new IAError('No se pudo conectar con el servidor')
  }
}

/** null si la función no está disponible para este usuario (no admin, apagada…). */
export async function flashcardsIAEstado(): Promise<EstadoFlashcardsIA | null> {
  try {
    const e = (await cuerpoOError(await abrir('/estado'))) as EstadoFlashcardsIA
    return e?.disponible ? e : null
  } catch {
    return null
  }
}

/** Índice de un documento largo (el mismo de los mapas; solo viaja el principio de cada sección). */
export async function flashcardsIAIndice(input: { titulo: string; secciones: Seccion[] }, signal?: AbortSignal): Promise<TemaIndice[]> {
  const r = (await cuerpoOError(
    await abrir('/indice', { method: 'POST', body: JSON.stringify({ titulo: input.titulo, secciones: resumenParaIndice(input.secciones) }), signal }),
  )) as { temas?: unknown }
  return sanitizeTemas(r?.temas, input.secciones.length)
}

type Comun = { titulo: string; niveles: FlashcardLevel[]; densidad: Densidad; unidad?: 'diapositiva' }

export type PeticionDocumento = Comun & {
  secciones: Seccion[]
  paginas: number
  /** Documento largo: cada tema como rango [desde, hasta] de `secciones`. */
  temas?: { titulo: string; desde: number; hasta: number }[]
}

export type PeticionMapa = Comun & {
  /** La rama: líneas { d, t } (d = 0 su raíz). */
  mapa: { d: number; t: string }[]
  /** Fragmento del documento de donde sale (si el navegador lo tiene). */
  secciones?: Seccion[]
}

export type StatsIA = { tarjetas: number; porNivel?: Record<string, number>; temas?: number; dudosas?: number }

export type FlashcardsGeneradas = { titulo: string; tarjetas: TarjetaIA[]; stats: StatsIA }

export type LibroFlashcards = {
  titulo: string
  temas: { i: number; titulo: string; tarjetas: TarjetaIA[]; stats: StatsIA }[]
  fallidos: { i: number; titulo: string; motivo: string }[]
  stats: StatsIA
}

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const statsDe = (raw: unknown): StatsIA => {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    tarjetas: typeof r.tarjetas === 'number' ? r.tarjetas : 0,
    ...(typeof r.dudosas === 'number' ? { dudosas: r.dudosas } : {}),
    ...(typeof r.temas === 'number' ? { temas: r.temas } : {}),
  }
}

/**
 * Genera las tarjetas (en streaming si hay `onEvento`: fases y preguntas provisionales). Devuelve
 * las tarjetas VALIDADAS del final (o, tema a tema, las de cada tema), ya saneadas.
 */
export async function flashcardsIAGenerar(
  input: PeticionDocumento | PeticionMapa,
  signal?: AbortSignal,
  onEvento?: (e: EventoIA) => void,
): Promise<FlashcardsGeneradas | LibroFlashcards> {
  const init: RequestInit = { method: 'POST', body: JSON.stringify(input), signal }
  const datos = onEvento
    ? await leerRespuesta(await abrir('', init, 'application/x-ndjson'), onEvento)
    : ((await cuerpoOError(await abrir('', init))) as Record<string, unknown>)
  const titulo = texto(datos.titulo, 200) || input.titulo
  if (Array.isArray(datos.temas)) {
    return {
      titulo,
      temas: datos.temas.flatMap((t) => {
        const x = t && typeof t === 'object' ? (t as Record<string, unknown>) : null
        if (!x || typeof x.i !== 'number') return []
        return [{ i: x.i, titulo: texto(x.titulo, 200) || `Tema ${x.i + 1}`, tarjetas: sanitizeTarjetas(x.tarjetas), stats: statsDe(x.stats) }]
      }),
      fallidos: (Array.isArray(datos.fallidos) ? datos.fallidos : []).flatMap((f) => {
        const x = f && typeof f === 'object' ? (f as Record<string, unknown>) : null
        return x && typeof x.i === 'number' ? [{ i: x.i, titulo: texto(x.titulo, 200), motivo: texto(x.motivo, 300) }] : []
      }),
      stats: statsDe(datos.stats),
    }
  }
  return { titulo, tarjetas: sanitizeTarjetas(datos.tarjetas), stats: statsDe(datos.stats) }
}

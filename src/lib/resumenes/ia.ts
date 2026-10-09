import { supabase } from '@/lib/supabaseBrowser'
import { IAError, type Seccion } from '@/lib/mapas/ia/types'
import { cuerpoOError, leerRespuesta, type EventoIA } from '@/lib/mapas/ia/stream'
import { resumenParaIndice, sanitizeTemas, type TemaIndice } from '@/lib/mapas/ia/libro'
import { sanearFuente, sanearParrafo, type FuenteFirmada, type ModoResumen, type ParrafoBorrador } from '@/lib/resumenes/borrador'
import type { Nivel } from '@/lib/resumenes/huecos'

// Llamadas a /api/admin/resumenes-ia. El permiso (rol admin, interruptor y cupos) lo valida SIEMPRE el
// backend; aquí solo se pinta lo que devuelva. Los párrafos NO se guardan aquí: se guardan después, con
// la vista previa aprobada (api.ts → anadirParrafos).

export type Densidad = 'pocas' | 'normal' | 'muchas'

export const DENSIDADES: { id: Densidad; titulo: string; descripcion: string }[] = [
  { id: 'pocas', titulo: 'Pocos', descripcion: 'Lo esencial de cada enfermedad.' },
  { id: 'normal', titulo: 'Normal', descripcion: 'Un repaso completo.' },
  { id: 'muchas', titulo: 'Muchos', descripcion: 'Casi todo lo examinable.' },
]

export const MODOS: { id: ModoResumen; titulo: string; descripcion: string }[] = [
  { id: 'resumen', titulo: 'Resumen', descripcion: 'La IA condensa cada apartado en párrafos cortos, con las palabras del documento.' },
  { id: 'literal', titulo: 'Texto original', descripcion: 'La IA elige los párrafos más preguntables del documento y los deja tal cual.' },
]

/**
 * Párrafos aproximados que saldrán (para avisar antes de generar). Lo que sale DE VERDAD en el banco
 * (16 temas de reuma, normal): ~0,13 × √caracteres en «Resumen» (vasculitis 84.000 → 37; artrosis 8.000
 * → 10) y algo más en «Texto original» (párrafos más cortos).
 */
const POR_RAIZ: Record<Densidad, number> = { pocas: 0.065, normal: 0.13, muchas: 0.21 }
export function parrafosAprox(caracteres: number, densidad: Densidad, modo: ModoResumen = 'resumen'): number {
  return Math.max(4, Math.round(POR_RAIZ[densidad] * Math.sqrt(Math.max(0, caracteres)) * (modo === 'literal' ? 1.4 : 1)))
}

export type EstadoResumenesIA = {
  disponible: boolean
  niveles: Nivel[]
  densidades: Densidad[]
  modos: ModoResumen[]
  opciones?: { libro?: boolean }
  limites: { maxChars: number; maxPaginas: number; maxCharsLibro?: number; maxPaginasLibro?: number; maxTemas?: number }
  cupo: { generacionesHoy: number; maxGeneracionesDia: number; caracteresHoy: number; maxCaracteresDia: number }
}

async function abrir(path: string, init: RequestInit = {}, accept = 'application/json'): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new IAError('Inicia sesión para usar la IA', 401)
  try {
    return await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/resumenes-ia${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Accept: accept, Authorization: `Bearer ${token}` },
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new IAError('No se pudo conectar con el servidor')
  }
}

/** null si la función no está disponible para este usuario (no admin, apagada…). */
export async function resumenesIAEstado(): Promise<EstadoResumenesIA | null> {
  try {
    const e = (await cuerpoOError(await abrir('/estado'))) as EstadoResumenesIA
    return e?.disponible ? e : null
  } catch {
    return null
  }
}

/** Índice de un documento largo (el mismo de los mapas; solo viaja el principio de cada sección). */
export async function resumenesIAIndice(input: { titulo: string; secciones: Seccion[] }, signal?: AbortSignal): Promise<TemaIndice[]> {
  const r = (await cuerpoOError(
    await abrir('/indice', { method: 'POST', body: JSON.stringify({ titulo: input.titulo, secciones: resumenParaIndice(input.secciones) }), signal }),
  )) as { temas?: unknown }
  return sanitizeTemas(r?.temas, input.secciones.length)
}

export type PeticionResumen = {
  titulo: string
  modo: ModoResumen
  niveles: Nivel[]
  densidad: Densidad
  secciones: Seccion[]
  paginas: number
  unidad?: 'diapositiva'
  temas?: { titulo: string; desde: number; hasta: number }[]
}

/**
 * Lo generado. `fuentes`: de qué documento (o tema del libro) sale cada párrafo, firmado por el
 * servidor; cada párrafo lleva en `doc` el hash de la suya (lo necesita el guardado: tope de «texto
 * original» por documento).
 */
export type ResumenesGenerados =
  | { titulo: string; parrafos: ParrafoBorrador[]; fuentes: FuenteFirmada[] }
  | { titulo: string; temas: { i: number; titulo: string; parrafos: ParrafoBorrador[] }[]; fallidos: { i: number; titulo: string; motivo: string }[]; fuentes: FuenteFirmada[] }

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const parrafos = (raw: unknown, prefijo: string, fuente: FuenteFirmada | null): ParrafoBorrador[] =>
  (Array.isArray(raw) ? raw : []).flatMap((x, k) => {
    const p = sanearParrafo(x && typeof x === 'object' ? { ...(x as object), incluir: true, key: undefined, doc: undefined, incluirParecido: undefined } : x, `${prefijo}${k}`)
    return p ? [fuente ? { ...p, doc: fuente.hash } : p] : []
  })

/**
 * Genera los párrafos (en streaming si hay `onEvento`: fases y párrafos provisionales). Devuelve los
 * VALIDADOS del final (o, tema a tema, los de cada tema), ya saneados.
 */
export async function resumenesIAGenerar(input: PeticionResumen, signal?: AbortSignal, onEvento?: (e: EventoIA) => void): Promise<ResumenesGenerados> {
  const init: RequestInit = { method: 'POST', body: JSON.stringify(input), signal }
  const datos = onEvento
    ? await leerRespuesta(await abrir('', init, 'application/x-ndjson'), onEvento)
    : ((await cuerpoOError(await abrir('', init))) as Record<string, unknown>)
  const titulo = texto(datos.titulo, 200) || input.titulo
  if (Array.isArray(datos.temas)) {
    const fuentes: FuenteFirmada[] = []
    const temas = datos.temas.flatMap((t) => {
      const x = t && typeof t === 'object' ? (t as Record<string, unknown>) : null
      if (!x || typeof x.i !== 'number') return []
      const nombre = texto(x.titulo, 200) || `Tema ${x.i + 1}`
      const fuente = sanearFuente(x.fuente)
      if (fuente && !fuentes.some((f) => f.hash === fuente.hash)) fuentes.push(fuente)
      return [{ i: x.i, titulo: nombre, parrafos: parrafos(x.parrafos, `t${x.i}-`, fuente).map((p) => ({ ...p, grupo: nombre })) }]
    })
    return {
      titulo,
      temas,
      fallidos: (Array.isArray(datos.fallidos) ? datos.fallidos : []).flatMap((f) => {
        const x = f && typeof f === 'object' ? (f as Record<string, unknown>) : null
        return x && typeof x.i === 'number' ? [{ i: x.i, titulo: texto(x.titulo, 200), motivo: texto(x.motivo, 300) }] : []
      }),
      fuentes,
    }
  }
  const fuente = sanearFuente(datos.fuente)
  return { titulo, parrafos: parrafos(datos.parrafos, 'p', fuente), fuentes: fuente ? [fuente] : [] }
}

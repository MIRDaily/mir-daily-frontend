// Resúmenes activos: llamadas a /api/resumenes (grupos, párrafos y estudio). Todo lo que llega se
// sanea (los huecos, con las mismas reglas que el servidor). Como las flashcards, no cuenta para las
// estadísticas del MIR.

import { supabase } from '@/lib/supabaseBrowser'
import { sanearHuecos, type Hueco, type Nivel, type Nota } from '@/lib/resumenes/huecos'
import type { ModoResumen } from '@/lib/resumenes/borrador'

export type ResumenEstados = { new: number; failed: number; learning: number; mastered: number }

export type GrupoResumen = {
  id: string
  name: string
  description?: string | null
  color?: string | null
  icon?: string | null
  created_at?: string | null
  total: number
  pendientes: number
  resumen: ResumenEstados
}

export type OrigenGuardado = { name: string | null; page: number | null; unit: 'pagina' | 'diapositiva' | null }

export type Parrafo = {
  itemId: number
  id: string
  tema: string | null
  modo: ModoResumen
  texto: string
  huecos: Hueco[]
  aiGenerated: boolean
  origen: OrigenGuardado | null
  status?: keyof ResumenEstados
  due?: boolean
  nextDueAt?: string | null
}

export type ParrafoNuevo = {
  tema?: string | null
  modo?: ModoResumen
  texto: string
  huecos: Hueco[]
  origen?: { name?: string; page?: number; unit?: 'pagina' | 'diapositiva' }
}

export type AjustesEstudio = {
  levels?: Nivel[] | null
  topics?: string[]
  onlyStatus?: 'failed' | 'due' | 'new'
  cardLimit?: number
}

const base = () => process.env.NEXT_PUBLIC_API_URL ?? ''

async function pedir<T>(ruta: string, init: RequestInit = {}, mensaje = 'No se pudo completar la operación'): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Inicia sesión')
  let res: Response
  try {
    res = await fetch(`${base()}/api/resumenes${ruta}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor')
  }
  const cuerpo = await res.json().catch(() => null)
  if (!res.ok) {
    const e = new Error(typeof cuerpo?.error === 'string' ? cuerpo.error : mensaje) as Error & { status?: number; caben?: number }
    e.status = res.status
    if (typeof cuerpo?.caben === 'number') e.caben = cuerpo.caben
    throw e
  }
  return cuerpo as T
}

const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

function sanearGrupo(raw: unknown): GrupoResumen | null {
  if (!raw || typeof raw !== 'object') return null
  const g = raw as Record<string, unknown>
  if (typeof g.id !== 'string' || typeof g.name !== 'string') return null
  const r = (g.resumen && typeof g.resumen === 'object' ? g.resumen : {}) as Record<string, unknown>
  return {
    id: g.id,
    name: g.name.slice(0, 80),
    description: typeof g.description === 'string' ? g.description : null,
    color: typeof g.color === 'string' ? g.color : null,
    icon: typeof g.icon === 'string' ? g.icon : null,
    created_at: typeof g.created_at === 'string' ? g.created_at : null,
    total: numero(g.total),
    pendientes: numero(g.pendientes),
    resumen: { new: numero(r.new), failed: numero(r.failed), learning: numero(r.learning), mastered: numero(r.mastered) },
  }
}

/** Un párrafo del servidor → párrafo limpio (huecos saneados), o null. */
export function sanearParrafoGuardado(raw: unknown): Parrafo | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  if (typeof p.id !== 'string' || typeof p.texto !== 'string') return null
  const o = p.origen && typeof p.origen === 'object' ? (p.origen as Record<string, unknown>) : null
  const estados = ['new', 'failed', 'learning', 'mastered']
  return {
    itemId: numero(p.itemId),
    id: p.id,
    tema: typeof p.tema === 'string' && p.tema.trim() ? p.tema : null,
    modo: p.modo === 'literal' ? 'literal' : 'resumen',
    texto: p.texto,
    huecos: sanearHuecos(p.huecos, p.texto),
    aiGenerated: p.aiGenerated === true,
    origen: o
      ? {
          name: typeof o.name === 'string' ? o.name : null,
          page: typeof o.page === 'number' && Number.isInteger(o.page) ? o.page : null,
          unit: o.unit === 'diapositiva' ? 'diapositiva' : o.unit === 'pagina' ? 'pagina' : null,
        }
      : null,
    ...(typeof p.status === 'string' && estados.includes(p.status) ? { status: p.status as keyof ResumenEstados } : {}),
    ...(typeof p.due === 'boolean' ? { due: p.due } : {}),
    ...(typeof p.nextDueAt === 'string' ? { nextDueAt: p.nextDueAt } : {}),
  }
}

export async function listarGrupos(): Promise<GrupoResumen[]> {
  const r = await pedir<{ grupos?: unknown[] }>('', {}, 'No se pudieron cargar los grupos')
  return (r.grupos ?? []).flatMap((g) => {
    const x = sanearGrupo(g)
    return x ? [x] : []
  })
}

export async function crearGrupo(name: string): Promise<GrupoResumen> {
  const r = await pedir<{ grupo?: unknown }>('', { method: 'POST', body: JSON.stringify({ name }) }, 'No se pudo crear el grupo')
  const g = sanearGrupo(r.grupo)
  if (!g) throw new Error('Respuesta no válida')
  return g
}

export async function renombrarGrupo(id: string, name: string): Promise<void> {
  await pedir(`/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }, 'No se pudo renombrar el grupo')
}

export async function borrarGrupo(id: string): Promise<void> {
  await pedir(`/${id}`, { method: 'DELETE' }, 'No se pudo borrar el grupo')
}

export async function cargarGrupo(id: string): Promise<{ grupo: GrupoResumen; parrafos: Parrafo[]; max: number }> {
  const r = await pedir<{ grupo?: unknown; parrafos?: unknown[]; max?: number }>(`/${id}`, {}, 'No se pudo cargar el grupo')
  const grupo = sanearGrupo({ total: 0, pendientes: 0, ...((r.grupo as object) ?? {}) })
  if (!grupo) throw new Error('Grupo no encontrado')
  const parrafos = (r.parrafos ?? []).flatMap((p) => {
    const x = sanearParrafoGuardado(p)
    return x ? [x] : []
  })
  return { grupo: { ...grupo, total: parrafos.length }, parrafos, max: numero(r.max) || 300 }
}

/** Tandas de 40 (el JSON de la API tiene 100 kB). Devuelve cuántos se crearon y cuántos ya estaban. */
export async function anadirParrafos(
  id: string,
  lista: ParrafoNuevo[],
  aiGenerated: boolean,
  onProgreso?: (hechos: number) => void,
): Promise<{ creados: number; duplicados: number }> {
  let creados = 0
  let duplicados = 0
  for (let k = 0; k < lista.length; k += 40) {
    const r = await pedir<{ creados?: number; duplicados?: number }>(
      `/${id}/parrafos`,
      { method: 'POST', body: JSON.stringify({ parrafos: lista.slice(k, k + 40), aiGenerated }) },
      'No se pudieron guardar los párrafos',
    )
    creados += numero(r.creados)
    duplicados += numero(r.duplicados)
    onProgreso?.(Math.min(lista.length, k + 40))
  }
  return { creados, duplicados }
}

export async function editarParrafo(pid: string, cambio: { texto?: string; huecos?: Hueco[]; tema?: string | null }): Promise<Parrafo> {
  const r = await pedir<{ parrafo?: unknown }>(`/parrafos/${pid}`, { method: 'PATCH', body: JSON.stringify(cambio) }, 'No se pudo guardar el párrafo')
  const p = sanearParrafoGuardado(r.parrafo)
  if (!p) throw new Error('Respuesta no válida')
  return p
}

export async function quitarParrafo(id: string, itemId: number): Promise<void> {
  await pedir(`/${id}/parrafos/${itemId}`, { method: 'DELETE' }, 'No se pudo borrar el párrafo')
}

export async function empezarSesion(id: string, ajustes: AjustesEstudio, limit = 200): Promise<string> {
  const levels = ajustes.levels && ajustes.levels.length > 0 && ajustes.levels.length < 4 ? ajustes.levels : undefined
  const r = await pedir<{ sessionId?: string }>(
    `/${id}/sesion`,
    { method: 'POST', body: JSON.stringify({ limit, ...ajustes, levels }) },
    'No se pudo empezar la sesión',
  )
  if (!r.sessionId) throw new Error('Respuesta no válida')
  return r.sessionId
}

export type Siguiente = { tipo: 'parrafo'; parrafo: Parrafo } | { tipo: 'fin' } | { tipo: 'caducada' } | { tipo: 'limite' }

export async function siguiente(id: string, sessionId: string): Promise<Siguiente> {
  const r = await pedir<{ parrafo?: unknown; done?: boolean; expired?: boolean; limitReached?: boolean }>(
    `/${id}/siguiente?sessionId=${encodeURIComponent(sessionId)}`,
    {},
    'No se pudo cargar el siguiente párrafo',
  )
  const p = sanearParrafoGuardado(r.parrafo)
  if (p) return { tipo: 'parrafo', parrafo: p }
  if (r.expired) return { tipo: 'caducada' }
  if (r.limitReached) return { tipo: 'limite' }
  return { tipo: 'fin' }
}

export async function registrarRepaso(
  id: string,
  d: { sessionId: string; deckItemId: number; tapados: number; fallos: number; grade?: Nota; timeSpent?: number },
): Promise<{ grade: Nota; sugerida: Nota }> {
  const r = await pedir<{ grade?: number; sugerida?: number }>(`/${id}/repaso`, { method: 'POST', body: JSON.stringify(d) }, 'No se pudo registrar el repaso')
  const n = (v: unknown): Nota => (v === 1 || v === 2 || v === 3 || v === 4 ? v : 3)
  return { grade: n(r.grade ?? d.grade), sugerida: n(r.sugerida) }
}

/** Cerrar la sesión: si falla, no rompe nada (el servidor la cierra sola a los 30 min). */
export async function terminarSesion(id: string, sessionId: string): Promise<void> {
  try {
    await pedir(`/${id}/fin`, { method: 'POST', body: JSON.stringify({ sessionId }) })
  } catch {
    /* sin importancia */
  }
}

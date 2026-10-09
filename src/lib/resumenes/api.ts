// Resúmenes activos: llamadas a /api/resumenes (grupos, párrafos y estudio). Todo lo que llega se
// sanea (los huecos, con las mismas reglas que el servidor). Como las flashcards, no cuenta para las
// estadísticas del MIR.

import { supabase } from '@/lib/supabaseBrowser'
import { sanearFallados, sanearFragmento, sanearHuecos, type Hueco, type Nivel, type Nota } from '@/lib/resumenes/huecos'
import type { FuenteFirmada, ModoResumen } from '@/lib/resumenes/borrador'

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

/** De dónde sale un párrafo. `fragmento`: un trozo corto del documento alrededor (≤300; solo en «Resumen»). */
export type OrigenGuardado = { name: string | null; page: number | null; unit: 'pagina' | 'diapositiva' | null; fragmento?: string | null }

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
  /** Posiciones de los huecos cuyo último resultado fue «No lo sabía». */
  huecosFallados?: number[]
}

export type ParrafoNuevo = {
  tema?: string | null
  modo?: ModoResumen
  texto: string
  huecos: Hueco[]
  origen?: { name?: string; page?: number; unit?: 'pagina' | 'diapositiva'; fragmento?: string }
}

export type AjustesEstudio = {
  levels?: Nivel[] | null
  topics?: string[]
  onlyStatus?: 'failed' | 'due' | 'new'
  cardLimit?: number
  /** Solo los párrafos con algún hueco fallado (y al estudiar se tapan solo esos). */
  soloHuecosFallados?: boolean
  /** Solo estos párrafos (deck_items): «Repasar ahora» los fallados de una sesión. */
  itemIds?: number[]
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
          fragmento: sanearFragmento(o.fragmento),
        }
      : null,
    ...(typeof p.status === 'string' && estados.includes(p.status) ? { status: p.status as keyof ResumenEstados } : {}),
    ...(typeof p.due === 'boolean' ? { due: p.due } : {}),
    ...(typeof p.nextDueAt === 'string' ? { nextDueAt: p.nextDueAt } : {}),
    ...(Array.isArray(p.huecosFallados) ? { huecosFallados: sanearFallados(p.huecosFallados) } : {}),
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

/** Una tanda de párrafos de la IA de un mismo documento (ver guardado.ts → tandasDeGuardado). */
export type TandaIA = { fuente: FuenteFirmada | null; parrafos: ParrafoNuevo[]; incluirParecidos: number[] }

/**
 * Guarda lo de la IA con su documento de origen (POST /:id/parrafos-ia): el servidor comprueba el tope
 * de «texto original» del documento y no guarda los casi iguales a uno del grupo salvo los de
 * `incluirParecidos`. Lanza con el mensaje del servidor (p. ej. el del 30 %).
 */
export async function anadirParrafosIA(
  id: string,
  tandas: TandaIA[],
  onProgreso?: (hechos: number) => void,
): Promise<{ creados: number; duplicados: number; parecidos: number }> {
  let creados = 0
  let duplicados = 0
  let parecidos = 0
  let hechos = 0
  for (const t of tandas) {
    const r = await pedir<{ creados?: number; duplicados?: number; parecidos?: number }>(
      `/${id}/parrafos-ia`,
      {
        method: 'POST',
        body: JSON.stringify({ parrafos: t.parrafos, ...(t.fuente ? { fuente: t.fuente } : {}), ...(t.incluirParecidos.length ? { incluirParecidos: t.incluirParecidos } : {}) }),
      },
      'No se pudieron guardar los párrafos',
    )
    creados += numero(r.creados)
    duplicados += numero(r.duplicados)
    parecidos += numero(r.parecidos)
    hechos += t.parrafos.length
    onProgreso?.(hechos)
  }
  return { creados, duplicados, parecidos }
}

/** Uno del grupo que se parece a uno de la vista previa (`igual`: el mismo texto). */
export type Parecido = { igual: boolean; tema: string | null; texto: string }
/** Cuánto texto literal de un documento hay ya en el grupo, y cuánto cabe en total. */
export type UsoLiteral = { hash: string; usado: number; tope: number }

/** Antes de guardar en un grupo: qué textos se parecen a uno suyo (tandas de 60) y el literal de cada documento. */
export async function buscarParecidos(id: string, textos: string[], fuentes: FuenteFirmada[]): Promise<{ parecidos: (Parecido | null)[]; literal: UsoLiteral[] }> {
  const parecidos: (Parecido | null)[] = []
  let literal: UsoLiteral[] = []
  for (let k = 0; k === 0 || k < textos.length; k += 60) {
    const r = await pedir<{ parecidos?: unknown[]; literal?: unknown[] }>(
      `/${id}/parecidos`,
      { method: 'POST', body: JSON.stringify({ textos: textos.slice(k, k + 60), ...(k === 0 && fuentes.length ? { fuentes: fuentes.slice(0, 20) } : {}) }) },
      'No se pudo comprobar el grupo',
    )
    const lote = Array.isArray(r.parecidos) ? r.parecidos : []
    for (let j = 0; j < Math.min(60, textos.length - k); j++) {
      const x = lote[j] && typeof lote[j] === 'object' ? (lote[j] as Record<string, unknown>) : null
      parecidos.push(x && typeof x.texto === 'string' ? { igual: x.igual === true, tema: typeof x.tema === 'string' ? x.tema : null, texto: x.texto.slice(0, 220) } : null)
    }
    if (k === 0) {
      literal = (Array.isArray(r.literal) ? r.literal : []).flatMap((u) => {
        const x = u && typeof u === 'object' ? (u as Record<string, unknown>) : null
        return x && typeof x.hash === 'string' ? [{ hash: x.hash, usado: numero(x.usado), tope: numero(x.tope) }] : []
      })
    }
  }
  return { parecidos, literal }
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
  d: { sessionId: string; deckItemId: number; huecos: { i: number; f: number; sabia: boolean }[]; grade?: Nota; timeSpent?: number },
): Promise<{ grade: Nota; sugerida: Nota }> {
  const r = await pedir<{ grade?: number; sugerida?: number }>(`/${id}/repaso`, { method: 'POST', body: JSON.stringify(d) }, 'No se pudo registrar el repaso')
  const n = (v: unknown): Nota => (v === 1 || v === 2 || v === 3 || v === 4 ? v : 3)
  return { grade: n(r.grade ?? d.grade), sugerida: n(r.sugerida) }
}

/**
 * Deshace el último repaso de la sesión (el servidor restaura el progreso y reabre la sesión si estaba
 * cerrada). `parrafo`: el párrafo para enseñarlo otra vez (null si se borró después de repasarlo).
 * Lanza con el mensaje del servidor si no hay nada que deshacer (409).
 */
export async function deshacerRepaso(id: string, sessionId: string): Promise<{ deckItemId: number; parrafo: Parrafo | null }> {
  const r = await pedir<{ deckItemId?: number; parrafo?: unknown }>(
    `/${id}/deshacer`,
    { method: 'POST', body: JSON.stringify({ sessionId }) },
    'No se pudo deshacer el repaso',
  )
  return { deckItemId: numero(r.deckItemId), parrafo: sanearParrafoGuardado(r.parrafo) }
}

/** Un párrafo fallado en la sesión (pantalla de fin): los huecos que se fallaron en ella. */
export type ParrafoFallado = Parrafo & { huecosFalladosSesion: number[] }

/**
 * Cerrar la sesión y traer los párrafos con algún hueco fallado en ella (con cuáles siguen fallados
 * ahora y cuándo vuelven). Si falla, no rompe nada (el servidor la cierra sola a los 30 min): lista vacía.
 */
export async function terminarSesion(id: string, sessionId: string): Promise<{ fallados: ParrafoFallado[] }> {
  try {
    const r = await pedir<{ fallados?: unknown[] }>(`/${id}/fin`, { method: 'POST', body: JSON.stringify({ sessionId }) })
    const fallados = (Array.isArray(r.fallados) ? r.fallados : []).flatMap((x) => {
      const p = sanearParrafoGuardado(x)
      if (!p) return []
      const raw = (x as Record<string, unknown>).huecosFalladosSesion
      const enSesion = Array.isArray(raw) ? raw.filter((k): k is number => Number.isInteger(k) && (k as number) >= 0 && (k as number) < p.huecos.length) : []
      return [{ ...p, huecosFalladosSesion: [...new Set(enSesion)].sort((a, b) => a - b) }]
    })
    return { fallados }
  } catch {
    return { fallados: [] }
  }
}

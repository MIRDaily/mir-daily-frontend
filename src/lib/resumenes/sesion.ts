// Ajustes de una sesión de estudio de resúmenes activos (puro, se prueba con `npm test`): qué niveles
// se tapan, qué temas, qué párrafos (todos, pendientes, solo fallados, solo nuevos, solo los que tienen
// huecos fallados) y cuántos. Van en la sesión y los aplica la cola del servidor
// (get_next_resumen_session_item) con las MISMAS definiciones que aquí: fallado = visto y el último
// mal; pendiente = visto y fallado o vencido; nuevo = nunca repasado; con huecos fallados = algún hueco
// (de los niveles elegidos) cuyo último resultado fue «No lo sabía». Aquí solo se calcula «Vas a
// estudiar N» y se traduce a la petición.
//
// Además, dos ajustes que solo son de la pantalla (no van al servidor): escribir la respuesta y la caja
// tapada de ancho fijo.

import { NIVELES, esNivel, type Hueco, type Nivel } from '@/lib/resumenes/huecos'
import type { AjustesEstudio } from '@/lib/resumenes/api'

export type Solo = 'todos' | 'due' | 'failed' | 'new' | 'huecos'
export type Ajustes = {
  niveles: Nivel[]
  temas: string[] | null
  solo: Solo
  cuantos: number | null
  /** Escribir la respuesta de cada hueco antes de destaparlo. */
  escribir: boolean
  /** Todas las cajas tapadas del mismo ancho (que no delaten lo largo de la respuesta). */
  anchoFijo: boolean
}

/** Lo que es solo de la pantalla del estudio. */
export type Vista = { escribir: boolean; anchoFijo: boolean }

export const AJUSTES_POR_DEFECTO: Ajustes = { niveles: [...NIVELES], temas: null, solo: 'todos', cuantos: null, escribir: false, anchoFijo: false }
export const CUANTOS = [10, 20, 50] as const

type ParrafoSesion = { tema: string | null; huecos: Hueco[]; status?: string; due?: boolean; huecosFallados?: number[] }

const temaDe = (p: ParrafoSesion) => (p.tema ?? '').trim()

/** ¿Entra el párrafo con estos ajustes (sin contar el «cuántos»)? */
export function entra(p: ParrafoSesion, a: Ajustes): boolean {
  const todosLosNiveles = a.niveles.length >= NIVELES.length
  if (!todosLosNiveles && !p.huecos.some((h) => a.niveles.includes(h.n))) return false
  if (a.temas && !a.temas.includes(temaDe(p))) return false
  const visto = p.status !== undefined && p.status !== 'new'
  if (a.solo === 'new' && visto) return false
  if (a.solo === 'failed' && !(visto && p.status === 'failed')) return false
  if (a.solo === 'due' && !(visto && (p.status === 'failed' || p.due === true))) return false
  if (a.solo === 'huecos' && !(p.huecosFallados ?? []).some((k) => p.huecos[k] && (todosLosNiveles || a.niveles.includes(p.huecos[k].n)))) return false
  return true
}

/** Cuántos párrafos distintos va a servir la sesión. */
export function cuantosSeEstudian(parrafos: ParrafoSesion[], a: Ajustes): number {
  const n = parrafos.filter((p) => entra(p, a)).length
  return a.cuantos ? Math.min(n, a.cuantos) : n
}

/** Ajustes → cuerpo de POST /api/resumenes/:id/sesion (null o todo = sin ese filtro). */
export function aPeticion(a: Ajustes, todosLosTemas: string[]): AjustesEstudio {
  const temas = a.temas && a.temas.length < todosLosTemas.length ? a.temas : null
  return {
    ...(a.niveles.length && a.niveles.length < NIVELES.length ? { levels: a.niveles } : {}),
    ...(temas ? { topics: temas } : {}),
    ...(a.solo === 'huecos' ? { soloHuecosFallados: true } : a.solo !== 'todos' ? { onlyStatus: a.solo } : {}),
    ...(a.cuantos ? { cardLimit: a.cuantos } : {}),
  }
}

/** «Repasar ahora» los fallados de una sesión: los mismos niveles, solo esos párrafos y solo sus huecos fallados. */
export function repasarAhora(a: AjustesEstudio, itemIds: number[]): AjustesEstudio {
  return { ...(a.levels ? { levels: a.levels } : {}), soloHuecosFallados: true, itemIds: [...new Set(itemIds)] }
}

/** Lo guardado en el navegador (los últimos ajustes de cada grupo) no se da por bueno. */
export function sanearAjustes(raw: unknown): Ajustes {
  if (!raw || typeof raw !== 'object') return { ...AJUSTES_POR_DEFECTO }
  const r = raw as Record<string, unknown>
  const niveles = Array.isArray(r.niveles) ? [...new Set(r.niveles.filter(esNivel))].sort() : []
  const temas = Array.isArray(r.temas) ? r.temas.filter((t): t is string => typeof t === 'string').map((t) => t.slice(0, 120)).slice(0, 200) : null
  return {
    niveles: niveles.length ? niveles : [...NIVELES],
    temas: temas && temas.length ? temas : null,
    solo: r.solo === 'due' || r.solo === 'failed' || r.solo === 'new' || r.solo === 'huecos' ? r.solo : 'todos',
    cuantos: typeof r.cuantos === 'number' && Number.isInteger(r.cuantos) && r.cuantos > 0 && r.cuantos <= 500 ? r.cuantos : null,
    escribir: r.escribir === true,
    anchoFijo: r.anchoFijo === true,
  }
}

/** Cuándo vuelve un párrafo, para la pantalla de fin: «hoy», «mañana», «en 3 días», «el 12 nov.». */
export function cuandoVuelve(iso: string | null | undefined, ahora = Date.now()): string {
  if (!iso) return 'pendiente'
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return 'pendiente'
  const dia = (x: number) => {
    const d = new Date(x)
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000
  }
  const dias = dia(t) - dia(ahora)
  if (dias <= 0) return t <= ahora ? 'ya' : 'hoy'
  if (dias === 1) return 'mañana'
  if (dias < 30) return `en ${dias} días`
  return `el ${new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
}

// Ajustes de una sesión de estudio de resúmenes activos (puro, se prueba con `npm test`): qué niveles
// se tapan, qué temas, qué párrafos (todos, pendientes, solo fallados, solo nuevos) y cuántos. Van en la
// sesión y los aplica la cola del servidor (get_next_resumen_session_item) con las MISMAS definiciones
// que aquí: fallado = visto y el último mal; pendiente = visto y fallado o vencido; nuevo = nunca
// repasado. Aquí solo se calcula «Vas a estudiar N» y se traduce a la petición.

import { NIVELES, esNivel, type Hueco, type Nivel } from '@/lib/resumenes/huecos'
import type { AjustesEstudio } from '@/lib/resumenes/api'

export type Solo = 'todos' | 'due' | 'failed' | 'new'
export type Ajustes = { niveles: Nivel[]; temas: string[] | null; solo: Solo; cuantos: number | null }

export const AJUSTES_POR_DEFECTO: Ajustes = { niveles: [...NIVELES], temas: null, solo: 'todos', cuantos: null }
export const CUANTOS = [10, 20, 50] as const

type ParrafoSesion = { tema: string | null; huecos: Hueco[]; status?: string; due?: boolean }

const temaDe = (p: ParrafoSesion) => (p.tema ?? '').trim()

/** ¿Entra el párrafo con estos ajustes (sin contar el «cuántos»)? */
export function entra(p: ParrafoSesion, a: Ajustes): boolean {
  if (a.niveles.length < NIVELES.length && !p.huecos.some((h) => a.niveles.includes(h.n))) return false
  if (a.temas && !a.temas.includes(temaDe(p))) return false
  const visto = p.status !== undefined && p.status !== 'new'
  if (a.solo === 'new' && visto) return false
  if (a.solo === 'failed' && !(visto && p.status === 'failed')) return false
  if (a.solo === 'due' && !(visto && (p.status === 'failed' || p.due === true))) return false
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
    ...(a.solo !== 'todos' ? { onlyStatus: a.solo } : {}),
    ...(a.cuantos ? { cardLimit: a.cuantos } : {}),
  }
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
    solo: r.solo === 'due' || r.solo === 'failed' || r.solo === 'new' ? r.solo : 'todos',
    cuantos: typeof r.cuantos === 'number' && Number.isInteger(r.cuantos) && r.cuantos > 0 && r.cuantos <= 500 ? r.cuantos : null,
  }
}

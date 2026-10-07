import type { MapTable } from '@/lib/mapas/table'

// Revisión guiada de un mapa generado con IA (informe 75). El servidor manda en cada nodo `ia`:
// cuánto se apoya en el documento, de qué página sale y, si conviene revisarlo, por qué. El editor
// pinta en ámbar lo dudoso y lleva la cuenta de lo que queda; `revisado` lo pone el usuario.
// Es opcional: los mapas de antes (y los hechos a mano) no lo tienen y no cambian en nada.

export type MotivoDudoso = 'anclaje' | 'tratamiento' | 'celdas'

/** Celda dudosa de una tabla: fila `f` del cuerpo, columna `c`, y el texto que tenía. */
export type CeldaDudosa = { f: number; c: number; t: string }

export type NodoIA = {
  /** Fracción de sus palabras que está en el documento (0–1). */
  anclaje?: number
  /** Fracción del dato que aparece en el documento junto a su enfermedad (0–1). */
  cerca?: number
  pagina?: number
  diapositiva?: number
  /** Título de la sección de origen (Word, sin páginas). */
  seccion?: string
  dudoso?: MotivoDudoso
  celdas?: CeldaDudosa[]
  revisado?: boolean
}

const MOTIVOS: MotivoDudoso[] = ['anclaje', 'tratamiento', 'celdas']
const MAX_CELDAS = 60

const fraccion = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, Math.round(v * 100) / 100)) : undefined
const entero = (v: unknown, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : undefined

/** Entrada no fiable (BD, JSON importado, servidor) → `NodoIA`, o undefined si no queda nada. */
export function sanitizeIA(raw: unknown): NodoIA | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, unknown>
  const out: NodoIA = {}
  const anclaje = fraccion(r.anclaje)
  if (anclaje !== undefined) out.anclaje = anclaje
  const cerca = fraccion(r.cerca)
  if (cerca !== undefined) out.cerca = cerca
  const pagina = entero(r.pagina, 100000)
  if (pagina) out.pagina = pagina
  const diapositiva = entero(r.diapositiva, 100000)
  if (diapositiva) out.diapositiva = diapositiva
  // Texto plano: se pinta como texto de React, nunca como HTML.
  if (typeof r.seccion === 'string' && r.seccion.trim()) out.seccion = r.seccion.trim().slice(0, 80)
  if (MOTIVOS.includes(r.dudoso as MotivoDudoso)) out.dudoso = r.dudoso as MotivoDudoso
  if (Array.isArray(r.celdas)) {
    const celdas: CeldaDudosa[] = []
    for (const x of r.celdas.slice(0, MAX_CELDAS)) {
      if (!x || typeof x !== 'object') continue
      const c = x as Record<string, unknown>
      const f = entero(c.f, 1000)
      const col = entero(c.c, 100)
      if (f === undefined || col === undefined || typeof c.t !== 'string') continue
      celdas.push({ f, c: col, t: c.t.slice(0, 400) })
    }
    if (celdas.length) out.celdas = celdas
  }
  if (r.revisado === true) out.revisado = true
  return Object.keys(out).length ? out : undefined
}

/** ¿Queda por revisar? (dudoso y sin marcar como revisado). */
export function isPendingReview(ia: NodoIA | undefined): boolean {
  return !!ia?.dudoso && !ia.revisado
}

/** «Página 12», «Diapositiva 3» o «Sección «…»»; null si no se sabe. */
export function origenLabel(ia: NodoIA | undefined): string | null {
  if (!ia) return null
  if (ia.pagina) return `Página ${ia.pagina}`
  if (ia.diapositiva) return `Diapositiva ${ia.diapositiva}`
  if (ia.seccion) return `Sección «${ia.seccion}»`
  return null
}

/** Por qué hay que revisarlo, dicho para el usuario. */
export function motivoLabel(m: MotivoDudoso): string {
  switch (m) {
    case 'anclaje':
      return 'Parte de este dato no aparece en el documento junto a su tema'
    case 'tratamiento':
      return 'Tratamiento: comprueba que es de esta entidad y no de otra'
    case 'celdas':
      return 'Hay celdas que el documento no respalda (marcadas en ámbar)'
  }
}

/**
 * ¿Se marca en ámbar la celda (f, c) del cuerpo? Solo si la tabla sigue pendiente y la celda
 * conserva el texto que el servidor juzgó: al corregirla (o al mover filas) deja de marcarse.
 */
export function isDoubtfulCell(ia: NodoIA | undefined, table: MapTable, f: number, c: number): boolean {
  if (!isPendingReview(ia) || !ia?.celdas) return false
  const text = table.rows[f]?.[c]
  return ia.celdas.some((x) => x.f === f && x.c === c && x.t === text)
}

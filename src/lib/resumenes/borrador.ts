// Borrador de la vista previa de los resúmenes activos con IA, guardado SOLO en este navegador
// (IndexedDB, base PROPIA: no la de las flashcards). Si se cierra o se recarga la pestaña a mitad de
// revisión, lo generado (y lo ya editado) no se pierde. Uno por usuario. Caduca a los 7 días y se borra
// al guardar. Nunca va al servidor.
//
// Lo puro (clave, caducidad, saneado al leer) va arriba y se prueba con `npm test`; lo de IndexedDB,
// abajo, y nunca lanza.

import { MAX_TEMA, sanearHuecos, type Hueco } from '@/lib/resumenes/huecos'

export const DIAS_BORRADOR = 7
const DB = 'mirdaily-resumenes-ia'
const STORE = 'borradores'
const VERSION = 1
const MAX_PARRAFOS = 1500

export type ModoResumen = 'resumen' | 'literal'

/** Lo que dice la revisión de la IA de un párrafo: página de origen y si es dudoso. */
export type OrigenParrafo = { pagina?: number; diapositiva?: number; seccion?: string; dudoso?: string }

/** Un párrafo de la vista previa. `grupo`: en un documento tema a tema, el tema del libro. */
export type ParrafoBorrador = {
  key: string
  tema: string
  texto: string
  huecos: Hueco[]
  incluir: boolean
  grupo?: string
  ia?: OrigenParrafo
}

export type BorradorResumen = {
  /** `${usuario}:documento`. */
  clave: string
  usuario: string
  titulo: string
  nombreGrupo: string
  modo: ModoResumen
  fuente: { nombre?: string; unidad?: 'pagina' | 'diapositiva' }
  lista: ParrafoBorrador[]
  fallidos: string[]
  creado: number
  actualizado: number
  caduca: number
}

export const claveBorrador = (usuario: string) => `${usuario}:documento`

export function caducado(b: Pick<BorradorResumen, 'caduca'> | null | undefined, ahora = Date.now()): boolean {
  return !b || typeof b.caduca !== 'number' || b.caduca <= ahora
}

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const entero = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 100000 ? v : undefined)

/** El origen que manda la IA (o el guardado), solo con campos conocidos. */
export function sanearOrigen(raw: unknown): OrigenParrafo | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const o: OrigenParrafo = {
    ...(entero(r.pagina) ? { pagina: entero(r.pagina) } : {}),
    ...(entero(r.diapositiva) ? { diapositiva: entero(r.diapositiva) } : {}),
    ...(typeof r.seccion === 'string' && r.seccion ? { seccion: r.seccion.slice(0, 80) } : {}),
    ...(typeof r.dudoso === 'string' && r.dudoso ? { dudoso: r.dudoso.slice(0, 20) } : {}),
  }
  return Object.keys(o).length ? o : undefined
}

/** Un párrafo de fuera (servidor o IndexedDB) → párrafo limpio, o null si no vale. */
export function sanearParrafo(raw: unknown, key: string): ParrafoBorrador | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const t = texto(r.texto, 1000)
  if (t.trim().length < 2) return null
  const huecos = sanearHuecos(r.huecos, t)
  if (!huecos.length) return null
  const ia = sanearOrigen(r.ia)
  return {
    key: texto(r.key, 40) || key,
    tema: texto(r.tema, MAX_TEMA).trim() || 'General',
    texto: t,
    huecos,
    incluir: r.incluir !== false,
    ...(typeof r.grupo === 'string' && r.grupo ? { grupo: r.grupo.slice(0, 200) } : {}),
    ...(ia ? { ia } : {}),
  }
}

/** Lo leído de IndexedDB tampoco se da por bueno: se reconstruye entero. null si no vale. */
export function sanearBorrador(raw: unknown): BorradorResumen | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.clave !== 'string' || typeof r.usuario !== 'string' || !Array.isArray(r.lista)) return null
  const lista: ParrafoBorrador[] = []
  for (const x of r.lista.slice(0, MAX_PARRAFOS)) {
    const p = sanearParrafo(x, `r${lista.length}`)
    if (p) lista.push(p)
  }
  if (!lista.length) return null
  const f = (r.fuente && typeof r.fuente === 'object' ? r.fuente : {}) as Record<string, unknown>
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return {
    clave: r.clave,
    usuario: r.usuario,
    titulo: texto(r.titulo, 200) || 'Resumen activo',
    nombreGrupo: texto(r.nombreGrupo, 80) || texto(r.titulo, 80) || 'Resumen activo',
    modo: r.modo === 'literal' ? 'literal' : 'resumen',
    fuente: {
      ...(typeof f.nombre === 'string' ? { nombre: f.nombre.slice(0, 160) } : {}),
      ...(f.unidad === 'diapositiva' || f.unidad === 'pagina' ? { unidad: f.unidad } : {}),
    },
    lista,
    fallidos: (Array.isArray(r.fallidos) ? r.fallidos : []).filter((x): x is string => typeof x === 'string').slice(0, 50),
    creado: num(r.creado),
    actualizado: num(r.actualizado),
    caduca: num(r.caduca),
  }
}

// ---------------------------------------------------------------------------
// IndexedDB
// ---------------------------------------------------------------------------

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Sin IndexedDB'))
    const req = indexedDB.open(DB, VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'clave' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function conStore<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, modo).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

/** Guarda (o actualiza) el borrador. Conserva la fecha de creación. Nunca lanza. */
export async function guardarBorrador(d: Omit<BorradorResumen, 'clave' | 'creado' | 'actualizado' | 'caduca'> & { creado?: number }): Promise<void> {
  try {
    const ahora = Date.now()
    const registro: BorradorResumen = {
      ...d,
      clave: claveBorrador(d.usuario),
      creado: d.creado ?? ahora,
      actualizado: ahora,
      caduca: ahora + DIAS_BORRADOR * 86_400_000,
    }
    await conStore('readwrite', (s) => s.put(registro))
  } catch {
    /* sin IndexedDB (navegación privada…): simplemente no hay borrador */
  }
}

/** El borrador vivo del usuario, o null (el caducado se borra). */
export async function leerBorrador(usuario: string): Promise<BorradorResumen | null> {
  try {
    const b = sanearBorrador(await conStore('readonly', (s) => s.get(claveBorrador(usuario))))
    if (!b || b.usuario !== usuario) return null
    if (caducado(b)) {
      await borrarBorrador(usuario)
      return null
    }
    return b
  } catch {
    return null
  }
}

export async function borrarBorrador(usuario: string): Promise<void> {
  try {
    await conStore('readwrite', (s) => s.delete(claveBorrador(usuario)))
  } catch {
    /* nada que borrar */
  }
}

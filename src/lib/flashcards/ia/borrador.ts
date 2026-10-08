// Borrador de la vista previa de las flashcards con IA, guardado SOLO en este navegador (IndexedDB):
// si se cierra o se recarga la pestaña a mitad de revisión, lo generado (y lo ya editado) no se
// pierde. Uno por usuario y origen (un documento; o cada mapa). Caduca a los 7 días y se borra al
// guardar las tarjetas. Nunca va al servidor.
//
// Desde un documento se guarda también su TEXTO (paquete 2, «Más de este tema»: ampliar un tema
// después de recargar necesita el fragmento de ese tema). Va en otro almacén, con la misma clave, la
// misma caducidad y se borra a la vez. El borrador guarda el hash del archivo: si el texto falta (un
// borrador antiguo, o el navegador lo ha perdido), se pide el archivo y se comprueba que es el mismo.
//
// Lo puro (claves, caducidad, saneado al leer, «hace …») va arriba y se prueba con `npm test`; lo de
// IndexedDB, abajo, y nunca lanza.

import { sanitizeTarjetas, type Borrador, type FuenteGuardar } from '@/lib/flashcards/ia/tarjetas'
import type { Seccion } from '@/lib/mapas/ia/types'

export const DIAS_BORRADOR = 7
const DB = 'mirdaily-flashcards-ia'
const STORE = 'borradores'
const STORE_DOCS = 'documentos'
const VERSION = 2
const MAX_TARJETAS = 2000

export type OrigenBorrador = { tipo: 'documento' } | { tipo: 'mapa'; mapId: string; nodeId?: string }

export type BorradorGuardado = {
  /** `${usuario}:documento` o `${usuario}:mapa:${mapId}`. */
  clave: string
  usuario: string
  origen: OrigenBorrador
  titulo: string
  nombreGrupo: string
  fuente: FuenteGuardar
  lista: Borrador[]
  /** Temas del libro que no salieron (se enseñan otra vez al recuperar). */
  fallidos: string[]
  /** El archivo del que salió (documento): su SHA-256, para comprobar que es el mismo si hay que pedirlo. */
  documento?: { hash: string; nombre: string }
  creado: number
  actualizado: number
  caduca: number
}

export function claveBorrador(usuario: string, origen: OrigenBorrador): string {
  return origen.tipo === 'mapa' ? `${usuario}:mapa:${origen.mapId}` : `${usuario}:documento`
}

export function caducado(b: Pick<BorradorGuardado, 'caduca'> | null | undefined, ahora = Date.now()): boolean {
  return !b || typeof b.caduca !== 'number' || b.caduca <= ahora
}

/** «hace 5 min», «hace 2 h», «hace 3 días». */
export function haceCuanto(ms: number, ahora = Date.now()): string {
  const s = Math.max(0, Math.round((ahora - ms) / 1000))
  if (s < 60) return 'hace un momento'
  const min = Math.round(s / 60)
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`
}

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

/**
 * Lo leído de IndexedDB tampoco se da por bueno (lo puede tocar cualquier script de la página o una
 * versión vieja): se reconstruye con el mismo saneado que la respuesta del servidor. null si no vale.
 */
export function sanearBorrador(raw: unknown): BorradorGuardado | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.clave !== 'string' || typeof r.usuario !== 'string' || !Array.isArray(r.lista)) return null
  const o = r.origen as Record<string, unknown> | undefined
  const origen: OrigenBorrador | null =
    o?.tipo === 'documento'
      ? { tipo: 'documento' }
      : o?.tipo === 'mapa' && typeof o.mapId === 'string'
        ? { tipo: 'mapa', mapId: o.mapId, ...(typeof o.nodeId === 'string' ? { nodeId: o.nodeId.slice(0, 64) } : {}) }
        : null
  if (!origen) return null
  // Cada tarjeta con el saneado de la respuesta del servidor; además, su clave, si va y su grupo.
  const lista: Borrador[] = []
  for (const c of (r.lista as unknown[]).slice(0, MAX_TARJETAS)) {
    const t = sanitizeTarjetas([c])[0]
    if (!t) continue
    const x = c as Record<string, unknown>
    lista.push({
      ...t,
      key: texto(x.key, 40) || `r${lista.length}`,
      incluir: x.incluir !== false,
      ...(typeof x.grupo === 'string' && x.grupo ? { grupo: x.grupo.slice(0, 200) } : {}),
      ...(x.nueva === true ? { nueva: true } : {}),
      ...(typeof x.nodeId === 'string' && x.nodeId ? { nodeId: x.nodeId.slice(0, 64) } : {}),
    })
  }
  if (!lista.length) return null
  const f = (r.fuente && typeof r.fuente === 'object' ? r.fuente : {}) as Record<string, unknown>
  const fuente: FuenteGuardar = {
    ...(typeof f.nombre === 'string' ? { nombre: f.nombre.slice(0, 160) } : {}),
    ...(f.unidad === 'diapositiva' || f.unidad === 'pagina' ? { unidad: f.unidad } : {}),
    ...(typeof f.mapId === 'string' ? { mapId: f.mapId } : {}),
    ...(typeof f.nodeId === 'string' ? { nodeId: f.nodeId.slice(0, 64) } : {}),
  }
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const d = (r.documento && typeof r.documento === 'object' ? r.documento : null) as Record<string, unknown> | null
  const documento = d && typeof d.hash === 'string' && /^[0-9a-f]{64}$/.test(d.hash) ? { hash: d.hash, nombre: texto(d.nombre, 160) } : undefined
  return {
    clave: r.clave,
    usuario: r.usuario,
    origen,
    titulo: texto(r.titulo, 200) || 'Flashcards',
    nombreGrupo: texto(r.nombreGrupo, 80) || texto(r.titulo, 80) || 'Flashcards',
    fuente,
    lista,
    fallidos: (Array.isArray(r.fallidos) ? r.fallidos : []).filter((x): x is string => typeof x === 'string').slice(0, 50),
    ...(documento ? { documento } : {}),
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
      if (!req.result.objectStoreNames.contains(STORE_DOCS)) req.result.createObjectStore(STORE_DOCS, { keyPath: 'clave' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function conStore<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>, store = STORE): Promise<T> {
  const db = await abrir()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(store, modo).objectStore(store))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

/** Guarda (o actualiza) el borrador. Conserva la fecha de creación. Nunca lanza. */
export async function guardarBorrador(
  d: Omit<BorradorGuardado, 'clave' | 'creado' | 'actualizado' | 'caduca'> & { creado?: number },
): Promise<void> {
  try {
    const ahora = Date.now()
    const clave = claveBorrador(d.usuario, d.origen)
    const registro: BorradorGuardado = { ...d, clave, creado: d.creado ?? ahora, actualizado: ahora, caduca: ahora + DIAS_BORRADOR * 86_400_000 }
    await conStore('readwrite', (s) => s.put(registro))
  } catch {
    /* sin IndexedDB (navegación privada…): simplemente no hay borrador */
  }
}

export async function leerBorrador(clave: string): Promise<BorradorGuardado | null> {
  try {
    const b = sanearBorrador(await conStore('readonly', (s) => s.get(clave)))
    if (!b) return null
    if (caducado(b)) {
      await borrarBorrador(clave)
      return null
    }
    return b
  } catch {
    return null
  }
}

/** Los borradores vivos de un usuario, el más reciente primero (los caducados se borran). */
export async function listarBorradores(usuario: string): Promise<BorradorGuardado[]> {
  try {
    const todos = (await conStore('readonly', (s) => s.getAll())) as unknown[]
    const out: BorradorGuardado[] = []
    for (const raw of todos) {
      const b = sanearBorrador(raw)
      if (!b || b.usuario !== usuario) continue
      if (caducado(b)) await borrarBorrador(b.clave)
      else out.push(b)
    }
    return out.sort((a, b) => b.actualizado - a.actualizado)
  } catch {
    return []
  }
}

/** Borra el borrador y, con él, el texto de su documento. */
export async function borrarBorrador(clave: string): Promise<void> {
  try {
    await conStore('readwrite', (s) => s.delete(clave))
  } catch {
    /* nada que borrar */
  }
  try {
    await conStore('readwrite', (s) => s.delete(clave), STORE_DOCS)
  } catch {
    /* nada que borrar */
  }
}

// ---------------------------------------------------------------------------
// Texto del documento de un borrador (para «Más de este tema» tras recargar)
// ---------------------------------------------------------------------------

export type DocumentoBorrador = { clave: string; hash: string; nombre: string; secciones: Seccion[]; unidad?: 'página' | 'diapositiva'; caduca: number }

/** Lo leído de IndexedDB tampoco se da por bueno: secciones con texto, páginas enteras, acotado. */
export function sanearDocumentoBorrador(raw: unknown): DocumentoBorrador | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.clave !== 'string' || typeof r.hash !== 'string' || !Array.isArray(r.secciones) || typeof r.caduca !== 'number') return null
  const secciones: Seccion[] = []
  for (const s of r.secciones.slice(0, 5000)) {
    const x = s && typeof s === 'object' ? (s as Record<string, unknown>) : null
    if (!x || typeof x.texto !== 'string') continue
    secciones.push({
      texto: x.texto.slice(0, 200_000),
      ...(typeof x.titulo === 'string' ? { titulo: x.titulo.slice(0, 300) } : {}),
      ...(typeof x.pagina === 'number' && Number.isInteger(x.pagina) && x.pagina >= 1 ? { pagina: x.pagina } : {}),
    })
  }
  if (!secciones.length) return null
  return {
    clave: r.clave,
    hash: r.hash,
    nombre: texto(r.nombre, 160),
    secciones,
    ...(r.unidad === 'diapositiva' || r.unidad === 'página' ? { unidad: r.unidad } : {}),
    caduca: r.caduca,
  }
}

/** Guarda el texto del documento con la clave (y la caducidad) de su borrador. Nunca lanza. */
export async function guardarDocumentoBorrador(
  usuario: string,
  d: { hash: string; nombre: string; secciones: Seccion[]; unidad?: 'página' | 'diapositiva' },
): Promise<void> {
  try {
    const clave = claveBorrador(usuario, { tipo: 'documento' })
    const registro: DocumentoBorrador = { clave, ...d, caduca: Date.now() + DIAS_BORRADOR * 86_400_000 }
    await conStore('readwrite', (s) => s.put(registro), STORE_DOCS)
  } catch {
    /* sin IndexedDB: «Más de este tema» pedirá el archivo */
  }
}

/** El texto del documento de un borrador, o null (no está, caducado o de otro archivo). */
export async function leerDocumentoBorrador(clave: string, hash?: string): Promise<DocumentoBorrador | null> {
  try {
    const d = sanearDocumentoBorrador(await conStore('readonly', (s) => s.get(clave), STORE_DOCS))
    if (!d) return null
    if (caducado(d)) {
      await conStore('readwrite', (s) => s.delete(clave), STORE_DOCS)
      return null
    }
    return hash && d.hash !== hash ? null : d
  } catch {
    return null
  }
}

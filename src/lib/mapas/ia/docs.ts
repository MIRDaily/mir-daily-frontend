// Texto del documento de un mapa generado con IA, guardado SOLO en este navegador (IndexedDB), para
// poder rehacer o ampliar una rama después (informe 76). Nunca va al servidor más que el fragmento
// de la rama que se rehace. Caduca a los 30 días y se puede borrar desde el editor. Si no está
// (otro dispositivo, caché borrada, caducado), el editor pide volver a elegir el archivo y comprueba
// con el hash guardado en el mapa que es el mismo.

import type { Seccion } from '@/lib/mapas/ia/types'

export const DIAS_DOCUMENTO = 30
const DB = 'mirdaily-mapas-ia'
const STORE = 'documentos'

export type DocumentoGuardado = {
  mapId: string
  /** SHA-256 del archivo (hex). */
  hash: string
  nombre: string
  secciones: Seccion[]
  unidad?: 'página' | 'diapositiva'
  guardado: number
  caduca: number
}

/** ¿Ha caducado? (también si el registro está roto). */
export function caducado(d: Pick<DocumentoGuardado, 'caduca'> | null | undefined, ahora = Date.now()): boolean {
  return !d || typeof d.caduca !== 'number' || d.caduca <= ahora
}

/** SHA-256 de un archivo, en hexadecimal (64 caracteres). */
export async function hashArchivo(file: Blob): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Sin IndexedDB'))
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'mapId' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function conStore<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, modo)
      const req = fn(tx.objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export async function guardarDocumento(
  mapId: string,
  d: { hash: string; nombre: string; secciones: Seccion[]; unidad?: 'página' | 'diapositiva' },
): Promise<void> {
  const ahora = Date.now()
  const registro: DocumentoGuardado = { mapId, ...d, guardado: ahora, caduca: ahora + DIAS_DOCUMENTO * 86_400_000 }
  await conStore('readwrite', (s) => s.put(registro))
}

/** El documento del mapa, o null si no está o ha caducado (entonces se borra). Nunca lanza. */
export async function leerDocumento(mapId: string): Promise<DocumentoGuardado | null> {
  try {
    const d = (await conStore('readonly', (s) => s.get(mapId))) as DocumentoGuardado | undefined
    if (!d) return null
    if (caducado(d) || !Array.isArray(d.secciones)) {
      await borrarDocumento(mapId)
      return null
    }
    return d
  } catch {
    return null
  }
}

export async function borrarDocumento(mapId: string): Promise<void> {
  try {
    await conStore('readwrite', (s) => s.delete(mapId))
  } catch {
    /* nada que borrar */
  }
}

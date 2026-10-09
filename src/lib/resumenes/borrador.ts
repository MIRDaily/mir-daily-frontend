// Borradores de la vista previa de los resúmenes activos con IA, guardados SOLO en este navegador
// (IndexedDB, base PROPIA: no la de las flashcards). Si se cierra o se recarga la pestaña a mitad de
// revisión, lo generado (y lo ya editado) no se pierde. Caducan a los 7 días y se borran al guardar.
// Nunca van al servidor.
//
// UNO POR DOCUMENTO (informe 82): la clave es el usuario y el SHA-256 del archivo. Antes había uno solo
// por usuario y generar otro documento lo sobrescribía sin avisar. Ahora /resumenes los lista todos
// («Retomar» y «Descartar» cada uno) y generar otra vez del MISMO archivo avisa antes de sustituir el
// suyo. Versión 2 de la base: añade el índice por usuario; el borrador de la versión 1 se queda tal
// cual (su clave termina en «:documento») y aparece en la lista como uno más.
//
// Cada párrafo recuerda de qué documento lo sacó el servidor (`doc`, el hash del TEXTO procesado) y el
// borrador guarda esas fuentes firmadas: al guardar, el servidor comprueba con ellas el tope del 30 %
// de «texto original» por documento.
//
// Lo puro (claves, caducidad, saneado al leer, orden) va arriba y se prueba con `npm test`; lo de
// IndexedDB, abajo, y nunca lanza.

import { MAX_TEMA, sanearHuecos, type Hueco } from '@/lib/resumenes/huecos'

export const DIAS_BORRADOR = 7
const DB = 'mirdaily-resumenes-ia'
const STORE = 'borradores'
const INDICE_USUARIO = 'usuario'
const VERSION = 2
const MAX_PARRAFOS = 1500
/** Más de esto, se borran los más viejos al guardar uno nuevo. */
export const MAX_BORRADORES = 12
/** El documento de un borrador de la versión 1 (antes de que hubiera uno por archivo). */
export const DOCUMENTO_V1 = 'documento'

export type ModoResumen = 'resumen' | 'literal'

/** Lo que dice la revisión de la IA de un párrafo: página de origen y si es dudoso. */
export type OrigenParrafo = { pagina?: number; diapositiva?: number; seccion?: string; dudoso?: string }

/** De qué documento salen unos párrafos, firmado por el servidor al generar (no se puede cambiar). */
export type FuenteFirmada = { hash: string; caracteres: number; firma: string }

/**
 * Un párrafo de la vista previa. `grupo`: en un documento tema a tema, el tema del libro. `doc`: el
 * hash de su fuente firmada. `incluirParecido`: el usuario ha pedido guardarlo aunque el grupo ya
 * tenga uno parecido.
 */
export type ParrafoBorrador = {
  key: string
  tema: string
  texto: string
  huecos: Hueco[]
  incluir: boolean
  grupo?: string
  ia?: OrigenParrafo
  doc?: string
  incluirParecido?: boolean
}

export type BorradorResumen = {
  /** `${usuario}:${documento}`. */
  clave: string
  usuario: string
  /** SHA-256 del archivo (o «documento» en un borrador de la versión 1). */
  documento: string
  titulo: string
  nombreGrupo: string
  modo: ModoResumen
  fuente: { nombre?: string; unidad?: 'pagina' | 'diapositiva' }
  /** Las fuentes firmadas de los párrafos (una por documento, o por tema del libro). */
  fuentes: FuenteFirmada[]
  lista: ParrafoBorrador[]
  fallidos: string[]
  creado: number
  actualizado: number
  caduca: number
}

const HEX64 = /^[0-9a-f]{64}$/

/** Clave de un borrador. Sin documento, la de la versión 1 (uno por usuario). */
export const claveBorrador = (usuario: string, documento: string = DOCUMENTO_V1) => `${usuario}:${documento}`

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

/** Una fuente firmada que viene de fuera (servidor o IndexedDB), o null. La firma la comprueba el servidor. */
export function sanearFuente(raw: unknown): FuenteFirmada | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.hash !== 'string' || !HEX64.test(r.hash)) return null
  if (typeof r.firma !== 'string' || !HEX64.test(r.firma)) return null
  if (typeof r.caracteres !== 'number' || !Number.isInteger(r.caracteres) || r.caracteres < 1 || r.caracteres > 10_000_000) return null
  return { hash: r.hash, caracteres: r.caracteres, firma: r.firma }
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
    ...(typeof r.doc === 'string' && HEX64.test(r.doc) ? { doc: r.doc } : {}),
    ...(r.incluirParecido === true ? { incluirParecido: true } : {}),
  }
}

/** El documento de un registro: el campo (versión 2) o lo que va tras el usuario en la clave (versión 1). */
function documentoDe(r: Record<string, unknown>): string {
  if (typeof r.documento === 'string' && (HEX64.test(r.documento) || r.documento === DOCUMENTO_V1)) return r.documento
  const clave = String(r.clave)
  const sufijo = clave.slice(clave.indexOf(':') + 1)
  return HEX64.test(sufijo) ? sufijo : DOCUMENTO_V1
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
  const fuentes = (Array.isArray(r.fuentes) ? r.fuentes : []).flatMap((x) => {
    const s = sanearFuente(x)
    return s ? [s] : []
  })
  return {
    clave: r.clave,
    usuario: r.usuario,
    documento: documentoDe(r),
    titulo: texto(r.titulo, 200) || 'Resumen activo',
    nombreGrupo: texto(r.nombreGrupo, 80) || texto(r.titulo, 80) || 'Resumen activo',
    modo: r.modo === 'literal' ? 'literal' : 'resumen',
    fuente: {
      ...(typeof f.nombre === 'string' ? { nombre: f.nombre.slice(0, 160) } : {}),
      ...(f.unidad === 'diapositiva' || f.unidad === 'pagina' ? { unidad: f.unidad } : {}),
    },
    fuentes: fuentes.slice(0, 60),
    lista,
    fallidos: (Array.isArray(r.fallidos) ? r.fallidos : []).filter((x): x is string => typeof x === 'string').slice(0, 50),
    creado: num(r.creado),
    actualizado: num(r.actualizado),
    caduca: num(r.caduca),
  }
}

/**
 * Registros de un usuario → los borradores vivos, saneados, del más reciente al más viejo, y las
 * claves de los que sobran (caducados, rotos o de otro usuario: se borran).
 */
export function ordenarBorradores(registros: unknown[], usuario: string, ahora = Date.now()): { vivos: BorradorResumen[]; sobran: string[] } {
  const vivos: BorradorResumen[] = []
  const sobran: string[] = []
  for (const raw of registros) {
    const b = sanearBorrador(raw)
    const clave = raw && typeof raw === 'object' && typeof (raw as { clave?: unknown }).clave === 'string' ? (raw as { clave: string }).clave : null
    if (!b || b.usuario !== usuario || caducado(b, ahora)) {
      if (clave && (!b || b.usuario === usuario)) sobran.push(clave)
      continue
    }
    vivos.push(b)
  }
  vivos.sort((a, b) => b.actualizado - a.actualizado)
  return { vivos, sobran }
}

/** Al guardar uno nuevo: las claves de los más viejos que pasan de MAX_BORRADORES (el nuevo no cuenta). */
export function sobrantes(vivos: Pick<BorradorResumen, 'clave' | 'actualizado'>[], nueva: string, max = MAX_BORRADORES): string[] {
  const otros = vivos.filter((b) => b.clave !== nueva).sort((a, b) => b.actualizado - a.actualizado)
  return otros.slice(Math.max(0, max - 1)).map((b) => b.clave)
}

// ---------------------------------------------------------------------------
// IndexedDB
// ---------------------------------------------------------------------------

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Sin IndexedDB'))
    const req = indexedDB.open(DB, VERSION)
    req.onupgradeneeded = () => {
      // Versión 1 → 2: el almacén se conserva con lo que tenga (el borrador de la versión 1 sigue con su
      // clave «usuario:documento»); solo se añade el índice por usuario para listar los de cada uno.
      const db = req.result
      const store = db.objectStoreNames.contains(STORE) ? req.transaction!.objectStore(STORE) : db.createObjectStore(STORE, { keyPath: 'clave' })
      if (!store.indexNames.contains(INDICE_USUARIO)) store.createIndex(INDICE_USUARIO, 'usuario', { unique: false })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    // Otra pestaña con la versión 1 abierta: no se queda colgado esperando.
    req.onblocked = () => reject(new Error('Base bloqueada'))
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

async function registrosDe(usuario: string): Promise<unknown[]> {
  return conStore('readonly', (s) => s.index(INDICE_USUARIO).getAll(IDBKeyRange.only(usuario)))
}

type NuevoBorrador = Omit<BorradorResumen, 'clave' | 'creado' | 'actualizado' | 'caduca'> & { creado?: number }

/** Guarda (o actualiza) el borrador de ese documento. Conserva la fecha de creación. Nunca lanza. */
export async function guardarBorrador(d: NuevoBorrador): Promise<void> {
  try {
    const ahora = Date.now()
    const clave = claveBorrador(d.usuario, d.documento)
    const registro: BorradorResumen = {
      ...d,
      clave,
      creado: d.creado ?? ahora,
      actualizado: ahora,
      caduca: ahora + DIAS_BORRADOR * 86_400_000,
    }
    await conStore('readwrite', (s) => s.put(registro))
    const { vivos } = ordenarBorradores(await registrosDe(d.usuario), d.usuario, ahora)
    for (const c of sobrantes(vivos, clave)) await conStore('readwrite', (s) => s.delete(c))
  } catch {
    /* sin IndexedDB (navegación privada…): simplemente no hay borrador */
  }
}

/** Los borradores vivos del usuario, del más reciente al más viejo (los caducados se borran). */
export async function leerBorradores(usuario: string): Promise<BorradorResumen[]> {
  try {
    const { vivos, sobran } = ordenarBorradores(await registrosDe(usuario), usuario)
    for (const c of sobran) await conStore('readwrite', (s) => s.delete(c))
    return vivos
  } catch {
    return []
  }
}

/** El borrador vivo de ese documento (por defecto, el de la versión 1), o null. */
export async function leerBorrador(usuario: string, documento: string = DOCUMENTO_V1): Promise<BorradorResumen | null> {
  try {
    const b = sanearBorrador(await conStore('readonly', (s) => s.get(claveBorrador(usuario, documento))))
    if (!b || b.usuario !== usuario) return null
    if (caducado(b)) {
      await borrarBorrador(usuario, documento)
      return null
    }
    return b
  } catch {
    return null
  }
}

export async function borrarBorrador(usuario: string, documento: string = DOCUMENTO_V1): Promise<void> {
  try {
    await conStore('readwrite', (s) => s.delete(claveBorrador(usuario, documento)))
  } catch {
    /* nada que borrar */
  }
}

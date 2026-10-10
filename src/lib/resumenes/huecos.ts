// Resúmenes activos: lo que es puro (sin React ni red) y se prueba con `npm test`. Un párrafo es texto
// plano + huecos [{ i, f, n }]: el trozo texto[i, f) se tapa al estudiar y n (1-4) es su nivel. Las
// mismas reglas que valida el servidor (src/services/resumenesIA/huecos.js) y el CHECK de la base de
// datos: dentro del texto, sin solaparse, con texto, de 1 a 8.
//
// Aquí van además las operaciones de la vista previa (tocar una palabra, seleccionar un trozo, cambiar
// el nivel, recolocar los huecos tras editar el texto) y las del estudio (qué huecos se tapan con el
// filtro de niveles, el siguiente que se destapa y la nota que se propone).

export type Nivel = 1 | 2 | 3 | 4
export type Hueco = { i: number; f: number; n: Nivel }
export type Nota = 1 | 2 | 3 | 4

export const NIVELES: Nivel[] = [1, 2, 3, 4]
export const MAX_HUECOS = 8
export const MIN_TEXTO = 20
export const MAX_TEXTO = 800
export const MAX_TEMA = 120

export const esNivel = (v: unknown): v is Nivel => v === 1 || v === 2 || v === 3 || v === 4

/** Nombre de cada nota de repaso (FSRS). */
export const NOMBRE_NOTA: Record<Nota, string> = { 1: 'Otra vez', 2: 'Difícil', 3: 'Bien', 4: 'Fácil' }

/** La nota que se propone al acabar un párrafo: todos bien = Bien; uno mal = Difícil; más = Otra vez. */
export function notaDeRepaso(fallos: number): Nota {
  if (fallos <= 0) return 3
  if (fallos === 1) return 2
  return 1
}

/** El mismo texto, para no guardar dos veces el mismo párrafo (como el servidor). */
export function claveParrafo(texto: string): string {
  return texto.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** null si los huecos valen para el texto; si no, el motivo (para enseñarlo). */
export function errorHuecos(texto: string, huecos: Hueco[]): string | null {
  if (huecos.length < 1) return 'Marca al menos un hueco'
  if (huecos.length > MAX_HUECOS) return `Como mucho ${MAX_HUECOS} huecos por párrafo`
  const orden = [...huecos].sort((a, b) => a.i - b.i)
  for (let k = 0; k < orden.length; k++) {
    const h = orden[k]
    if (!Number.isInteger(h.i) || !Number.isInteger(h.f) || !esNivel(h.n)) return 'Huecos no válidos'
    if (h.i < 0 || h.f <= h.i || h.f > texto.length) return 'Un hueco se sale del texto'
    if (!texto.slice(h.i, h.f).trim()) return 'Un hueco no tiene texto'
    if (k > 0 && h.i < orden[k - 1].f) return 'Dos huecos se solapan'
  }
  return null
}

/**
 * Huecos que llegan de fuera (el servidor, IndexedDB): solo los que valen, ordenados, sin solaparse y
 * como mucho 8. Nunca se confía en lo que llega.
 */
export function sanearHuecos(raw: unknown, texto: string): Hueco[] {
  if (!Array.isArray(raw)) return []
  const out: Hueco[] = []
  const lista = raw
    .map((h) => (h && typeof h === 'object' ? (h as Record<string, unknown>) : null))
    .filter((h): h is Record<string, unknown> => !!h)
    .map((h) => ({ i: h.i, f: h.f, n: h.n }))
    .filter((h): h is Hueco => Number.isInteger(h.i) && Number.isInteger(h.f) && esNivel(h.n))
    .sort((a, b) => a.i - b.i)
  for (const h of lista) {
    if (h.i < 0 || h.f <= h.i || h.f > texto.length || !texto.slice(h.i, h.f).trim()) continue
    if (out.length && h.i < out[out.length - 1].f) continue
    out.push({ i: h.i, f: h.f, n: h.n })
    if (out.length >= MAX_HUECOS) break
  }
  return out
}

export type Segmento = { t: string; k?: number }

/** Texto partido en trozos: los de fuera de los huecos y cada hueco (con su índice `k`). */
export function segmentos(texto: string, huecos: Hueco[]): Segmento[] {
  const out: Segmento[] = []
  let pos = 0
  huecos.forEach((h, k) => {
    if (h.i > pos) out.push({ t: texto.slice(pos, h.i) })
    out.push({ t: texto.slice(h.i, h.f), k })
    pos = h.f
  })
  if (pos < texto.length) out.push({ t: texto.slice(pos) })
  return out
}

// Lo que no es parte de un dato en los bordes de una palabra: «(anti-TPO).» → «anti-TPO».
const BORDE_IZQ = /^[\s¿¡([{«"'“‘]+/
const BORDE_DER = /[\s.,;:)\]}»"'”’!?]+$/

/** Ajusta un trozo [i, f) a palabras enteras y le quita espacios y puntuación de los bordes. */
export function ajustarSeleccion(texto: string, i: number, f: number): { i: number; f: number } | null {
  let a = Math.max(0, Math.min(i, f))
  let b = Math.min(texto.length, Math.max(i, f))
  // Hasta el principio y el final de la palabra (si se ha empezado o acabado a mitad).
  while (a > 0 && !/\s/.test(texto[a - 1]) && !/\s/.test(texto[a] ?? ' ')) a -= 1
  while (b < texto.length && !/\s/.test(texto[b]) && b > 0 && !/\s/.test(texto[b - 1])) b += 1
  const trozo = texto.slice(a, b)
  const izq = (BORDE_IZQ.exec(trozo) ?? [''])[0].length
  const der = (BORDE_DER.exec(trozo.slice(izq)) ?? [''])[0].length
  a += izq
  b -= der
  return b > a && texto.slice(a, b).trim() ? { i: a, f: b } : null
}

/** La palabra en la posición `pos` (sin la puntuación de sus bordes), o null si ahí hay un espacio. */
export function palabraEn(texto: string, pos: number): { i: number; f: number } | null {
  if (pos < 0 || pos >= texto.length || /\s/.test(texto[pos])) return null
  return ajustarSeleccion(texto, pos, pos + 1)
}

export type Cambio = { huecos: Hueco[]; error?: string }

/**
 * Crear un hueco sobre [i, f) (ajustado a palabras). Los huecos que toca se funden en él (con el nivel
 * más alto). Error si pasaría de 8.
 */
export function crearHueco(texto: string, huecos: Hueco[], i: number, f: number, nivel: Nivel): Cambio {
  const sel = ajustarSeleccion(texto, i, f)
  if (!sel) return { huecos, error: 'Selecciona alguna palabra' }
  const tocados = huecos.filter((h) => h.i < sel.f && h.f > sel.i)
  const nuevo: Hueco = {
    i: Math.min(sel.i, ...tocados.map((h) => h.i)),
    f: Math.max(sel.f, ...tocados.map((h) => h.f)),
    n: tocados.length ? (Math.max(nivel, ...tocados.map((h) => h.n)) as Nivel) : nivel,
  }
  const resto = huecos.filter((h) => !tocados.includes(h))
  if (resto.length + 1 > MAX_HUECOS) return { huecos, error: `Como mucho ${MAX_HUECOS} huecos por párrafo` }
  return { huecos: [...resto, nuevo].sort((a, b) => a.i - b.i) }
}

/** Tocar una palabra: si está en un hueco, se quita el hueco; si no, la palabra pasa a ser un hueco. */
export function alternarPalabra(texto: string, huecos: Hueco[], pos: number, nivel: Nivel): Cambio {
  const dentro = huecos.findIndex((h) => pos >= h.i && pos < h.f)
  if (dentro >= 0) return { huecos: huecos.filter((_, k) => k !== dentro) }
  const p = palabraEn(texto, pos)
  if (!p) return { huecos }
  return crearHueco(texto, huecos, p.i, p.f, nivel)
}

export const quitarHueco = (huecos: Hueco[], k: number): Hueco[] => huecos.filter((_, j) => j !== k)
export const cambiarNivel = (huecos: Hueco[], k: number, n: Nivel): Hueco[] => huecos.map((h, j) => (j === k ? { ...h, n } : h))

/**
 * Subir (+1) o bajar (-1) un nivel todos los huecos, sin salir de 1-4. `enTope`: los que ya estaban en
 * el nivel más alto (o el más bajo) y se quedan igual. Si no cambia ninguno, la MISMA lista (para no
 * repintar el párrafo).
 */
export function desplazarNiveles(huecos: Hueco[], d: 1 | -1): { huecos: Hueco[]; cambiados: number; enTope: number } {
  let cambiados = 0
  let enTope = 0
  const out = huecos.map((h) => {
    const n = Math.min(4, Math.max(1, h.n + d)) as Nivel
    if (n === h.n) {
      enTope += 1
      return h
    }
    cambiados += 1
    return { ...h, n }
  })
  return { huecos: cambiados ? out : huecos, cambiados, enTope }
}

export type CambioNiveles = { huecos: number; parrafos: number; enTope: number }

/**
 * Lo mismo para los párrafos con esas claves (un tema, lo marcado). Los párrafos que no cambian son
 * los MISMOS objetos (y si no cambia nada, la misma lista). `huecos`: cuántos han cambiado; `parrafos`:
 * en cuántos párrafos; `enTope`: cuántos ya estaban en el tope.
 */
export function desplazarNivelesDe<T extends { key: string; huecos: Hueco[] }>(
  lista: T[],
  claves: ReadonlySet<string>,
  d: 1 | -1,
): CambioNiveles & { lista: T[] } {
  const r: CambioNiveles = { huecos: 0, parrafos: 0, enTope: 0 }
  const out = lista.map((p) => {
    if (!claves.has(p.key)) return p
    const x = desplazarNiveles(p.huecos, d)
    r.enTope += x.enTope
    if (!x.cambiados) return p
    r.huecos += x.cambiados
    r.parrafos += 1
    return { ...p, huecos: x.huecos }
  })
  return { ...r, lista: r.huecos ? out : lista }
}

/** El aviso tras un cambio de nivel masivo: «12 huecos subidos de nivel en 5 párrafos (3 ya estaban…)». */
export function textoCambioNiveles(r: CambioNiveles, d: 1 | -1): string {
  const tope = d > 0 ? 'el nivel más alto' : 'el nivel más bajo'
  if (!r.huecos) return r.enTope ? `Ningún hueco cambia: ya estaban todos en ${tope}` : 'No hay huecos que cambiar'
  const base = `${r.huecos} ${r.huecos === 1 ? 'hueco' : 'huecos'} ${d > 0 ? 'subido' : 'bajado'}${r.huecos === 1 ? '' : 's'} de nivel en ${r.parrafos} ${r.parrafos === 1 ? 'párrafo' : 'párrafos'}`
  return r.enTope ? `${base} (${r.enTope} ya ${r.enTope === 1 ? 'estaba' : 'estaban'} en ${tope})` : base
}

/**
 * El texto ha cambiado: los huecos de lo que no ha cambiado se quedan (y se mueven si hace falta); los
 * de la parte cambiada se buscan por su texto (si sale una sola vez, sin solaparse, se recoloca) y si
 * no, se pierden. Devuelve también cuántos se han perdido, para avisar.
 */
export function ajustarTrasEditar(viejo: string, nuevo: string, huecos: Hueco[]): { huecos: Hueco[]; perdidos: number } {
  let pre = 0
  while (pre < viejo.length && pre < nuevo.length && viejo[pre] === nuevo[pre]) pre += 1
  let suf = 0
  while (suf < viejo.length - pre && suf < nuevo.length - pre && viejo[viejo.length - 1 - suf] === nuevo[nuevo.length - 1 - suf]) suf += 1
  const finViejo = viejo.length - suf
  const delta = nuevo.length - viejo.length
  const quedan: Hueco[] = []
  const sueltos: Hueco[] = []
  for (const h of huecos) {
    if (h.f <= pre) quedan.push(h)
    else if (h.i >= finViejo) quedan.push({ ...h, i: h.i + delta, f: h.f + delta })
    else sueltos.push(h)
  }
  let perdidos = 0
  for (const h of sueltos) {
    const t = viejo.slice(h.i, h.f)
    const a = nuevo.indexOf(t)
    const unico = a >= 0 && nuevo.indexOf(t, a + 1) < 0
    if (unico && !quedan.some((q) => q.i < a + t.length && q.f > a)) quedan.push({ i: a, f: a + t.length, n: h.n })
    else perdidos += 1
  }
  quedan.sort((a, b) => a.i - b.i)
  return { huecos: sanearHuecos(quedan, nuevo), perdidos }
}

// ---------------------------------------------------------------------------
// Estudio
// ---------------------------------------------------------------------------

/** Los huecos que se tapan con el filtro de niveles (los demás se ven). null = todos los niveles. */
export function huecosTapados(huecos: Hueco[], niveles: Nivel[] | null): number[] {
  return huecos.flatMap((h, k) => (!niveles || niveles.length === 0 || niveles.includes(h.n) ? [k] : []))
}

export type Respuesta = 'sabia' | 'no'

/**
 * Estado del estudio de un párrafo: qué huecos están tapados, qué se ha respondido en cada uno y en qué
 * orden (para volver a abrir el último).
 */
export type EstadoParrafo = { tapados: number[]; respuestas: Record<number, Respuesta>; orden?: number[] }

/**
 * `fallados`: en una sesión de «solo huecos fallados», los huecos fallados ahora del párrafo: se tapan
 * solo esos (de los niveles elegidos). Si no queda ninguno (se recuperaron al repetirlo en la sesión),
 * se tapan los de los niveles, como siempre.
 */
export function empezarParrafo(huecos: Hueco[], niveles: Nivel[] | null, fallados: number[] | null = null): EstadoParrafo {
  const deNivel = huecosTapados(huecos, niveles)
  const soloFallados = fallados ? deNivel.filter((k) => fallados.includes(k)) : []
  return { tapados: soloFallados.length ? soloFallados : deNivel, respuestas: {}, orden: [] }
}

/** El siguiente hueco tapado aún sin destapar (en orden de lectura), o null si ya están todos. */
export function siguienteTapado(e: EstadoParrafo): number | null {
  return e.tapados.find((k) => !(k in e.respuestas)) ?? null
}

/** Responder un hueco tapado (o cambiar su respuesta: corregir antes de pasar). */
export function responder(e: EstadoParrafo, k: number, r: Respuesta): EstadoParrafo {
  if (!e.tapados.includes(k)) return e
  return { ...e, respuestas: { ...e.respuestas, [k]: r }, orden: [...(e.orden ?? []).filter((x) => x !== k), k] }
}

/** Corregir un hueco ya contestado: «Lo sabía» ↔ «No lo sabía». */
export function cambiarRespuesta(e: EstadoParrafo, k: number): EstadoParrafo {
  const r = e.respuestas[k]
  if (!r) return e
  return { ...e, respuestas: { ...e.respuestas, [k]: r === 'sabia' ? 'no' : 'sabia' } }
}

/** Volver a abrir un hueco contestado (queda destapado y sin respuesta). */
export function reabrir(e: EstadoParrafo, k: number): EstadoParrafo {
  if (!(k in e.respuestas)) return e
  const respuestas = { ...e.respuestas }
  delete respuestas[k]
  return { ...e, respuestas, orden: (e.orden ?? []).filter((x) => x !== k) }
}

/** El último hueco contestado (para reabrirlo con Retroceso), o null. */
export function ultimoRespondido(e: EstadoParrafo): number | null {
  const orden = (e.orden ?? []).filter((k) => k in e.respuestas)
  return orden.length ? orden[orden.length - 1] : null
}

export const terminado = (e: EstadoParrafo) => e.tapados.every((k) => k in e.respuestas)
export const fallos = (e: EstadoParrafo) => e.tapados.filter((k) => e.respuestas[k] === 'no').length

/** Lo que se manda al registrar el repaso: cada hueco tapado por su posición en el texto, y si se sabía. */
export function resultados(e: EstadoParrafo, huecos: Hueco[]): { i: number; f: number; sabia: boolean }[] {
  return e.tapados.flatMap((k) => (huecos[k] && k in e.respuestas ? [{ i: huecos[k].i, f: huecos[k].f, sabia: e.respuestas[k] === 'sabia' }] : []))
}

/** Huecos fallados que llegan del servidor: posiciones válidas (0-7), sin repetir y ordenadas. */
export function sanearFallados(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return [...new Set(raw.filter((k): k is number => Number.isInteger(k) && (k as number) >= 0 && (k as number) < MAX_HUECOS))].sort((a, b) => a - b)
}

/** Fragmento de origen que llega del servidor: texto (como mucho 300) o null. */
export const sanearFragmento = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.slice(0, 300) : null)

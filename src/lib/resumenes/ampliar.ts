// «Más de este tema» y «Rehacer este párrafo» en la vista previa de los resúmenes activos con IA (lo
// puro; se prueba con `npm test`). Copia lo de las flashcards (lib/flashcards/ia/tarjetas.ts) con lo
// propio de los párrafos:
//
//   - un tema se identifica por su tema del libro (`grupo`, en un documento tema a tema) y su nombre;
//   - viaja SOLO el fragmento del tema: las páginas de sus párrafos con una de margen (o, sin páginas,
//     las secciones que más se le parecen), dentro de las secciones de su tema del libro si se saben;
//     para rehacer un párrafo, su página ±1;
//   - lo nuevo entra después del último párrafo de su tema, con el `doc` de los del tema (el tope de
//     «texto original» al guardar es por documento) y marcado como nuevo hasta que se toca;
//   - lo rehecho sustituye texto, huecos y origen EN SU SITIO (misma clave, tema y documento).

import { fragmentoParaRama } from '@/lib/mapas/ia/rama'
import type { Seccion } from '@/lib/mapas/ia/types'
import type { DocumentoResumen, ParrafoBorrador, TemaDocumento } from '@/lib/resumenes/borrador'
import { NIVELES, type Nivel } from '@/lib/resumenes/huecos'

export type OpcionMas = 'todo' | 'dificiles' | 'faciles'

/** `niveles` null: los de la generación. */
export const OPCIONES_MAS: { id: OpcionMas; titulo: string; descripcion: string; niveles: Nivel[] | null }[] = [
  { id: 'todo', titulo: 'Más de todo', descripcion: 'Con los niveles de la generación.', niveles: null },
  { id: 'dificiles', titulo: 'Más difíciles', descripcion: 'Huecos difícil y demencial.', niveles: [3, 4] },
  { id: 'faciles', titulo: 'Más fáciles', descripcion: 'Huecos fácil y media.', niveles: [1, 2] },
]
export const CANTIDADES_MAS = [3, 5, 10] as const
export const CANTIDAD_MAS_DEFECTO = 5

/** Los niveles de los huecos de una lista (los de la generación, al retomar un borrador). Sin huecos, todos. */
export function nivelesDeLista(lista: Pick<ParrafoBorrador, 'huecos'>[]): Nivel[] {
  const hay = new Set<Nivel>()
  for (const p of lista) for (const h of p.huecos) hay.add(h.n)
  const out = NIVELES.filter((n) => hay.has(n))
  return out.length ? out : [...NIVELES]
}

export const nivelesDeOpcion = (opcion: OpcionMas, generacion: Nivel[]): Nivel[] =>
  OPCIONES_MAS.find((o) => o.id === opcion)?.niveles ?? (generacion.length ? generacion : [...NIVELES])

/** Una copia sin esos campos (sin dejarlos a undefined: el borrador se guarda tal cual). */
function sin<T extends object, K extends keyof T>(x: T, campos: K[]): Omit<T, K> {
  const c: Partial<T> = { ...x }
  for (const k of campos) delete c[k]
  return c as Omit<T, K>
}

const esDelTema =(p: Pick<ParrafoBorrador, 'grupo' | 'tema'>, grupo: string, tema: string) => (p.grupo ?? '') === grupo && p.tema === tema

/** Los párrafos de un tema (todos, también los desmarcados: tampoco se quieren repetidos). */
export const parrafosDeTema = (lista: ParrafoBorrador[], grupo: string, tema: string) => lista.filter((p) => esDelTema(p, grupo, tema))

/**
 * Los otros temas (primero los del mismo tema del libro): al ampliar, la IA no hace párrafos de ellos y
 * el servidor quita los que los nombran sin nombrar el tema pedido.
 */
export function vecinosDeTema(lista: ParrafoBorrador[], grupo: string, tema: string, max = 60): string[] {
  const mismos: string[] = []
  const otros: string[] = []
  for (const p of lista) {
    if (p.tema === tema || mismos.includes(p.tema) || otros.includes(p.tema)) continue
    ;((p.grupo ?? '') === grupo ? mismos : otros).push(p.tema)
  }
  return [...mismos, ...otros].slice(0, max)
}

/** Páginas (o diapositivas) de donde salen unos párrafos. */
export function paginasDe(ps: Pick<ParrafoBorrador, 'ia'>[]): number[] {
  const out: number[] = []
  for (const p of ps) {
    const n = p.ia?.pagina ?? p.ia?.diapositiva
    if (n) out.push(n)
  }
  return out
}

const normal = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()

/** Las secciones del tema del libro `grupo` (si el documento lo sabe); si no, el documento entero. */
export function seccionesDelGrupo(doc: Pick<DocumentoResumen, 'secciones' | 'temas'>, grupo: string): Seccion[] {
  if (!grupo || !doc.temas?.length) return doc.secciones
  const g = normal(grupo)
  const t = doc.temas.find((x) => normal(x.titulo) === g)
  return t ? doc.secciones.slice(t.desde, t.hasta + 1) : doc.secciones
}

/** El fragmento de un tema: las páginas de sus párrafos (con margen) o las secciones que más se le parecen. */
export function fragmentoDeTema(doc: Pick<DocumentoResumen, 'secciones' | 'temas'>, grupo: string, tema: string, ps: ParrafoBorrador[]): Seccion[] {
  return fragmentoParaRama(seccionesDelGrupo(doc, grupo), paginasDe(ps), `${tema} ${ps.map((p) => p.texto).join(' ')}`)
}

/** El fragmento para rehacer un párrafo: su página ±1 o, si no se sabe, el de su tema. */
export function fragmentoDeParrafo(doc: Pick<DocumentoResumen, 'secciones' | 'temas'>, p: ParrafoBorrador, delTema: ParrafoBorrador[]): Seccion[] {
  const grupo = p.grupo ?? ''
  const pagina = p.ia?.pagina ?? p.ia?.diapositiva
  if (!pagina) return fragmentoDeTema(doc, grupo, p.tema, delTema)
  return fragmentoParaRama(seccionesDelGrupo(doc, grupo), [pagina], `${p.tema} ${p.texto}`)
}

/** Cuántas páginas tiene un fragmento (las distintas; sin páginas, sus secciones). Al menos 1. */
export function paginasDeFragmento(secciones: Seccion[]): number {
  const pags = new Set(secciones.map((s) => s.pagina).filter((n): n is number => !!n))
  return Math.max(1, pags.size || secciones.length)
}

/**
 * Los rangos (en el documento ENTERO) de los temas del libro que salieron, por el nombre que les puso
 * el servidor (el `grupo` de sus párrafos). `enviados`: los temas mandados, en orden, con su rango en el
 * documento; `generados`: los que volvieron, con su índice en `enviados` (si el título no cuadra con
 * ese índice, se busca por el título).
 */
export function rangosDeTemas(enviados: TemaDocumento[], generados: { i: number; titulo: string }[]): TemaDocumento[] {
  const out: TemaDocumento[] = []
  for (const g of generados) {
    const n = normal(g.titulo)
    if (!n) continue
    const cuadra = (t: TemaDocumento | undefined) => !!t && (normal(t.titulo) === n || normal(t.titulo).startsWith(n) || n.startsWith(normal(t.titulo)))
    const t = cuadra(enviados[g.i]) ? enviados[g.i] : enviados.find((x) => normal(x.titulo) === n)
    if (t) out.push({ titulo: g.titulo, desde: t.desde, hasta: t.hasta })
  }
  return out
}

/** Los temas del índice que llevan alguna sección marcada (los que se mandan, en el mismo orden), con su rango. */
export const temasMarcados = (temas: TemaDocumento[], sel: Set<number>): TemaDocumento[] =>
  temas.filter((t) => {
    for (let i = t.desde; i <= t.hasta; i++) if (sel.has(i)) return true
    return false
  })

/**
 * Mete los párrafos nuevos de un tema justo después del último de ese tema, marcados como nuevos,
 * con su tema del libro y el `doc` de los del tema, y con claves que no chocan. `sello` hace las
 * claves deterministas (se puede llamar dos veces con el mismo resultado). No muta `lista`.
 */
export function insertarNuevos(
  lista: ParrafoBorrador[],
  grupo: string,
  tema: string,
  nuevos: ParrafoBorrador[],
  sello: string,
): { lista: ParrafoBorrador[]; primera: string | null } {
  if (!nuevos.length) return { lista, primera: null }
  const usadas = new Set(lista.map((p) => p.key))
  const delTema = lista.filter((p) => esDelTema(p, grupo, tema))
  const doc = delTema.find((p) => p.doc)?.doc
  let n = 0
  const clave = () => {
    let k = `m${sello}-${n++}`
    while (usadas.has(k)) k = `m${sello}-${n++}`
    usadas.add(k)
    return k
  }
  const aMeter: ParrafoBorrador[] = nuevos.map((p) => {
    const x: ParrafoBorrador = { ...sin(p, ['incluirParecido', 'doc', 'grupo']), key: clave(), tema, incluir: true, nuevo: true }
    if (grupo) x.grupo = grupo
    if (doc) x.doc = doc
    return x
  })
  let ultima = -1
  lista.forEach((p, i) => {
    if (esDelTema(p, grupo, tema)) ultima = i
  })
  return {
    lista: ultima < 0 ? [...lista, ...aMeter] : [...lista.slice(0, ultima + 1), ...aMeter, ...lista.slice(ultima + 1)],
    primera: aMeter[0].key,
  }
}

/**
 * La versión rehecha EN SU SITIO: texto, huecos y origen nuevos; la misma clave, tema, tema del libro,
 * documento y «incluir». «Incluir igual» se quita (es otro texto: se vuelve a comprobar si se parece).
 */
export function rehacerEnSitio(lista: ParrafoBorrador[], key: string, nuevo: Pick<ParrafoBorrador, 'texto' | 'huecos' | 'ia'>): ParrafoBorrador[] {
  return lista.map((p) => {
    if (p.key !== key) return p
    return { ...sin(p, ['ia', 'incluirParecido', 'nuevo']), texto: nuevo.texto, huecos: nuevo.huecos, ...(nuevo.ia ? { ia: nuevo.ia } : {}) }
  })
}

/** «Deshacer»: vuelve la versión anterior (texto, huecos, origen e «Incluir igual»); «incluir» se queda como esté. */
export function deshacerEnSitio(lista: ParrafoBorrador[], key: string, anterior: ParrafoBorrador): ParrafoBorrador[] {
  const a = sin(anterior, ['nuevo'])
  return lista.map((p) => (p.key === key ? { ...a, key, incluir: p.incluir } : p))
}

/** «+3 nuevos · 2 quitados por repetir uno que ya tenías». */
export function textoMas(nuevos: number, quitados: number): string {
  const base = `+${nuevos} ${nuevos === 1 ? 'nuevo' : 'nuevos'}`
  return quitados > 0 ? `${base} · ${quitados} ${quitados === 1 ? 'quitado' : 'quitados'} por repetir uno que ya tenías` : base
}

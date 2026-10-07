// Añadir un documento a un mapa que ya existe (informe 76): p. ej., el mapa de los apuntes más el
// PowerPoint de clase. El servidor genera el mapa del documento nuevo con los nombres de los bloques
// y enfermedades del existente como guía; aquí se decide dónde va cada rama nueva y qué está
// repetido. Determinista y puro (`npm test`):
//   - un bloque o enfermedad nuevo con el nombre de uno que ya existe se funde con él;
//   - una hoja cuyo dato ya está (casi todas sus palabras) en una hoja de ese sitio NO se añade;
//   - lo que no encaja en nada va como bloque nuevo en la raíz.
// Antes de aplicar se enseña el plan; al aplicar, todo en UNA acción (Ctrl+Z) y lo añadido queda
// marcado para la revisión guiada.

import { plainText } from '@/lib/mapas/export/richtext'
import { sanitizeDoc } from '@/lib/mapas/tree'
import { aplicarRama, type LineaMapa, type NodoMapa } from '@/lib/mapas/ia/rama'
import type { CategoryStyles } from '@/lib/mapas/graph'
import type { MapDoc, MapNode } from '@/lib/mapas/types'

const quitarTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const norm = (s: string) => quitarTildes(s.toLowerCase()).replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim()
const PARADA = new Set('para como pero sobre entre desde hasta cuando donde segun tambien puede pueden debe deben tiene tienen otros otras este esta estos estas cada todo toda todos todas mas menos muy solo'.split(' '))
/** Raíces (5 letras) de las palabras con contenido y los números: lo que define un dato. */
function raices(s: string): Set<string> {
  const out = new Set<string>()
  // «<6 mg/dl» y «menor de 6 mg/dl» son el mismo dato.
  const t = s.replace(/≤|</g, ' menor ').replace(/≥|>/g, ' mayor ')
  for (const w of quitarTildes(t.toLowerCase()).match(/[a-z0-9ñ]+/g) ?? []) {
    if (/^\d+$/.test(w)) out.add(w)
    else if (w.length >= 4 && !PARADA.has(w)) out.add(w.slice(0, 5))
  }
  return out
}
/** El dato de una hoja sin su «Faceta:». */
const dato = (t: string) => t.replace(/^[^:]{2,40}:\s*/, '')

/** ¿Es el mismo bloque o enfermedad? Mismo nombre, uno dentro del otro, o casi las mismas palabras. */
export function mismoNombre(a: string, b: string): boolean {
  const x = norm(a)
  const y = norm(b)
  if (!x || !y) return false
  if (x === y) return true
  if (Math.min(x.length, y.length) >= 6 && (x.includes(y) || y.includes(x))) return true
  const ra = raices(a)
  const rb = raices(b)
  if (ra.size === 0 || rb.size === 0) return false
  let k = 0
  for (const r of ra) if (rb.has(r)) k += 1
  return k / Math.min(ra.size, rb.size) >= 0.75 && k >= 2
}

/** ¿Todas las palabras de `corto` están en `largo`? («Gota» en «Hiperuricemia y gota»). */
export function contenidoEn(corto: string, largo: string): boolean {
  const a = raices(corto)
  const b = raices(largo)
  if (a.size === 0) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}

/** Faceta de una hoja «Faceta: dato», por su primera palabra («Tratamiento del ataque» → tratamiento). */
export function facetaDe(t: string): string | null {
  const m = /^([^:]{2,40}):\s*\S/.exec(t)
  return m ? (norm(m[1]).split(' ')[0] ?? null) : null
}

/**
 * ¿El dato de esta hoja ya está en alguna de esas? Casi igual (≥65 % de sus palabras en una sola)
 * Y lo que trae de más no es nuevo: una cifra que no estaba, o dos palabras que el mapa no tiene en
 * ninguna parte (`vocabulario`), son un dato nuevo («…y TC de doble energía» junto a la ecografía).
 */
export function repetida(hoja: string, existentes: string[], vocabulario?: Set<string>, umbral = 0.65): boolean {
  const r = raices(dato(hoja))
  if (r.size === 0) return true
  return existentes.some((e) => {
    const s = raices(e)
    let k = 0
    for (const x of r) if (s.has(x)) k += 1
    if (k / r.size < umbral) return false
    const faltan = [...r].filter((x) => !s.has(x))
    if (faltan.some((x) => /^\d+$/.test(x))) return false
    return faltan.filter((x) => !vocabulario?.has(x)).length < 2
  })
}

export type Anadido = {
  /** Nodo del mapa del que cuelga lo nuevo. */
  destinoId: string
  /** Camino hasta el destino (para la vista previa). */
  ruta: string[]
  /** Lo que se cuelga: árbol v1 con el destino como raíz. */
  doc: MapDoc
  /** Nodos nuevos (sin contar el destino). */
  nodos: number
  /** Ejemplos de lo que se añade (vista previa). */
  muestra: string[]
}

export type PlanAnadir = { anadidos: Anadido[]; repetidas: string[]; total: number }

type NodoT = { t: string; n: MapNode; h: NodoT[] }

/**
 * Qué se añade y dónde. `existentes`: nodos del mapa abierto; `nuevo`: árbol v1 que devolvió el
 * servidor para el documento nuevo (su raíz no cuenta).
 */
export function planAnadir(existentes: NodoMapa[], nuevo: MapDoc): PlanAnadir {
  const texto = (n: NodoMapa) => (n.data.table ? n.data.table.title : plainText(n.data.label)).replace(/\s+/g, ' ').trim()
  const hijos = new Map<string, NodoMapa[]>()
  for (const n of existentes) if (n.data.parentId) (hijos.get(n.data.parentId) ?? hijos.set(n.data.parentId, []).get(n.data.parentId)!).push(n)
  const raiz = existentes.find((n) => !n.data.parentId)
  if (!raiz) return { anadidos: [], repetidas: [], total: 0 }
  const byId = new Map(existentes.map((n) => [n.id, n]))
  // Todas las palabras del mapa: lo que una hoja casi repetida trae «de más» y ya está en el mapa no es nuevo.
  const vocabulario = new Set<string>()
  for (const n of existentes) for (const r of raices(texto(n))) vocabulario.add(r)
  const ruta = (id: string) => {
    const out: string[] = []
    for (let p: NodoMapa | undefined = byId.get(id); p; p = p.data.parentId ? byId.get(p.data.parentId) : undefined) out.unshift(texto(p))
    return out
  }
  const hojasBajo = (id: string): string[] => {
    const out: string[] = []
    const walk = (x: string) => {
      for (const c of hijos.get(x) ?? []) {
        if ((hijos.get(c.id) ?? []).length) walk(c.id)
        else out.push(texto(c))
      }
    }
    walk(id)
    return out
  }
  /** Nodos con hijos bajo `id`, hasta `hondo` niveles (donde buscar el mismo bloque o enfermedad). */
  const internosBajo = (id: string, hondo: number): NodoMapa[] => {
    const out: NodoMapa[] = []
    const walk = (x: string, k: number) => {
      if (k > hondo) return
      for (const c of hijos.get(x) ?? []) {
        if (!(hijos.get(c.id) ?? []).length) continue
        out.push(c)
        walk(c.id, k + 1)
      }
    }
    walk(id, 1)
    return out
  }

  // Árbol nuevo anidado.
  const arbol = sanitizeDoc(nuevo)
  const porId = new Map<string, NodoT>()
  let raizNueva: NodoT | null = null
  for (const n of arbol.nodes) {
    const t: NodoT = { t: n.table ? n.table.title : n.text, n, h: [] }
    porId.set(n.id, t)
    if (!n.parentId) raizNueva = t
    else porId.get(n.parentId)?.h.push(t)
  }
  if (!raizNueva) return { anadidos: [], repetidas: [], total: 0 }

  const porDestino = new Map<string, NodoT[]>()
  const repetidas: string[] = []
  const anadir = (destinoId: string, t: NodoT) => (porDestino.get(destinoId) ?? porDestino.set(destinoId, []).get(destinoId)!).push(t)

  /** Quita de un subárbol nuevo las hojas repetidas (y los nodos que se queden vacíos). */
  const sinRepetidas = (t: NodoT, ya: string[]): NodoT | null => {
    if (!t.h.length) {
      if (!t.n.table && repetida(t.t, ya, vocabulario)) {
        repetidas.push(t.t)
        return null
      }
      return t
    }
    const h = t.h.map((c) => sinRepetidas(c, ya)).filter((c): c is NodoT => !!c)
    return h.length ? { ...t, h } : null
  }

  /**
   * Dónde va una hoja suelta dentro de `destino`: el nodo (el propio destino o uno de sus grupos)
   * cuyos hijos directos tienen más hojas con su misma faceta. null si ninguno tiene esa faceta.
   */
  const sitioPorFaceta = (hoja: string, destino: NodoMapa): NodoMapa | null => {
    const f = facetaDe(hoja)
    if (!f) return null
    const raizFaceta = [...raices(f)][0]
    let mejor: NodoMapa | null = null
    let puntos = 0
    let hondoMejor = -1
    const hondo = (x: NodoMapa) => ruta(x.id).length
    for (const x of [destino, ...internosBajo(destino.id, 3)]) {
      // Hojas hijas con la misma faceta, y un extra si el grupo se llama como ella («Manifestaciones
      // clínicas» para «Clínica: …»: muchos mapas no repiten el prefijo dentro de su grupo).
      const k = (hijos.get(x.id) ?? []).filter((c) => !(hijos.get(c.id) ?? []).length && facetaDe(texto(c)) === f).length
      const nombre = x !== destino && raizFaceta && raices(texto(x)).has(raizFaceta) ? 3 : 0
      const p = k + nombre
      const h = hondo(x)
      // A igualdad, el más concreto (más hondo).
      if (p > puntos || (p === puntos && p > 0 && h > hondoMejor)) {
        puntos = p
        mejor = x
        hondoMejor = h
      }
    }
    return mejor
  }

  /** Mete los hijos de `t` (nuevo) en `destino` (existente). */
  const fundir = (t: NodoT, destino: NodoMapa) => {
    const ya = hojasBajo(destino.id)
    const candidatos = internosBajo(destino.id, 3)
    for (const c of t.h) {
      if (!c.h.length) {
        // Una hoja: si su dato ya está bajo el destino, fuera; si no, al grupo de su faceta.
        if (!c.n.table && repetida(c.t, ya, vocabulario)) repetidas.push(c.t)
        else anadir((sitioPorFaceta(c.t, destino) ?? destino).id, c)
        continue
      }
      // Un bloque, enfermedad o subgrupo: ¿ya existe con ese nombre bajo el destino?
      const igual = candidatos.find((x) => mismoNombre(texto(x), c.t))
      if (igual) {
        fundir(c, igual)
        continue
      }
      // La enfermedad que da nombre al destino («Gota» dentro de «Hiperuricemia y gota»): sus
      // hijos van al destino.
      if (mismoNombre(texto(destino), c.t) || contenidoEn(c.t, texto(destino))) {
        fundir(c, destino)
        continue
      }
      // Un subgrupo por aspecto que aquí no existe («Tratamiento del ataque»): sus hojas se reparten
      // por faceta entre los grupos que ya hay; lo que no encaje se queda en el subgrupo, nuevo.
      const soloHojas = c.h.every((x) => !x.h.length)
      if (soloHojas && (c.n.ia?.subgrupo || c.h.every((x) => facetaDe(x.t)))) {
        const quedan: NodoT[] = []
        for (const x of c.h) {
          if (!x.n.table && repetida(x.t, ya, vocabulario)) {
            repetidas.push(x.t)
            continue
          }
          const sitio = sitioPorFaceta(x.t, destino)
          if (sitio) anadir(sitio.id, x)
          else quedan.push(x)
        }
        if (quedan.length) anadir(destino.id, { ...c, h: quedan })
        continue
      }
      const limpio = sinRepetidas(c, ya)
      if (limpio) anadir(destino.id, limpio)
    }
  }

  /**
   * Respaldo por CONTENIDO para un bloque que no casa por nombre (sinónimos: «Enfermedad por depósito
   * de pirofosfato cálcico» frente a «Condrocalcinosis»): el bloque existente que tiene en su rama
   * al menos el 30 % de las palabras del nuevo y claramente más (×1,5) que el siguiente.
   */
  const porContenido = (t: NodoT, candidatos: NodoMapa[]): NodoMapa | null => {
    const palabras = new Set<string>()
    const juntar = (x: NodoT) => {
      for (const r of raices(x.t)) palabras.add(r)
      x.h.forEach(juntar)
    }
    juntar(t)
    if (palabras.size < 4) return null
    const puntos = candidatos.map((c) => {
      const v = new Set<string>()
      for (const r of raices(texto(c))) v.add(r)
      for (const hoja of hojasBajo(c.id)) for (const r of raices(hoja)) v.add(r)
      for (const i of internosBajo(c.id, 4)) for (const r of raices(texto(i))) v.add(r)
      let k = 0
      for (const r of palabras) if (v.has(r)) k += 1
      return { c, p: k / palabras.size }
    }).sort((a, b) => b.p - a.p)
    const [primero, segundo] = puntos
    if (!primero || primero.p < 0.3) return null
    if (segundo && primero.p < segundo.p * 1.5) return null
    return primero.c
  }

  // Primer nivel: cada bloque nuevo, con el bloque existente del mismo nombre o, si no hay, con
  // cualquier nodo del mapa que se llame igual (la enfermedad que ya está en otro bloque) o, por
  // último, con el bloque que trata de lo mismo.
  for (const b of raizNueva.h) {
    if (!b.h.length) {
      fundir({ ...raizNueva, h: [b] }, raiz)
      continue
    }
    const bloque = (hijos.get(raiz.id) ?? []).find((x) => mismoNombre(texto(x), b.t))
      ?? internosBajo(raiz.id, 4).find((x) => mismoNombre(texto(x), b.t))
      ?? porContenido(b, (hijos.get(raiz.id) ?? []).filter((x) => (hijos.get(x.id) ?? []).length > 0))
    if (bloque) fundir(b, bloque)
    else {
      const limpio = sinRepetidas(b, hojasBajo(raiz.id))
      if (limpio) anadir(raiz.id, limpio)
    }
  }

  // Cada destino, un árbol v1 (el destino como raíz).
  const anadidos: Anadido[] = []
  let total = 0
  for (const [destinoId, lista] of porDestino) {
    const nodes: MapNode[] = [{ id: 'd', parentId: null, text: texto(byId.get(destinoId)!), category: 'general' }]
    const muestra: string[] = []
    let k = 0
    const volcar = (t: NodoT, padre: string) => {
      const id = `a${(k += 1)}`
      nodes.push({ ...t.n, id, parentId: padre })
      if (!t.h.length && muestra.length < 4) muestra.push(t.t)
      for (const c of t.h) volcar(c, id)
    }
    for (const t of lista) volcar(t, 'd')
    total += nodes.length - 1
    anadidos.push({ destinoId, ruta: ruta(destinoId), doc: { version: 1, nodes }, nodos: nodes.length - 1, muestra })
  }
  return { anadidos, repetidas, total }
}

/**
 * Aplica el plan: cada grupo debajo de lo que ya cuelga de su destino, del mismo lado, marcado
 * para revisar y con la página del documento nuevo como «nombre, pág. N». Devuelve los arrays
 * nuevos (no muta los de entrada) o null si nada se pudo colocar.
 */
export function aplicarAnadido<N extends NodoMapa, E extends LineaMapa>(
  nodes: N[],
  edges: E[],
  plan: PlanAnadir,
  opts: { nuevoId: () => string; categoryStyles?: CategoryStyles; labelFont?: number; origen: string },
): { nodes: N[]; edges: E[]; nuevos: string[] } | null {
  let estado: { nodes: N[]; edges: E[]; nuevos: string[] } = { nodes, edges, nuevos: [] }
  for (const a of plan.anadidos) {
    const r = aplicarRama(estado.nodes, estado.edges, a.destinoId, a.doc, { ...opts, conservar: true, marcarNuevos: true })
    if (r) estado = { nodes: r.nodes, edges: r.edges, nuevos: [...estado.nuevos, ...r.nuevos] }
  }
  return estado.nuevos.length ? estado : null
}

// Índice del documento para elegir qué parte usar (informe 76). Sale de lo que ya da la extracción:
// marcadores del PDF, títulos «Tema N» / «N.M. Apartado» al principio de las páginas, títulos de
// Word y de las diapositivas; si no hay nada de eso, una entrada por página. Puro (sin DOM): se
// prueba con `npm test`.
//
// La selección se guarda como un conjunto de ÍNDICES de sección (cada sección es una página, una
// diapositiva o un apartado de Word): marcar una entrada marca su rango, y al servidor solo viajan
// las secciones marcadas.

import type { Seccion } from '@/lib/mapas/ia/types'

export type EntradaIndice = {
  key: string
  titulo: string
  /** 1 = tema o capítulo; 2 = apartado dentro de él. */
  nivel: 1 | 2
  /** Rango de secciones [desde, hasta], ambos incluidos. */
  desde: number
  hasta: number
  /** Páginas (o diapositivas) que abarca, si se saben. */
  paginaDesde?: number
  paginaHasta?: number
  caracteres: number
}

/** Marcador del PDF (o tema detectado): título y página donde empieza. */
export type Marcador = { titulo: string; pagina: number; nivel?: 1 | 2 }

const MAX_TITULO = 90

const limpiarTitulo = (s: string) =>
  s.replace(/\s+/g, ' ').trim().slice(0, MAX_TITULO).replace(/[\s.:;,\-–—]+$/, '')
const paginaDe = (s: Seccion, i: number) => s.pagina ?? i + 1

// «Tema 3», «Capítulo 12. Vasculitis», «UNIDAD 4 - …»: al principio de una línea.
const RE_TEMA = /^(tema|cap[ií]tulo|unidad|lecci[oó]n|bloque|m[oó]dulo)\s+(\d{1,3})\b[\s.:\-–—]*(.*)$/i
// «3.1. Panarteritis nodosa» o «3.1 Panarteritis nodosa».
const RE_APARTADO = /^(\d{1,3})\.(\d{1,2})\.?\s+([A-ZÁÉÍÓÚÑ¿(].{2,})$/

// Un título que acaba en «y», «de», «(»… sigue en la línea siguiente («Enfermedad de Still y» /
// «artritis idiopática juvenil»).
const ACABA_A_MEDIAS = /(\s(y|e|o|u|de|del|la|las|el|los|en|con|por|para|a|al)|[(,\-–])$/i

function seguir(titulo: string, siguiente: string | undefined): string {
  const t = titulo.trim()
  if (!siguiente || !ACABA_A_MEDIAS.test(t) || siguiente.length > 80) return t
  return `${t} ${siguiente.trim()}`
}

/**
 * Temas y apartados que empiezan en cada página, mirando solo sus primeras líneas (donde van los
 * títulos). Las cabeceras de página repiten el tema («Tema 3  Vasculitis» en cada impar): un tema
 * empieza en la PRIMERA página donde sale su número. Un apartado cuenta si es del tema en curso.
 */
export function detectarTemas(secciones: Seccion[]): Marcador[] {
  const out: Marcador[] = []
  const vistos = new Set<number>()
  let actual: number | null = null
  secciones.forEach((s, i) => {
    const lineas = s.texto.split('\n').map((l) => l.trim()).filter(Boolean)
    const cabeza = lineas.slice(0, 4)
    for (let k = 0; k < cabeza.length; k++) {
      const m = RE_TEMA.exec(cabeza[k])
      if (!m) continue
      const n = Number(m[2])
      if (vistos.has(n)) {
        actual = n
        break
      }
      // Título: lo que siga en la línea («Tema 3. Vasculitis») o la línea siguiente.
      const resto = m[3].trim()
      const base = resto || cabeza[k + 1] || ''
      const siguiente = resto ? cabeza[k + 1] : cabeza[k + 2]
      const titulo = limpiarTitulo(`${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} ${n}. ${seguir(base, siguiente)}`)
      vistos.add(n)
      actual = n
      out.push({ titulo: titulo.replace(/\.\s*$/, ''), pagina: paginaDe(s, i), nivel: 1 })
      break
    }
    // Apartados en cualquier línea de la página (empiezan donde caigan).
    lineas.forEach((l, k) => {
      const m = RE_APARTADO.exec(l)
      if (!m || (actual !== null && Number(m[1]) !== actual) || l.length > 100) return
      if (out.some((x) => x.nivel === 2 && x.titulo.startsWith(`${m[1]}.${m[2]}.`))) return
      out.push({ titulo: limpiarTitulo(`${m[1]}.${m[2]}. ${seguir(m[3], lineas[k + 1])}`), pagina: paginaDe(s, i), nivel: 2 })
    })
  })
  return out
}

const sumaChars = (secciones: Seccion[], desde: number, hasta: number) => {
  let n = 0
  for (let i = desde; i <= hasta; i++) n += secciones[i].texto.length + (secciones[i].titulo?.length ?? 0)
  return n
}

/** Entradas a partir de marcadores ordenados por página: cada una llega hasta donde empieza la siguiente de su nivel o superior. */
function desdeMarcadores(secciones: Seccion[], marcadores: Marcador[]): EntradaIndice[] {
  const idxDePagina = (p: number) => {
    const i = secciones.findIndex((s, k) => paginaDe(s, k) >= p)
    return i < 0 ? secciones.length - 1 : i
  }
  const ms = marcadores
    .filter((m) => Number.isInteger(m.pagina) && m.pagina >= 1 && m.titulo.trim())
    .map((m) => ({ ...m, nivel: m.nivel ?? 1, i: idxDePagina(m.pagina) }))
    .sort((a, b) => a.i - b.i || a.nivel - b.nivel)
  const out: EntradaIndice[] = []
  ms.forEach((m, k) => {
    const siguiente = ms.slice(k + 1).find((x) => x.nivel <= m.nivel)
    // Un tema acaba en la página anterior a la del siguiente (los temas empiezan página). Un
    // apartado empieza donde caiga: comparte con el siguiente la página en que este empieza, para
    // no perder su final.
    const hasta = !siguiente
      ? secciones.length - 1
      : m.nivel === 2 && siguiente.nivel === 2
        ? Math.max(m.i, siguiente.i)
        : Math.max(m.i, siguiente.i - 1)
    out.push({
      key: `m${k}`,
      titulo: limpiarTitulo(m.titulo),
      nivel: m.nivel,
      desde: m.i,
      hasta,
      paginaDesde: paginaDe(secciones[m.i], m.i),
      paginaHasta: paginaDe(secciones[hasta], hasta),
      caracteres: sumaChars(secciones, m.i, hasta),
    })
  })
  // Lo que haya antes del primer marcador (portada, índice) también se puede elegir.
  if (out.length && out[0].desde > 0) {
    out.unshift({
      key: 'inicio',
      titulo: 'Inicio del documento',
      nivel: 1,
      desde: 0,
      hasta: out[0].desde - 1,
      paginaDesde: paginaDe(secciones[0], 0),
      paginaHasta: paginaDe(secciones[out[0].desde - 1], out[0].desde - 1),
      caracteres: sumaChars(secciones, 0, out[0].desde - 1),
    })
  }
  return out
}

/**
 * Índice del documento. Prioridad: marcadores del PDF → temas detectados en las páginas → títulos
 * de las secciones (Word, PowerPoint) → una entrada por página.
 */
export function construirIndice(secciones: Seccion[], marcadores: Marcador[] = []): EntradaIndice[] {
  if (secciones.length === 0) return []
  if (marcadores.length >= 2) return desdeMarcadores(secciones, marcadores)

  // Word y PowerPoint traen sus títulos: mandan ellos (un «2.1.» dentro del texto no es un índice).
  const conTitulo = secciones.filter((s) => s.titulo).length >= 2

  if (!conTitulo) {
    const temas = detectarTemas(secciones)
    const nivel1 = temas.filter((t) => t.nivel === 1)
    // Un tema solo: el índice útil son sus apartados.
    const utiles = nivel1.length >= 2 ? temas : temas.filter((t) => t.nivel === 2)
    if (utiles.length >= 2) return desdeMarcadores(secciones, utiles)
  }

  const repetidas = lineasRepetidas(secciones)
  if (conTitulo) {
    // Word / PowerPoint: cada sección con título abre una entrada; las que no tienen se suman a la anterior.
    const out: EntradaIndice[] = []
    secciones.forEach((s, i) => {
      const ultima = out[out.length - 1]
      if (s.titulo || !ultima) {
        out.push({
          key: `s${i}`,
          titulo: limpiarTitulo(s.titulo || primeraLinea(s.texto, repetidas)),
          nivel: 1,
          desde: i,
          hasta: i,
          ...(s.pagina ? { paginaDesde: s.pagina, paginaHasta: s.pagina } : {}),
          caracteres: sumaChars(secciones, i, i),
        })
      } else {
        ultima.hasta = i
        if (s.pagina) ultima.paginaHasta = s.pagina
        ultima.caracteres += sumaChars(secciones, i, i)
      }
    })
    return out
  }

  return secciones.map((s, i) => ({
    key: `p${i}`,
    titulo: primeraLinea(s.texto, repetidas),
    nivel: 1 as const,
    desde: i,
    hasta: i,
    paginaDesde: paginaDe(s, i),
    paginaHasta: paginaDe(s, i),
    caracteres: sumaChars(secciones, i, i),
  }))
}

const sinNumeros = (l: string) => l.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * Líneas que se repiten en muchas páginas (cabeceras y pies: «ec-europe - ISBN … 7»), sin contar
 * los números: no sirven para nombrar una página.
 */
function lineasRepetidas(secciones: Seccion[]): Set<string> {
  const cuenta = new Map<string, number>()
  for (const s of secciones) {
    const unicas = new Set(s.texto.split('\n').map(sinNumeros).filter(Boolean))
    for (const l of unicas) cuenta.set(l, (cuenta.get(l) ?? 0) + 1)
  }
  const tope = Math.max(2, secciones.length * 0.3)
  return new Set([...cuenta].filter(([, n]) => n >= tope).map(([l]) => l))
}

/** Primera línea con letras que no sea cabecera o pie repetido (un número de página suelto no dice nada). */
function primeraLinea(texto: string, repetidas: Set<string> = new Set()): string {
  const l =
    texto
      .split('\n')
      .map((x) => x.trim())
      .find((x) => /\p{L}{3}/u.test(x) && !repetidas.has(sinNumeros(x))) ?? ''
  return limpiarTitulo(l) || 'Sin título'
}

/** «3-5, 8» → páginas (o null si no se entiende). Acepta guiones largos y espacios. */
export function leerRango(texto: string, maxPagina: number): Set<number> | null {
  const t = texto.trim()
  if (!t) return null
  const out = new Set<number>()
  for (const parte of t.split(/[,;]+/)) {
    const p = parte.trim()
    if (!p) continue
    const m = /^(\d{1,5})(?:\s*[-–—a]\s*(\d{1,5}))?$/i.exec(p)
    if (!m) return null
    const a = Number(m[1])
    const b = m[2] ? Number(m[2]) : a
    if (a < 1 || b < a || a > maxPagina) return null
    for (let k = a; k <= Math.min(b, maxPagina); k++) out.add(k)
  }
  return out.size ? out : null
}

/** Índices de sección cuyas páginas están en `paginas`. */
export function seccionesDePaginas(secciones: Seccion[], paginas: Set<number>): Set<number> {
  const out = new Set<number>()
  secciones.forEach((s, i) => {
    if (paginas.has(paginaDe(s, i))) out.add(i)
  })
  return out
}

/** Estado de una entrada según la selección: todo, parte o nada de su rango. */
export function estadoEntrada(e: EntradaIndice, sel: Set<number>): 'todo' | 'parte' | 'nada' {
  let n = 0
  for (let i = e.desde; i <= e.hasta; i++) if (sel.has(i)) n += 1
  return n === 0 ? 'nada' : n === e.hasta - e.desde + 1 ? 'todo' : 'parte'
}

/** Marca o desmarca el rango de una entrada. */
export function alternarEntrada(e: EntradaIndice, sel: Set<number>): Set<number> {
  const marcar = estadoEntrada(e, sel) !== 'todo'
  const out = new Set(sel)
  for (let i = e.desde; i <= e.hasta; i++) {
    if (marcar) out.add(i)
    else out.delete(i)
  }
  return out
}

/** Lo que se manda y lo que se calcula de la selección. */
export function resumenSeleccion(secciones: Seccion[], sel: Set<number>) {
  const elegidas = secciones.filter((_, i) => sel.has(i))
  const caracteres = elegidas.reduce((n, s) => n + s.texto.length + (s.titulo?.length ?? 0), 0)
  // Word no tiene páginas: se estiman como al leerlo (≈ 2.500 caracteres por página).
  const paginas = elegidas.some((s) => s.pagina)
    ? new Set(elegidas.map((s, k) => s.pagina ?? -k)).size
    : Math.max(elegidas.length ? 1 : 0, Math.round(caracteres / 2500))
  return { elegidas, caracteres, paginas }
}

/** «págs. 3–5», «pág. 7», «diaps. 2–9». */
export function rangoLabel(e: EntradaIndice, unidad: 'página' | 'diapositiva' = 'página'): string {
  if (!e.paginaDesde) return ''
  const corto = unidad === 'diapositiva' ? 'diap' : 'pág'
  return e.paginaHasta && e.paginaHasta !== e.paginaDesde
    ? `${corto}s. ${e.paginaDesde}–${e.paginaHasta}`
    : `${corto}. ${e.paginaDesde}`
}

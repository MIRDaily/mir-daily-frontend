// Documento largo TEMA A TEMA (informe 76). El servidor saca el índice con una llamada barata a
// partir del PRINCIPIO de cada sección (no del documento entero) y luego genera un mapa por tema.
// Aquí, lo que es del navegador: qué se manda para el índice, cómo se pinta ese índice para
// elegir, qué temas se mandan a generar y cómo se une todo en un mapa grande. Puro: `npm test`.

import type { EntradaIndice } from '@/lib/mapas/ia/indice'
import type { Seccion } from '@/lib/mapas/ia/types'
import type { MapDoc, MapNode } from '@/lib/mapas/types'

/** Caracteres del principio de cada sección que viajan para sacar el índice. */
export const INICIO_INDICE = 400

/** Tema del índice tal como lo devuelve el servidor (rangos sobre las secciones mandadas). */
export type TemaIndice = {
  titulo: string
  desde: number
  hasta: number
  chars: number
  paginaDesde?: number
  paginaHasta?: number
  apartados: { titulo: string; desde: number }[]
}

/** Lo que se manda a POST /indice: el principio de cada sección, su tamaño y su página. */
export function resumenParaIndice(secciones: Seccion[]) {
  return secciones.map((s) => ({
    inicio: `${s.titulo ? `${s.titulo}\n` : ''}${s.texto}`.slice(0, INICIO_INDICE),
    chars: s.texto.length + (s.titulo?.length ?? 0),
    ...(s.pagina ? { pagina: s.pagina } : {}),
  }))
}

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const entero = (v: unknown, max: number) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : null)

/** Respuesta no fiable del servidor → temas válidos (en orden, dentro de rango, sin solaparse). */
export function sanitizeTemas(raw: unknown, n: number): TemaIndice[] {
  if (!Array.isArray(raw)) return []
  const out: TemaIndice[] = []
  let fin = -1
  for (const r of raw.slice(0, 200)) {
    if (!r || typeof r !== 'object') continue
    const t = r as Record<string, unknown>
    const desde = entero(t.desde, n - 1)
    const hasta = entero(t.hasta, n - 1)
    if (desde === null || hasta === null || desde > hasta || desde <= fin) continue
    fin = hasta
    const apartados = Array.isArray(t.apartados)
      ? t.apartados
          .map((a) => (a && typeof a === 'object' ? (a as Record<string, unknown>) : {}))
          .map((a) => ({ titulo: texto(a.titulo, 120), desde: entero(a.desde, n - 1) }))
          .filter((a): a is { titulo: string; desde: number } => !!a.titulo && a.desde !== null && a.desde >= desde && a.desde <= hasta)
      : []
    out.push({
      titulo: texto(t.titulo, 120) || `Parte ${out.length + 1}`,
      desde,
      hasta,
      chars: entero(t.chars, 10_000_000) ?? 0,
      ...(entero(t.paginaDesde, 100000) ? { paginaDesde: t.paginaDesde as number } : {}),
      ...(entero(t.paginaHasta, 100000) ? { paginaHasta: t.paginaHasta as number } : {}),
      apartados,
    })
  }
  return out
}

/** Temas del servidor → entradas del selector «Qué parte usar» (tema y sus apartados). */
export function entradasDeTemas(temas: TemaIndice[], secciones: Seccion[]): EntradaIndice[] {
  const pag = (i: number) => secciones[i]?.pagina
  const chars = (a: number, b: number) => {
    let n = 0
    for (let i = a; i <= b; i++) n += (secciones[i]?.texto.length ?? 0) + (secciones[i]?.titulo?.length ?? 0)
    return n
  }
  const out: EntradaIndice[] = []
  temas.forEach((t, k) => {
    out.push({ key: `t${k}`, titulo: t.titulo, nivel: 1, desde: t.desde, hasta: t.hasta, paginaDesde: pag(t.desde), paginaHasta: pag(t.hasta), caracteres: chars(t.desde, t.hasta) })
    t.apartados.forEach((a, j) => {
      const sig = t.apartados[j + 1]
      const hasta = sig ? Math.max(a.desde, sig.desde) : t.hasta
      out.push({ key: `t${k}a${j}`, titulo: a.titulo, nivel: 2, desde: a.desde, hasta, paginaDesde: pag(a.desde), paginaHasta: pag(hasta), caracteres: chars(a.desde, hasta) })
    })
  })
  return out
}

/**
 * Lo que se manda a generar: SOLO las secciones marcadas (en su orden) y cada tema con algo
 * marcado como rango sobre ese envío. Lo marcado fuera de cualquier tema (portada) no viaja.
 */
export function temasParaEnviar(secciones: Seccion[], sel: Set<number>, temas: TemaIndice[]) {
  const enviadas: Seccion[] = []
  const rangos: { titulo: string; desde: number; hasta: number }[] = []
  for (const t of temas) {
    const desde = enviadas.length
    for (let i = t.desde; i <= t.hasta; i++) if (sel.has(i)) enviadas.push(secciones[i])
    if (enviadas.length > desde) rangos.push({ titulo: t.titulo, desde, hasta: enviadas.length - 1 })
  }
  const caracteres = enviadas.reduce((n, s) => n + s.texto.length + (s.titulo?.length ?? 0), 0)
  return { secciones: enviadas, temas: rangos, caracteres }
}

/** Nodos aproximados de un libro: cada tema crece con la raíz de su texto (como un mapa suelto). */
export function nodosLibro(charsPorTema: number[], k: number): number {
  return charsPorTema.reduce((n, c) => n + Math.max(5, Math.round(k * Math.sqrt(c))), 0)
}

export type TemaGenerado = { titulo: string; doc: MapDoc }

/**
 * Un mapa grande con cada tema plegado: raíz = el documento; cada tema, un bloque de primer nivel
 * (plegado) con su mapa debajo. Los ids se prefijan por tema para que no choquen.
 */
export function unirTemas(titulo: string, temas: TemaGenerado[]): MapDoc {
  const nodes: MapNode[] = [{ id: 'libro', parentId: null, text: titulo, category: 'general' }]
  temas.forEach((t, k) => {
    const raiz = t.doc.nodes.find((n) => n.parentId === null)
    if (!raiz) return
    const id = (x: string) => `t${k + 1}-${x}`
    nodes.push({ id: id(raiz.id), parentId: 'libro', text: t.titulo, category: 'general', collapsed: true })
    for (const n of t.doc.nodes) {
      if (n === raiz) continue
      nodes.push({ ...n, id: id(n.id), parentId: n.parentId ? id(n.parentId) : id(raiz.id) })
    }
  })
  return { version: 1, nodes }
}

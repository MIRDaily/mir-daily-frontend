// Precio de una generación con IA en créditos, calculado AL INSTANTE en el navegador con la tarifa de
// GET /api/ia/tarifa. Es la misma fórmula que el servidor (mir-daily-backend, services/creditos/tarifa.js)
// y los mismos caracteres que cuenta él (el saneado de services/mapasIA/texto.js), para que lo que se
// enseña sea lo que se cobra. Aun así, el que manda es el servidor: lo que aquí se calcula solo viaja
// como tope (`creditosAnunciados`); si se queda corto, el servidor contesta 409 `precio_cambiado`.
//
//   créditos = ⌈ (fijo × llamadas + por_mil × caracteres / 1.000) × factor ⌉, mínimo 1
//   (una clave sin coste, el índice, vale 0)

import type { Seccion } from '@/lib/mapas/ia/types'

export type TarifaClave = { fijo: number | string; por_mil: number | string; factores?: Record<string, number> }
export type TarifaIA = {
  version: number
  claves: Record<string, TarifaClave>
  cancelacionesGratisMes: number
  cancelacionSinTextoSeg: number
}

export type PeticionPrecio = { clave: string; caracteres?: number; llamadas?: number; densidad?: string }

/** Créditos de una generación, o null si la tarifa no tiene esa clave (no se puede anunciar). */
export function precioIA(tarifa: TarifaIA | null | undefined, { clave, caracteres = 0, llamadas = 1, densidad }: PeticionPrecio): number | null {
  const t = tarifa?.claves?.[clave]
  if (!t) return null
  const fijo = Number(t.fijo) || 0
  const porMil = Number(t.por_mil) || 0
  if (fijo === 0 && porMil === 0) return 0
  const f = densidad !== undefined && t.factores && Object.hasOwn(t.factores, densidad) ? Number(t.factores[densidad]) : 1
  const factor = Number.isFinite(f) && f > 0 ? f : 1
  const n = Math.max(1, Math.floor(Number(llamadas) || 1))
  const chars = Math.max(0, Number(caracteres) || 0)
  const bruto = (fijo * n + (porMil * chars) / 1000) * factor
  return Math.max(1, Math.ceil(Math.round(bruto * 1e6) / 1e6))
}

/** Claves de la tarifa (las mismas que el servidor). */
export const claveMapa = (modo: string, tablas: boolean) => `mapa:${modo}${tablas ? '+tablas' : ''}`
export const claveFlashcards = (origen: 'documento' | 'mapa') => `flashcards:${origen}`
export const claveResumenes = (modo: string) => `resumenes:${modo === 'literal' ? 'literal' : 'resumen'}`

// --- Los caracteres como los cuenta el servidor -----------------------------------------------------

// Caracteres de control, de formato invisible y de dirección bidi (los mismos que quita el servidor).
const INVISIBLES = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F­؜᠎​-‏‪-‮⁠-⁯﻿￹-￻\u{E0000}-\u{E007F}]/gu

/** El saneado de entrada del servidor (limpiarEntrada): lo que de verdad se manda al modelo. */
export function limpiarEntrada(texto: string): string {
  return String(texto ?? '')
    .normalize('NFC')
    .replace(INVISIBLES, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Caracteres de una sección (0 si el servidor la descarta: menos de 10 tras sanear). */
export function caracteresSeccion(s: Seccion): number {
  const n = limpiarEntrada(s?.texto ?? '').length
  return n < 10 ? 0 : n
}

/** Caracteres de un documento (las secciones que se mandan). */
export function caracteresDocumento(secciones: Seccion[]): number {
  return secciones.reduce((n, s) => n + caracteresSeccion(s), 0)
}

/**
 * Libro tema a tema: cada tema es un rango [desde, hasta] de `secciones`. El servidor procesa (y
 * cobra) la suma de los temas, y un tema sin texto se descarta (no paga su fijo).
 */
export function caracteresLibro(secciones: Seccion[], temas: { desde: number; hasta: number }[]): { caracteres: number; llamadas: number } {
  let caracteres = 0
  let llamadas = 0
  for (const t of temas) {
    let n = 0
    let alguna = false
    for (let i = t.desde; i <= t.hasta && i < secciones.length; i++) {
      const c = caracteresSeccion(secciones[i])
      if (c > 0) alguna = true
      n += c
    }
    if (alguna) {
      llamadas += 1
      caracteres += n
    }
  }
  return { caracteres, llamadas: Math.max(1, llamadas) }
}

// Flashcards desde una rama del mapa: el servidor cuenta el texto de la rama tal como se lo manda al
// modelo (cada línea saneada como un nodo y sangrada) más el fragmento del documento.
const COLA = /(?:\s+(?:de|del|la|las|el|los|y|e|o|u|en|a|al|con|por|para|un|una|que|se|su|sus|sobre|entre))+$/i

function limpiarNodo(texto: string): string {
  return String(texto ?? '')
    .normalize('NFC')
    .replace(INVISIBLES, ' ')
    .replace(/!\[([^\]]*)\]\((?:[^()]|\([^)]*\))*\)/g, '$1')
    .replace(/\[([^\]]*)\]\((?:[^()]|\([^)]*\))*\)/g, '$1')
    .replace(/\b(?:https?|ftp|file|data|javascript|vbscript):[^\s]*/gi, '')
    .replace(/\bwww\.[^\s]+/gi, '')
    .replace(/(^|\s)\/\/[\w.-]+\.[a-z]{2,}\S*/gi, '$1')
    .replace(/<(script|style|iframe|object|embed)\b[\s\S]*?(<\/\1\s*>|$)/gi, ' ')
    .replace(/<\/?[a-zA-Z!][^>]*>/g, ' ')
    .replace(/^[\s>#*•·\-–—+]+/, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.;:,\s]+$/, '')
}

function acotar(texto: string, maxPalabras: number, maxCaracteres: number): string {
  const palabras = texto.split(' ')
  let t = palabras.length > maxPalabras ? palabras.slice(0, maxPalabras).join(' ') : texto
  if (t.length > maxCaracteres) {
    t = t.slice(0, maxCaracteres)
    const corte = t.lastIndexOf(' ')
    if (corte > 0) t = t.slice(0, corte)
  }
  return t.replace(COLA, '').replace(/[.;:,\s]+$/, '')
}

export function caracteresRamaMapa(mapa: { d: number; t: string }[], secciones: Seccion[] = []): number {
  const lineas = mapa.map((x) => ({ d: x.d, t: acotar(limpiarNodo(x.t), 60, 400) })).filter((x) => x.t.length >= 2)
  const texto = lineas.map((x) => `${'  '.repeat(x.d)}${x.t}`).join('\n')
  return texto.length + caracteresDocumento(secciones)
}

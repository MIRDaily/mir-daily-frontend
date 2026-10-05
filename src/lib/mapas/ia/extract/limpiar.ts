import type { Seccion } from '../types'

// Quita caracteres invisibles (también los que esconden instrucciones para una
// IA) y normaliza espacios. El servidor repite esta limpieza: aquí es para no
// contar ni enviar basura.
const INVISIBLES = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F­؜᠎​-‏‪-‮⁠-⁯﻿￹-￻\u{E0000}-\u{E007F}]/gu

export function limpiarTexto(t: string): string {
  return t
    .normalize('NFC')
    .replace(INVISIBLES, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const clave = (linea: string) => linea.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim()

/**
 * Cabeceras y pies repetidos en las páginas ("DOCENCIA UNIDAD DE SALUD MENTAL…",
 * "Tema 2 Manifestaciones…", números de página): una línea corta que aparece en
 * al menos el 40 % de las páginas no es contenido. Ahorra caracteres y evita
 * que la IA los convierta en nodos.
 */
export function quitarRepetidas(paginas: string[]): string[] {
  if (paginas.length < 4) return paginas.map((p) => p.replace(/^\s*\d{1,4}\s*$/gm, '').trim())
  const cuenta = new Map<string, number>()
  for (const p of paginas) {
    const vistas = new Set(p.split('\n').map(clave).filter((l) => l && l.length < 120))
    for (const l of vistas) cuenta.set(l, (cuenta.get(l) ?? 0) + 1)
  }
  const umbral = Math.max(3, Math.ceil(paginas.length * 0.4))
  return paginas.map((p) =>
    p
      .split('\n')
      .filter((l) => {
        const k = clave(l)
        if (!k) return true
        if (/^#$/.test(k)) return false // número de página suelto
        return !((cuenta.get(k) ?? 0) >= umbral && l.length < 120)
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  )
}

export function contarCaracteres(secciones: Seccion[]): number {
  return secciones.reduce((s, x) => s + x.texto.length, 0)
}

export function tituloDeArchivo(nombre: string): string {
  return (
    nombre
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .replace(/[_]+/g, ' ')
      .replace(/^\d+[.)\s-]+\s*/, '')
      .replace(/\s*\(\d+\)\s*$/, '')
      .trim()
      .slice(0, 120) || 'Mapa mental'
  )
}

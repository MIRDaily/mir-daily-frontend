// Resúmenes activos: los niveles y los huecos, legibles por todos (puro, se prueba con `npm test`).
//
// - Cada nivel lleva una ETIQUETA CORTA además del color (quien no distingue el verde del ámbar lee
//   «Fác», «Med», «Dif», «Dem»).
// - Los colores de LEVEL_INFO (compartidos con las flashcards, no se tocan) no llegan a AA como texto
//   sobre su propio tono suave (3,3-4,3:1). Aquí, una TINTA más oscura de cada nivel para el texto, que
//   pasa de 4,5:1 sobre su tono suave, sobre blanco y sobre el fondo de la página (lo comprueba el test).
// - Lo que lee un lector de pantalla de cada hueco: tapado, destapado, sabido o fallado.

import { LEVEL_INFO } from '@/lib/studioFlashcards'
import type { Nivel } from '@/lib/resumenes/huecos'

export const NIVEL_CORTO: Record<Nivel, string> = { 1: 'Fác', 2: 'Med', 3: 'Dif', 4: 'Dem' }

/** Texto de cada nivel (AA sobre su tono suave, sobre blanco y sobre #FAF7F4). */
export const TINTA_NIVEL: Record<Nivel, string> = { 1: '#3B6537', 2: '#2B5F82', 3: '#7E520A', 4: '#8E3346' }

/** Verde y rojo de «Lo sabía» / «No lo sabía» con texto blanco encima (AA). */
export const VERDE_OK = '#3B6537'
export const ROJO_KO = '#8E3346'
/** El gris secundario de la casa (#7D8A96) no llega a AA en letra pequeña: este sí (sobre blanco y #FAF7F4). */
export const GRIS_AA = '#5F6B76'

/** Estilo de un nivel: el color de siempre para bordes y fondos, la tinta para el texto. */
export function estiloNivel(n: Nivel) {
  const info = LEVEL_INFO[n]
  return { nombre: info.name, corto: NIVEL_CORTO[n], borde: info.color, suave: info.soft, tinta: TINTA_NIVEL[n] }
}

// Contraste WCAG 2.x entre dos colores #RRGGBB.
function luminancia(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export function contraste(a: string, b: string): number {
  const x = luminancia(a)
  const y = luminancia(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

export type EstadoHueco = 'tapado' | 'destapado' | 'sabia' | 'no' | 'visible'

/**
 * Lo que dice un lector de pantalla de un hueco del estudio. Tapado: el nivel, nunca la respuesta.
 * Los demás: la respuesta y qué se puede hacer.
 */
export function etiquetaHueco(estado: EstadoHueco, n: Nivel, respuesta: string, opciones: { escribir?: boolean } = {}): string {
  const nivel = `nivel ${LEVEL_INFO[n].name.toLowerCase()}`
  switch (estado) {
    case 'tapado':
      return `Hueco tapado, ${nivel}. ${opciones.escribir ? 'Toca para escribir la respuesta' : 'Toca para destaparlo'}`
    case 'destapado':
      return `Destapado: ${respuesta}. ¿Lo sabías?`
    case 'sabia':
      return `${respuesta}: lo sabías. Toca para cambiarlo a «No lo sabía»`
    case 'no':
      return `${respuesta}: no lo sabías. Toca para cambiarlo a «Lo sabía»`
    default:
      return `${respuesta} (hueco de ${nivel}, no se tapa en esta sesión)`
  }
}

/** El aviso para el lector de pantalla tras cada paso del estudio (región aria-live). */
export function anuncioEstudio(
  evento: { tipo: 'destapado'; respuesta: string } | { tipo: 'respondido'; respuesta: string; sabia: boolean; quedan: number } | { tipo: 'parrafo'; tapados: number; tema: string | null },
): string {
  if (evento.tipo === 'destapado') return `Destapado: ${evento.respuesta}. ¿Lo sabías?`
  if (evento.tipo === 'respondido') {
    const r = `${evento.respuesta}: ${evento.sabia ? 'lo sabías' : 'no lo sabías'}.`
    return evento.quedan > 0 ? `${r} ${evento.quedan === 1 ? 'Queda 1 hueco' : `Quedan ${evento.quedan} huecos`}.` : `${r} Párrafo terminado: elige la nota y pasa al siguiente.`
  }
  const huecos = evento.tapados === 1 ? '1 hueco tapado' : `${evento.tapados} huecos tapados`
  return `Párrafo nuevo${evento.tema ? ` de ${evento.tema}` : ''}: ${huecos}.`
}

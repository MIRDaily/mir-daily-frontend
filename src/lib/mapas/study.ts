import { plainText } from '@/lib/mapas/export/richtext'

// Modo estudio del editor de mapas (informe 75): las hojas se tapan y se destapan con un clic.
// En una hoja «Faceta: dato» (las del mapa de IA) solo se tapa el dato: la faceta es la pregunta.

// Faceta: hasta 40 caracteres y 4 palabras antes de los dos puntos (la misma regla que usa el
// servidor para las hojas de la IA). «Esto es una frase larga de verdad: …» no es una faceta.
const FACETA = /^([^:]{2,40}):\s*(\S[\s\S]*)$/

/** Texto de una hoja → { faceta, dato }. Sin faceta, `faceta` vacía y todo es dato. */
export function splitFacet(text: string): { faceta: string; dato: string } {
  const t = text.trim()
  const m = FACETA.exec(t)
  if (!m || m[1].trim().split(/\s+/).length > 4) return { faceta: '', dato: t }
  return { faceta: m[1].trim(), dato: m[2].trim() }
}

/** Lo mismo desde el label del nodo (HTML con formato): se trabaja con su texto plano. */
export function splitFacetLabel(label: string): { faceta: string; dato: string } {
  return splitFacet(plainText(label))
}

type StudyNode = { id: string; data: { parentId?: string; childCount?: number } }

/**
 * ¿Se tapa en el modo estudio? Las hojas (sin hijos) que cuelgan de algo: la raíz y los nodos
 * sueltos sin hijos son títulos, no respuestas.
 */
export function isCoverable(n: StudyNode): boolean {
  return !!n.data.parentId && !n.data.childCount
}

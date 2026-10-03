import type { Paragraph } from '@/lib/mapas/export/richtext'

// Maquetación del texto de un nodo: partir en líneas según el ancho disponible. Es independiente
// del formato de salida: recibe una función que mide, y cada pintor (PDF, PNG) pone la suya.

export type FontSpec = { family: string; size: number; bold?: boolean; italic?: boolean }
export type Measure = (text: string, font: FontSpec) => number

export type LineRun = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; width: number }
export type TextLine = { runs: LineRun[]; width: number }

/** Altura de línea del nodo en pantalla (NodeLabel: line-height 1.5). */
export const LINE_HEIGHT = 1.5

export function wrapParagraphs(paragraphs: Paragraph[], maxWidth: number, base: { family: string; size: number }, measure: Measure): TextLine[] {
  const lines: TextLine[] = []
  for (const para of paragraphs) {
    let cur: LineRun[] = []
    let curW = 0
    const flush = () => {
      // Se quitan los espacios sobrantes del final de la línea.
      const last = cur[cur.length - 1]
      if (last) {
        const trimmed = last.text.replace(/\s+$/, '')
        if (trimmed !== last.text) {
          last.text = trimmed
          last.width = measure(trimmed, { ...base, bold: last.bold, italic: last.italic })
          curW = cur.reduce((a, r) => a + r.width, 0)
        }
      }
      lines.push({ runs: cur, width: curW })
      cur = []
      curW = 0
    }
    if (para.length === 0) {
      lines.push({ runs: [], width: 0 })
      continue
    }
    for (const run of para) {
      const tokens = run.text.match(/\S+\s*|\s+/g) ?? []
      for (const tok of tokens) {
        const font = { ...base, bold: run.bold, italic: run.italic }
        const w = measure(tok, font)
        const trimmedW = measure(tok.replace(/\s+$/, ''), font)
        if (curW + trimmedW > maxWidth && cur.length > 0) flush()
        // Una palabra más ancha que la línea se parte por letras.
        if (trimmedW > maxWidth) {
          let chunk = ''
          for (const ch of tok) {
            if (measure(chunk + ch, font) > maxWidth && chunk) {
              cur.push({ text: chunk, bold: run.bold, italic: run.italic, underline: run.underline, strike: run.strike, width: measure(chunk, font) })
              curW += measure(chunk, font)
              flush()
              chunk = ''
            }
            chunk += ch
          }
          if (chunk) {
            cur.push({ text: chunk, bold: run.bold, italic: run.italic, underline: run.underline, strike: run.strike, width: measure(chunk, font) })
            curW += measure(chunk, font)
          }
          continue
        }
        const prev = cur[cur.length - 1]
        if (prev && prev.bold === run.bold && prev.italic === run.italic && prev.underline === run.underline && prev.strike === run.strike) {
          prev.text += tok
          prev.width += w
        } else {
          cur.push({ text: tok, bold: run.bold, italic: run.italic, underline: run.underline, strike: run.strike, width: w })
        }
        curW += w
      }
    }
    flush()
  }
  return lines
}

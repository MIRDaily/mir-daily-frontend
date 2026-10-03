// Texto con formato de un nodo (HTML que deja el editor: <b>, <i>, <u>, <strike>, <br>, <div>…) a una
// lista de párrafos con tramos de estilo uniforme. Sin DOM: se puede usar y probar en Node.

export type Run = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean }
export type Paragraph = Run[]

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decode(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

type Flag = 'bold' | 'italic' | 'underline' | 'strike'
const BLOCK = new Set(['div', 'p', 'li', 'h1', 'h2', 'h3', 'h4'])

export function parseLabel(html: string): Paragraph[] {
  const paragraphs: Paragraph[] = [[]]
  const flags = { bold: 0, italic: 0, underline: 0, strike: 0 }
  const stack: (Flag | null)[] = []
  const newParagraph = () => {
    if (paragraphs[paragraphs.length - 1].length > 0) paragraphs.push([])
  }
  const re = /<\/?([a-z0-9]+)([^>]*)>|([^<]+)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    if (m[3] !== undefined) {
      const text = decode(m[3]).replace(/\s+/g, ' ')
      if (!text) continue
      paragraphs[paragraphs.length - 1].push({
        text,
        bold: flags.bold > 0 || undefined,
        italic: flags.italic > 0 || undefined,
        underline: flags.underline > 0 || undefined,
        strike: flags.strike > 0 || undefined,
      })
      continue
    }
    const tag = m[1].toLowerCase()
    const closing = m[0][1] === '/'
    const kind: Flag | null =
      tag === 'b' || tag === 'strong'
        ? 'bold'
        : tag === 'i' || tag === 'em'
          ? 'italic'
          : tag === 'u'
            ? 'underline'
            : tag === 's' || tag === 'strike' || tag === 'del'
              ? 'strike'
              : null
    if (tag === 'br') {
      paragraphs.push([])
    } else if (BLOCK.has(tag)) {
      newParagraph()
    } else if (!closing) {
      // Etiquetas con estilo en línea (<span style="font-weight:bold">…): se entienden las básicas.
      const style = /style\s*=\s*"([^"]*)"/i.exec(m[2])?.[1] ?? ''
      let k: Flag | null = kind
      if (!k && /font-weight\s*:\s*(bold|[6-9]00)/i.test(style)) k = 'bold'
      else if (!k && /font-style\s*:\s*italic/i.test(style)) k = 'italic'
      else if (!k && /text-decoration[^;]*underline/i.test(style)) k = 'underline'
      else if (!k && /text-decoration[^;]*line-through/i.test(style)) k = 'strike'
      stack.push(k)
      if (k) flags[k]++
      continue
    }
    if (closing && !BLOCK.has(tag) && tag !== 'br') {
      const k = stack.pop()
      if (k) flags[k]--
    }
  }
  const out = paragraphs.filter((p) => p.length > 0)
  return out.length > 0 ? out : [[]]
}

/** Texto plano (sin formato), para títulos de página y esquemas. */
export function plainText(html: string): string {
  return parseLabel(html)
    .map((p) => p.map((r) => r.text).join('').trim())
    .filter(Boolean)
    .join(' ')
}

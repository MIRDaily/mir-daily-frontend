// Saneado del texto con formato de un nodo (`data.label`), que se pinta como HTML.
//
// El label es entrada no fiable: viene de la BD, de un .json importado (que puede haber escrito
// otra persona) o de la IA. No se filtra lo malo: se REESCRIBE el HTML entero desde una lista
// blanca. Solo salen las etiquetas que deja el editor (contentEditable + execCommand de
// TextFormatPopup: <b>, <i>, <u>, <strike>, <br>, <div>, <span style> al pegar…), sin más
// atributo que un `style` con propiedades de texto, y el texto siempre escapado. Sin DOM: se usa
// igual en el navegador y en los tests de Node.

/** Etiquetas que se conservan tal cual. */
const INLINE = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'span', 'sub', 'sup'])
const BLOCK = new Set(['div', 'p'])
/** Bloques que se pegan de otras webs: pasan a <div> para no perder los saltos de línea. */
const AS_DIV = new Set([
  'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'tr', 'dt', 'dd',
  'section', 'article', 'header', 'footer', 'aside', 'figcaption',
])
/** Su contenido no es texto del nodo: se descarta entero. */
const DROP_CONTENT = new Set([
  'script', 'style', 'textarea', 'title', 'iframe', 'noscript', 'template', 'xmp',
  'noembed', 'noframes', 'object', 'svg', 'math', 'select', 'head',
])

/** Propiedades de `style` que se conservan (las que deja el editor o un pegado normal). */
const STYLE_PROPS = new Set([
  'font-weight', 'font-style', 'text-decoration', 'text-decoration-line', 'color',
  'background-color', 'font-size', 'font-family', 'text-align',
])
const STYLE_VALUE = /^[\w\s#.,%()'+-]{1,120}$/
const STYLE_FUNCS = new Set(['rgb', 'rgba', 'hsl', 'hsla'])

const ATTR = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
const TOKEN =
  /<!--[\s\S]*?(?:-->|$)|<[!?][^>]*>?|<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>|<\/[^>]*>?|<|[^<]+/g

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decodeAttr(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
    }
    return NAMED[e.toLowerCase()] ?? m
  })
}

/** Texto → HTML seguro. Las entidades ya escritas (`&nbsp;`, `&lt;`…) se respetan. */
function escapeText(s: string): string {
  return s
    .replace(/&(?!(?:#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});)/gi, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function sanitizeStyle(raw: string): string {
  const out: string[] = []
  for (const decl of decodeAttr(raw).split(';')) {
    const colon = decl.indexOf(':')
    if (colon < 0) continue
    const prop = decl.slice(0, colon).trim().toLowerCase()
    // Comillas dobles → simples: el atributo se reescribe entre comillas dobles.
    const value = decl.slice(colon + 1).trim().replace(/"/g, "'")
    if (!STYLE_PROPS.has(prop) || !STYLE_VALUE.test(value)) continue
    // Sin `\` ni `:` no hay escapes ni esquemas; de funciones, solo colores (fuera url(), expression()…).
    const funcs = Array.from(value.matchAll(/([a-z-]+)\s*\(/gi), (m) => m[1].toLowerCase())
    if (funcs.some((f) => !STYLE_FUNCS.has(f))) continue
    if (value.includes('(') && funcs.length === 0) continue
    out.push(`${prop}: ${value}`)
  }
  return out.join('; ')
}

function styleOf(attrs: string): string {
  for (const m of attrs.matchAll(ATTR)) {
    if (m[1].toLowerCase() !== 'style') continue
    return sanitizeStyle(m[2] ?? m[3] ?? m[4] ?? '')
  }
  return ''
}

/**
 * HTML de un nodo → HTML seguro con el mismo aspecto. Idempotente: sanear dos veces da lo mismo.
 * Lo que no está en la lista blanca se desenvuelve (queda su texto), salvo el contenido de
 * <script>, <style> y similares, que se tira.
 */
export function sanitizeLabelHtml(html: string): string {
  if (typeof html !== 'string' || html === '') return ''
  let out = ''
  const stack: string[] = []
  TOKEN.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TOKEN.exec(html))) {
    const token = m[0]
    if (m[2] === undefined) {
      // Comentarios, <!doctype>, <?…?> y cierres raros se tiran; el resto es texto.
      if (token[0] !== '<' || token === '<') out += escapeText(token)
      continue
    }
    const name = m[2].toLowerCase()
    const closing = m[1] === '/'
    if (!closing && DROP_CONTENT.has(name)) {
      const end = new RegExp(`</${name}\\s*>`, 'gi')
      end.lastIndex = TOKEN.lastIndex
      const found = end.exec(html)
      TOKEN.lastIndex = found ? end.lastIndex : html.length
      continue
    }
    if (name === 'br') {
      if (!closing) out += '<br>'
      continue
    }
    const tag = INLINE.has(name) || BLOCK.has(name) ? name : AS_DIV.has(name) ? 'div' : null
    if (!tag) continue
    if (closing) {
      const at = stack.lastIndexOf(tag)
      if (at < 0) continue
      while (stack.length > at) out += `</${stack.pop()}>`
      continue
    }
    const style = styleOf(m[3])
    out += style ? `<${tag} style="${style}">` : `<${tag}>`
    stack.push(tag)
  }
  while (stack.length) out += `</${stack.pop()}>`
  return out
}

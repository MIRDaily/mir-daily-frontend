import { avisoImagenes, ExtractError, FACTOR_LECTURA, type Extraido, type Seccion } from '../types'
import { limpiarTexto, tituloDeArchivo } from './limpiar'

type Opciones = { maxChars: number }

const BLOQUES = new Set(['P', 'LI', 'TR', 'BLOCKQUOTE', 'PRE'])

/** Texto de un Word (.docx) con sus títulos como secciones. */
export async function extraerDocx(file: File, { maxChars }: Opciones): Promise<Extraido> {
  const mammoth = await import('mammoth')
  let html: string
  let imagenes = 0
  try {
    // El HTML solo se lee con DOMParser (no se inserta en la página): no ejecuta nada.
    // Las imágenes no se cargan (por defecto mammoth las incrusta en base64: 27 MB de fotos
    // eran ~36 MB de texto en memoria que luego se tiraba); solo se cuentan para avisar.
    const convertImage = mammoth.images.imgElement(async () => {
      imagenes += 1
      return { src: '' }
    })
    html = (await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, { convertImage })).value
  } catch {
    throw new ExtractError('No se pudo leer el documento Word. Comprueba que es un .docx válido.')
  }

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const secciones: Seccion[] = []
  let titulo: string | undefined
  let lineas: string[] = []
  let acumulado = 0
  let truncado = false
  const tope = maxChars * FACTOR_LECTURA

  const cerrar = () => {
    const texto = limpiarTexto(lineas.join('\n'))
    if (texto.length >= 10 || (titulo && texto.length > 0)) secciones.push({ titulo, texto })
    lineas = []
  }

  const recorrer = (nodo: Element) => {
    for (const hijo of Array.from(nodo.children)) {
      if (truncado) return
      const etiqueta = hijo.tagName
      if (/^H[1-6]$/.test(etiqueta)) {
        cerrar()
        titulo = limpiarTexto(hijo.textContent ?? '').slice(0, 100) || undefined
      } else if (etiqueta === 'TR') {
        const celdas = Array.from(hijo.children).map((c) => limpiarTexto(c.textContent ?? ''))
        const fila = celdas.filter(Boolean).join(' | ')
        if (fila) lineas.push(fila)
        acumulado += fila.length
      } else if (BLOQUES.has(etiqueta)) {
        const t = limpiarTexto(hijo.textContent ?? '')
        if (t) lineas.push(t)
        acumulado += t.length
      } else {
        recorrer(hijo) // UL, OL, TABLE, TBODY, DIV…
      }
      if (acumulado > tope) truncado = true
    }
  }
  recorrer(doc.body)
  cerrar()

  const total = secciones.reduce((s, x) => s + x.texto.length, 0)
  if (total < 50) throw new ExtractError('El documento no tiene texto suficiente.')

  const avisos: string[] = []
  if (truncado) avisos.push('El documento es muy largo: solo se ha leído la primera parte.')
  const aviso = avisoImagenes(imagenes)
  if (aviso) avisos.push(aviso)
  // Un Word sin títulos se manda en secciones de tamaño razonable: el servidor
  // las reagrupa, pero así el límite de sección no corta un párrafo largo.
  return {
    titulo: tituloDeArchivo(file.name),
    secciones,
    // Word no tiene páginas fijas; se estima (≈ 2.500 caracteres por página).
    paginas: Math.max(1, Math.round(total / 2500)),
    caracteres: total,
    avisos,
    truncado,
  }
}

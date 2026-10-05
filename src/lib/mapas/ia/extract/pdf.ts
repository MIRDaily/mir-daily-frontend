import { ExtractError, FACTOR_LECTURA, type Extraido } from '../types'
import { limpiarTexto, quitarRepetidas, tituloDeArchivo } from './limpiar'

type Opciones = { maxChars: number; onProgreso?: (hecho: number, total: number) => void }

/** Texto de un PDF, una sección por página. Solo PDFs con capa de texto (sin OCR). */
export async function extraerPdf(file: File, { maxChars, onProgreso }: Opciones): Promise<Extraido> {
  // Carga perezosa: pdf.js pesa y solo se necesita al usar esta función.
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

  let pdf
  try {
    // isEvalSupported:false → sin generación de código en el visor (hubo fallos
    // graves de ejecución en versiones antiguas); sin XFA ni scripts.
    pdf = await pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      isEvalSupported: false,
      enableXfa: false,
      verbosity: 0,
    }).promise
  } catch (e) {
    const nombre = e instanceof Error ? e.name : ''
    if (nombre === 'PasswordException') throw new ExtractError('El PDF está protegido con contraseña.')
    throw new ExtractError('No se pudo leer el PDF. Puede estar dañado.')
  }

  const topeLectura = maxChars * FACTOR_LECTURA
  const paginas: string[] = []
  let acumulado = 0
  let truncado = false

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const contenido = await page.getTextContent()
    let texto = ''
    let ultimaY: number | null = null
    for (const item of contenido.items) {
      if (!('str' in item)) continue
      const y = item.transform[5]
      if (ultimaY !== null && Math.abs(y - ultimaY) > 2) texto += '\n'
      else if (texto && !texto.endsWith(' ') && !texto.endsWith('\n')) texto += ' '
      texto += item.str
      ultimaY = y
    }
    page.cleanup()
    const limpio = limpiarTexto(texto)
    paginas.push(limpio)
    acumulado += limpio.length
    onProgreso?.(i, pdf.numPages)
    if (acumulado > topeLectura && i < pdf.numPages) {
      truncado = true
      break
    }
  }

  const conTexto = paginas.filter((p) => p.length >= 40).length
  if (paginas.length > 0 && conTexto / paginas.length < 0.3) {
    throw new ExtractError(
      'Este PDF parece escaneado (casi no tiene texto seleccionable). De momento solo se admiten PDF con texto.',
    )
  }

  let titulo = ''
  try {
    const meta = await pdf.getMetadata()
    const t = (meta.info as { Title?: unknown } | undefined)?.Title
    if (typeof t === 'string') titulo = limpiarTexto(t).slice(0, 120)
  } catch {
    /* sin metadatos */
  }

  const limpias = quitarRepetidas(paginas)
  const secciones = limpias.map((texto) => ({ texto })).filter((s) => s.texto.length >= 10)
  const avisos: string[] = []
  if (truncado) avisos.push('El documento es muy largo: solo se ha leído la primera parte.')
  return {
    titulo: titulo.length >= 4 ? titulo : tituloDeArchivo(file.name),
    secciones,
    paginas: pdf.numPages,
    caracteres: secciones.reduce((s, x) => s + x.texto.length, 0),
    avisos,
    truncado,
  }
}

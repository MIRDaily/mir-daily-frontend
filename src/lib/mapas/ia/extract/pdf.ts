import { ExtractError, FACTOR_LECTURA, type Extraido } from '../types'
import { limpiarTexto, quitarRepetidas, tituloDeArchivo } from './limpiar'
import { cajasDibujadas, componerTexto, detectarTablas, type ItemTexto } from './tablasPdf'
import { detectarEncabezados, type TrozoPdf } from './encabezados'

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
  // Tamaño y letra de cada trozo, para sacar los títulos si el PDF no trae marcadores.
  const trozos: TrozoPdf[][] = []
  let tablas = 0
  let acumulado = 0
  let truncado = false

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const contenido = await page.getTextContent()
    const items = contenido.items.filter((it): it is ItemTexto & typeof it => 'str' in it)
    trozos.push(
      items.map((it) => ({
        str: it.str,
        alto: Math.hypot(it.transform[2], it.transform[3]),
        fuente: (it as { fontName?: string }).fontName ?? '',
        y: it.transform[5],
      })),
    )
    // Tablas con su estructura (rejilla dibujada en la página): salen como filas «celda | celda»
    // en vez de columna tras columna. Si algo falla, el texto de siempre.
    let detectadas: ReturnType<typeof detectarTablas> = { tablas: [], deTabla: items.map(() => -1) }
    try {
      const ops = await page.getOperatorList()
      detectadas = detectarTablas(cajasDibujadas(ops.fnArray, ops.argsArray, pdfjs.OPS), items)
    } catch {
      /* sin tablas: texto plano */
    }
    tablas += detectadas.tablas.length
    const texto = componerTexto(items, detectadas.tablas, detectadas.deTabla)
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

  // Marcadores (el índice del propio PDF): para elegir qué parte usar. Si algo falla, sin ellos.
  const marcadores: { titulo: string; pagina: number; nivel: 1 | 2 }[] = []
  try {
    const outline = (await pdf.getOutline()) ?? []
    const paginaDe = async (dest: unknown): Promise<number | null> => {
      const explicito = typeof dest === 'string' ? await pdf.getDestination(dest) : dest
      if (!Array.isArray(explicito) || !explicito[0]) return null
      const ref = explicito[0]
      const indice = typeof ref === 'number' ? ref : await pdf.getPageIndex(ref)
      return Number.isInteger(indice) ? indice + 1 : null
    }
    const recorrer = async (items: typeof outline, nivel: 1 | 2) => {
      for (const it of items.slice(0, 300)) {
        const pagina = await paginaDe(it.dest).catch(() => null)
        const titulo = limpiarTexto(it.title ?? '').slice(0, 120)
        if (pagina && titulo && pagina <= paginas.length) marcadores.push({ titulo, pagina, nivel })
        if (nivel === 1 && it.items?.length) await recorrer(it.items, 2)
      }
    }
    await recorrer(outline, 1)
  } catch {
    /* sin marcadores */
  }

  // Títulos por la letra (apartados de un tema suelto): para el índice de «Qué parte usar». Si algo falla, sin ellos.
  let encabezados: ReturnType<typeof detectarEncabezados> = []
  try {
    encabezados = detectarEncabezados(trozos)
  } catch {
    /* sin títulos */
  }

  const limpias = quitarRepetidas(paginas)
  // Cada página lleva su número: el servidor lo devuelve como página de origen de cada nodo.
  const secciones = limpias.map((texto, i) => ({ texto, pagina: i + 1 })).filter((s) => s.texto.length >= 10)
  const avisos: string[] = []
  if (truncado) avisos.push('El documento es muy largo: solo se ha leído la primera parte.')
  return {
    titulo: titulo.length >= 4 ? titulo : tituloDeArchivo(file.name),
    secciones,
    paginas: pdf.numPages,
    tablas,
    caracteres: secciones.reduce((s, x) => s + x.texto.length, 0),
    avisos,
    truncado,
    ...(marcadores.length >= 2 ? { marcadores } : {}),
    ...(encabezados.length >= 2 ? { encabezados } : {}),
  }
}

import { ExtractError, FACTOR_LECTURA, type Extraido, type Seccion } from '../types'
import { limpiarTexto, tituloDeArchivo } from './limpiar'

type Opciones = { maxChars: number }

const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

// Un .pptx es un ZIP: se vigila que no sea una "bomba" (muchas entradas o XML
// gigantes). Solo se leen las diapositivas y sus notas, nunca imágenes ni vídeo.
const MAX_ENTRADAS = 4000
const MAX_XML_BYTES = 8_000_000

// Marcadores que no son contenido: número de diapositiva, pie y fecha.
const PH_IGNORADOS = new Set(['sldNum', 'ftr', 'dt', 'hdr'])
const PH_TITULO = new Set(['title', 'ctrTitle'])

type Zip = import('jszip')

/** Título de la portada como título del mapa; en MAYÚSCULAS se pasa a frase normal. */
function tituloDePortada(t: string): string {
  const limpio = t.replace(/\s+/g, ' ').trim().slice(0, 120)
  if (limpio.length < 4) return ''
  if (limpio !== limpio.toUpperCase()) return limpio
  const minus = limpio.toLowerCase()
  return minus.charAt(0).toUpperCase() + minus.slice(1)
}

async function leerXml(zip: Zip, ruta: string): Promise<Document | null> {
  const entrada = zip.file(ruta)
  if (!entrada) return null
  const tam = (entrada as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize
  if (typeof tam === 'number' && tam > MAX_XML_BYTES) return null
  const texto = await entrada.async('string')
  if (texto.length > MAX_XML_BYTES) return null
  const doc = new DOMParser().parseFromString(texto, 'application/xml')
  return doc.getElementsByTagName('parsererror').length ? null : doc
}

/** Párrafos (a:p) de un contenedor, uniendo sus fragmentos de texto (a:t). */
function parrafos(raiz: Element): string[] {
  const out: string[] = []
  for (const p of Array.from(raiz.getElementsByTagNameNS(NS_A, 'p'))) {
    const t = Array.from(p.getElementsByTagNameNS(NS_A, 't'))
      .map((x) => x.textContent ?? '')
      .join('')
    const limpio = limpiarTexto(t)
    if (limpio) out.push(limpio)
  }
  return out
}

function relaciones(doc: Document | null): Map<string, string> {
  const mapa = new Map<string, string>()
  if (!doc) return mapa
  for (const r of Array.from(doc.getElementsByTagName('Relationship'))) {
    const id = r.getAttribute('Id')
    const destino = r.getAttribute('Target')
    if (id && destino) mapa.set(id, destino)
  }
  return mapa
}

/** Ruta absoluta dentro del zip de un destino relativo (`../slides/slide1.xml`). */
function resolver(base: string, destino: string): string {
  if (destino.startsWith('/')) return destino.slice(1)
  const partes = base.split('/').slice(0, -1)
  for (const seg of destino.split('/')) {
    if (seg === '..') partes.pop()
    else if (seg !== '.') partes.push(seg)
  }
  return partes.join('/')
}

/** Texto de un PowerPoint (.pptx): una sección por diapositiva, con su título y notas. */
export async function extraerPptx(file: File, { maxChars }: Opciones): Promise<Extraido> {
  const JSZip = (await import('jszip')).default
  let zip: Zip
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer())
  } catch {
    throw new ExtractError('No se pudo leer la presentación. Comprueba que es un .pptx válido.')
  }
  if (Object.keys(zip.files).length > MAX_ENTRADAS) throw new ExtractError('La presentación tiene demasiados elementos.')

  // Orden real de las diapositivas: presentation.xml + sus relaciones (el número
  // del fichero slideN.xml no tiene por qué coincidir con el orden).
  const pres = await leerXml(zip, 'ppt/presentation.xml')
  const relPres = relaciones(await leerXml(zip, 'ppt/_rels/presentation.xml.rels'))
  let rutas: string[] = []
  if (pres) {
    for (const s of Array.from(pres.getElementsByTagNameNS(NS_P, 'sldId'))) {
      const destino = relPres.get(s.getAttributeNS(NS_R, 'id') ?? '')
      if (destino) rutas.push(resolver('ppt/presentation.xml', destino))
    }
  }
  if (!rutas.length) {
    rutas = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
  }
  if (!rutas.length) throw new ExtractError('La presentación no tiene diapositivas.')

  const secciones: Seccion[] = []
  // Título de la portada: el nombre del archivo suele ser «Clase ITU» o «tema3_v2».
  let tituloPortada = ''
  const tope = maxChars * FACTOR_LECTURA
  let acumulado = 0
  let truncado = false

  for (const ruta of rutas) {
    const doc = await leerXml(zip, ruta)
    if (!doc) continue

    let titulo = ''
    const cuerpo: string[] = []
    for (const sp of Array.from(doc.getElementsByTagNameNS(NS_P, 'sp'))) {
      const ph = sp.getElementsByTagNameNS(NS_P, 'ph')[0]
      const tipo = ph?.getAttribute('type') ?? ''
      if (PH_IGNORADOS.has(tipo)) continue
      const lineas = parrafos(sp)
      if (!lineas.length) continue
      if (PH_TITULO.has(tipo) && !titulo) titulo = lineas.join(' ')
      else cuerpo.push(...lineas)
    }
    // Tablas (a:tbl): una línea por fila, celdas separadas por " | ".
    for (const fila of Array.from(doc.getElementsByTagNameNS(NS_A, 'tr'))) {
      const celdas = Array.from(fila.getElementsByTagNameNS(NS_A, 'tc')).map((c) => parrafos(c).join(' ')).filter(Boolean)
      if (celdas.length) cuerpo.push(celdas.join(' | '))
    }

    // Notas del orador: en clases y seminarios suelen llevar la explicación.
    const relSlide = relaciones(await leerXml(zip, ruta.replace(/([^/]+)\.xml$/, '_rels/$1.xml.rels')))
    for (const destino of relSlide.values()) {
      if (!/notesSlide/.test(destino)) continue
      const notas = await leerXml(zip, resolver(ruta, destino))
      if (!notas) continue
      const lineas: string[] = []
      for (const sp of Array.from(notas.getElementsByTagNameNS(NS_P, 'sp'))) {
        const tipo = sp.getElementsByTagNameNS(NS_P, 'ph')[0]?.getAttribute('type') ?? ''
        if (tipo === 'body') lineas.push(...parrafos(sp))
      }
      if (lineas.length) cuerpo.push(`Notas: ${lineas.join(' ')}`)
    }

    if (ruta === rutas[0]) tituloPortada = titulo
    const texto = limpiarTexto(cuerpo.join('\n'))
    if (!titulo && texto.length < 10) continue
    secciones.push({ titulo: titulo.slice(0, 100) || undefined, texto: texto || titulo })
    acumulado += texto.length + titulo.length
    if (acumulado > tope && ruta !== rutas[rutas.length - 1]) {
      truncado = true
      break
    }
  }

  const total = secciones.reduce((s, x) => s + x.texto.length + (x.titulo?.length ?? 0), 0)
  if (total < 50) throw new ExtractError('La presentación no tiene texto suficiente (¿son solo imágenes?).')

  const avisos: string[] = []
  if (truncado) avisos.push('La presentación es muy larga: solo se han leído las primeras diapositivas.')
  return {
    titulo: tituloDePortada(tituloPortada) || tituloDeArchivo(file.name),
    secciones,
    paginas: rutas.length,
    unidad: 'diapositiva',
    caracteres: total,
    avisos,
    truncado,
  }
}

import { ExtractError, MAX_ARCHIVO_BYTES, type Extraido } from '../types'

export type OpcionesExtraccion = { maxChars: number; onProgreso?: (hecho: number, total: number) => void }

export const FORMATOS_ACEPTADOS = '.pdf,.docx,.pptx'

/** Lee un PDF, Word o PowerPoint y devuelve su texto por secciones. */
export async function extraerDocumento(file: File, opciones: OpcionesExtraccion): Promise<Extraido> {
  if (file.size === 0) throw new ExtractError('El archivo está vacío.')
  if (file.size > MAX_ARCHIVO_BYTES) {
    throw new ExtractError(`El archivo pesa demasiado (máximo ${Math.round(MAX_ARCHIVO_BYTES / 1_000_000)} MB).`)
  }
  const nombre = file.name.toLowerCase()
  if (nombre.endsWith('.pdf')) return (await import('./pdf')).extraerPdf(file, opciones)
  if (nombre.endsWith('.docx')) return (await import('./docx')).extraerDocx(file, opciones)
  if (nombre.endsWith('.pptx')) return (await import('./pptx')).extraerPptx(file, opciones)
  if (/\.(doc|ppt|odt|odp|rtf)$/.test(nombre)) {
    throw new ExtractError('Formato antiguo. Guárdalo como .docx o .pptx (o expórtalo a PDF) y vuelve a intentarlo.')
  }
  throw new ExtractError('Formato no admitido. Usa un PDF, un Word (.docx) o un PowerPoint (.pptx).')
}

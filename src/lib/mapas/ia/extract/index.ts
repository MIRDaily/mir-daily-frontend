import { ExtractError, MAX_ARCHIVO_BYTES, MAX_OFFICE_BYTES, type Extraido } from '../types'
import { mensajeFormato } from './formatos'

export type OpcionesExtraccion = { maxChars: number; onProgreso?: (hecho: number, total: number) => void }

export const FORMATOS_ACEPTADOS = '.pdf,.docx,.pptx'

/** Lee un PDF, Word o PowerPoint y devuelve su texto por secciones. */
export async function extraerDocumento(file: File, opciones: OpcionesExtraccion): Promise<Extraido> {
  if (file.size === 0) throw new ExtractError('El archivo está vacío.')
  const nombre = file.name.toLowerCase()
  const tope = /\.(docx|pptx)$/.test(nombre) ? MAX_OFFICE_BYTES : MAX_ARCHIVO_BYTES
  if (file.size > tope) {
    throw new ExtractError(`El archivo pesa demasiado (máximo ${Math.round(tope / 1_000_000)} MB).`)
  }
  if (nombre.endsWith('.pdf')) return (await import('./pdf')).extraerPdf(file, opciones)
  if (nombre.endsWith('.docx')) return (await import('./docx')).extraerDocx(file, opciones)
  if (nombre.endsWith('.pptx')) return (await import('./pptx')).extraerPptx(file, opciones)
  // .ppt, .doc, LibreOffice, Keynote…: qué es y cómo pasarlo a un formato que se lea.
  throw new ExtractError(mensajeFormato(nombre))
}

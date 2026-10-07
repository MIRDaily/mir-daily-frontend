// Qué decir cuando el archivo no es un PDF, un .docx o un .pptx. El navegador solo sabe leer los
// formatos abiertos (un ZIP con XML dentro); los binarios antiguos (.ppt, .doc) y los de otros
// programas no. En vez de un «formato no admitido» a secas, se dice qué es y cómo pasarlo a uno que
// sí se lea. Sin imports: se prueba con `npm test`.

const COMO_GUARDAR = 'Archivo → Guardar como'

const MENSAJES: Record<string, string> = {
  ppt:
    `Es un PowerPoint antiguo (.ppt) y solo se puede leer el formato nuevo. Ábrelo en PowerPoint o LibreOffice Impress, ` +
    `${COMO_GUARDAR} → «Presentación de PowerPoint (.pptx)», y vuelve a elegirlo. ` +
    'También vale exportarlo a PDF, pero así se pierden las notas del ponente.',
  pps:
    `Es una presentación de PowerPoint antigua (.pps). Ábrela en PowerPoint o LibreOffice Impress, ${COMO_GUARDAR} → ` +
    '«Presentación de PowerPoint (.pptx)», y vuelve a elegirla.',
  ppsx:
    `Es una presentación de PowerPoint en modo pase (.ppsx). Ábrela en PowerPoint, ${COMO_GUARDAR} → ` +
    '«Presentación de PowerPoint (.pptx)», y vuelve a elegirla.',
  doc:
    `Es un Word antiguo (.doc) y solo se puede leer el formato nuevo. Ábrelo en Word o LibreOffice Writer, ` +
    `${COMO_GUARDAR} → «Documento de Word (.docx)», y vuelve a elegirlo. También vale exportarlo a PDF.`,
  rtf: `Es un documento .rtf. Ábrelo en Word o LibreOffice Writer, ${COMO_GUARDAR} → «Documento de Word (.docx)», y vuelve a elegirlo.`,
  odt: `Es un documento de LibreOffice (.odt). En LibreOffice Writer, ${COMO_GUARDAR} → «Word 2007-365 (.docx)», y vuelve a elegirlo.`,
  odp: `Es una presentación de LibreOffice (.odp). En LibreOffice Impress, ${COMO_GUARDAR} → «PowerPoint 2007-365 (.pptx)», y vuelve a elegirla.`,
  key: 'Es una presentación de Keynote. En Keynote, Archivo → Exportar a → PowerPoint (.pptx) o PDF, y vuelve a elegirla.',
  pages: 'Es un documento de Pages. En Pages, Archivo → Exportar a → Word (.docx) o PDF, y vuelve a elegirlo.',
}

const GENERICO = 'Formato no admitido. Usa un PDF con texto, un Word (.docx) o un PowerPoint (.pptx).'

/** Mensaje para un archivo que no se puede leer, según su extensión. */
export function mensajeFormato(nombre: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(nombre.trim())?.[1]?.toLowerCase() ?? ''
  return MENSAJES[ext] ?? GENERICO
}

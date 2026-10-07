// Mensaje para los archivos que no se pueden leer (.ppt, .doc, LibreOffice, Keynote…).
//
//   npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mensajeFormato } from '@/lib/mapas/ia/extract/formatos'

test('mensajeFormato: dice qué es y cómo pasarlo a un formato que se lea', () => {
  assert.match(mensajeFormato('Clase  ITU.ppt'), /PowerPoint antiguo \(\.ppt\).*Guardar como.*\.pptx.*notas del ponente/)
  assert.match(mensajeFormato('TEMA.PPT'), /PowerPoint antiguo/)
  assert.match(mensajeFormato('apuntes.doc'), /Word antiguo \(\.doc\).*\.docx/)
  assert.match(mensajeFormato('clase.odp'), /LibreOffice.*\.pptx/)
  assert.match(mensajeFormato('notas.odt'), /LibreOffice.*\.docx/)
  assert.match(mensajeFormato('charla.key'), /Keynote/)
  assert.match(mensajeFormato('foto.jpg'), /^Formato no admitido/)
  assert.match(mensajeFormato('sin-extension'), /^Formato no admitido/)
})

import { isGraphDoc, sanitizeGraph, type GraphDoc, type StoredDoc } from '@/lib/mapas/graph'
import { sanitizeDoc } from '@/lib/mapas/tree'

// Archivo de intercambio de un mapa (.json): una cabecera para reconocerlo y el
// documento tal cual lo guarda la base de datos, que puede ser
//   · grafo (versión 2): lo que exporta el editor, con posiciones y estilos;
//   · árbol (versión 1): `{ nodes: [{ id, parentId, text, category }] }`, la forma
//     sencilla de escribir un mapa a mano o de generarlo con IA.
// Se valida como entrada no fiable: se repara lo reparable y se rechaza el resto.

export const MAP_FILE_FORMAT = 'mirdaily-mindmap'
export const MAP_FILE_MAX_BYTES = 2_000_000
export const MAP_FILE_MAX_NODES = 5000

export type MapFile = {
  format: typeof MAP_FILE_FORMAT
  version: 1
  title: string
  exportedAt: string
  doc: StoredDoc
}

export function serializeMap(title: string, doc: StoredDoc, now = new Date()): string {
  const file: MapFile = {
    format: MAP_FILE_FORMAT,
    version: 1,
    title,
    exportedAt: now.toISOString(),
    doc,
  }
  return JSON.stringify(file, null, 2)
}

export class MapFileError extends Error {}

function titleOf(doc: StoredDoc): string {
  const first = doc.nodes[0] as { text?: string; data?: { label?: string } } | undefined
  const text = first?.text ?? first?.data?.label ?? ''
  return text.trim().slice(0, 200) || 'Mapa importado'
}

/** Acepta el archivo completo o un documento suelto (árbol o grafo). */
export function parseMapFile(text: string): { title: string; doc: StoredDoc } {
  if (text.length > MAP_FILE_MAX_BYTES) throw new MapFileError('El archivo es demasiado grande.')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new MapFileError('El archivo no es un JSON válido.')
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new MapFileError('El archivo no contiene un mapa.')
  }
  const obj = raw as Record<string, unknown>

  const isWrapped = obj.format === MAP_FILE_FORMAT
  if (obj.format !== undefined && !isWrapped) {
    throw new MapFileError('El archivo no es un mapa de MIRDaily.')
  }
  const docRaw = isWrapped ? obj.doc : obj
  const nodes = docRaw && typeof docRaw === 'object' ? (docRaw as { nodes?: unknown }).nodes : null
  if (!Array.isArray(nodes) || nodes.length === 0) throw new MapFileError('El mapa no tiene nodos.')
  if (nodes.length > MAP_FILE_MAX_NODES) {
    throw new MapFileError(`El mapa tiene demasiados nodos (máximo ${MAP_FILE_MAX_NODES}).`)
  }

  const doc: StoredDoc = isGraphDoc(docRaw) ? (sanitizeGraph(docRaw) as GraphDoc) : sanitizeDoc(docRaw)
  const title =
    typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim().slice(0, 200) : titleOf(doc)
  return { title, doc }
}

/** Nombre de archivo seguro a partir del título. */
export function fileNameFor(title: string, ext: string): string {
  const safe = title.trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'mapa-mental'
  return `${safe}.${ext}`
}

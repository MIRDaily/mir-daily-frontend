import type { MapTable } from '@/lib/mapas/table'
import type { NodoIA } from '@/lib/mapas/ia/revision'

// Modelo del mapa mental: un ÁRBOL de nodos tipados, no un grafo libre.
//
// Es a propósito: el mismo formato sirve para el editor manual y, más
// adelante, para lo que devuelva la IA al leer un documento (JSON con este
// esquema). Las posiciones NO se guardan: las calcula `layout.ts` a partir de
// la estructura, así un mapa generado y uno dibujado a mano se pintan igual.

export type MapCategoryId =
  | 'general'
  | 'definicion'
  | 'etiologia'
  | 'clinica'
  | 'diagnostico'
  | 'tratamiento'
  | 'perla'

export type MapCategory = {
  id: MapCategoryId
  label: string
  /** Color de acento: borde, línea y chip. */
  color: string
  /** Fondo suave del nodo. */
  soft: string
}

export const MAP_CATEGORIES: Record<MapCategoryId, MapCategory> = {
  general: { id: 'general', label: 'General', color: '#7D8A96', soft: '#F1F3F5' },
  definicion: { id: 'definicion', label: 'Definición', color: '#6E9BC5', soft: '#EAF2F9' },
  etiologia: { id: 'etiologia', label: 'Etiología', color: '#9B86BD', soft: '#F1ECF7' },
  clinica: { id: 'clinica', label: 'Clínica', color: '#E8A598', soft: '#FCEFEC' },
  diagnostico: { id: 'diagnostico', label: 'Diagnóstico', color: '#D9A441', soft: '#FBF3E1' },
  tratamiento: { id: 'tratamiento', label: 'Tratamiento', color: '#8BA888', soft: '#EDF3EC' },
  perla: { id: 'perla', label: 'Perla MIR', color: '#D4667A', soft: '#FAEAED' },
}

export const MAP_CATEGORY_LIST: MapCategory[] = Object.values(MAP_CATEGORIES)

export type MapNode = {
  id: string
  /** null solo en la raíz. */
  parentId: string | null
  text: string
  category: MapCategoryId
  collapsed?: boolean
  /** Nodo tabla (ver `table.ts`). Su título es `text`. */
  table?: MapTable
  /** Generado con IA: anclaje, página de origen y revisión (ver `ia/revision.ts`). */
  ia?: NodoIA
}

export type MapDoc = {
  version: 1
  /** El orden del array es el orden de los hermanos. */
  nodes: MapNode[]
}

/** Número de atajo (1–7) de cada categoría: su posición en el panel. */
export function categoryNumber(id: MapCategoryId): number {
  return MAP_CATEGORY_LIST.findIndex((c) => c.id === id) + 1
}

/** Categoría que corresponde a una tecla de dígito ('1'..'7'); null si no hay. */
export function categoryForKey(key: string): MapCategoryId | null {
  if (!/^[1-9]$/.test(key)) return null
  return MAP_CATEGORY_LIST[Number(key) - 1]?.id ?? null
}

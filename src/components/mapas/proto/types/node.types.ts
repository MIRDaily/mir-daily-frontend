import type { Node } from '@xyflow/react'
import type { MapTable } from '@/lib/mapas/table'
import type { NodoIA } from '@/lib/mapas/ia/revision'

export type NodeShape = 'rectangle' | 'pill' | 'circle' | 'diamond'

export interface NodeStyle {
  color: string
  borderColor: string
  borderWidth: number
  glowColor: string
  glowIntensity: number
  shape: NodeShape
  textColor: string
  fontSize: number
  fontFamily: string
  textAlign: 'left' | 'center' | 'right'
}

export interface NodeData extends Record<string, unknown> {
  label: string
  style: NodeStyle
  isEditing: boolean
  isFocused: boolean
  isNew: boolean
  isRemoving: boolean
  parentId?: string
  /** Rama plegada: sus descendientes no se ven. Se guarda en el mapa. */
  collapsed?: boolean
  // Derivados (los calcula syncCollapse, no se guardan): lo que pinta el botón de plegar.
  childCount?: number
  hiddenCount?: number
  childSide?: 'left' | 'right'
  /** Categoría MIR (definición, clínica…): semántica del nodo, el estilo es aparte. */
  category?: string
  /** Nodo tabla: `label` es una copia en texto de la tabla (la regenera `updateTable`). */
  table?: MapTable
  /** Generado con IA: anclaje, página de origen y revisión. Se guarda en el mapa. */
  ia?: NodoIA
}

export type MindMapNode = Node<NodeData, 'mindmap'>

export const DEFAULT_NODE_STYLE: NodeStyle = {
  color: '#FFFFFF',
  borderColor: '#EDE6DE',
  borderWidth: 1,
  glowColor: '#E8A598',
  glowIntensity: 0,
  shape: 'rectangle',
  textColor: '#2A2420',
  fontSize: 14,
  fontFamily: 'Lexend',
  textAlign: 'center',
}

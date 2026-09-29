import type { Edge } from '@xyflow/react'

export type EdgeVariant = 'solid' | 'dashed' | 'dotted'

export interface EdgeData extends Record<string, unknown> {
  isAnimating: boolean
  variant?: EdgeVariant
  color?: string       // null/undefined = theme default
  strokeWidth?: number // null/undefined = default (1.5)
  label?: string
}

export type MindMapEdge = Edge<EdgeData, 'animated'>

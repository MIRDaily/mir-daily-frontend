import type { CSSProperties, ReactNode } from 'react'
import type { NodeShape, NodeStyle } from '@/components/mapas/proto/types/node.types'

function getShapeStyles(shape: NodeShape): CSSProperties {
  switch (shape) {
    case 'pill':
      return { borderRadius: '999px', minWidth: 100 }
    case 'circle':
      return { borderRadius: '50%', minWidth: 80, minHeight: 80, aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }
    case 'diamond':
      return { borderRadius: '8px', transform: 'rotate(45deg)', minWidth: 80, minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }
    default:
      return { borderRadius: '12px' }
  }
}

interface NodeBodyProps {
  style: NodeStyle
  children: ReactNode
  isSelected: boolean
  isDark?: boolean
}

export function NodeBody({ style, children, isSelected, isDark }: NodeBodyProps) {
  const restingShadow = isDark
    ? '0 6px 18px rgba(232,165,152,0.30), 0 2px 6px rgba(232,165,152,0.20)'
    : '0 2px 12px rgba(0,0,0,0.15)'

  const glowShadow = isSelected
    ? `0 0 0 2px ${style.glowColor}, 0 0 20px ${style.glowColor}55`
    : style.glowIntensity > 0
    ? `0 0 ${style.glowIntensity * 20}px ${style.glowColor}66`
    : restingShadow

  const containerStyle: CSSProperties = {
    background: style.color,
    border: `${style.borderWidth}px solid ${isSelected ? style.glowColor : style.borderColor}`,
    color: style.textColor,
    padding: '10px 16px',
    minWidth: 100,
    width: '100%',
    height: '100%',
    boxSizing: 'border-box' as const,
    boxShadow: glowShadow,
    cursor: 'pointer',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color 200ms ease, box-shadow 200ms ease, filter 750ms cubic-bezier(0.4, 0, 0.2, 1), opacity 750ms cubic-bezier(0.4, 0, 0.2, 1)',
    ...getShapeStyles(style.shape),
  }

  return (
    <div className="node-body" style={containerStyle}>
      {style.shape === 'diamond' ? (
        <div style={{ transform: 'rotate(-45deg)' }}>{children}</div>
      ) : (
        children
      )}
    </div>
  )
}

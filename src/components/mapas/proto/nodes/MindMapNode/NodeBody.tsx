import type { CSSProperties, ReactNode } from 'react'
import type { NodeShape, NodeStyle } from '@/components/mapas/proto/types/node.types'

function getShapeStyles(shape: NodeShape): CSSProperties {
  switch (shape) {
    case 'pill':
      return { borderRadius: '999px', minWidth: 100 }
    case 'circle':
      return { borderRadius: '50%', minWidth: 80, minHeight: 80, aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }
    case 'diamond':
      // El rombo se dibuja con un polígono SVG detrás del texto (ver NodeBody): girar la caja 45°
      // desbordaba el texto y no coincidía con el tamaño que mide React Flow.
      return { borderRadius: 0, minWidth: 130, minHeight: 64, padding: '18px 52px' }
    case 'label':
      // Rótulo: sin caja (el fondo, el borde y la sombra los quita NodeBody), poco relleno.
      return { borderRadius: 8, minWidth: 0, padding: '4px 8px' }
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

  if (style.shape === 'label') {
    // Rótulo de un subgrupo: solo el texto (ver mapas.css: mayúsculas, gris; más marcado en el modo
    // estudio). Seleccionado, un aro fino para que se vea qué está seleccionado.
    return (
      <div
        className="node-body shape-label"
        style={{
          ...containerStyle,
          background: 'transparent',
          border: 'none',
          boxShadow: isSelected ? `0 0 0 2px ${style.glowColor}` : 'none',
        }}
      >
        {children}
      </div>
    )
  }

  if (style.shape === 'diamond') {
    // Sin fondo, borde ni sombra propios: los pone el polígono (la sombra, con drop-shadow, que sí
    // sigue la silueta del rombo).
    const stroke = isSelected ? style.glowColor : style.borderColor
    const shadow = isSelected
      ? `drop-shadow(0 0 3px ${style.glowColor}) drop-shadow(0 0 12px ${style.glowColor}66)`
      : style.glowIntensity > 0
        ? `drop-shadow(0 0 ${style.glowIntensity * 10}px ${style.glowColor}88)`
        : isDark
          ? 'drop-shadow(0 4px 10px rgba(232,165,152,0.30))'
          : 'drop-shadow(0 2px 6px rgba(0,0,0,0.18))'
    return (
      <div
        className="node-body"
        style={{ ...containerStyle, background: 'none', border: 'none', boxShadow: 'none', filter: shadow }}
      >
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
        >
          <polygon
            points="50,0 100,50 50,100 0,50"
            fill={style.color}
            stroke={style.borderWidth > 0 || isSelected ? stroke : 'none'}
            strokeWidth={isSelected ? Math.max(style.borderWidth, 2) : style.borderWidth}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div style={{ position: 'relative' }}>{children}</div>
      </div>
    )
  }

  return (
    <div className="node-body" style={containerStyle}>
      {children}
    </div>
  )
}

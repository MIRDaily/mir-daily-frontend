import { resolveFont } from '@/components/mapas/proto/utils/font'
import type { NodeStyle } from '@/components/mapas/proto/types/node.types'

interface NodeLabelProps {
  label: string
  style: NodeStyle
}

export function NodeLabel({ label, style }: NodeLabelProps) {
  return (
    <div
      className="node-label"
      style={{
        fontSize: style.fontSize ?? 14,
        fontFamily: resolveFont(style.fontFamily),
        textAlign: style.textAlign ?? 'center',
        lineHeight: 1.5,
        pointerEvents: 'none',
        userSelect: 'none',
        width: '100%',
        wordBreak: 'break-word',
      }}
      dangerouslySetInnerHTML={{ __html: label }}
    />
  )
}

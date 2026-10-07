import { useMemo } from 'react'
import { resolveFont } from '@/components/mapas/proto/utils/font'
import { sanitizeLabelHtml } from '@/lib/mapas/labelHtml'
import type { NodeStyle } from '@/components/mapas/proto/types/node.types'

interface NodeLabelProps {
  label: string
  style: NodeStyle
}

export function NodeLabel({ label, style }: NodeLabelProps) {
  // Defensa extra: el label ya llega saneado al cargar, pero se pinta como HTML.
  const html = useMemo(() => sanitizeLabelHtml(label), [label])
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
        // Un rótulo (forma `label`) se ve en mayúsculas y en gris: lo pone mapas.css (con los
        // ajustes de la pestaña «Rótulos» de Categorías).
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

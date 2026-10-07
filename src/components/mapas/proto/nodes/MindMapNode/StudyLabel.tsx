import { useMemo } from 'react'
import { resolveFont } from '@/components/mapas/proto/utils/font'
import { splitFacetLabel } from '@/lib/mapas/study'
import type { NodeStyle } from '@/components/mapas/proto/types/node.types'

/**
 * Etiqueta de una hoja TAPADA en el modo estudio: la faceta a la vista y el dato tapado con una
 * franja rayada del mismo ancho que el texto (el nodo no cambia de tamaño al destaparlo). Todo es
 * texto de React: el label (HTML) solo se usa a través de su texto plano.
 */
export function StudyLabel({ label, style }: { label: string; style: NodeStyle }) {
  const { faceta, dato } = useMemo(() => splitFacetLabel(label), [label])
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
        ['--tapa' as string]: style.textColor,
      }}
    >
      {faceta && <b>{faceta}: </b>}
      <span className="estudio-tapa" aria-label="Tapado: haz clic para verlo">
        {dato || '…'}
      </span>
    </div>
  )
}

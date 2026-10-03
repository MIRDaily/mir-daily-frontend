import { resolveFont } from '@/components/mapas/proto/utils/font'
import { useRef, useEffect } from 'react'
import type { NodeStyle } from '@/components/mapas/proto/types/node.types'

interface NodeEditorProps {
  label: string
  style: NodeStyle
  onSave: (text: string) => void
  onExit: () => void
  /** Tab mientras se escribe: guardar y seguir (crear un hijo). */
  onTab?: () => void
  /** Seleccionar todo el texto al empezar (nodo recién creado: se escribe encima). */
  selectAll?: boolean
  /** Texto con el que empieza (se escribió con el nodo seleccionado): sustituye al anterior. */
  seed?: string | null
}

export function NodeEditor({ label, style, onSave, onExit, onTab, selectAll, seed }: NodeEditorProps) {
  const ref = useRef<HTMLDivElement>(null)
  const savedRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Set initial HTML content (supports rich formatting from previous edits)
    if (seed != null) el.textContent = seed
    else el.innerHTML = label

    // Un nodo recién creado está oculto (visibility: hidden) hasta que React Flow lo mide, y
    // focus() no funciona sobre algo oculto: se reintenta durante un momento (con temporizador, no
    // con requestAnimationFrame, que se para si la pestaña no se pinta). Sin esto,
    // al crear con Tab/Enter lo que se escribía se perdía.
    let timer: ReturnType<typeof setTimeout> | undefined
    let tries = 0
    const focusNow = () => {
      el.focus()
      if (document.activeElement !== el) {
        if (tries++ < 30) timer = setTimeout(focusNow, 16)
        return
      }
      // Cursor al final; en un nodo recién creado, todo el texto seleccionado para escribir encima.
      const range = document.createRange()
      range.selectNodeContents(el)
      if (!selectAll) range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    focusNow()
    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveAndExit = (el: HTMLDivElement) => {
    if (savedRef.current) return
    savedRef.current = true
    const html = el.innerHTML.trim()
    onSave(html || label)
    onExit()
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className="nodrag nopan"
      onMouseDown={(e) => e.stopPropagation()}
      onBlur={(e) => handleSaveAndExit(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          handleSaveAndExit(e.currentTarget as HTMLDivElement)
        }
        if (e.key === 'Tab' && onTab) {
          e.preventDefault()
          handleSaveAndExit(e.currentTarget as HTMLDivElement)
          onTab()
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          handleSaveAndExit(e.currentTarget as HTMLDivElement)
        }
        e.stopPropagation()
      }}
      style={{
        fontSize: style.fontSize ?? 14,
        fontFamily: resolveFont(style.fontFamily),
        textAlign: style.textAlign ?? 'center',
        lineHeight: 1.5,
        minWidth: 80,
        width: '100%',
        outline: 'none',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        cursor: 'text',
      }}
    />
  )
}

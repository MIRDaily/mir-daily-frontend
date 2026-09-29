import { resolveFont } from '@/components/mapas/proto/utils/font'
import { useRef, useEffect } from 'react'
import type { NodeStyle } from '@/components/mapas/proto/types/node.types'

interface NodeEditorProps {
  label: string
  style: NodeStyle
  onSave: (text: string) => void
  onExit: () => void
}

export function NodeEditor({ label, style, onSave, onExit }: NodeEditorProps) {
  const ref = useRef<HTMLDivElement>(null)
  const savedRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Set initial HTML content (supports rich formatting from previous edits)
    el.innerHTML = label

    el.focus()

    // Place cursor at end
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
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

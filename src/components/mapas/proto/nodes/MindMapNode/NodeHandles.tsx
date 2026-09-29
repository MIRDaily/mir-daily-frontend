import { Handle, Position } from '@xyflow/react'

interface NodeHandlesProps {
  onQuickAdd: (direction: 'top' | 'bottom' | 'left' | 'right') => void
}

export function NodeHandles({ onQuickAdd }: NodeHandlesProps) {
  const handleClick = (e: React.MouseEvent, dir: 'top' | 'bottom' | 'left' | 'right') => {
    e.stopPropagation()
    onQuickAdd(dir)
  }

  return (
    <>
      <Handle type="source" position={Position.Top}    id="top"    onClick={(e) => handleClick(e, 'top')} />
      <Handle type="source" position={Position.Bottom} id="bottom" onClick={(e) => handleClick(e, 'bottom')} />
      <Handle type="source" position={Position.Left}   id="left"   onClick={(e) => handleClick(e, 'left')} />
      <Handle type="source" position={Position.Right}  id="right"  onClick={(e) => handleClick(e, 'right')} />
    </>
  )
}

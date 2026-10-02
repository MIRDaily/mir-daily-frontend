import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'

interface BranchToggleProps {
  nodeId: string
  collapsed: boolean
  hiddenCount: number
  side: 'left' | 'right'
  accent: string
}

/**
 * Botón de plegar/desplegar la rama, en el lado por el que salen los hijos y más allá del punto
 * de conexión (que aparece a 8 px del borde al pasar el ratón). Desplegado solo se ve al pasar
 * el ratón por el nodo; plegado se queda a la vista con cuántos nodos esconde.
 */
export function BranchToggle({ nodeId, collapsed, hiddenCount, side, accent }: BranchToggleProps) {
  const t = useTheme()

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    const store = useMindMapStore.getState()
    useHistoryStore.getState().pushSnapshot(store.nodes, store.edges)
    store.toggleCollapse(nodeId)
  }

  return (
    <button
      type="button"
      className="branch-toggle nodrag nopan"
      data-collapsed={collapsed ? 'true' : 'false'}
      onClick={toggle}
      onDoubleClick={(e) => e.stopPropagation()}
      title={collapsed ? `Desplegar rama (${hiddenCount} nodos)` : 'Plegar rama'}
      aria-label={collapsed ? `Desplegar rama, ${hiddenCount} nodos ocultos` : 'Plegar rama'}
      style={{
        position: 'absolute',
        top: '50%',
        [side === 'right' ? 'left' : 'right']: 'calc(100% + 24px)',
        transform: 'translateY(-50%)',
        minWidth: 20,
        height: 20,
        padding: collapsed ? '0 7px' : 0,
        borderRadius: 999,
        border: `1.5px solid ${accent}`,
        background: collapsed ? accent : t.bgPanel,
        color: collapsed ? '#FFFFFF' : accent,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: `0 2px 8px ${t.shadow}`,
        zIndex: 11,
      }}
    >
      {collapsed ? `+${hiddenCount}` : '−'}
    </button>
  )
}

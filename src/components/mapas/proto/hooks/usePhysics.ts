import { useEffect, useRef } from 'react'
import {
  forceSimulation,
  forceManyBody,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3-force'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'

interface SimNode extends SimulationNodeDatum {
  id: string
  dragging?: boolean
}

export function usePhysics() {
  const simRef = useRef<Simulation<SimNode, undefined> | null>(null)

  useEffect(() => {
    const runSimulation = () => {
      simRef.current?.stop()
      simRef.current = null

      const currentNodes = useMindMapStore.getState().nodes
      if (currentNodes.length < 2) return

      const simNodes: SimNode[] = currentNodes.map((n) => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        dragging: n.dragging,
        fx: n.dragging ? n.position.x : null,
        fy: n.dragging ? n.position.y : null,
      }))

      const sim = forceSimulation<SimNode>(simNodes)
        .force('repulsion', forceManyBody<SimNode>().strength(-180).distanceMax(350))
        .force('collision', forceCollide<SimNode>(90))
        .alphaDecay(0.06)
        .velocityDecay(0.4)
        .on('tick', () => {
          const posMap: Record<string, { x: number; y: number }> = {}
          for (const sn of simNodes) {
            if (!sn.dragging) posMap[sn.id] = { x: sn.x ?? 0, y: sn.y ?? 0 }
          }
          useMindMapStore.setState((s) => ({
            nodes: s.nodes.map((node) => {
              if (node.dragging) return node
              const pos = posMap[node.id]
              if (!pos) return node
              return { ...node, position: pos }
            }),
          }))
        })
        .on('end', () => {
          simRef.current = null
        })

      simRef.current = sim
    }

    // Subscribe: only react to node count changes (add/delete)
    const unsub = useMindMapStore.subscribe((state, prev) => {
      // Cargar un mapa cambia el número de nodos pero no debe recolocarlos.
      if (state.loadTick !== prev.loadTick) return
      if (!useUIStore.getState().physicsEnabled) return
      if (state.nodes.length !== prev.nodes.length) {
        runSimulation()
      }
    })

    return () => {
      unsub()
      simRef.current?.stop()
    }
  }, [])
}

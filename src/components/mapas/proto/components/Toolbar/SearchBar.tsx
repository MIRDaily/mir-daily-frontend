import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import { getFlow, selectOnly } from '@/components/mapas/proto/utils/keyboard'
import { parentMap } from '@/components/mapas/proto/utils/tree'
import { setCollapsedAnimated } from '@/components/mapas/proto/utils/foldAnimation'

// Buscador de nodos (Ctrl+F). Busca en el texto de todos los nodos, también los que están dentro
// de ramas plegadas: al ir a uno de esos, despliega lo necesario para que se vea.

/** Texto plano, sin mayúsculas ni tildes: "Péptidos <b>BNP</b>" → "peptidos bnp". */
function normalize(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

// Resaltado como en el resto de MIRDaily (HighlightedText de studio/deckUi): el texto que coincide,
// "subrayado con marcador" amarillo. Se pinta con la CSS Custom Highlight API: marca rangos del
// texto sin tocar el DOM (las etiquetas llevan formato HTML y React las gestiona). Estilos en
// mapas.css (::highlight). Si el navegador no la tiene, se cae a un aro alrededor del nodo.
const HL_ALL = 'mapa-busqueda'
const HL_CURRENT = 'mapa-busqueda-actual'
const MATCH = 'search-match'
const CURRENT = 'search-current'

type HighlightRegistry = { set(name: string, h: unknown): void; delete(name: string): void }
function highlightApi(): { registry: HighlightRegistry; Ctor: new (...r: Range[]) => unknown } | null {
  const registry = (globalThis.CSS as unknown as { highlights?: HighlightRegistry } | undefined)?.highlights
  const Ctor = (globalThis as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight
  return registry && Ctor ? { registry, Ctor } : null
}

function clearMarks() {
  const api = highlightApi()
  api?.registry.delete(HL_ALL)
  api?.registry.delete(HL_CURRENT)
  document.querySelectorAll(`.mapa-root .${MATCH}, .mapa-root .${CURRENT}`).forEach((el) => {
    el.classList.remove(MATCH, CURRENT)
  })
}

/** Rangos del texto de `root` donde aparece `q` (ya normalizado), ignorando mayúsculas y tildes. */
function rangesIn(root: Element, q: string): Range[] {
  const map: Array<[Text, number]> = []
  let norm = ''
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let t = walker.nextNode() as Text | null; t; t = walker.nextNode() as Text | null) {
    const s = t.data
    for (let i = 0; i < s.length; i++) {
      const c = normalize(s[i])
      for (let k = 0; k < c.length; k++) map.push([t, i])
      norm += c
    }
  }
  const out: Range[] = []
  for (let from = norm.indexOf(q); from !== -1 && q; from = norm.indexOf(q, from + q.length)) {
    const [st, so] = map[from]
    const [et, eo] = map[from + q.length - 1]
    const r = document.createRange()
    r.setStart(st, so)
    r.setEnd(et, eo + 1)
    out.push(r)
  }
  return out
}

/** Despliega las ramas plegadas que esconden al nodo. No es un paso de deshacer: solo se mira. */
function unfoldTo(id: string) {
  const { nodes, edges } = useMindMapStore.getState()
  const parents = parentMap(nodes, edges)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const toOpen = new Set<string>()
  const seen = new Set<string>([id])
  for (let p = parents.get(id); p && !seen.has(p); p = parents.get(p)) {
    seen.add(p)
    if (byId.get(p)?.data.collapsed) toOpen.add(p)
  }
  if (toOpen.size === 0) return
  setCollapsedAnimated(new Map([...toOpen].map((p) => [p, false])))
}

function centerOn(id: string) {
  const flow = getFlow()
  const node = useMindMapStore.getState().nodes.find((n) => n.id === id)
  if (!flow || !node || useUIStore.getState().cameraLocked) return
  const w = node.measured?.width ?? 160
  const h = node.measured?.height ?? 50
  const zoom = Math.max(flow.getViewport().zoom, 0.9)
  void flow.setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom, duration: 400 })
}

export function SearchBar() {
  const open = useUIStore((s) => s.searchOpen)
  if (!open) return null
  return <SearchBox />
}

function SearchBox() {
  const t = useTheme()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  // Solo hace falta el texto de cada nodo: los movimientos no vuelven a calcular nada.
  const labels = useMindMapStore((s) => s.nodes.map((n) => `${n.id}\u0000${n.data.label}`).join('\u0001'))

  const matches = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return [] as string[]
    return labels
      .split('\u0001')
      .map((row) => row.split('\u0000'))
      .filter(([, label]) => normalize(label ?? '').includes(q))
      .map(([id]) => id)
  }, [labels, query])

  const current = matches.length ? matches[Math.min(index, matches.length - 1)] : null

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
    return clearMarks
  }, [])

  // Ir al resultado actual (con una pequeña espera mientras se teclea).
  useEffect(() => {
    if (!current) return
    const timer = setTimeout(() => {
      unfoldTo(current)
      selectOnly(current)
      // Lo recién desplegado aún no está medido: se centra en el fotograma siguiente.
      requestAnimationFrame(() => centerOn(current))
    }, 120)
    return () => clearTimeout(timer)
  }, [current])

  // Resaltado de los resultados (sin re-renderizar los nodos): marcador amarillo sobre el texto
  // que coincide; el resultado actual, más intenso.
  useEffect(() => {
    const q = normalize(query.trim())
    const paint = () => {
      clearMarks()
      const api = highlightApi()
      const all: Range[] = []
      const cur: Range[] = []
      for (const id of matches) {
        const node = document.querySelector(`.mapa-root .react-flow__node[data-id="${id}"]`)
        const label = node?.querySelector('.node-label')
        if (!node || !label) continue
        if (!api) {
          node.classList.add(id === current ? CURRENT : MATCH)
          continue
        }
        ;(id === current ? cur : all).push(...rangesIn(label, q))
      }
      if (api) {
        api.registry.set(HL_ALL, new api.Ctor(...all))
        api.registry.set(HL_CURRENT, new api.Ctor(...cur))
      }
    }
    paint()
    // Lo que aparece al desplegar (o cambia de texto) se pinta en cuanto existe.
    const t1 = setTimeout(paint, 250)
    const t2 = setTimeout(paint, 600)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [matches, current, query])

  const close = () => useUIStore.getState().setSearchOpen(false)

  // Pulsar fuera de la barra la cierra (Esc y la X también).
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) useUIStore.getState().setSearchOpen(false)
    }
    document.addEventListener('mousedown', down)
    return () => document.removeEventListener('mousedown', down)
  }, [])
  const step = (d: number) => {
    if (!matches.length) return
    setIndex((i) => (Math.min(i, matches.length - 1) + d + matches.length) % matches.length)
  }

  return (
    <div
      ref={rootRef}
      role="search"
      style={{
        position: 'absolute',
        // El lienzo ya empieza debajo de la cabecera del editor: solo un respiro.
        top: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1001,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 8px 6px 12px',
        background: t.bgPanel,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        boxShadow: `0 6px 24px ${t.shadow}`,
        width: 'min(420px, calc(100% - 32px))',
      }}
    >
      <Search size={15} color={t.textMuted} />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setIndex(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            close()
          } else if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault()
            step(e.shiftKey ? -1 : 1)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            step(-1)
          } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault()
            inputRef.current?.select()
          }
        }}
        placeholder="Buscar en el mapa…"
        aria-label="Buscar en el mapa"
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: t.textPrimary,
          fontSize: 13,
          fontFamily: 'inherit',
        }}
      />
      <span style={{ fontSize: 11, color: t.textMuted, whiteSpace: 'nowrap', minWidth: 54, textAlign: 'right' }}>
        {query.trim() ? (matches.length ? `${matches.indexOf(current!) + 1} / ${matches.length}` : 'Sin resultados') : ''}
      </span>
      <IconBtn title="Anterior (Mayús+Enter)" onClick={() => step(-1)} color={t.textSecondary} hoverBg={t.hoverBg}>
        <ChevronUp size={15} />
      </IconBtn>
      <IconBtn title="Siguiente (Enter)" onClick={() => step(1)} color={t.textSecondary} hoverBg={t.hoverBg}>
        <ChevronDown size={15} />
      </IconBtn>
      <IconBtn title="Cerrar (Esc)" onClick={close} color={t.textMuted} hoverBg={t.hoverBg}>
        <X size={15} />
      </IconBtn>
    </div>
  )
}

function IconBtn({
  title,
  onClick,
  color,
  hoverBg,
  children,
}: {
  title: string
  onClick: () => void
  color: string
  hoverBg: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color, padding: 4, borderRadius: 6, display: 'flex' }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = hoverBg)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'none')}
    >
      {children}
    </button>
  )
}

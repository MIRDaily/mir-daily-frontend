import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useReactFlow } from '@xyflow/react'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  FileDown,
  Layers,
  Moon,
  Network,
  Plus,
  Redo2,
  Search,
  Shapes,
  SlidersHorizontal,
  Sun,
  Undo2,
} from 'lucide-react'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import { showUpToLevel } from '@/components/mapas/proto/utils/branches'
import type { BgStyle } from '@/components/mapas/proto/types/store.types'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

/** Alto de la cabecera del editor. El lienzo y sus paneles cuelgan por debajo. */
export const BAR_H = 52

type Props = {
  title: string
  onTitleChange: (title: string) => void
  save: SaveState
  onRetry: () => void
  /** Texto fijo en lugar del estado del guardado (p. ej. el mapa de práctica, que no se guarda). */
  statusText?: string
  onAutoLayout: () => void
}

/**
 * Cabecera única del editor: a la izquierda volver y el título, en el centro las acciones de cada
 * día y a la derecha la vista y exportar. Tres zonas fijas en una sola franja: nada se pisa. Lo
 * secundario (fondo, tema, física, desenfoque) vive en el menú «Vista»; en pantallas estrechas, las
 * etiquetas se ocultan y buscar, categorías y niveles pasan también a ese menú.
 */
export function EditorTopBar({ title, onTitleChange, save, onRetry, statusText, onAutoLayout }: Props) {
  const t = useTheme()
  const { setCenter } = useReactFlow()
  const categoriesOpen = useUIStore((s) => s.categoriesPanelOpen)
  const setCategoriesOpen = useUIStore((s) => s.setCategoriesPanelOpen)
  const exportOpen = useUIStore((s) => s.exportOpen)

  const addNode = () => {
    const store = useMindMapStore.getState()
    useHistoryStore.getState().pushSnapshot(store.nodes, store.edges)
    const newId = store.addNode()
    setTimeout(() => {
      const node = useMindMapStore.getState().nodes.find((n) => n.id === newId)
      if (node) void setCenter(node.position.x, node.position.y, { duration: 600, zoom: 1 })
    }, 150)
  }

  const status =
    statusText ?? (save === 'saved' ? 'Guardado' : save === 'saving' ? 'Guardando…' : save === 'dirty' ? 'Cambios sin guardar' : '')

  return (
    <div
      className="mapa-topbar"
      role="toolbar"
      aria-label="Herramientas del mapa"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: BAR_H,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 14px',
        background: t.bgPanel,
        borderBottom: `1px solid ${t.border}`,
        transition: 'background 400ms ease, border-color 400ms ease',
      }}
    >
      {/* Izquierda: marca, volver y título */}
      <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Link href="/dashboard" title="Ir a MIRDaily" aria-label="MIRDaily" className="hide-md" style={{ display: 'flex', flexShrink: 0, padding: 4 }}>
          <svg width="22" height="22" viewBox="0 0 48 48" fill={t.accent} aria-hidden="true">
            <path d="M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z" />
          </svg>
        </Link>
        <Link
          href="/mapas"
          title="Volver a mis mapas"
          aria-label="Volver a mis mapas"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 9, color: t.textSecondary, flexShrink: 0 }}
        >
          <ArrowLeft size={17} />
        </Link>
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value.slice(0, 200))}
          placeholder="Título del mapa"
          aria-label="Título del mapa"
          className="mapa-topbar-title"
          style={{
            minWidth: 60,
            flex: '1 1 auto',
            maxWidth: 300,
            background: 'transparent',
            border: '1px solid transparent',
            borderRadius: 8,
            padding: '5px 8px',
            outline: 'none',
            color: t.textPrimary,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: 'inherit',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = t.border2)}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
        />
        {save === 'error' && !statusText ? (
          <button
            type="button"
            onClick={onRetry}
            title="No se pudo guardar. Reintentando; pulsa para reintentar ya."
            style={{ flexShrink: 0, border: 'none', cursor: 'pointer', borderRadius: 8, padding: '3px 8px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', background: `${t.danger}22`, color: t.danger }}
          >
            Sin guardar · reintentar
          </button>
        ) : (
          <span className="hide-md" style={{ flexShrink: 0, fontSize: 11, fontWeight: 500, color: save === 'saved' ? t.accentGreen : t.textMuted, whiteSpace: 'nowrap' }}>
            {status}
          </span>
        )}
      </div>

      {/* Centro: lo que se usa a cada rato */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <Btn t={t} onClick={addNode} title="Nuevo nodo sin relaciones (N, o Alt+N)" tone="accent" label="Añadir">
          <Plus size={16} />
        </Btn>
        <Sep t={t} />
        <Btn t={t} onClick={() => useHistoryStore.getState().undo()} title="Deshacer (Ctrl+Z)">
          <Undo2 size={16} />
        </Btn>
        <Btn t={t} onClick={() => useHistoryStore.getState().redo()} title="Rehacer (Ctrl+Mayús+Z)">
          <Redo2 size={16} />
        </Btn>
        <Sep t={t} />
        <Btn t={t} onClick={onAutoLayout} title="Ordenar el mapa automáticamente" label="Ordenar">
          <Network size={16} />
        </Btn>
        <span className="hide-md" style={{ display: 'contents' }}>
          <Btn t={t} onClick={() => useUIStore.getState().setSearchOpen(true)} title="Buscar en el mapa (Ctrl+F)" label="Buscar">
            <Search size={16} />
          </Btn>
          <Btn
            t={t}
            onClick={() => setCategoriesOpen(!categoriesOpen)}
            title="Estilos de las categorías"
            label="Categorías"
            active={categoriesOpen}
          >
            <Shapes size={16} />
          </Btn>
          <LevelsMenu t={t} />
        </span>
      </div>

      {/* Derecha: vista y exportar */}
      <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
        <ViewMenu t={t} />
        <button
          type="button"
          data-tuto="export-open"
          onClick={() => useUIStore.getState().setExportOpen(true)}
          title="Exportar o imprimir (Ctrl+P): PDF, imagen o copia JSON"
          aria-pressed={exportOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 34,
            padding: '0 12px',
            borderRadius: 9,
            border: 'none',
            background: t.accent,
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <FileDown size={16} />
          <span className="lbl">Exportar</span>
        </button>
      </div>
    </div>
  )
}

type Theme = ReturnType<typeof useTheme>

function Sep({ t }: { t: Theme }) {
  return <span aria-hidden style={{ width: 1, height: 20, background: t.border, margin: '0 4px', flexShrink: 0 }} />
}

function Btn({
  t,
  onClick,
  title,
  label,
  active,
  tone,
  children,
}: {
  t: Theme
  onClick: () => void
  title: string
  label?: string
  active?: boolean
  tone?: 'accent'
  children: React.ReactNode
}) {
  const color = active || tone === 'accent' ? t.accent : t.textSecondary
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={label ?? title}
      aria-pressed={active}
      style={{
        height: 34,
        minWidth: 34,
        padding: '0 9px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 9,
        border: 'none',
        background: active ? `${t.accent}1A` : 'transparent',
        color,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'inherit',
        flexShrink: 0,
        transition: 'background 150ms, color 300ms',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = t.hoverBg
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = active ? `${t.accent}1A` : 'transparent'
      }}
    >
      {children}
      {label && <span className="lbl">{label}</span>}
    </button>
  )
}

/** Un menú desplegable de la barra: se cierra al pulsar fuera o con Esc. */
function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', down)
    window.addEventListener('keydown', key, true)
    return () => {
      document.removeEventListener('mousedown', down)
      window.removeEventListener('keydown', key, true)
    }
  }, [open])
  return { open, setOpen, ref }
}

function popStyle(t: Theme, width: number): React.CSSProperties {
  return {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width,
    zIndex: 1300,
    background: t.bgPanel,
    border: `1px solid ${t.border}`,
    borderRadius: 14,
    padding: 10,
    boxShadow: `0 10px 36px ${t.shadow}`,
  }
}

function LevelsMenu({ t }: { t: Theme }) {
  const { open, setOpen, ref } = usePopover()
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        data-tuto="niveles"
        onClick={() => setOpen(!open)}
        title="Ver el mapa hasta un nivel (Alt+1…9, Alt+0 = todo)"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ height: 34, padding: '0 9px', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 9, border: 'none', background: open ? `${t.accent}1A` : 'transparent', color: open ? t.accent : t.textSecondary, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
      >
        <Layers size={16} />
        <span className="lbl">Niveles</span>
        <ChevronDown size={13} />
      </button>
      {open && <LevelsList t={t} onPick={() => setOpen(false)} />}
    </div>
  )
}

function LevelsList({ t, onPick }: { t: Theme; onPick: () => void }) {
  return (
    <div role="menu" style={{ ...popStyle(t, 210), right: 'auto', left: 0 }}>
      <div style={{ color: t.textMuted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '2px 4px 8px' }}>Ver hasta el nivel</div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {[1, 2, 3, 4, 5].map((lvl) => (
          <button
            key={lvl}
            role="menuitem"
            title={`Ver hasta el nivel ${lvl} (Alt+${lvl})`}
            onClick={() => {
              showUpToLevel(lvl)
              onPick()
            }}
            style={chip(t)}
          >
            {lvl}
          </button>
        ))}
        <button
          role="menuitem"
          title="Desplegarlo todo (Alt+0)"
          onClick={() => {
            showUpToLevel(null)
            onPick()
          }}
          style={{ ...chip(t), width: 'auto', padding: '0 12px' }}
        >
          Todo
        </button>
      </div>
    </div>
  )
}

function chip(t: Theme): React.CSSProperties {
  return { width: 34, height: 34, borderRadius: 9, border: `1px solid ${t.border}`, background: 'transparent', color: t.textPrimary, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }
}

function ViewMenu({ t }: { t: Theme }) {
  const { open, setOpen, ref } = usePopover()
  const bgStyle = useUIStore((s) => s.bgStyle)
  const setBgStyle = useUIStore((s) => s.setBgStyle)
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  const physics = useUIStore((s) => s.physicsEnabled)
  const setPhysics = useUIStore((s) => s.setPhysicsEnabled)
  const focusBlur = useUIStore((s) => s.focusBlur)
  const setFocusBlur = useUIStore((s) => s.setFocusBlur)
  const categoriesOpen = useUIStore((s) => s.categoriesPanelOpen)
  const setCategoriesOpen = useUIStore((s) => s.setCategoriesPanelOpen)
  const dark = theme === 'dark'
  const label: React.CSSProperties = { color: t.textMuted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '2px 4px 8px' }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Vista: fondo, tema, física y desenfoque"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ height: 34, padding: '0 10px', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 9, border: `1px solid ${open ? t.accent : t.border}`, background: open ? `${t.accent}14` : 'transparent', color: open ? t.accent : t.textSecondary, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
      >
        <SlidersHorizontal size={16} />
        <span className="lbl">Vista</span>
      </button>

      {open && (
        <div role="menu" style={popStyle(t, 260)}>
          {/* Lo que en pantallas anchas ya está en la barra */}
          <div className="only-md" style={{ flexDirection: 'column', gap: 2, marginBottom: 8 }}>
            <MenuRow t={t} icon={<Search size={15} />} text="Buscar en el mapa" onClick={() => { setOpen(false); useUIStore.getState().setSearchOpen(true) }} />
            <MenuRow t={t} icon={<Shapes size={15} />} text="Categorías" onClick={() => { setOpen(false); setCategoriesOpen(!categoriesOpen) }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 4px 0' }}>
              <span style={{ fontSize: 12.5, color: t.textSecondary, marginRight: 4 }}>Niveles</span>
              {[1, 2, 3].map((l) => (
                <button key={l} style={{ ...chip(t), width: 30, height: 30 }} onClick={() => { showUpToLevel(l); setOpen(false) }}>{l}</button>
              ))}
              <button style={{ ...chip(t), width: 'auto', height: 30, padding: '0 9px' }} onClick={() => { showUpToLevel(null); setOpen(false) }}>Todo</button>
            </div>
            <div style={{ height: 1, background: t.border, margin: '8px 0 2px' }} />
          </div>

          <div style={label}>Fondo</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {(['flat', 'dots-light', 'dots'] as BgStyle[]).map((s) => (
              <button
                key={s}
                role="menuitemradio"
                aria-checked={bgStyle === s}
                title={s === 'flat' ? 'Fondo plano' : s === 'dots-light' ? 'Puntos sutiles' : 'Puntos'}
                onClick={() => setBgStyle(s)}
                style={{ flex: 1, height: 38, borderRadius: 10, border: `1.5px solid ${bgStyle === s ? t.accent : t.border}`, background: bgStyle === s ? `${t.accent}14` : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <BgIcon type={s} color={bgStyle === s ? t.accent : t.textMuted} />
              </button>
            ))}
          </div>

          <div style={label}>Tema</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {([['light', 'Claro', <Sun key="s" size={15} />], ['dark', 'Oscuro', <Moon key="m" size={15} />]] as const).map(([id, text, icon]) => {
              const on = (id === 'dark') === dark
              return (
                <button
                  key={id}
                  role="menuitemradio"
                  aria-checked={on}
                  onClick={() => setTheme(id)}
                  style={{ flex: 1, height: 36, borderRadius: 10, border: `1.5px solid ${on ? t.accent : t.border}`, background: on ? `${t.accent}14` : 'transparent', color: on ? t.accent : t.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
                >
                  {icon}
                  {text}
                </button>
              )
            })}
          </div>

          <Switch t={t} checked={focusBlur} onChange={setFocusBlur} text="Desenfocar al pasar el ratón" hint="Atenúa lo que no está conectado al nodo." />
          <Switch t={t} checked={physics} onChange={setPhysics} text="Física" hint="Los nodos se apartan al añadir o soltar." />
        </div>
      )}
    </div>
  )
}

function MenuRow({ t, icon, text, onClick }: { t: Theme; icon: React.ReactNode; text: string; onClick: () => void }) {
  return (
    <button role="menuitem" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 6px', borderRadius: 8, border: 'none', background: 'transparent', color: t.textPrimary, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
      <span style={{ color: t.textSecondary, display: 'flex' }}>{icon}</span>
      {text}
    </button>
  )
}

function Switch({ t, checked, onChange, text, hint }: { t: Theme; checked: boolean; onChange: (v: boolean) => void; text: string; hint: string }) {
  return (
    <button
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 4px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
    >
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', color: t.textPrimary, fontSize: 13, fontWeight: 600 }}>{text}</span>
        <span style={{ display: 'block', color: t.textMuted, fontSize: 11.5, marginTop: 1 }}>{hint}</span>
      </span>
      <span
        aria-hidden
        style={{ width: 34, height: 20, borderRadius: 999, background: checked ? t.accent : t.border2, position: 'relative', flexShrink: 0, transition: 'background 200ms' }}
      >
        <span style={{ position: 'absolute', top: 2, left: checked ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 200ms' }}>
          {checked && <Check size={10} color={t.accent} style={{ margin: 3 }} />}
        </span>
      </span>
    </button>
  )
}

/** Iconos de los tres estilos de fondo. */
function BgIcon({ type, color }: { type: BgStyle; color: string }) {
  if (type === 'flat') {
    return (
      <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden>
        <rect x="1" y="1" width="12" height="12" rx="2" fill={color} />
      </svg>
    )
  }
  const r = type === 'dots-light' ? 1 : 1.4
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden>
      {[2, 7, 12].flatMap((x) => [2, 7, 12].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={color} opacity={type === 'dots-light' ? 0.5 : 1} />))}
    </svg>
  )
}

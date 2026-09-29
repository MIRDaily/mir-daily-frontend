import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

interface MapTitleBarProps {
  title: string
  onTitleChange: (title: string) => void
  save: SaveState
  onRetry: () => void
}

/** Volver a la lista, título del mapa y estado del guardado. Mismo lenguaje visual que MainToolbar. */
export function MapTitleBar({ title, onTitleChange, save, onRetry }: MapTitleBarProps) {
  const t = useTheme()

  return (
    <div
      className="mapa-titlebar"
      style={{
        position: 'absolute',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: t.bgPanel,
        border: `1px solid ${t.border}`,
        borderRadius: 14,
        padding: '6px 12px 6px 6px',
        boxShadow: `0 4px 24px ${t.shadow}`,
        backdropFilter: 'blur(16px)',
        transition: 'background 400ms ease, border-color 400ms ease',
      }}
    >
      <Link
        href="/mapas"
        title="Mis mapas"
        aria-label="Volver a mis mapas"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 30,
          height: 30,
          borderRadius: 8,
          color: t.textSecondary,
          flexShrink: 0,
        }}
      >
        <ArrowLeft size={16} />
      </Link>
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value.slice(0, 200))}
        placeholder="Título del mapa"
        aria-label="Título del mapa"
        style={{
          minWidth: 0,
          flex: 1,
          width: 190,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: t.textPrimary,
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'inherit',
        }}
      />
      {save === 'error' ? (
        <button
          type="button"
          onClick={onRetry}
          title="No se pudo guardar. Reintentando; pulsa para reintentar ya."
          style={{
            flexShrink: 0,
            border: 'none',
            cursor: 'pointer',
            borderRadius: 8,
            padding: '3px 8px',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'inherit',
            background: `${t.danger}22`,
            color: t.danger,
          }}
        >
          Sin guardar · reintentar
        </button>
      ) : (
        <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 500, color: t.textMuted, whiteSpace: 'nowrap' }}>
          {save === 'saved' ? 'Guardado' : save === 'saving' ? 'Guardando…' : 'Cambios sin guardar'}
        </span>
      )}
    </div>
  )
}

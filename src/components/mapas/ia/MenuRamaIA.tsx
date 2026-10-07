'use client'

import { useEffect, useRef } from 'react'
import { FilePlus2, Sparkles } from 'lucide-react'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import { ACCIONES_RAMA } from '@/lib/mapas/ia/rama'

// Menú de clic derecho de un nodo (informe 76): rehacer, ampliar o resumir ESA rama con la IA.
// Solo aparece si la IA de mapas está disponible para el usuario (ver MindMapNode).

export function MenuRamaIA() {
  const menu = useUIStore((s) => s.menuRama)
  const t = useTheme()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const cerrar = () => useUIStore.getState().setMenuRama(null)
    const fuera = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) cerrar()
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
    }
    window.addEventListener('mousedown', fuera, true)
    window.addEventListener('keydown', tecla)
    window.addEventListener('wheel', cerrar, { passive: true })
    return () => {
      window.removeEventListener('mousedown', fuera, true)
      window.removeEventListener('keydown', tecla)
      window.removeEventListener('wheel', cerrar)
    }
  }, [menu])

  if (!menu) return null
  const ink = t.isDark ? '#FAF7F4' : '#2C3E50'
  const borde = t.isDark ? t.border2 : '#2C3E50'
  // Dentro de la ventana aunque el clic sea en un borde.
  const ancho = 272
  const alto = 262
  const x = Math.min(menu.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - ancho - 8)
  const y = Math.min(menu.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - alto - 8)

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Rama con IA"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        width: ancho,
        zIndex: 1500,
        borderRadius: 14,
        border: `2px solid ${borde}`,
        boxShadow: `4px 4px 0 0 ${t.isDark ? '#000' : '#2C3E50'}`,
        background: t.isDark ? t.bgPanel2 : '#FFFFFF',
        color: ink,
        padding: 6,
      }}
    >
      <p style={{ margin: '4px 8px 6px', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.textSecondary, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Sparkles size={13} color={t.accent} /> Esta rama con IA
      </p>
      {ACCIONES_RAMA.map((a) => (
        <button
          key={a.id}
          type="button"
          role="menuitem"
          onClick={() => {
            const ui = useUIStore.getState()
            ui.setMenuRama(null)
            ui.setRamaIA({ id: menu.id, accion: a.id })
          }}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '7px 9px',
            border: 0,
            borderRadius: 9,
            background: 'transparent',
            color: ink,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = t.hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800 }}>{a.titulo}</span>
          <span style={{ display: 'block', fontSize: '0.72rem', color: t.textSecondary, lineHeight: 1.3 }}>{a.descripcion}</span>
        </button>
      ))}
      <div style={{ height: 1, background: t.border, margin: '4px 6px' }} />
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          const ui = useUIStore.getState()
          ui.setMenuRama(null)
          ui.setAnadirDoc(true)
        }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '7px 9px', border: 0, borderRadius: 9, background: 'transparent', color: ink, fontFamily: 'inherit', cursor: 'pointer' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = t.hoverBg)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <FilePlus2 size={16} color={t.accent} style={{ flexShrink: 0 }} />
        <span>
          <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800 }}>Añadir un documento al mapa</span>
          <span style={{ display: 'block', fontSize: '0.72rem', color: t.textSecondary, lineHeight: 1.3 }}>Otro PDF, Word o PowerPoint del mismo tema: lo nuevo, a su sitio.</span>
        </span>
      </button>
    </div>
  )
}

'use client'

// Menú desplegable (kebab) reutilizable y accesible.
// Cierra al hacer click fuera o pulsar Escape. Los items pueden llevar icono
// (material-symbols) y una variante "danger".

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type MenuItem = {
  label: string
  icon?: string
  onSelect: () => void
  danger?: boolean
}

export default function DropdownMenu({
  items,
  ariaLabel = 'Acciones',
  align = 'right',
}: {
  items: MenuItem[]
  ariaLabel?: string
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const place = () => {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const width = 200
      const left = align === 'right' ? r.right - width : r.left
      setCoords({ top: r.bottom + 8, left: Math.max(8, left) })
    }
    place()

    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDocClick)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, align])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-slate-400 transition hover:border-[#EAE4E2] hover:bg-slate-50 hover:text-slate-700 ${
          open ? 'border-[#EAE4E2] bg-slate-50 text-slate-700' : ''
        }`}
      >
        <span className="material-symbols-outlined text-[20px]">more_vert</span>
      </button>

      {open && coords && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ position: 'fixed', top: coords.top, left: coords.left, width: 200 }}
              className="z-[200] overflow-hidden rounded-xl border border-[#EAE4E2] bg-white/95 p-1 shadow-xl shadow-black/10 backdrop-blur-sm"
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpen(false)
                    item.onSelect()
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                    item.danger
                      ? 'text-[#C4655A] hover:bg-[#FFF1EE]'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {item.icon ? (
                    <span className="material-symbols-outlined text-[19px]">{item.icon}</span>
                  ) : null}
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

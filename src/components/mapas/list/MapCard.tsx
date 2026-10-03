'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { MapSummary } from '@/lib/mapas/api'
import { listSubjects, subjectVisual } from '@/lib/subjectVisuals'
import { MapThumb } from '@/components/mapas/list/MapThumb'

const SUBJECTS = listSubjects()

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

type Props = {
  map: MapSummary
  pinSupported: boolean
  renaming: boolean
  onStartRename: () => void
  onRename: (title: string) => void
  onCancelRename: () => void
  onDuplicate: () => void
  onSubject: (subject: string | null) => void
  onPin: () => void
  onDelete: () => void
}

/** Tarjeta de un mapa: miniatura, título, asignatura y menú «⋯» (renombrar, duplicar, fijar…). */
export function MapCard({ map, pinSupported, renaming, onStartRename, onRename, onCancelRename, onDuplicate, onSubject, onPin, onDelete }: Props) {
  const [menu, setMenu] = useState<'closed' | 'main' | 'subject'>('closed')
  const ref = useRef<HTMLDivElement>(null)
  const subj = map.subject ? subjectVisual(map.subject) : null

  useEffect(() => {
    if (menu === 'closed') return
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu('closed')
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu('closed')
    }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
    }
  }, [menu])

  const item = 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#2C3E50] transition-colors hover:bg-[#FAF7F4]'

  return (
    <article className="group relative flex flex-col rounded-3xl border border-[#7D8A96]/15 bg-white shadow-sm transition-shadow hover:shadow-md">
      <Link href={`/mapas/${map.id}`} className="relative block aspect-[16/10] overflow-hidden rounded-t-3xl bg-[#F5F1EC] p-3" tabIndex={-1} aria-label={`Abrir ${map.title}`}>
        <MapThumb thumb={map.thumb} />
        {map.pinned && (
          <span className="absolute top-3 left-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#E8A598] shadow-sm" title="Fijado">
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>push_pin</span>
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {renaming ? (
          <RenameInput initial={map.title} onDone={onRename} onCancel={onCancelRename} />
        ) : (
          <Link href={`/mapas/${map.id}`} className="block">
            <h2 className="line-clamp-2 text-base leading-snug font-bold text-[#2C3E50]">{map.title || 'Mapa sin título'}</h2>
          </Link>
        )}
        <p className="text-xs font-medium text-[#7D8A96]">
          {map.nodeCount} {map.nodeCount === 1 ? 'nodo' : 'nodos'} · {formatDate(map.updated_at)}
        </p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {subj && (
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: subj.color.soft, color: subj.color.text }}>
              {map.subject}
            </span>
          )}
          {map.example && (
            <span className="rounded-full bg-[#FCEFEC] px-2.5 py-0.5 text-[11px] font-bold text-[#B87A6F]" title="Mapa de ejemplo para experimentar; se retirará antes del lanzamiento">
              Ejemplo
            </span>
          )}
        </div>
      </div>

      {/* Menú */}
      <div ref={ref} className="absolute top-3 right-3">
        <button
          type="button"
          onClick={() => setMenu(menu === 'closed' ? 'main' : 'closed')}
          aria-label={`Opciones de ${map.title}`}
          aria-haspopup="menu"
          aria-expanded={menu !== 'closed'}
          className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#7D8A96] shadow-sm transition-opacity hover:text-[#2C3E50] focus:opacity-100 ${menu !== 'closed' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} [@media(hover:none)]:opacity-100`}
        >
          <span className="material-symbols-outlined text-[20px]">more_horiz</span>
        </button>

        {menu === 'main' && (
          <div role="menu" className="absolute top-10 right-0 z-30 w-56 rounded-2xl border border-[#7D8A96]/15 bg-white p-1.5 shadow-xl">
            <button role="menuitem" className={item} onClick={() => { setMenu('closed'); onStartRename() }}>
              <span className="material-symbols-outlined text-[18px] text-[#7D8A96]">edit</span>Renombrar
            </button>
            <button role="menuitem" className={item} onClick={() => { setMenu('closed'); onDuplicate() }}>
              <span className="material-symbols-outlined text-[18px] text-[#7D8A96]">content_copy</span>Duplicar
            </button>
            {pinSupported && (
              <button role="menuitem" className={item} onClick={() => { setMenu('closed'); onPin() }}>
                <span className="material-symbols-outlined text-[18px] text-[#7D8A96]">push_pin</span>
                {map.pinned ? 'Dejar de fijar' : 'Fijar arriba'}
              </button>
            )}
            {!map.example && (
              <button role="menuitem" className={item} onClick={() => setMenu('subject')}>
                <span className="material-symbols-outlined text-[18px] text-[#7D8A96]">label</span>
                Asignatura
                <span className="material-symbols-outlined ml-auto text-[18px] text-[#7D8A96]">chevron_right</span>
              </button>
            )}
            <div className="my-1 h-px bg-[#7D8A96]/15" />
            <button role="menuitem" className={`${item} !text-[#B87A6F]`} onClick={() => { setMenu('closed'); onDelete() }}>
              <span className="material-symbols-outlined text-[18px]">delete</span>Enviar a la papelera
            </button>
          </div>
        )}

        {menu === 'subject' && (
          <div role="menu" aria-label="Asignatura" className="absolute top-10 right-0 z-30 w-60 rounded-2xl border border-[#7D8A96]/15 bg-white p-1.5 shadow-xl">
            <button className={`${item} text-[#7D8A96]`} onClick={() => setMenu('main')}>
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>Asignatura
            </button>
            <div className="max-h-64 overflow-y-auto">
              <button role="menuitemradio" aria-checked={!map.subject} className={item} onClick={() => { setMenu('closed'); onSubject(null) }}>
                Sin asignatura
              </button>
              {SUBJECTS.map((s) => (
                <button
                  key={s.label}
                  role="menuitemradio"
                  aria-checked={map.subject === s.label}
                  className={`${item} ${map.subject === s.label ? 'bg-[#FAF7F4]' : ''}`}
                  onClick={() => { setMenu('closed'); onSubject(s.label) }}
                >
                  <span className="material-symbols-outlined text-[18px] text-[#7D8A96]">{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

/** Campo para renombrar en la propia tarjeta: Enter guarda, Esc cancela, perder el foco guarda. */
function RenameInput({ initial, onDone, onCancel }: { initial: string; onDone: (t: string) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(initial)
  const finished = useRef(false)
  const finish = (save: boolean) => {
    if (finished.current) return
    finished.current = true
    if (save) onDone(draft)
    else onCancel()
  }
  return (
    <input
      autoFocus
      value={draft}
      maxLength={200}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(true)
        if (e.key === 'Escape') finish(false)
      }}
      onBlur={() => finish(true)}
      aria-label="Nuevo título del mapa"
      className="w-full rounded-lg border border-[#E8A598] bg-[#FAF7F4] px-2 py-1 text-base font-bold text-[#2C3E50] outline-none"
    />
  )
}

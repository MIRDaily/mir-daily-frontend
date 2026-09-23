'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export type GuideTocChild = { id: string; label: string; color?: string }
export type GuideTocItem = { id: string; label: string; icon: string; children?: GuideTocChild[] }

type GuideTableOfContentsProps = {
  items: GuideTocItem[]
  /** sidebar: índice lateral (xl+); bar: barra flotante (por debajo de xl) */
  variant: 'sidebar' | 'bar'
}

type SpyState = {
  /** Secciones activas (más de una si están lado a lado en la misma fila) */
  active: string[]
  activeChild: string | null
  /** Cuánto se ha recorrido (0-1) del último apartado activo hasta el siguiente */
  fraction: number
  progress: number
  headerHeight: number
}

// Separación entre el borde del índice y el inicio de la línea vertical (top-1 / bottom-1).
const LINE_INSET = 4

// Un bloque cuenta como "en curso" cuando su borde superior ha pasado esta línea bajo la cabecera.
const SPY_OFFSET = 48

function readSpyState(items: GuideTocItem[]): SpyState {
  // La cabecera global es un nav sticky top-0 (GlobalHeader/AppHeader).
  const header = document.querySelector('.sticky.top-0')
  const headerHeight = header ? header.getBoundingClientRect().height : 0
  const line = headerHeight + SPY_OFFSET

  let bestTop = -Infinity
  let active: string[] = []
  for (const item of items) {
    const element = document.getElementById(item.id)
    if (!element) continue
    const top = element.getBoundingClientRect().top
    if (top > line) continue
    if (top > bestTop + 4) {
      bestTop = top
      active = [item.id]
    } else if (Math.abs(top - bestTop) <= 4) {
      active.push(item.id)
    }
  }
  if (active.length === 0 && items[0]) active = [items[0].id]

  let activeChild: string | null = null
  for (const item of items) {
    if (!active.includes(item.id) || !item.children) continue
    for (const child of item.children) {
      const element = document.getElementById(child.id)
      if (element && element.getBoundingClientRect().top <= line) activeChild = child.id
    }
  }

  const scrollable = document.documentElement.scrollHeight - window.innerHeight
  const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0

  // Avance dentro del apartado en curso: de su borde superior al del siguiente (o al final de la página).
  const lastIndex = items.findLastIndex((item) => active.includes(item.id))
  let fraction = 0
  const current = lastIndex >= 0 ? document.getElementById(items[lastIndex].id) : null
  if (current) {
    const top = current.getBoundingClientRect().top
    const next = items[lastIndex + 1] ? document.getElementById(items[lastIndex + 1].id) : null
    const end = next ? next.getBoundingClientRect().top : top + current.getBoundingClientRect().height
    fraction = end > top ? Math.min(1, Math.max(0, (line - top) / (end - top))) : 0
    if (!next && progress >= 0.999) fraction = 1
  }

  return { active, activeChild, fraction, progress, headerHeight }
}

export function goTo(id: string) {
  const element = document.getElementById(id)
  if (!element) return
  if (element instanceof HTMLDetailsElement) element.open = true
  element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  history.replaceState(null, '', `#${id}`)
}

export default function GuideTableOfContents({ items, variant }: GuideTableOfContentsProps) {
  const [spy, setSpy] = useState<SpyState>({ active: [], activeChild: null, fraction: 0, progress: 0, headerHeight: 0 })
  const [mobileOpen, setMobileOpen] = useState(false)
  // Se incrementa al terminar de desplegar un subíndice para volver a medir la línea.
  const [layoutTick, setLayoutTick] = useState(0)
  const timelineRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const update = () => setSpy(readSpyState(items))
    const initial = window.setTimeout(update, 0)
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    // Abrir o cerrar un tema cambia la posición de lo que viene detrás.
    document.addEventListener('toggle', update, true)
    return () => {
      window.clearTimeout(initial)
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      document.removeEventListener('toggle', update, true)
    }
  }, [items])

  const current = items.find((item) => spy.active.includes(item.id)) ?? items[0]
  const firstActiveIndex = items.findIndex((item) => spy.active.includes(item.id))
  const lastActiveIndex = items.findLastIndex((item) => spy.active.includes(item.id))

  // La línea llega al punto del apartado en curso y avanza hacia el siguiente según lo leído.
  useLayoutEffect(() => {
    const timeline = timelineRef.current
    const fill = fillRef.current
    if (!timeline || !fill) return
    const base = timeline.getBoundingClientRect().top + LINE_INSET
    const centers = Array.from(timeline.querySelectorAll<HTMLElement>('[data-toc-dot]')).map((dot) => {
      const rect = dot.getBoundingClientRect()
      return rect.top + rect.height / 2 - base
    })
    if (lastActiveIndex < 0 || centers.length === 0) {
      fill.style.height = '0px'
      return
    }
    const from = centers[lastActiveIndex]
    const to = centers[lastActiveIndex + 1] ?? timeline.getBoundingClientRect().height - LINE_INSET * 2
    fill.style.height = `${Math.max(0, from + (to - from) * spy.fraction)}px`
  }, [lastActiveIndex, spy.fraction, layoutTick])
  const percent = Math.round(spy.progress * 100)

  const handleClick = (event: React.MouseEvent, id: string) => {
    event.preventDefault()
    setMobileOpen(false)
    goTo(id)
  }

  if (variant === 'sidebar') {
    return (
      <nav
        aria-label="Índice de la guía"
        className="sticky hidden max-h-[calc(100vh-7rem)] flex-col gap-4 overflow-y-auto pt-1 pr-1 pb-6 pl-2 xl:flex"
        style={{ top: spy.headerHeight + 24 }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-[#7D8A96] uppercase">Índice</span>
          <span className="text-[11px] font-semibold text-[#7D8A96] tabular-nums">{percent}%</span>
        </div>

        <div ref={timelineRef} className="relative pl-5">
          <div className="absolute top-1 bottom-1 left-[5px] w-0.5 overflow-hidden rounded-full bg-[#EAE4E2]" aria-hidden>
            <div ref={fillRef} className="h-0 w-full rounded-full bg-[#E8A598] transition-[height] duration-200 ease-out" />
          </div>

          <ol className="flex flex-col gap-0.5">
            {items.map((item, index) => {
              const isActive = spy.active.includes(item.id)
              const isPassed = firstActiveIndex >= 0 && index < firstActiveIndex
              const showChildren = isActive && item.children && item.children.length > 0
              return (
                <li key={item.id} className="relative">
                  <span
                    data-toc-dot
                    className={`absolute top-[13px] -left-5 z-10 h-3 w-3 rounded-full border-2 transition-all duration-300 ${
                      isActive
                        ? 'scale-110 border-[#E8A598] bg-[#E8A598] shadow-[0_0_0_4px_rgba(232,165,152,0.2)]'
                        : isPassed
                          ? 'border-[#E8A598] bg-white'
                          : 'border-[#D5CFCB] bg-[#FAF7F4]'
                    }`}
                    aria-hidden
                  />
                  <a
                    href={`#${item.id}`}
                    onClick={(event) => handleClick(event, item.id)}
                    aria-current={isActive ? 'location' : undefined}
                    className={`relative flex items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] leading-tight transition-colors ${
                      isActive ? 'font-bold text-[#2C3E50]' : 'text-[#7D8A96] hover:text-[#2C3E50]'
                    }`}
                  >
                    {spy.active[0] === item.id ? (
                      <motion.span
                        layoutId="guia-toc-active"
                        className="absolute inset-0 rounded-xl bg-white shadow-sm ring-1 ring-[#EAE4E2]"
                        transition={{ type: 'spring', stiffness: 400, damping: 36 }}
                      />
                    ) : null}
                    <span className={`material-symbols-outlined relative text-[17px] ${isActive ? 'text-[#E8A598]' : ''}`}>{item.icon}</span>
                    <span className="relative">{item.label}</span>
                  </a>

                  <AnimatePresence initial={false}>
                    {showChildren ? (
                      <motion.ol
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        onAnimationComplete={() => setLayoutTick((tick) => tick + 1)}
                        className="ml-4 flex flex-col overflow-hidden border-l border-[#EAE4E2] py-1"
                      >
                        {item.children?.map((child) => {
                          const childActive = spy.activeChild === child.id
                          return (
                            <li key={child.id}>
                              <a
                                href={`#${child.id}`}
                                onClick={(event) => handleClick(event, child.id)}
                                aria-current={childActive ? 'location' : undefined}
                                className={`-ml-px flex items-center gap-2 border-l-2 py-1 pr-2 pl-3 text-xs transition-colors ${
                                  childActive
                                    ? 'border-[#2C3E50] font-semibold text-[#2C3E50]'
                                    : 'border-transparent text-[#7D8A96] hover:text-[#2C3E50]'
                                }`}
                              >
                                {child.color ? (
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: child.color }} />
                                ) : null}
                                <span className="truncate">{child.label}</span>
                              </a>
                            </li>
                          )
                        })}
                      </motion.ol>
                    ) : null}
                  </AnimatePresence>
                </li>
              )
            })}
          </ol>
        </div>

        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className={`flex w-fit items-center gap-1 rounded-full border border-[#EAE4E2] bg-white px-3 py-1.5 text-xs font-semibold text-[#2C3E50] transition-all hover:border-[#E8A598] ${
            spy.progress > 0.05 ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
          Volver arriba
        </button>
      </nav>
    )
  }

  // Móvil y tablet: barra flotante con la sección actual
  return (
      <div className="sticky z-40 -mx-4 px-4 xl:hidden" style={{ top: spy.headerHeight + 8 }}>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            className="relative flex w-full items-center gap-2 overflow-hidden rounded-2xl border border-[#EAE4E2] bg-white/95 px-4 py-2.5 text-left shadow-sm backdrop-blur"
          >
            <span className="material-symbols-outlined text-[18px] text-[#E8A598]">{current?.icon ?? 'toc'}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#2C3E50]">{current?.label}</span>
            <span className="text-xs font-semibold text-[#7D8A96] tabular-nums">{percent}%</span>
            <span className={`material-symbols-outlined text-[#7D8A96] transition-transform ${mobileOpen ? 'rotate-180' : ''}`}>expand_more</span>
            <span className="absolute bottom-0 left-0 h-0.5 bg-[#E8A598] transition-[width] duration-150" style={{ width: `${percent}%` }} />
          </button>

          <AnimatePresence>
            {mobileOpen ? (
              <motion.ol
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-x-0 top-full mt-2 flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto rounded-2xl border border-[#EAE4E2] bg-white p-2 shadow-xl"
              >
                {items.map((item) => {
                  const isActive = spy.active.includes(item.id)
                  return (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        onClick={(event) => handleClick(event, item.id)}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${
                          isActive ? 'bg-[#E8A598]/15 font-bold text-[#2C3E50]' : 'text-[#2C3E50]'
                        }`}
                      >
                        <span className={`material-symbols-outlined text-[18px] ${isActive ? 'text-[#E8A598]' : 'text-[#7D8A96]'}`}>{item.icon}</span>
                        {item.label}
                      </a>
                    </li>
                  )
                })}
              </motion.ol>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
  )
}

// Accesos rápidos del banner: los mismos apartados que el índice, con desplazamiento suave.
export function GuideSectionChips({ items }: { items: GuideTocItem[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          onClick={(event) => {
            event.preventDefault()
            goTo(item.id)
          }}
          className="flex items-center gap-1.5 rounded-full border border-[#EAE4E2] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#2C3E50] transition-colors hover:border-[#E8A598] hover:text-[#B5655A]"
        >
          <span className="material-symbols-outlined text-[15px] text-[#E8A598]">{item.icon}</span>
          {item.label}
        </a>
      ))}
    </div>
  )
}

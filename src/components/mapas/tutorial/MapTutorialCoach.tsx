'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useReactFlow } from '@xyflow/react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronRight, Minimize2, Play, RotateCcw, X } from 'lucide-react'
import MascotBubble from '@/components/tutorial/MascotBubble'
import { desbloquearVoz } from '@/lib/tutorials/mascotAudio'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { cancelRuns, DemoCancelled, newRun, wait } from './fx'
import { runDemo } from './demos'
import { LESSONS, type CheckCtx, type Line } from './lessons'
import { HelpButtonIcon, KeyCap, TutorialFx } from './TutorialFx'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { COACH_WIDTH, TUTORIAL_FIT } from './layout'
import { readLessonsDone, writeLessonsDone } from './progress'

// El entrenador del tutorial de mapas (/mapas/tutorial). Vive DENTRO del editor, sobre un mapa
// de práctica: la mascota cuenta (MascotBubble, la misma del Studio), el propio motor lo enseña
// (demos.ts) y el usuario lo prueba con tareas que se marcan solas al detectarlo.
//
// No es modal: el mapa tiene que poder usarse mientras tanto. Por eso sus botones no se quedan
// con el foco (onMouseDown → preventDefault): si lo hicieran, el siguiente Tab o Enter del
// usuario iría al botón en vez de al mapa.


const LEFT = 16
const TOP = 16

type Phase = 'intro' | 'demo' | 'practice'

const PRACTICE_LINE: Line = { pose: 'senalando-abajo', text: 'Ahora tú. Aquí abajo tienes lo que hay que hacer.' }
const DONE_FALLBACK: Line = { pose: 'celebracion', text: '¡Hecho!' }

/** Que un botón del entrenador no se quede con el foco (el teclado es del mapa). */
const keepFocus = (e: React.MouseEvent) => e.preventDefault()

export function MapTutorialCoach({ startAt = 0 }: { startAt?: number }) {
  const router = useRouter()
  const flow = useReactFlow()
  const [lessonIdx, setLessonIdx] = useState(() => Math.min(Math.max(startAt, 0), LESSONS.length - 1))
  const [phase, setPhase] = useState<Phase>('intro')
  const [lineIdx, setLineIdx] = useState(0)
  const [typedKey, setTypedKey] = useState<string | null>(null)
  const [minimized, setMinimized] = useState(false)
  const [doneLessons, setDoneLessons] = useState<string[]>(readLessonsDone)
  const [ready, setReady] = useState(false)

  const lesson = LESSONS[lessonIdx]
  const isLast = lessonIdx === LESSONS.length - 1

  // ── Lo que pasa en el mapa durante la práctica ─────────────────────────────
  const events = useRef<Set<string>>(new Set())
  const base = useRef<CheckCtx['base'] | null>(null)
  const passed = useRef<Set<string>>(new Set())
  const [, bump] = useState(0)
  // Las tareas se comprueban sobre el mapa, pero NO se re-renderiza el entrenador (mascota, tareas…)
  // en cada fotograma de un arrastre: la store avisa con un pequeño retardo y se mira entonces.
  const [mapTick, setMapTick] = useState(0)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsub = useMindMapStore.subscribe((s, p) => {
      if (s.nodes === p.nodes && s.edges === p.edges && s.editingNodeId === p.editingNodeId) return
      if (timer) return
      timer = setTimeout(() => {
        timer = undefined
        setMapTick((n) => n + 1)
      }, 120)
    })
    return () => {
      unsub()
      if (timer) clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    // El editor ordena el mapa de práctica al abrirlo: se espera a que esté colocado para que
    // la primera demostración no apunte a nodos que aún se están moviendo.
    const t = setTimeout(() => setReady(true), 700)
    return () => clearTimeout(t)
  }, [])

  // El mapa de práctica tal como queda al abrir el tutorial (ya ordenado). Cada lección y cada demo
  // empiezan desde aquí: si el usuario borra o descoloca nodos que luego usa una demostración (p. ej.
  // «HTA»), la demo no se rompe.
  const pristine = useRef<{ nodes: ReturnType<typeof useMindMapStore.getState>['nodes']; edges: ReturnType<typeof useMindMapStore.getState>['edges'] } | null>(null)
  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => {
      const s = useMindMapStore.getState()
      pristine.current = { nodes: structuredClone(s.nodes), edges: structuredClone(s.edges) }
    }, 500)
    return () => clearTimeout(t)
  }, [ready])

  const resetMap = useCallback(() => {
    const p = pristine.current
    if (!p) return
    useHistoryStore.getState().clear()
    useUIStore.getState().setCategoryStyles({})
    useUIStore.getState().setStylePanelOpen(false)
    useMindMapStore.setState({
      nodes: structuredClone(p.nodes).map((n) => ({ ...n, selected: false })),
      edges: structuredClone(p.edges).map((e) => ({ ...e, selected: false })),
      editingNodeId: null,
      hoveredNodeId: null,
    })
    useMindMapStore.getState().syncCollapse()
  }, [])

  const note = useCallback((e: string) => {
    if (events.current.has(e)) return
    events.current.add(e)
    bump((n) => n + 1)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (e.key === 'Tab') note('Tab')
      else if (e.key === 'Enter') note('Enter')
      else if (e.key.startsWith('Arrow')) note('Arrow')
      else if (e.key === 'F2') note('F2')
      else if (e.key === ' ') note('Space')
      if (e.altKey && /^Digit[1-3]$/.test(e.code)) note(`Alt${e.code.slice(5)}`)
      if (!mod && !e.altKey && e.key.length === 1 && e.key !== ' ' && !(e.target as HTMLElement | null)?.isContentEditable) note('typed')
      if (e.altKey && e.code === 'Digit0') note('Alt0')
      if (mod && e.key.toLowerCase() === 'f') note('CtrlF')
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) note('CtrlZ')
    }
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null
      if (t?.closest?.('.react-flow__node')) note('node-click')
      if (t?.closest?.('[data-tuto="style-reset"]')) note('style-reset')
      if (t?.closest?.('.react-flow__controls-zoomin, .react-flow__controls-zoomout')) note('zoom')
      // El menú «Niveles» de la barra vale lo mismo que Alt+1…3 / Alt+0.
      const lvl = (t?.closest?.('[role="menuitem"]') as HTMLElement | null)?.title ?? ''
      const m = /^Ver hasta el nivel ([1-3])/.exec(lvl)
      if (m) note(`Alt${m[1]}`)
      if (/^Desplegarlo todo/.test(lvl)) note('Alt0')
      if (t?.closest?.('[data-tuto="export-dialog"] button[aria-pressed]')?.textContent?.includes('Una hoja por rama')) note('export-branches')
      if (t?.closest?.('button[title="Ordenar el mapa automáticamente"]')) {
        note('ordenar')
        const { nodes } = useMindMapStore.getState()
        const sel = nodes.filter((n) => n.selected && !n.hidden).length
        // "Ordenar" solo cuenta si de verdad coloca algo: se compara dónde estaban los nodos antes
        // de pulsar con dónde están un momento después.
        const before = new Map(nodes.map((n) => [n.id, n.position]))
        setTimeout(() => {
          const moved = useMindMapStore
            .getState()
            .nodes.some((n) => {
              const b = before.get(n.id)
              return b && Math.hypot(n.position.x - b.x, n.position.y - b.y) > 4
            })
          if (!moved) return
          note('ordenar-cambio')
          if (sel > 1) note('ordenar-bloque-cambio')
        }, 120)
      }
    }
    const onDblClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.('.react-flow__node')) note('dblclick')
    }
    // Rueda sin Ctrl = mover el mapa; con Ctrl (o pellizco) = zoom.
    const onWheel = (e: WheelEvent) => {
      if (!(e.target as Element | null)?.closest?.('.react-flow')) return
      note(e.ctrlKey || e.metaKey ? 'zoom' : 'pan')
    }
    // Arrastrar con el botón central o el derecho también mueve el mapa.
    const onPointerMove = (e: PointerEvent) => {
      if ((e.buttons & 6) === 0) return
      if ((e.target as Element | null)?.closest?.('.react-flow__pane')) note('pan')
    }
    const unMap = useMindMapStore.subscribe((s, p) => {
      if (s.editingNodeId && !p.editingNodeId) note('editing')
      if (s.nodes !== p.nodes) {
        const was = new Map(p.nodes.map((n) => [n.id, !!n.data.collapsed]))
        for (const n of s.nodes) {
          const before = was.get(n.id)
          if (before === false && n.data.collapsed) note('fold')
          if (before === true && !n.data.collapsed) note('unfold')
        }
      }
    })
    const unUi = useUIStore.subscribe((s, p) => {
      if (s.searchOpen && !p.searchOpen) note('search-open')
      if (s.stylePanelOpen && !p.stylePanelOpen) note('style-open')
      if (s.categoriesPanelOpen && !p.categoriesPanelOpen) note('cat-open')
      if (s.exportOpen && !p.exportOpen) note('export-open')
      if (s.categoryStyles !== p.categoryStyles) note('cat-style')
    })
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('dblclick', onDblClick, true)
    document.addEventListener('wheel', onWheel, { capture: true, passive: true })
    document.addEventListener('pointermove', onPointerMove, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('dblclick', onDblClick, true)
      document.removeEventListener('wheel', onWheel, true)
      document.removeEventListener('pointermove', onPointerMove, true)
      unMap()
      unUi()
    }
  }, [note])

  // ── Fases ──────────────────────────────────────────────────────────────────
  const startPractice = useCallback(() => {
    const s = useMindMapStore.getState()
    base.current = { nodes: s.nodes, edges: s.edges, selected: s.nodes.find((n) => n.selected)?.id ?? null }
    events.current = new Set()
    passed.current = new Set()
    setPhase('practice')
  }, [])

  const startDemo = useCallback(() => {
    if (!lesson.demo) {
      startPractice()
      return
    }
    resetMap()
    const run = newRun()
    setPhase('demo')
    // La cámara se fija en el encuadre óptimo antes de empezar (y el mapa queda bloqueado mientras
    // dura, ver el escudo más abajo): las demostraciones apuntan a posiciones de pantalla, y si la
    // vista se mueve a mitad el cursor y las teclas dejan de coincidir con los nodos.
    wait(run, 120)
      .then(async () => {
        await flow.fitView({ ...TUTORIAL_FIT, duration: 450 })
        await wait(run, 200)
      })
      .then(() => runDemo(lesson.demo!, run))
      .then(() => startPractice())
      .catch((e: unknown) => {
        if (!(e instanceof DemoCancelled)) startPractice()
      })
  }, [lesson.demo, startPractice, resetMap, flow])

  const goTo = useCallback((idx: number) => {
    cancelRuns()
    base.current = null
    // Lo que dejó abierto la lección anterior (paneles de estilo, buscador…) no debe pasar a la
    // siguiente, y el mapa se vuelve a encuadrar por si se movió o se acercó.
    const ui = useUIStore.getState()
    ui.setStylePanelOpen(false)
    ui.setCategoriesPanelOpen(false)
    ui.setExportOpen(false)
    ui.setSearchOpen(false)
    resetMap()
    void flow.fitView({ ...TUTORIAL_FIT, duration: 500 })
    setLessonIdx(Math.min(Math.max(idx, 0), LESSONS.length - 1))
    setPhase('intro')
    setLineIdx(0)
    setTypedKey(null)
  }, [flow, resetMap])

  // Durante una demostración el teclado tampoco llega al mapa (el escudo bloquea el ratón y la rueda).
  useEffect(() => {
    if (phase !== 'demo') return
    const block = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', block, true)
    // Y la cámara se queda quieta: ni el teclado, ni el buscador ni los nodos nuevos la mueven.
    useUIStore.getState().setCameraLocked(true)
    return () => {
      window.removeEventListener('keydown', block, true)
      useUIStore.getState().setCameraLocked(false)
    }
  }, [phase])

  // Al desmontar (salir), que no quede ninguna demostración a medias.
  useEffect(() => () => cancelRuns(), [])

  // ── Estado de las tareas ───────────────────────────────────────────────────
  const taskState = useMemo(() => {
    if (phase !== 'practice' || !base.current) return lesson.tasks.map(() => false)
    const st = useMindMapStore.getState()
    const ctx: CheckCtx = { nodes: st.nodes, edges: st.edges, base: base.current, events: events.current, editingNodeId: st.editingNodeId }
    return lesson.tasks.map((t) => {
      // Una tarea hecha se queda hecha (deshacer no la desmarca).
      if (passed.current.has(t.id)) return true
      if (t.check(ctx)) {
        passed.current.add(t.id)
        return true
      }
      return false
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, lesson, mapTick, events.current.size])

  const allDone = phase === 'practice' && lesson.tasks.length > 0 && taskState.every(Boolean)

  useEffect(() => {
    if (!allDone) return
    setDoneLessons((prev) => {
      const next = [...new Set([...prev, lesson.id])]
      writeLessonsDone(next)
      return next
    })
  }, [allDone, lesson.id])

  // Señalar en la interfaz lo que pide la tarea pendiente (p. ej. el botón Ordenar).
  useEffect(() => {
    if (phase !== 'practice') return
    const pending = lesson.tasks.find((_, i) => !taskState[i])
    if (!pending?.glow) return
    let els = [...document.querySelectorAll<HTMLElement>(pending.glow)].filter((el) => el.getClientRects().length > 0)
    // Con la ventana estrecha, «Niveles» y «Categorías» están dentro del menú «Vista»: se señala ese.
    if (els.length === 0 && /niveles|categor/i.test(pending.glow)) {
      els = [...document.querySelectorAll<HTMLElement>('[data-tuto="vista"]')]
    }
    els.forEach((el) => el.classList.add('tuto-glow'))
    return () => els.forEach((el) => el.classList.remove('tuto-glow'))
  }, [phase, lesson, taskState])

  // ── Lo que dice la mascota ─────────────────────────────────────────────────
  const line: Line =
    phase === 'intro'
      ? lesson.intro[lineIdx]
      : phase === 'demo'
        ? lesson.demoLine ?? lesson.intro[lesson.intro.length - 1]
        : allDone
          ? lesson.done ?? DONE_FALLBACK
          : PRACTICE_LINE
  const lineKey = `${lesson.id}-${phase}-${lineIdx}-${allDone ? 'ok' : ''}`
  const typed = typedKey === lineKey

  const onBubble = () => {
    void desbloquearVoz()
    if (!typed) {
      window.dispatchEvent(new Event('tutorial:acelerar'))
      return
    }
    if (phase !== 'intro') return
    if (lineIdx + 1 < lesson.intro.length) {
      setLineIdx(lineIdx + 1)
      return
    }
    if (lesson.demo) startDemo()
    else if (lesson.tasks.length) startPractice()
    else {
      // Lecciones sin tareas (bienvenida, despedida): se dan por hechas al leerlas.
      setDoneLessons((prev) => {
        const next = [...new Set([...prev, lesson.id])]
        writeLessonsDone(next)
        return next
      })
      if (!isLast) goTo(lessonIdx + 1)
      else router.push('/mapas')
    }
  }

  const exit = () => {
    cancelRuns()
    router.push('/mapas')
  }

  // Mientras corre una demostración, una capa transparente sobre el mapa se come ratón y rueda: no se
  // puede mover, acercar ni arrastrar nada (la vista y los nodos son de la demo). Debajo del entrenador,
  // para que «Saltar» y minimizar sigan funcionando.
  const shield =
    phase === 'demo' ? (
      <div aria-hidden className="tuto-shield" style={{ position: 'absolute', inset: 0, zIndex: 1050, cursor: 'progress' }} />
    ) : null

  if (!ready) return <TutorialFx leftInset={LEFT + COACH_WIDTH} />

  if (minimized) {
    return (
      <>
        {shield}
        <TutorialFx leftInset={0} />
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={() => setMinimized(false)}
          style={{
            position: 'absolute',
            left: LEFT,
            bottom: 16,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderRadius: 999,
            border: '1px solid #E8A59866',
            background: '#fff',
            color: '#2C3E50',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(44,62,80,.15)',
          }}
        >
          <Play size={13} color="#E8A598" />
          Tutorial · {lessonIdx + 1}/{LESSONS.length} {lesson.title}
        </button>
      </>
    )
  }

  return (
    <>
      {shield}
      <TutorialFx leftInset={LEFT + COACH_WIDTH} />
      <div
        className="tuto-coach"
        style={{
          position: 'absolute',
          left: LEFT,
          top: TOP,
          bottom: 16,
          width: COACH_WIDTH,
          zIndex: 1100,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          pointerEvents: 'none',
        }}
      >
        {/* Cabecera: lección, progreso y controles. */}
        <div
          style={{
            pointerEvents: 'auto',
            background: '#fff',
            border: '1px solid #E8A5984D',
            borderRadius: 18,
            padding: '10px 12px',
            boxShadow: '0 10px 30px rgba(125,138,150,.18)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: '#E8A598', textTransform: 'uppercase' }}>
              Tutorial · {lessonIdx + 1}/{LESSONS.length}
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#2C3E50', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lesson.title}
            </span>
            <IconBtn title="Minimizar" onClick={() => setMinimized(true)}>
              <Minimize2 size={14} />
            </IconBtn>
            <IconBtn title="Salir del tutorial" onClick={exit}>
              <X size={15} />
            </IconBtn>
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 8 }} role="tablist" aria-label="Lecciones">
            {LESSONS.map((l, i) => {
              const done = doneLessons.includes(l.id)
              const current = i === lessonIdx
              return (
                <button
                  key={l.id}
                  type="button"
                  role="tab"
                  aria-selected={current}
                  title={`${i + 1}. ${l.title}${done ? ' (hecha)' : ''}`}
                  onMouseDown={keepFocus}
                  onClick={() => goTo(i)}
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 999,
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    background: current ? '#E8A598' : done ? '#8BA888' : '#E9E4DF',
                    outline: current ? '2px solid #E8A59855' : 'none',
                    outlineOffset: 2,
                  }}
                />
              )
            })}
          </div>
        </div>

        {/* La mascota. Tocar el bocadillo acelera el texto o pasa al siguiente. */}
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={onBubble}
          aria-label={typed ? 'Siguiente' : 'Escribir más rápido'}
          style={{
            pointerEvents: 'auto',
            background: 'none',
            border: 'none',
            padding: 0,
            textAlign: 'left',
            cursor: phase === 'intro' || !typed ? 'pointer' : 'default',
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={lineKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <MascotBubble texto={line.text} marca={<HelpButtonIcon />} pose={line.pose} apilada onTextoCompleto={() => setTypedKey(lineKey)} />
            </motion.div>
          </AnimatePresence>
        </button>

        {/* Demostración en curso. */}
        {phase === 'demo' && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <motion.span
                animate={{ opacity: [0.35, 1, 0.35] }}
                transition={{ repeat: Infinity, duration: 1.4 }}
                style={{ width: 8, height: 8, borderRadius: 999, background: '#E8A598' }}
              />
              <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#7D8A96' }}>Mira cómo se hace…</span>
              <SmallBtn
                onClick={() => {
                  cancelRuns()
                  startPractice()
                }}
              >
                Saltar
              </SmallBtn>
            </div>
          </Card>
        )}

        {/* Práctica: tareas que se marcan solas. */}
        {phase === 'practice' && lesson.tasks.length > 0 && (
          <Card>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {lesson.tasks.map((t, i) => {
                const ok = taskState[i]
                const active = !ok && taskState.slice(0, i).every(Boolean)
                return (
                  <li key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, opacity: ok || active ? 1 : 0.55 }}>
                    <motion.span
                      animate={ok ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                      transition={{ duration: 0.35 }}
                      style={{
                        flexShrink: 0,
                        marginTop: 1,
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: ok ? '#8BA888' : '#fff',
                        border: ok ? 'none' : `2px solid ${active ? '#E8A598' : '#D8D2CC'}`,
                      }}
                    >
                      {ok && <Check size={13} color="#fff" strokeWidth={3} />}
                    </motion.span>
                    <span style={{ flex: 1, fontSize: 13, lineHeight: 1.45, fontWeight: active ? 700 : 600, color: ok ? '#7D8A96' : '#2C3E50', textDecoration: ok ? 'line-through' : 'none' }}>
                      {t.text}
                      {t.keys && (
                        <span style={{ display: 'inline-flex', gap: 4, marginLeft: 6, verticalAlign: 'middle' }}>
                          {t.keys.map((k) => (
                            <KeyCap key={k} k={k} size="sm" />
                          ))}
                        </span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              {lesson.demo && (
                <SmallBtn onClick={startDemo}>
                  <RotateCcw size={12} /> Ver otra vez
                </SmallBtn>
              )}
              <span style={{ flex: 1 }} />
              {allDone ? (
                <PrimaryBtn onClick={() => goTo(lessonIdx + 1)}>
                  Siguiente <ChevronRight size={14} />
                </PrimaryBtn>
              ) : (
                <SmallBtn onClick={() => goTo(lessonIdx + 1)}>Saltar lección</SmallBtn>
              )}
            </div>
          </Card>
        )}
      </div>
    </>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        pointerEvents: 'auto',
        background: '#fff',
        border: '1px solid #E8A5984D',
        borderRadius: 18,
        padding: '14px 14px 12px',
        boxShadow: '0 18px 40px rgba(125,138,150,.22)',
      }}
    >
      {children}
    </div>
  )
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={keepFocus}
      onClick={onClick}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7D8A96', padding: 4, borderRadius: 8, display: 'flex' }}
    >
      {children}
    </button>
  )
}

function SmallBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={keepFocus}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '6px 11px',
        borderRadius: 10,
        border: '1px solid #7D8A9640',
        background: '#fff',
        color: '#7D8A96',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function PrimaryBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      onMouseDown={keepFocus}
      onClick={onClick}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '7px 14px',
        borderRadius: 10,
        border: 'none',
        background: '#E8A598',
        color: '#fff',
        fontSize: 12,
        fontWeight: 800,
        cursor: 'pointer',
        boxShadow: '0 6px 16px rgba(232,165,152,.45)',
      }}
    >
      {children}
    </motion.button>
  )
}

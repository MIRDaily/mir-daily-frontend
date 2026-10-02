'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronRight, Minimize2, Play, RotateCcw, X } from 'lucide-react'
import MascotBubble from '@/components/tutorial/MascotBubble'
import { desbloquearVoz } from '@/lib/tutorials/mascotAudio'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { cancelRuns, DemoCancelled, newRun } from './fx'
import { runDemo } from './demos'
import { LESSONS, type CheckCtx, type Line } from './lessons'
import { KeyCap, TutorialFx } from './TutorialFx'
import { COACH_WIDTH } from './layout'
import { readLessonsDone, writeLessonsDone } from './progress'

// El entrenador del tutorial de mapas (/mapas/tutorial). Vive DENTRO del editor, sobre un mapa
// de práctica: la mascota cuenta (MascotBubble, la misma del Studio), el propio motor lo enseña
// (demos.ts) y el usuario lo prueba con tareas que se marcan solas al detectarlo.
//
// No es modal: el mapa tiene que poder usarse mientras tanto. Por eso sus botones no se quedan
// con el foco (onMouseDown → preventDefault): si lo hicieran, el siguiente Tab o Enter del
// usuario iría al botón en vez de al mapa.


const LEFT = 16
const TOP = 120

type Phase = 'intro' | 'demo' | 'practice'

const PRACTICE_LINE: Line = { pose: 'senalando-abajo', text: 'Ahora tú. Aquí abajo tienes lo que hay que hacer.' }
const DONE_FALLBACK: Line = { pose: 'celebracion', text: '¡Hecho!' }

/** Que un botón del entrenador no se quede con el foco (el teclado es del mapa). */
const keepFocus = (e: React.MouseEvent) => e.preventDefault()

export function MapTutorialCoach({ startAt = 0 }: { startAt?: number }) {
  const router = useRouter()
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
  const nodes = useMindMapStore((s) => s.nodes)
  const edges = useMindMapStore((s) => s.edges)
  const editingNodeId = useMindMapStore((s) => s.editingNodeId)

  useEffect(() => {
    // El editor ordena el mapa de práctica al abrirlo: se espera a que esté colocado para que
    // la primera demostración no apunte a nodos que aún se están moviendo.
    const t = setTimeout(() => setReady(true), 700)
    return () => clearTimeout(t)
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
      if (e.altKey && e.code === 'Digit1') note('Alt1')
      if (e.altKey && e.code === 'Digit0') note('Alt0')
      if (mod && e.key.toLowerCase() === 'f') note('CtrlF')
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) note('CtrlZ')
    }
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null
      if (t?.closest?.('button[title="Ordenar el mapa automáticamente"]')) {
        note('ordenar')
        const sel = useMindMapStore.getState().nodes.filter((n) => n.selected && !n.hidden).length
        if (sel > 1) note('ordenar-bloque')
      }
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
    })
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('click', onClick, true)
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
    const run = newRun()
    setPhase('demo')
    runDemo(lesson.demo, run)
      .then(() => startPractice())
      .catch((e: unknown) => {
        if (!(e instanceof DemoCancelled)) startPractice()
      })
  }, [lesson.demo, startPractice])

  const goTo = useCallback((idx: number) => {
    cancelRuns()
    base.current = null
    setLessonIdx(Math.min(Math.max(idx, 0), LESSONS.length - 1))
    setPhase('intro')
    setLineIdx(0)
    setTypedKey(null)
  }, [])

  // Al desmontar (salir), que no quede ninguna demostración a medias.
  useEffect(() => () => cancelRuns(), [])

  // ── Estado de las tareas ───────────────────────────────────────────────────
  const taskState = useMemo(() => {
    if (phase !== 'practice' || !base.current) return lesson.tasks.map(() => false)
    const ctx: CheckCtx = { nodes, edges, base: base.current, events: events.current, editingNodeId }
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
  }, [phase, lesson, nodes, edges, editingNodeId, events.current.size])

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
    const els = [...document.querySelectorAll(pending.glow)]
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

  if (!ready) return <TutorialFx leftInset={LEFT + COACH_WIDTH} />

  if (minimized) {
    return (
      <>
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
              <MascotBubble texto={line.text} pose={line.pose} apilada onTextoCompleto={() => setTypedKey(lineKey)} />
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

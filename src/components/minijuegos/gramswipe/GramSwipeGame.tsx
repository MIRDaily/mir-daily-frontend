'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ANTIBIOTICS, COVERAGE_LABELS, shuffleArray, type Antibiotic, type Coverage } from './data'

type ScreenName = 'start' | 'game' | 'results'
type Mode = 'study' | 'quick'
type Direction = 'right' | 'left' | 'up' | 'down'

type AnsweredEntry = {
  card: Antibiotic
  correct: boolean
  dir: Direction
}

type FeedbackState = {
  card: Antibiotic
  correct: boolean
  dir: Direction
}

const DIR_COVERAGE: Record<Direction, Coverage | null> = {
  right: 'gram_positive',
  left: 'gram_negative',
  up: 'broad',
  down: null,
}

const OVERLAY_CONFIG: Record<Direction, { color: string; icon: string; label: string }> = {
  right: { color: '139,168,136', icon: 'add_circle', label: 'Gram +' },
  left: { color: '212,151,140', icon: 'remove_circle', label: 'Gram −' },
  up: { color: '162,120,207', icon: 'swap_horiz', label: 'Amplio espectro' },
  down: { color: '168,164,160', icon: 'help_outline', label: 'No sé' },
}

const ALL_DIRECTIONS: Direction[] = ['right', 'left', 'up', 'down']

const SWIPE_THRESHOLD = 90
const DRAG_THRESHOLD = 8
const MAX_ROTATE = 18

export default function GramSwipeGame() {
  const [screen, setScreen] = useState<ScreenName>('start')
  const [mode, setMode] = useState<Mode>('study')
  const [queue, setQueue] = useState<Antibiotic[]>([])
  const [answered, setAnswered] = useState<AnsweredEntry[]>([])
  const [skippedIds, setSkippedIds] = useState<Set<number>>(new Set())
  const [score, setScore] = useState(0)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)

  const animatingRef = useRef(false)
  const [animating, setAnimating] = useState(false)
  const [swipeCount, setSwipeCount] = useState(0)

  const outerRefs = useRef(new Map<number, HTMLDivElement>())
  const dirRightRef = useRef<HTMLDivElement>(null)
  const dirLeftRef = useRef<HTMLDivElement>(null)
  const dirUpRef = useRef<HTMLDivElement>(null)
  const dirDownRef = useRef<HTMLDivElement>(null)

  function getDirEl(dir: Direction): HTMLDivElement | null {
    switch (dir) {
      case 'right':
        return dirRightRef.current
      case 'left':
        return dirLeftRef.current
      case 'up':
        return dirUpRef.current
      case 'down':
        return dirDownRef.current
    }
  }

  const total = ANTIBIOTICS.length
  const done = answered.length
  const progressPct = total > 0 ? (done / total) * 100 : 0

  const startGame = useCallback(
    (deckOverride?: Antibiotic[]) => {
      setQueue(deckOverride ?? shuffleArray(ANTIBIOTICS))
      setAnswered([])
      setSkippedIds(new Set())
      setScore(0)
      setFeedback(null)
      setSwipeCount(0)
      animatingRef.current = false
      setAnimating(false)
      setScreen('game')
    },
    [],
  )

  const resetIndicators = useCallback(() => {
    ALL_DIRECTIONS.forEach((dir) => {
      const el = getDirEl(dir)
      if (!el) return
      const bubble = el.querySelector<HTMLDivElement>('.gs-dir-bubble')
      const icon = bubble?.querySelector<HTMLElement>('.material-symbols-outlined')
      el.style.opacity = ''
      if (bubble) {
        bubble.style.background = ''
        bubble.style.transform = ''
        bubble.style.boxShadow = ''
      }
      if (icon) icon.style.fontSize = ''
    })
  }, [])

  const lightIndicator = useCallback(
    (dx: number, dy: number) => {
      resetIndicators()
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)
      const mag = Math.min(Math.max(absDx, absDy) / SWIPE_THRESHOLD, 1)
      const dir: Direction = absDx > absDy ? (dx > 0 ? 'right' : 'left') : dy < 0 ? 'up' : 'down'
      const cfg = OVERLAY_CONFIG[dir]
      const el = getDirEl(dir)
      if (!el) return
      el.style.opacity = String(0.2 + mag * 0.8)
      const bubble = el.querySelector<HTMLDivElement>('.gs-dir-bubble')
      const icon = bubble?.querySelector<HTMLElement>('.material-symbols-outlined')
      if (bubble) {
        bubble.style.background = `rgba(${cfg.color}, ${mag * 0.18})`
        bubble.style.transform = `scale(${1 + mag * 0.7})`
        bubble.style.boxShadow = `0 0 0 ${mag * 6}px rgba(${cfg.color}, ${mag * 0.12})`
      }
      if (icon) icon.style.fontSize = `${28 + mag * 18}px`
    },
    [resetIndicators],
  )

  const flashIndicator = useCallback(
    (dir: Direction) => {
      const el = getDirEl(dir)
      if (!el) return
      const cfg = OVERLAY_CONFIG[dir]
      const bubble = el.querySelector<HTMLDivElement>('.gs-dir-bubble')
      const icon = bubble?.querySelector<HTMLElement>('.material-symbols-outlined')
      el.style.opacity = '1'
      if (bubble) {
        bubble.style.background = `rgba(${cfg.color},0.22)`
        bubble.style.transform = 'scale(1.7)'
        bubble.style.boxShadow = `0 0 0 10px rgba(${cfg.color},0.12)`
      }
      if (icon) icon.style.fontSize = '44px'
      window.setTimeout(() => resetIndicators(), 380)
    },
    [resetIndicators],
  )

  const triggerSwipe = useCallback(
    (direction: Direction) => {
      if (animatingRef.current) return
      if (queue.length === 0) return
      animatingRef.current = true
      setAnimating(true)
      resetIndicators()
      flashIndicator(direction)

      const top = queue[0]
      const outerEl = outerRefs.current.get(top.id)
      if (outerEl) {
        const rnd = (Math.random() - 0.5) * 10
        outerEl.style.transition = 'transform 0.42s cubic-bezier(0.4,0,0.8,0.65), opacity 0.28s ease 0.1s'
        if (direction === 'right') outerEl.style.transform = 'translateX(160vw) rotate(32deg)'
        else if (direction === 'left') outerEl.style.transform = 'translateX(-160vw) rotate(-32deg)'
        else if (direction === 'up') outerEl.style.transform = `translateY(-135vh) rotate(${rnd}deg)`
        else outerEl.style.transform = `translateY(130vh) rotate(${rnd * 0.4}deg)`
        outerEl.style.opacity = '0'
      }

      window.setTimeout(() => {
        setQueue((prev) => {
          const [head, ...rest] = prev
          return direction === 'down' ? [...rest, head] : rest
        })
        setSwipeCount((c) => c + 1)

        if (direction === 'down') {
          setSkippedIds((prev) => new Set(prev).add(top.id))
        } else {
          const correct = DIR_COVERAGE[direction] === top.coverage
          setAnswered((prev) => [...prev, { card: top, correct, dir: direction }])
          if (correct) setScore((s) => s + 1)
        }

        outerRefs.current.delete(top.id)
        animatingRef.current = false
        setAnimating(false)

        if (direction !== 'down') {
          const correct = DIR_COVERAGE[direction] === top.coverage
          const queueEmptyNext = queue.length - 1 === 0
          if (mode === 'study') {
            setFeedback({ card: top, correct, dir: direction })
          } else if (queueEmptyNext) {
            setScreen('results')
          }
        }
      }, 440)
    },
    [queue, mode, resetIndicators, flashIndicator],
  )

  const continueAfterFeedback = useCallback(() => {
    setFeedback(null)
    if (queue.length === 0) setScreen('results')
  }, [queue.length])

  // ── Teclado ──────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'game') return
    function onKeyDown(e: KeyboardEvent) {
      if (feedback) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          continueAfterFeedback()
        }
        return
      }
      if (animatingRef.current) return
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault()
          triggerSwipe('right')
          break
        case 'ArrowLeft':
          e.preventDefault()
          triggerSwipe('left')
          break
        case 'ArrowUp':
          e.preventDefault()
          triggerSwipe('up')
          break
        case 'ArrowDown':
          e.preventDefault()
          triggerSwipe('down')
          break
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [screen, feedback, triggerSwipe, continueAfterFeedback])

  const goBack = useCallback(() => {
    if (window.confirm('¿Abandonar la sesión actual?')) setScreen('start')
  }, [])

  const retryErrors = useCallback(() => {
    const errors = answered.filter((a) => !a.correct).map((a) => a.card)
    startGame(shuffleArray(errors))
  }, [answered, startGame])

  const top3 = queue.slice(0, 3)

  return (
    <div className="gs-root relative mx-auto w-full max-w-3xl px-4 py-6 text-[#7D8A96] md:px-6">
      {screen === 'start' && (
        <StartScreen mode={mode} onSelectMode={setMode} onStart={() => startGame()} />
      )}

      {screen === 'game' && (
        <div className="flex flex-col items-center gap-6">
          <div className="flex w-full max-w-xl items-center gap-4">
            <button
              type="button"
              onClick={goBack}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[#EAE4E2] bg-white text-[#7D8A96] transition-colors hover:bg-[#F2EFED]"
              title="Volver"
            >
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-[#F2EFED]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#E8A598] to-[#D4978C] transition-[width] duration-400"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="self-end text-[11px] font-medium text-[#A8A4A0]">
                {done} / {total}
              </span>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1 rounded-full border border-[#8BA888]/30 bg-[#8BA888]/10 py-1.5 pr-2.5 pl-1.5">
              <span className="material-symbols-outlined text-base text-[#8BA888]" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
              <span className="text-sm font-bold text-[#8BA888]">{score}</span>
            </div>
          </div>

          <div className="relative flex w-full max-w-xl flex-col items-center gap-4">
            <div ref={dirUpRef} className="gs-dir pointer-events-none absolute top-2 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5 opacity-20 transition-opacity" style={{ color: '#A278CF' }}>
              <div className="gs-dir-bubble flex h-11 w-11 items-center justify-center rounded-full">
                <span className="material-symbols-outlined text-[28px]">swap_horiz</span>
              </div>
              <span className="text-[11px] font-bold tracking-wide uppercase">Ambos</span>
            </div>
            <div ref={dirDownRef} className="gs-dir pointer-events-none absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 flex-col-reverse items-center gap-1.5 opacity-20 transition-opacity" style={{ color: '#A8A4A0' }}>
              <div className="gs-dir-bubble flex h-11 w-11 items-center justify-center rounded-full">
                <span className="material-symbols-outlined text-[28px]">help_outline</span>
              </div>
              <span className="text-[11px] font-bold tracking-wide uppercase">No sé</span>
            </div>
            <div ref={dirRightRef} className="gs-dir pointer-events-none absolute top-1/2 right-0 z-10 hidden -translate-y-1/2 translate-x-[85%] flex-col items-center gap-1.5 opacity-20 transition-opacity md:flex" style={{ color: '#8BA888' }}>
              <div className="gs-dir-bubble flex h-11 w-11 items-center justify-center rounded-full">
                <span className="material-symbols-outlined text-[28px]">add_circle</span>
              </div>
              <span className="text-[11px] font-bold tracking-wide uppercase">Gram +</span>
            </div>
            <div ref={dirLeftRef} className="gs-dir pointer-events-none absolute top-1/2 left-0 z-10 hidden -translate-x-[85%] -translate-y-1/2 flex-col items-center gap-1.5 opacity-20 transition-opacity md:flex" style={{ color: '#D4978C' }}>
              <div className="gs-dir-bubble flex h-11 w-11 items-center justify-center rounded-full">
                <span className="material-symbols-outlined text-[28px]">remove_circle</span>
              </div>
              <span className="text-[11px] font-bold tracking-wide uppercase">Gram −</span>
            </div>

            <div className="gs-card-stack relative h-[420px] w-[92vw] max-w-[380px] sm:h-[460px] sm:max-w-[420px] md:h-[520px] md:w-full md:max-w-[480px] lg:h-[560px] lg:max-w-[540px]">
              {[...top3].reverse().map((ab, i) => {
                const depth = top3.length - 1 - i
                const isEntering = depth === 2 && swipeCount > 0
                return (
                  <SwipeCard
                    key={ab.id}
                    antibiotic={ab}
                    depth={depth}
                    interactive={depth === 0 && !animating && !feedback}
                    entering={isEntering}
                    onSwipe={triggerSwipe}
                    onDragMove={lightIndicator}
                    onDragEnd={resetIndicators}
                    registerOuterEl={(el) => {
                      if (el) outerRefs.current.set(ab.id, el)
                      else outerRefs.current.delete(ab.id)
                    }}
                  />
                )
              })}
            </div>

            <KeyboardHintBar key={queue[0]?.id ?? 0} />
          </div>
        </div>
      )}

      {screen === 'results' && (
        <ResultsScreen
          answered={answered}
          skippedCount={skippedIds.size}
          onRetryErrors={retryErrors}
          onRestart={() => startGame()}
          onHome={() => setScreen('start')}
        />
      )}

      {feedback && <FeedbackOverlay feedback={feedback} onContinue={continueAfterFeedback} />}

      <style jsx>{`
        .gs-dir-bubble {
          background: transparent;
          transition:
            background 0.1s ease,
            transform 0.1s ease,
            box-shadow 0.1s ease;
        }
      `}</style>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// START SCREEN
// ═══════════════════════════════════════════════════════════
function StartScreen({
  mode,
  onSelectMode,
  onStart,
}: {
  mode: Mode
  onSelectMode: (m: Mode) => void
  onStart: () => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex items-center gap-3.5">
        <span className="material-symbols-outlined text-4xl text-[#E8A598]" style={{ fontVariationSettings: "'FILL' 1" }}>
          biotech
        </span>
        <div>
          <h2 className="text-2xl leading-tight font-black tracking-tight text-[#2C3E50]">GramSwipe</h2>
          <p className="text-sm text-[#7D8A96]">MIRBiotics · Antibióticos</p>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-[#7D8A96]">
        Clasifica cada antibiótico según su espectro de cobertura deslizando la tarjeta en la dirección correcta.
      </p>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex items-center gap-2.5 rounded-xl border border-[#EAE4E2] bg-white px-3.5 py-2.5">
          <span className="w-6 text-center text-xl leading-none font-bold text-[#8BA888]">→</span>
          <span className="text-[13px] leading-tight font-bold text-[#2C3E50]">Gram +</span>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-[#EAE4E2] bg-white px-3.5 py-2.5">
          <span className="w-6 text-center text-xl leading-none font-bold text-[#D4978C]">←</span>
          <span className="text-[13px] leading-tight font-bold text-[#2C3E50]">Gram −</span>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-[#EAE4E2] bg-white px-3.5 py-2.5">
          <span className="w-6 text-center text-xl leading-none font-bold text-[#A278CF]">↑</span>
          <span className="text-[13px] leading-tight font-bold text-[#2C3E50]">Amplio espectro</span>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-[#EAE4E2] bg-white px-3.5 py-2.5">
          <span className="w-6 text-center text-xl leading-none font-bold text-[#A8A4A0]">↓</span>
          <span className="text-[13px] leading-tight font-medium text-[#7D8A96]">No sé — vuelve al mazo</span>
        </div>
      </div>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-[#A8A4A0]">
        <span className="material-symbols-outlined text-[15px]">touch_app</span>
        Toca la tarjeta (o clic) para ver familia y mecanismo de acción
      </p>

      <div>
        <p className="mb-2.5 text-[13px] font-semibold text-[#7D8A96]">Modo de juego</p>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onSelectMode('study')}
            className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-3.5 transition-colors ${
              mode === 'study' ? 'border-[#E8A598] bg-[#E8A598]/[0.08]' : 'border-[#EAE4E2] bg-white'
            }`}
          >
            <span className={`material-symbols-outlined text-2xl ${mode === 'study' ? 'text-[#B87A6F]' : 'text-[#7D8A96]'}`}>school</span>
            <span className="text-[13px] font-semibold text-[#2C3E50]">Estudio</span>
            <span className="text-center text-[11px] leading-tight text-[#7D8A96]">Feedback tras cada carta</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectMode('quick')}
            className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-3.5 transition-colors ${
              mode === 'quick' ? 'border-[#E8A598] bg-[#E8A598]/[0.08]' : 'border-[#EAE4E2] bg-white'
            }`}
          >
            <span className={`material-symbols-outlined text-2xl ${mode === 'quick' ? 'text-[#B87A6F]' : 'text-[#7D8A96]'}`}>bolt</span>
            <span className="text-[13px] font-semibold text-[#2C3E50]">Repaso rápido</span>
            <span className="text-center text-[11px] leading-tight text-[#7D8A96]">Sin interrupciones</span>
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E8A598] px-6 py-4 text-[15px] font-bold text-white shadow-[0_4px_16px_rgba(232,165,152,0.35)] transition-colors hover:bg-[#D4978C]"
      >
        <span className="material-symbols-outlined">play_arrow</span>
        Empezar
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// SWIPE CARD
// ═══════════════════════════════════════════════════════════
function SwipeCard({
  antibiotic,
  depth,
  interactive,
  entering,
  onSwipe,
  onDragMove,
  onDragEnd,
  registerOuterEl,
}: {
  antibiotic: Antibiotic
  depth: number
  interactive: boolean
  entering: boolean
  onSwipe: (dir: Direction) => void
  onDragMove: (dx: number, dy: number) => void
  onDragEnd: () => void
  registerOuterEl: (el: HTMLDivElement | null) => void
}) {
  const innerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const overlayIconRef = useRef<HTMLSpanElement>(null)
  const overlayLabelRef = useRef<HTMLSpanElement>(null)
  const [flipped, setFlipped] = useState(false)

  const dragState = useRef({ startX: 0, startY: 0, dx: 0, dy: 0, dragged: false })

  const setOverlay = useCallback((dx: number, dy: number) => {
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)
    const mag = Math.min(Math.max(absDx, absDy) / SWIPE_THRESHOLD, 1)
    const dir: Direction = absDx > absDy ? (dx > 0 ? 'right' : 'left') : dy < 0 ? 'up' : 'down'
    const cfg = OVERLAY_CONFIG[dir]
    if (overlayRef.current) overlayRef.current.style.background = `rgba(${cfg.color},${mag * 0.62})`
    if (overlayIconRef.current) {
      overlayIconRef.current.textContent = cfg.icon
      overlayIconRef.current.style.opacity = String(mag)
      overlayIconRef.current.style.transform = `scale(${0.5 + mag * 0.5})`
    }
    if (overlayLabelRef.current) {
      overlayLabelRef.current.textContent = cfg.label
      overlayLabelRef.current.style.opacity = String(mag)
      overlayLabelRef.current.style.transform = `translateY(${6 - mag * 6}px)`
    }
  }, [])

  const resetOverlay = useCallback(() => {
    if (overlayRef.current) overlayRef.current.style.background = 'transparent'
    if (overlayIconRef.current) overlayIconRef.current.style.opacity = '0'
    if (overlayLabelRef.current) overlayLabelRef.current.style.opacity = '0'
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!interactive) return
      const outer = e.currentTarget
      outer.setPointerCapture(e.pointerId)
      const state = dragState.current
      state.startX = e.clientX
      state.startY = e.clientY
      state.dx = 0
      state.dy = 0
      state.dragged = false
      if (innerRef.current) innerRef.current.style.transition = 'none'

      function onMove(ev: PointerEvent) {
        const dx = ev.clientX - state.startX
        const dy = ev.clientY - state.startY
        if (!state.dragged && Math.hypot(dx, dy) > DRAG_THRESHOLD) state.dragged = true
        if (!state.dragged) return
        state.dx = dx
        state.dy = dy
        const rot = (dx / window.innerWidth) * MAX_ROTATE
        outer.style.transform = `translate(${dx}px,${dy}px) rotate(${rot}deg)`
        onDragMove(dx, dy)
        setOverlay(dx, dy)
      }

      function onUp() {
        outer.removeEventListener('pointermove', onMove)
        outer.removeEventListener('pointerup', onUp)
        outer.removeEventListener('pointercancel', onUp)
        onDragEnd()

        if (!state.dragged) {
          setFlipped((f) => !f)
          if (innerRef.current) innerRef.current.style.transition = ''
          return
        }

        resetOverlay()
        if (innerRef.current) innerRef.current.style.transition = ''

        const absDx = Math.abs(state.dx)
        const absDy = Math.abs(state.dy)
        let dir: Direction | null = null
        if (absDx > absDy) {
          if (absDx > SWIPE_THRESHOLD) dir = state.dx > 0 ? 'right' : 'left'
        } else if (absDy > SWIPE_THRESHOLD) {
          dir = state.dy < 0 ? 'up' : 'down'
        }

        if (dir) {
          onSwipe(dir)
        } else {
          outer.style.transition = 'transform 0.45s cubic-bezier(0.22,1,0.36,1)'
          outer.style.transform = ''
          window.setTimeout(() => {
            outer.style.transition = ''
          }, 460)
        }
      }

      outer.addEventListener('pointermove', onMove)
      outer.addEventListener('pointerup', onUp)
      outer.addEventListener('pointercancel', onUp)
    },
    [interactive, onDragMove, onDragEnd, onSwipe, resetOverlay, setOverlay],
  )

  return (
    <div
      ref={registerOuterEl}
      data-depth={depth}
      onPointerDown={onPointerDown}
      className={`gs-card absolute inset-0 ${interactive ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'} ${
        entering ? 'gs-card-enter' : ''
      }`}
      style={{ touchAction: 'none' }}
    >
      <div
        ref={innerRef}
        className={`gs-card-inner relative h-full w-full rounded-[20px] bg-white shadow-[0_20px_60px_-10px_rgba(125,138,150,0.22)] ${
          flipped ? 'gs-flipped' : ''
        }`}
        data-depth={depth}
      >
        <div className="gs-face gs-face-front absolute inset-0 flex flex-col gap-3.5 overflow-hidden rounded-[20px] bg-white p-5">
          <div className="relative h-[38%] w-full flex-shrink-0 overflow-hidden rounded-2xl bg-white">
            <Image
              src={antibiotic.image}
              alt={`Caja de ${antibiotic.name}`}
              fill
              sizes="(min-width: 1024px) 540px, (min-width: 768px) 480px, 92vw"
              className="object-contain"
              draggable={false}
              priority={depth === 0}
            />
          </div>
          <div className="flex flex-1 flex-col justify-center gap-1">
            <p className="text-[11px] font-semibold tracking-wide text-[#A8A4A0] uppercase">Principio activo</p>
            <p className="text-sm text-[#7D8A96]">{antibiotic.activeIngredient}</p>
            <p className="text-[clamp(1.3rem,3vw,1.7rem)] leading-tight font-extrabold tracking-tight text-[#2C3E50]">
              {antibiotic.name}
            </p>
          </div>
          <div className="mt-auto flex items-center gap-1.5 text-[11px] text-[#A8A4A0]">
            <span className="material-symbols-outlined text-[15px]">touch_app</span>
            Toca para ver familia y mecanismo
          </div>
        </div>

        <div className="gs-face gs-face-back absolute inset-0 flex flex-col justify-center gap-4 overflow-hidden rounded-[20px] bg-[linear-gradient(145deg,#2C2522_0%,#1A1614_100%)] p-6 text-white">
          <div className="flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white/70 uppercase">
            <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              local_pharmacy
            </span>
            Cara interna
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-white/45 uppercase">Familia</p>
            <p className="text-lg leading-tight font-bold">{antibiotic.family}</p>
          </div>
          <div className="h-px bg-white/10" />
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-wide text-white/45 uppercase">Mecanismo de acción</p>
            <p className="text-[13px] leading-relaxed text-white/90">{antibiotic.mechanism}</p>
          </div>
          <div className="mt-auto flex items-center gap-1.5 text-[11px] text-white/35">
            <span className="material-symbols-outlined text-[14px]">swipe</span>
            Desliza para clasificar
          </div>
        </div>

        <div
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 z-[5] flex flex-col items-center justify-center gap-2.5 rounded-[20px]"
          style={{ background: 'transparent' }}
        >
          <span
            ref={overlayIconRef}
            className="material-symbols-outlined text-[52px] text-white opacity-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
            style={{ fontVariationSettings: "'FILL' 1, 'wght' 700", transition: 'opacity .1s ease, transform .1s ease' }}
          />
          <span
            ref={overlayLabelRef}
            className="text-base font-extrabold tracking-widest text-white uppercase opacity-0 [text-shadow:0_1px_6px_rgba(0,0,0,0.25)]"
            style={{ transition: 'opacity .1s ease, transform .1s ease' }}
          />
        </div>
      </div>

      <style jsx>{`
        .gs-card-inner {
          transform-style: preserve-3d;
          perspective: 1200px;
          transition:
            transform 0.5s cubic-bezier(0.22, 1, 0.36, 1),
            box-shadow 0.5s ease;
          will-change: transform;
        }
        .gs-card[data-depth='1'] .gs-card-inner {
          transform: translateY(12px) scale(0.96);
          box-shadow: 0 8px 24px -6px rgba(125, 138, 150, 0.14);
        }
        .gs-card[data-depth='2'] .gs-card-inner {
          transform: translateY(22px) scale(0.92);
          box-shadow: 0 4px 12px -4px rgba(125, 138, 150, 0.1);
        }
        .gs-card-enter {
          animation: gsCardEnter 0.55s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes gsCardEnter {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .gs-card-enter .gs-card-inner {
          animation: gsCardInnerEnter 0.55s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes gsCardInnerEnter {
          from {
            transform: translateY(40px) scale(0.86);
          }
          to {
            transform: translateY(22px) scale(0.92);
          }
        }
        .gs-face {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .gs-face-back {
          transform: rotateY(180deg);
        }
        .gs-flipped {
          transform: rotateY(180deg) !important;
        }
      `}</style>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// KEYBOARD HINT BAR
// ═══════════════════════════════════════════════════════════
function KeyboardHintBar() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = window.setTimeout(() => setVisible(false), 5000)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div
      className="hidden items-center gap-2 rounded-full border border-[#EAE4E2] bg-[#F5F1EC]/85 px-3.5 py-1.5 backdrop-blur transition-opacity duration-500 md:flex"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <kbd className="rounded border border-[#EAE4E2] border-b-2 bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#7D8A96]">←</kbd>
      <span className="text-[11px] text-[#A8A4A0]">Gram −</span>
      <span className="text-[11px] text-[#A8A4A0]">·</span>
      <kbd className="rounded border border-[#EAE4E2] border-b-2 bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#7D8A96]">→</kbd>
      <span className="text-[11px] text-[#A8A4A0]">Gram +</span>
      <span className="text-[11px] text-[#A8A4A0]">·</span>
      <kbd className="rounded border border-[#EAE4E2] border-b-2 bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#7D8A96]">↑</kbd>
      <span className="text-[11px] text-[#A8A4A0]">Ambos</span>
      <span className="text-[11px] text-[#A8A4A0]">·</span>
      <kbd className="rounded border border-[#EAE4E2] border-b-2 bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#7D8A96]">↓</kbd>
      <span className="text-[11px] text-[#A8A4A0]">No sé</span>
      <span className="text-[11px] text-[#A8A4A0]">·</span>
      <kbd className="rounded border border-[#EAE4E2] border-b-2 bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#7D8A96]">Space</kbd>
      <span className="text-[11px] text-[#A8A4A0]">Voltear</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// FEEDBACK OVERLAY
// ═══════════════════════════════════════════════════════════
function FeedbackOverlay({ feedback, onContinue }: { feedback: FeedbackState; onContinue: () => void }) {
  const { card, correct, dir } = feedback
  const detail = correct
    ? `${card.name} es ${COVERAGE_LABELS[card.coverage]}. ¡Muy bien!`
    : `Marcaste "${COVERAGE_LABELS[DIR_COVERAGE[dir] as Coverage]}" pero ${card.name} es ${COVERAGE_LABELS[card.coverage]}.`

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#171312]/55 px-5 pb-10 backdrop-blur-sm md:items-center md:pb-0">
      <div className="flex w-full max-w-[400px] flex-col items-center gap-3 rounded-3xl bg-white p-7 pt-8 shadow-[0_-8px_40px_rgba(0,0,0,0.15)]">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full ${
            correct ? 'bg-[#8BA888]/15' : 'bg-[#C97B6E]/15'
          }`}
        >
          <span
            className={`material-symbols-outlined text-3xl ${correct ? 'text-[#8BA888]' : 'text-[#C97B6E]'}`}
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {correct ? 'check_circle' : 'cancel'}
          </span>
        </div>
        <p className={`text-xl font-extrabold tracking-tight ${correct ? 'text-[#8BA888]' : 'text-[#C97B6E]'}`}>
          {correct ? '¡Correcto!' : 'Incorrecto'}
        </p>
        <p className="max-w-[320px] text-center text-[13px] leading-relaxed text-[#7D8A96]">{detail}</p>
        <button
          type="button"
          onClick={onContinue}
          className="mt-1 flex max-w-[220px] w-full items-center justify-center gap-2 rounded-2xl bg-[#E8A598] px-6 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#D4978C]"
        >
          Continuar
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// RESULTS SCREEN
// ═══════════════════════════════════════════════════════════
function ResultsScreen({
  answered,
  skippedCount,
  onRetryErrors,
  onRestart,
  onHome,
}: {
  answered: AnsweredEntry[]
  skippedCount: number
  onRetryErrors: () => void
  onRestart: () => void
  onHome: () => void
}) {
  const correct = answered.filter((a) => a.correct).length
  const wrong = answered.filter((a) => !a.correct).length
  const total = answered.length
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0

  const circ = 213.6
  const arcOffset = circ - (circ * accuracy) / 100
  const arcColor = accuracy >= 70 ? '#8BA888' : accuracy >= 40 ? '#D4978C' : '#C97B6E'

  let trophy = 'school'
  let title = 'Sigue practicando'
  if (accuracy === 100) {
    trophy = 'emoji_events'
    title = '¡Perfecto!'
  } else if (accuracy >= 70) {
    trophy = 'thumb_up'
    title = '¡Muy bien!'
  }

  const failed = answered.filter((a) => !a.correct).map((a) => a.card)

  const badgeClasses: Record<Coverage, string> = {
    gram_positive: 'bg-[#8BA888]/15 text-[#8BA888]',
    gram_negative: 'bg-[#D4978C]/15 text-[#D4978C]',
    broad: 'bg-[#A278CF]/15 text-[#A278CF]',
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="material-symbols-outlined text-5xl text-[#E8A598]" style={{ fontVariationSettings: "'FILL' 1" }}>
          {trophy}
        </span>
        <h2 className="text-2xl font-black tracking-tight text-[#2C3E50]">{title}</h2>
        <p className="text-sm text-[#7D8A96]">
          {correct} de {total} correctas · {accuracy}% de precisión
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="flex flex-col items-center gap-1 rounded-xl border border-[#EAE4E2] bg-white px-3 py-4">
          <span className="text-3xl font-black tracking-tight text-[#8BA888]">{correct}</span>
          <span className="text-[11px] font-medium text-[#A8A4A0]">Correctas</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl border border-[#EAE4E2] bg-white px-3 py-4">
          <span className="text-3xl font-black tracking-tight text-[#C97B6E]">{wrong}</span>
          <span className="text-[11px] font-medium text-[#A8A4A0]">Errores</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl border border-[#EAE4E2] bg-white px-3 py-4">
          <span className="text-3xl font-black tracking-tight text-[#7D8A96]">{skippedCount}</span>
          <span className="text-[11px] font-medium text-[#A8A4A0]">Saltadas</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="relative h-[120px] w-[120px]">
          <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#F2EFED" strokeWidth="8" />
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke={arcColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={arcOffset}
              style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1), stroke .4s ease' }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-2xl font-black tracking-tight text-[#2C3E50]">
            {accuracy}%
          </span>
        </div>
        <p className="text-xs font-medium text-[#A8A4A0]">Precisión</p>
      </div>

      {failed.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <h3 className="text-sm font-bold text-[#2C3E50]">Tarjetas falladas</h3>
          <div className="flex flex-col gap-2">
            {failed.map((ab) => (
              <div
                key={ab.id}
                className="flex items-center justify-between gap-2.5 rounded-xl border border-[#EAE4E2] bg-white px-3.5 py-3"
              >
                <span className="text-sm font-semibold text-[#2C3E50]">{ab.name}</span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${badgeClasses[ab.coverage]}`}>
                  {COVERAGE_LABELS[ab.coverage]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {failed.length > 0 && (
          <button
            type="button"
            onClick={onRetryErrors}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E8A598] px-6 py-4 text-[15px] font-bold text-white transition-colors hover:bg-[#D4978C]"
          >
            <span className="material-symbols-outlined">replay</span>
            Repetir errores
          </button>
        )}
        <button
          type="button"
          onClick={onRestart}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#EAE4E2] bg-white px-6 py-3.5 text-sm font-semibold text-[#2C3E50] transition-colors hover:bg-[#F2EFED]"
        >
          <span className="material-symbols-outlined">refresh</span>
          Nueva sesión
        </button>
        <button
          type="button"
          onClick={onHome}
          className="flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-medium text-[#7D8A96] transition-colors hover:bg-[#F2EFED]"
        >
          <span className="material-symbols-outlined">home</span>
          Inicio
        </button>
      </div>
    </div>
  )
}

'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TimerPhase = 'idle' | 'study' | 'break'
export type ZenPreset = 'classic' | 'deep' | 'custom'

export type ZenTimerState = {
  phase: TimerPhase
  timeRemaining: number   // seconds
  cycle: number
  running: boolean
  preset: ZenPreset
  studyDuration: number   // seconds
  breakDuration: number   // seconds
}

export type ZenTimerAction =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESET' }
  | { type: 'TICK' }
  | { type: 'SET_PRESET'; preset: ZenPreset }
  | { type: 'SET_CUSTOM_TIMES'; studyMinutes: number; breakMinutes: number }

// ─── Preset Definitions ───────────────────────────────────────────────────────

export const PRESET_DURATIONS: Record<Exclude<ZenPreset, 'custom'>, { study: number; break: number }> = {
  classic: { study: 25 * 60, break: 5 * 60 },
  deep:    { study: 50 * 60, break: 10 * 60 },
}

export const DEFAULT_CUSTOM_DURATIONS = { study: 30 * 60, break: 5 * 60 }

export const PRESET_LABELS: Record<ZenPreset, string> = {
  classic: 'Clásico 25/5',
  deep:    'Profundo 50/10',
  custom:  'Personalizado',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function presetsStudy(preset: ZenPreset, studyDuration: number): number {
  return preset === 'custom' ? studyDuration : PRESET_DURATIONS[preset].study
}

function presetsBreak(preset: ZenPreset, breakDuration: number): number {
  return preset === 'custom' ? breakDuration : PRESET_DURATIONS[preset].break
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function getTotalDuration(state: ZenTimerState): number {
  if (state.phase === 'break') return state.breakDuration
  return state.studyDuration
}

// ─── Initial State ────────────────────────────────────────────────────────────

export function makeInitialState(preset: ZenPreset = 'classic'): ZenTimerState {
  const study =
    preset === 'custom'
      ? DEFAULT_CUSTOM_DURATIONS.study
      : PRESET_DURATIONS[preset].study
  const brk =
    preset === 'custom'
      ? DEFAULT_CUSTOM_DURATIONS.break
      : PRESET_DURATIONS[preset].break

  return {
    phase: 'idle',
    timeRemaining: study,
    cycle: 1,
    running: false,
    preset,
    studyDuration: study,
    breakDuration: brk,
  }
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function zenTimerReducer(state: ZenTimerState, action: ZenTimerAction): ZenTimerState {
  switch (action.type) {
    case 'START': {
      if (state.phase === 'idle') {
        return {
          ...state,
          running: true,
          phase: 'study',
          timeRemaining: state.studyDuration,
        }
      }
      return { ...state, running: true }
    }

    case 'PAUSE':
      return { ...state, running: false }

    case 'RESET':
      return {
        ...state,
        running: false,
        phase: 'idle',
        timeRemaining: state.studyDuration,
        cycle: 1,
      }

    case 'TICK': {
      if (!state.running) return state

      if (state.timeRemaining <= 1) {
        if (state.phase === 'study') {
          return {
            ...state,
            phase: 'break',
            timeRemaining: state.breakDuration,
          }
        }
        // break → study: advance cycle
        return {
          ...state,
          phase: 'study',
          timeRemaining: state.studyDuration,
          cycle: state.cycle + 1,
        }
      }

      return { ...state, timeRemaining: state.timeRemaining - 1 }
    }

    case 'SET_PRESET': {
      const study = presetsStudy(action.preset, state.studyDuration)
      const brk   = presetsBreak(action.preset, state.breakDuration)
      return {
        ...state,
        preset: action.preset,
        studyDuration: study,
        breakDuration: brk,
        running: false,
        phase: 'idle',
        timeRemaining: study,
        cycle: 1,
      }
    }

    case 'SET_CUSTOM_TIMES': {
      const study = Math.max(1, action.studyMinutes) * 60
      const brk   = Math.max(1, action.breakMinutes) * 60
      const inStudyOrIdle = state.phase !== 'break'
      return {
        ...state,
        studyDuration: study,
        breakDuration: brk,
        timeRemaining: inStudyOrIdle ? study : brk,
        running: false,
        phase: 'idle',
        cycle: 1,
      }
    }

    default:
      return state
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

type ZenTimerContextValue = {
  state: ZenTimerState
  dispatch: Dispatch<ZenTimerAction>
  // Convenience helpers
  start:  () => void
  pause:  () => void
  reset:  () => void
}

const ZenTimerContext = createContext<ZenTimerContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ZenTimerProvider({
  children,
  initialPreset = 'classic',
}: {
  children: ReactNode
  initialPreset?: ZenPreset
}) {
  const [state, dispatch] = useReducer(
    zenTimerReducer,
    initialPreset,
    makeInitialState,
  )

  // Tick every second while running
  useEffect(() => {
    if (!state.running) return
    const id = setInterval(() => dispatch({ type: 'TICK' }), 1000)
    return () => clearInterval(id)
  }, [state.running])

  const start  = useCallback(() => dispatch({ type: 'START' }), [])
  const pause  = useCallback(() => dispatch({ type: 'PAUSE' }), [])
  const reset  = useCallback(() => dispatch({ type: 'RESET' }), [])

  const value = useMemo(
    () => ({ state, dispatch, start, pause, reset }),
    [state, dispatch, start, pause, reset],
  )

  return (
    <ZenTimerContext.Provider value={value}>
      {children}
    </ZenTimerContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useZenTimer(): ZenTimerContextValue {
  const ctx = useContext(ZenTimerContext)
  if (!ctx) throw new Error('useZenTimer must be used inside ZenTimerProvider')
  return ctx
}

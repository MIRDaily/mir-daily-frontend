'use client'

import { useState } from 'react'
import {
  useZenTimer,
  PRESET_LABELS,
  type ZenPreset,
} from '@/state/zenTimerStore'
import { primeAudio } from '@/lib/zenAudio'

const PRESETS: ZenPreset[] = ['classic', 'deep', 'custom']

export default function ZenControls() {
  const { state, dispatch, start, pause, reset } = useZenTimer()
  const { phase, running, preset } = state

  // Local custom-input state (minutes)
  const [customStudy, setCustomStudy] = useState(
    Math.round(state.studyDuration / 60),
  )
  const [customBreak, setCustomBreak] = useState(
    Math.round(state.breakDuration / 60),
  )

  const isIdle    = phase === 'idle'
  const isRunning = running

  function handlePresetClick(p: ZenPreset) {
    dispatch({ type: 'SET_PRESET', preset: p })
    if (p === 'custom') {
      // keep current custom minutes on switch
      setCustomStudy(Math.round(state.studyDuration / 60))
      setCustomBreak(Math.round(state.breakDuration / 60))
    }
  }

  function applyCustomTimes() {
    dispatch({
      type: 'SET_CUSTOM_TIMES',
      studyMinutes: customStudy,
      breakMinutes: customBreak,
    })
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-5">

      {/* Preset selector */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[#7D8A96]/60">
          Modo
        </span>
        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePresetClick(p)}
              disabled={isRunning}
              className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
                preset === p
                  ? 'border-[#E8A598]/50 bg-[#E8A598]/10 text-[#d18d80]'
                  : 'border-[#EAE4E2] bg-white text-[#7D8A96] hover:border-[#E8A598]/30 hover:text-[#d18d80]'
              }`}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Custom time inputs */}
      {preset === 'custom' && (
        <div className="rounded-xl border border-[#EAE4E2] bg-white p-4">
          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-semibold text-[#7D8A96]">
                Estudio (min)
              </span>
              <input
                type="number"
                min={1}
                max={120}
                value={customStudy}
                disabled={isRunning}
                onChange={(e) => setCustomStudy(Number(e.target.value))}
                className="w-full rounded-lg border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2 text-sm font-bold text-[#2c3e50] focus:border-[#E8A598] focus:outline-none focus:ring-2 focus:ring-[#E8A598]/20 disabled:opacity-50"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-semibold text-[#7D8A96]">
                Descanso (min)
              </span>
              <input
                type="number"
                min={1}
                max={60}
                value={customBreak}
                disabled={isRunning}
                onChange={(e) => setCustomBreak(Number(e.target.value))}
                className="w-full rounded-lg border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2 text-sm font-bold text-[#2c3e50] focus:border-[#E8A598] focus:outline-none focus:ring-2 focus:ring-[#E8A598]/20 disabled:opacity-50"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={applyCustomTimes}
            disabled={isRunning}
            className="mt-3 w-full rounded-lg border border-[#7D8A96]/20 bg-[#FAF7F4] py-2 text-xs font-semibold text-[#7D8A96] transition-colors hover:border-[#E8A598]/40 hover:text-[#d18d80] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Aplicar tiempos
          </button>
        </div>
      )}

      {/* Playback controls */}
      <div className="flex gap-3">
        {/* Start / Pause */}
        {!isRunning ? (
          <button
            type="button"
            onClick={() => { void primeAudio(); start() }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#E8A598] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#E8A598]/20 transition-all hover:-translate-y-0.5 hover:bg-[#d18d80] active:translate-y-0"
          >
            <span className="material-symbols-outlined text-[18px]">
              {isIdle ? 'play_arrow' : 'play_arrow'}
            </span>
            {isIdle ? 'Iniciar' : 'Continuar'}
          </button>
        ) : (
          <button
            type="button"
            onClick={pause}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#E8A598]/30 bg-white px-5 py-3 text-sm font-semibold text-[#d18d80] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#E8A598]/60 active:translate-y-0"
          >
            <span className="material-symbols-outlined text-[18px]">pause</span>
            Pausar
          </button>
        )}

        {/* Reset */}
        <button
          type="button"
          onClick={reset}
          aria-label="Reiniciar"
          className="flex items-center justify-center rounded-xl border border-[#EAE4E2] bg-white px-4 py-3 text-[#7D8A96] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#7D8A96]/40 hover:text-[#2c3e50] active:translate-y-0"
        >
          <span className="material-symbols-outlined text-[18px]">restart_alt</span>
        </button>
      </div>

    </div>
  )
}

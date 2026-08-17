'use client'

import { useEffect, useRef } from 'react'
import { RhythmMonitor, TwelveLead } from '@/lib/electros/render'
import type { Synth } from '@/lib/electros/ecgCore'
import type { LeadName } from '@/lib/electros/leads'

/* ════════════════════════════════════════════════════════════════════════
   Monitor de cabecera: barre una derivación en tiempo real.
   El renderizador es imperativo (canvas + rAF), así que vive en un ref y solo
   recibe órdenes desde efectos; React nunca lo re-crea al cambiar de patrón.
═══════════════════════════════════════════════════════════════════════════ */
export function MonitorCanvas({
  synth,
  lead,
  running,
  speed,
  onBeat,
  className = '',
}: {
  synth: Synth
  lead: LeadName
  running: boolean
  speed: number
  onBeat?: () => void
  className?: string
}) {
  const gridRef = useRef<HTMLCanvasElement>(null)
  const traceRef = useRef<HTMLCanvasElement>(null)
  const monitorRef = useRef<RhythmMonitor | null>(null)
  // El callback cambia en cada render; el monitor guarda una referencia estable
  // que se refresca tras el render, nunca durante.
  const beatRef = useRef(onBeat)
  useEffect(() => {
    beatRef.current = onBeat
  })

  useEffect(() => {
    const grid = gridRef.current
    const trace = traceRef.current
    if (!grid || !trace) return

    const monitor = new RhythmMonitor(grid, trace, {
      lead: 'II',
      onBeat: () => beatRef.current?.(),
    })
    monitorRef.current = monitor
    monitor.resize()

    const observer = new ResizeObserver(() => monitor.resize())
    observer.observe(grid)

    return () => {
      observer.disconnect()
      monitor.stop()
      monitorRef.current = null
    }
  }, [])

  useEffect(() => {
    monitorRef.current?.setPattern(synth)
  }, [synth])

  useEffect(() => {
    monitorRef.current?.setLead(lead)
  }, [lead])

  useEffect(() => {
    const monitor = monitorRef.current
    if (!monitor) return
    monitor.timeScale = speed
  }, [speed])

  useEffect(() => {
    const monitor = monitorRef.current
    if (!monitor) return
    if (running) monitor.start()
    else monitor.stop()
  }, [running, synth])

  return (
    <div className={`relative ${className}`}>
      <canvas ref={gridRef} className="absolute inset-0 h-full w-full" />
      <canvas ref={traceRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   ECG completo de 12 derivaciones (estático, formato impresión 4×3).
═══════════════════════════════════════════════════════════════════════════ */
export function TwelveLeadCanvas({
  synth,
  rhythmLead = 'II',
  className = '',
}: {
  synth: Synth
  rhythmLead?: LeadName
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<TwelveLead | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new TwelveLead(canvas, { rhythmLead: 'II' })
    rendererRef.current = renderer

    // El canvas se dimensiona por CSS; al redibujar solo cambiamos su buffer
    // interno, así que observar su caja no realimenta al observer.
    const observer = new ResizeObserver(() => renderer.draw())
    observer.observe(canvas)

    return () => {
      observer.disconnect()
      rendererRef.current = null
    }
  }, [])

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return
    renderer.rhythmLead = rhythmLead
    renderer.setPattern(synth)
  }, [synth, rhythmLead])

  return <canvas ref={canvasRef} className={`block h-full w-full ${className}`} />
}

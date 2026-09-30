'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  GUIDE_CATEGORIES,
  IMAGE_SUBCATEGORIES,
  QUESTION_CATEGORIES,
  categoryLabel,
  type ImageSubcategory,
  type ReportCategory,
} from '@/lib/reports/categories'
import {
  contentKeyOf,
  getMyReports,
  markReported,
  submitReport,
  type MyReport,
  type ReportContext,
  type ReportTarget,
} from '@/lib/reports/api'

const LETTERS = ['A', 'B', 'C', 'D', 'E']
const MAX_MESSAGE = 1000

type ReportModalProps = {
  target: ReportTarget
  context: ReportContext
  /** Nº de opciones de la pregunta, para el selector "¿cuál crees que es?". */
  optionCount?: number
  /** Qué se está reportando, en una línea (p. ej. "MIR 2019 · P45"). */
  subtitle?: string
  onClose: () => void
}

// Ventana de reporte: un toque para el tipo y, si quiere, una línea más.
// Todo lo demás (foto de la pregunta, de dónde viene, qué respondió, versión)
// lo adjunta el sistema. No enseña nada de la respuesta correcta: se puede
// abrir a mitad del daily sin destripar la pregunta.
export default function ReportModal({
  target,
  context,
  optionCount = 4,
  subtitle,
  onClose,
}: ReportModalProps) {
  const categories = useMemo(() => {
    const all = target.type === 'question' ? QUESTION_CATEGORIES : GUIDE_CATEGORIES
    return context.answered ? all : all.filter((c) => !c.needsAnswer)
  }, [target.type, context.answered])

  const [category, setCategory] = useState<ReportCategory | null>(null)
  const [subcategory, setSubcategory] = useState<ImageSubcategory | null>(null)
  const [suggested, setSuggested] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [mine, setMine] = useState<MyReport[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ updated: boolean } | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Si ya lo había reportado, se precarga lo suyo para que edite en vez de repetir.
  useEffect(() => {
    let alive = true
    getMyReports(target)
      .then((reports) => {
        if (!alive || reports.length === 0) return
        setMine(reports)
        const last = reports[0]
        if (categories.some((c) => c.key === last.category)) {
          setCategory(last.category)
          setSubcategory(last.subcategory)
          setSuggested(last.suggested_answer)
          setMessage(last.message ?? '')
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mientras está abierta, ninguna tecla llega a la página: el detalle de
  // resultados cambia de pregunta con las flechas y el quiz enseña la imagen
  // con el espacio, y eso saltaría al escribir el reporte. Se corta en la fase
  // de captura de window, antes que nadie; lo que se escribe sigue entrando
  // porque no se llama a preventDefault.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    },
    [],
  )

  const pickCategory = (key: ReportCategory) => {
    setError(null)
    setCategory(key)
    const previous = mine.find((r) => r.category === key)
    setSubcategory(previous?.subcategory ?? null)
    setSuggested(previous?.suggested_answer ?? null)
    setMessage(previous?.message ?? '')
  }

  const def = categories.find((c) => c.key === category) ?? null
  const needsText = category === 'otro'
  const canSend = !!category && !sending && (!needsText || message.trim().length > 0)
  const editing = !!category && mine.some((r) => r.category === category)

  const send = async () => {
    if (!category || !canSend) return
    setSending(true)
    setError(null)
    try {
      const result = await submitReport({
        target,
        context,
        category,
        subcategory: category === 'imagen' ? subcategory : null,
        suggestedAnswer: category === 'respuesta_erronea' ? suggested : null,
        message: message.trim(),
      })
      markReported(contentKeyOf(target))
      setDone(result)
      closeTimer.current = setTimeout(onClose, 2600)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el reporte')
    } finally {
      setSending(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    // Los eventos de un portal suben por el árbol de React: sin cortarlos, un
    // clic aquí llegaría a la tarjeta de la pregunta que contiene el botón.
    <motion.div
      className="fixed inset-0 z-[300] flex items-end justify-center p-3 sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-[#2c3e50]/45 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative z-10 flex max-h-[calc(100dvh-24px)] w-full max-w-md flex-col overflow-hidden rounded-3xl border-2 border-[#2c3e50] bg-white"
        style={{ boxShadow: '7px 7px 0 0 #2c3e50' }}
      >
        {done ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#8BA888] text-white shadow-md">
              <span className="material-symbols-outlined text-3xl">check</span>
            </span>
            <p className="text-lg font-black text-[#2C3E50]">
              {done.updated ? 'Reporte actualizado' : '¡Gracias por avisar!'}
            </p>
            <p className="max-w-xs text-sm text-[#7D8A96]">
              Lo revisamos y te avisaremos cuando esté resuelto. Si tenías razón, te llevas XP.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-xl border border-[#EAE4E2] bg-white px-5 py-2 text-sm font-semibold text-[#2C3E50] transition hover:bg-[#F7F4F2]"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 bg-[#FBEDEA] px-6 py-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#C4655A] text-white shadow-md">
                <span className="material-symbols-outlined text-2xl">report</span>
              </span>
              <div className="min-w-0 flex-1">
                <p id="report-modal-title" className="text-lg font-black leading-tight text-[#2C3E50]">
                  {target.type === 'question' ? 'Reportar pregunta' : 'Reportar un error'}
                </p>
                {subtitle ? <p className="truncate text-xs font-semibold text-[#A0524A]">{subtitle}</p> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#7D8A96] transition hover:bg-white/70"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto p-5 sm:p-6">
              {mine.length > 0 ? (
                <p className="rounded-xl bg-[#F7F4F2] px-3 py-2 text-xs text-[#7D8A96]">
                  Ya lo reportaste ({mine.map((r) => categoryLabel(r.category).toLowerCase()).join(', ')}).
                  Puedes corregir tu reporte o añadir otro tipo.
                </p>
              ) : null}

              <div>
                <p className="mb-2 text-xs font-semibold text-[#7D8A96]/80">¿Qué pasa?</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => {
                    const active = c.key === category
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => pickCategory(c.key)}
                        aria-pressed={active}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${
                          active
                            ? 'border-[#C4655A] bg-[#C4655A] text-white'
                            : 'border-[#EAE4E2] bg-white text-[#2C3E50] hover:border-[#E8A598] hover:bg-[#FBEDEA]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">{c.icon}</span>
                        {c.label}
                      </button>
                    )
                  })}
                </div>
                {!context.answered && target.type === 'question' ? (
                  <p className="mt-2 text-[11px] text-[#7D8A96]/80">
                    Responde primero si lo que falla es la respuesta o la explicación.
                  </p>
                ) : null}
              </div>

              {category === 'respuesta_erronea' ? (
                <div>
                  <p className="mb-2 text-xs font-semibold text-[#7D8A96]/80">
                    ¿Cuál crees que es la correcta? <span className="font-normal">(opcional)</span>
                  </p>
                  <div className="flex gap-2">
                    {LETTERS.slice(0, optionCount).map((l, i) => {
                      const active = suggested === i + 1
                      return (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setSuggested(active ? null : i + 1)}
                          aria-pressed={active}
                          className={`h-10 w-10 rounded-xl border text-sm font-black transition ${
                            active
                              ? 'border-[#2C3E50] bg-[#2C3E50] text-white'
                              : 'border-[#EAE4E2] bg-white text-[#2C3E50] hover:bg-[#F7F4F2]'
                          }`}
                        >
                          {l}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {category === 'imagen' ? (
                <div className="flex flex-wrap gap-2">
                  {IMAGE_SUBCATEGORIES.map((s) => {
                    const active = subcategory === s.key
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setSubcategory(active ? null : s.key)}
                        aria-pressed={active}
                        className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${
                          active
                            ? 'border-[#2C3E50] bg-[#2C3E50] text-white'
                            : 'border-[#EAE4E2] bg-white text-[#2C3E50] hover:bg-[#F7F4F2]'
                        }`}
                      >
                        {s.label}
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {def ? (
                <div>
                  <label htmlFor="report-message" className="mb-1.5 block text-xs font-semibold text-[#7D8A96]/80">
                    {def.prompt} {needsText ? null : <span className="font-normal">(opcional)</span>}
                  </label>
                  <textarea
                    id="report-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2.5 text-sm text-[#2C3E50] outline-none transition focus:bg-white"
                  />
                  {message.length > MAX_MESSAGE - 100 ? (
                    <p className="mt-1 text-right text-[11px] text-[#7D8A96]">
                      {message.length}/{MAX_MESSAGE}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {error ? <p className="text-sm font-medium text-[#C4655A]">{error}</p> : null}

              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-[11px] leading-snug text-[#7D8A96]/80">
                  Adjuntamos la pregunta tal como la ves y tu respuesta.
                </p>
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!canSend}
                  className="shrink-0 rounded-xl bg-[#C4655A] px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {sending ? 'Enviando…' : editing ? 'Actualizar' : 'Enviar'}
                </button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>,
    document.body,
  )
}

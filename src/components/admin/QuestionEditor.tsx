'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  LETTERS,
  adminApi,
  autoNote,
  toAnswerNumber,
  type EditResult,
  type EditableField,
  type QuestionChanges,
  type QuestionSnapshot,
} from '@/lib/admin/reports'

type QuestionEditorProps = {
  questionId: number
  current: QuestionSnapshot
  /** Reportes abiertos: si hay, se ofrece "guardar y aceptar" en el mismo paso. */
  openReports: number
  onCancel: () => void
  onSaved: (result: EditResult) => void
}

// Editor de una pregunta. Solo manda lo que de verdad cambió; el backend lo
// aplica y guarda la revisión (antes / después) en la misma transacción, así
// que cualquier guardado se puede deshacer desde el historial.
export default function QuestionEditor({ questionId, current, openReports, onCancel, onSaved }: QuestionEditorProps) {
  const initial = useMemo(
    () => ({
      statement: current.statement ?? '',
      options: [...(current.options ?? [])],
      correct_answer: toAnswerNumber(current.correct_answer) ?? 1,
      explanation: current.explanation ?? '',
      image_url: current.image_url ?? '',
    }),
    [current],
  )

  const [statement, setStatement] = useState(initial.statement)
  const [options, setOptions] = useState(initial.options)
  const [correct, setCorrect] = useState(initial.correct_answer)
  const [explanation, setExplanation] = useState(initial.explanation)
  const [imageUrl, setImageUrl] = useState(initial.image_url)
  const [acceptReports, setAcceptReports] = useState(openReports > 0)
  const [userNote, setUserNote] = useState('')
  const [xp, setXp] = useState(25)
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const disarm = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (disarm.current) clearTimeout(disarm.current)
    },
    [],
  )

  const { changes, fields } = useMemo(() => {
    const c: QuestionChanges = {}
    if (statement.trim() !== initial.statement.trim()) c.statement = statement
    if (options.some((o, i) => o.trim() !== (initial.options[i] ?? '').trim())) c.options = options
    if (correct !== initial.correct_answer) c.correct_answer = correct
    if (explanation.trim() !== initial.explanation.trim()) c.explanation = explanation
    if (imageUrl.trim() !== initial.image_url.trim()) c.image_url = imageUrl.trim() || null
    return { changes: c, fields: Object.keys(c) as EditableField[] }
  }, [statement, options, correct, explanation, imageUrl, initial])

  const resolving = acceptReports && openReports > 0
  const previewNote = autoNote(fields, { correct_answer: initial.correct_answer }, { correct_answer: correct })
  const canSave = fields.length > 0 && !busy && statement.trim() !== '' && options.every((o) => o.trim() !== '')

  const save = async () => {
    if (!canSave) return
    // Aceptar avisa a los usuarios y no se puede deshacer: segundo clic.
    if (resolving && !armed) {
      setArmed(true)
      if (disarm.current) clearTimeout(disarm.current)
      disarm.current = setTimeout(() => setArmed(false), 4000)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await adminApi.editQuestion(
        questionId,
        changes,
        '',
        resolving ? { note: userNote.trim(), xp } : null,
      )
      onSaved(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
      setArmed(false)
    } finally {
      setBusy(false)
    }
  }

  const changed = (f: EditableField) => fields.includes(f)
  const ring = (f: EditableField) => (changed(f) ? 'border-[#5B7D99] bg-[#F3F7FA]' : 'border-[#EAE4E2] bg-[#FAF7F4]')

  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-[#5B7D99] bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-black text-[#2C3E50]">
          <span className="material-symbols-outlined text-[18px] text-[#5B7D99]">edit</span>
          Editar pregunta
        </h3>
        <p className="text-[11px] text-[#7D8A96]">
          {fields.length ? `Cambias: ${fields.map((f) => FIELD_NAMES[f]).join(', ')}` : 'Sin cambios todavía'}
        </p>
      </div>

      <Field label="Enunciado">
        <textarea
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          rows={Math.min(10, Math.max(3, Math.ceil(statement.length / 90)))}
          className={`w-full rounded-xl border px-3 py-2 text-sm text-[#2C3E50] outline-none focus:bg-white ${ring('statement')}`}
        />
      </Field>

      <Field label="Opciones · marca la correcta">
        <div className="flex flex-col gap-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => setCorrect(i + 1)}
                aria-pressed={correct === i + 1}
                aria-label={`Marcar ${LETTERS[i]} como correcta`}
                className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black transition ${
                  correct === i + 1
                    ? 'bg-[#8BA888] text-white'
                    : 'bg-white text-[#7D8A96] ring-1 ring-[#EAE4E2] hover:ring-[#8BA888]'
                }`}
              >
                {LETTERS[i]}
              </button>
              <textarea
                value={opt}
                onChange={(e) => setOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))}
                rows={Math.min(4, Math.max(1, Math.ceil(opt.length / 80)))}
                className={`min-w-0 flex-1 resize-none rounded-xl border px-3 py-1.5 text-sm text-[#2C3E50] outline-none focus:bg-white ${
                  opt.trim() !== (initial.options[i] ?? '').trim() ? 'border-[#5B7D99] bg-[#F3F7FA]' : 'border-[#EAE4E2] bg-[#FAF7F4]'
                }`}
              />
            </div>
          ))}
        </div>
        {changed('correct_answer') ? (
          <p className="mt-2 text-xs font-semibold text-[#5B7D99]">
            Clave: {LETTERS[initial.correct_answer - 1]} → {LETTERS[correct - 1]}
          </p>
        ) : null}
      </Field>

      <Field label="Explicación">
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={Math.min(14, Math.max(4, Math.ceil(explanation.length / 90)))}
          className={`w-full rounded-xl border px-3 py-2 text-sm text-[#2C3E50] outline-none focus:bg-white ${ring('explanation')}`}
        />
      </Field>

      <Field label="Imagen (URL https; vacío = sin imagen)">
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…/questions/2026/15.png"
          className={`w-full rounded-xl border px-3 py-2 text-sm text-[#2C3E50] outline-none focus:bg-white ${ring('image_url')}`}
        />
      </Field>

      {openReports > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl bg-[#F7F4F2] p-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-[#2C3E50]">
            <input type="checkbox" checked={acceptReports} onChange={(e) => setAcceptReports(e.target.checked)} />
            Aceptar {openReports === 1 ? 'el reporte abierto' : `los ${openReports} reportes abiertos`} y avisar
          </label>
          {acceptReports ? (
            <>
              <div className="flex items-center gap-2">
                <input
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value.slice(0, 500))}
                  placeholder={previewNote || 'Nota para el usuario'}
                  className="min-w-0 flex-1 rounded-lg border border-[#EAE4E2] bg-white px-3 py-1.5 text-sm text-[#2C3E50] outline-none"
                />
                <label className="flex shrink-0 items-center gap-1 text-xs text-[#7D8A96]">
                  XP
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={xp}
                    onChange={(e) => setXp(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                    className="w-14 rounded-lg border border-[#EAE4E2] bg-white px-2 py-1 text-right text-sm"
                  />
                </label>
              </div>
              <p className="text-[11px] text-[#7D8A96]">
                Si no escribes nada, leerán: «{previewNote || '…'}»
              </p>
            </>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm font-semibold text-[#C4655A]">{error}</p> : null}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-[#EAE4E2] bg-white px-4 py-2 text-sm font-semibold text-[#2C3E50] hover:bg-[#F7F4F2]"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => void save()}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: armed ? '#C4655A' : '#5B7D99' }}
        >
          <span className="material-symbols-outlined text-[18px]">{armed ? 'warning' : 'save'}</span>
          {busy ? 'Guardando…' : armed ? 'Confirmar: guardar y avisar' : resolving ? 'Guardar y aceptar' : 'Guardar'}
        </button>
      </div>
    </section>
  )
}

const FIELD_NAMES: Record<EditableField, string> = {
  statement: 'enunciado',
  options: 'opciones',
  correct_answer: 'clave',
  explanation: 'explicación',
  image_url: 'imagen',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-[#7D8A96]/80">{label}</p>
      {children}
    </div>
  )
}

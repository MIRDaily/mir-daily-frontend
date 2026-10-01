'use client'

import { useEffect, useState } from 'react'
import {
  FIELD_LABEL,
  adminApi,
  letter,
  timeAgo,
  toAnswerNumber,
  type EditableField,
  type QuestionState,
  type Revision,
} from '@/lib/admin/reports'

type QuestionRevisionsProps = {
  questionId: number
  /** Cambia tras cada guardado para recargar la lista. */
  version: number
  onReverted: (message: string) => void
}

// Historial de cambios de una pregunta, con "Deshacer" en cada revisión.
// Deshacer reaplica el "antes" como una revisión nueva: nada se pierde.
export default function QuestionRevisions({ questionId, version, onReverted }: QuestionRevisionsProps) {
  const token = `${questionId}#${version}`
  const [result, setResult] = useState<{ token: string; items?: Revision[]; error?: string } | null>(null)
  const items = result?.token === token ? result.items ?? null : null
  const error = result?.token === token ? result.error ?? null : null

  useEffect(() => {
    let alive = true
    const t = `${questionId}#${version}`
    adminApi
      .revisions(questionId)
      .then((r) => alive && setResult({ token: t, items: r }))
      .catch((e: Error) => alive && setResult({ token: t, error: e.message }))
    return () => {
      alive = false
    }
  }, [questionId, version])

  if (error) return <p className="text-sm text-[#C4655A]">{error}</p>
  if (!items || items.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[#7D8A96]">Historial de cambios ({items.length})</h3>
      {items.map((rev) => (
        <RevisionCard key={rev.id} questionId={questionId} rev={rev} onReverted={onReverted} />
      ))}
    </section>
  )
}

function RevisionCard({
  questionId,
  rev,
  onReverted,
}: {
  questionId: number
  rev: Revision
  onReverted: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const revert = async () => {
    if (!armed) {
      setArmed(true)
      setTimeout(() => setArmed(false), 4000)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await adminApi.revertRevision(questionId, rev.id)
      onReverted(r.unchanged ? `La revisión #${rev.id} ya estaba deshecha` : `Revisión #${rev.id} deshecha`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo deshacer')
    } finally {
      setBusy(false)
      setArmed(false)
    }
  }

  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-[#EAE4E2] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-[#2C3E50]">#{rev.id}</span>
        <span className="text-xs text-[#7D8A96]">
          {rev.changed_fields.map((f) => FIELD_LABEL[f]).join(', ')} · {rev.editor ?? 'Admin'} · {timeAgo(rev.edited_at)}
        </span>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs font-semibold text-[#5B7D99] underline">
            {open ? 'Ocultar' : 'Ver cambios'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void revert()}
            className={`rounded-lg border px-2 py-0.5 text-xs font-bold transition ${
              armed ? 'border-[#C4655A] bg-[#C4655A] text-white' : 'border-[#EAE4E2] text-[#2C3E50] hover:bg-[#F7F4F2]'
            }`}
          >
            {armed ? 'Confirmar' : 'Deshacer'}
          </button>
        </div>
      </div>
      {rev.note ? <p className="text-xs text-[#7D8A96]">{rev.note}</p> : null}
      {open ? (
        <dl className="flex flex-col gap-2">
          {rev.changed_fields.map((f) => (
            <div key={f} className="grid gap-1 sm:grid-cols-2">
              <dt className="col-span-full text-[11px] font-bold uppercase tracking-wide text-[#7D8A96]">{FIELD_LABEL[f]}</dt>
              <dd className="whitespace-pre-wrap rounded-lg bg-[#FBEDEA] px-2 py-1 text-xs text-[#7A3B33] line-through decoration-[#C4655A]/40">
                {show(rev.before, f)}
              </dd>
              <dd className="whitespace-pre-wrap rounded-lg bg-[#EAF2E9] px-2 py-1 text-xs text-[#3F5E3C]">{show(rev.after, f)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {error ? <p className="text-xs font-semibold text-[#C4655A]">{error}</p> : null}
    </article>
  )
}

function show(state: QuestionState, field: EditableField): string {
  const v = state?.[field]
  if (v == null || v === '') return '—'
  if (field === 'correct_answer') return letter(toAnswerNumber(v))
  if (field === 'options' && Array.isArray(v)) return v.map((o, i) => `${letter(i + 1)}) ${o}`).join('\n')
  return String(v)
}

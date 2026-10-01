'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ZoomableImage } from '@/components/simulacro/QuestionImage'
import { categoryLabel } from '@/lib/reports/categories'
import QuestionEditor from '@/components/admin/QuestionEditor'
import QuestionRevisions from '@/components/admin/QuestionRevisions'
import {
  FIELD_LABEL,
  ORIGIN_LABEL,
  STATUS_META,
  SUBCATEGORY_LABEL,
  TIER_META,
  adminApi,
  contentTitle,
  letter,
  snapshotDiff,
  timeAgo,
  toAnswerNumber,
  type AdminReport,
  type EditResult,
  type Outcome,
  type QuestionSnapshot,
  type ReportDetailData,
} from '@/lib/admin/reports'

type ReportDetailProps = {
  contentKey: string
  /** Tras resolver o anular: la página recarga la cola. */
  onChanged: () => void
  onBack?: () => void
}

const OUTCOME_BUTTONS: { outcome: Outcome; label: string; icon: string; bg: string }[] = [
  { outcome: 'accepted', label: 'Aceptar', icon: 'verified', bg: '#6E8D6B' },
  { outcome: 'rejected', label: 'Rechazar', icon: 'block', bg: '#7D8A96' },
  { outcome: 'duplicate', label: 'Ya estaba', icon: 'content_copy', bg: '#5B7D99' },
]

export default function ReportDetail({ contentKey, onChanged, onBack }: ReportDetailProps) {
  const [reloadToken, setReloadToken] = useState(0)
  // "Cargando" se deduce de si lo que hay en pantalla corresponde a la
  // petición actual; al recargar el mismo contenido se sigue viendo el anterior.
  const requestToken = `${contentKey}#${reloadToken}`
  const [result, setResult] = useState<{ token: string; data?: ReportDetailData; error?: string } | null>(null)
  const loading = result?.token !== requestToken
  const data = result?.data && result.data.key === contentKey ? result.data : null
  const error = !loading ? result?.error ?? null : null
  // Resultado de la última acción. Vive aquí y no en la caja de resolver
  // porque esa caja desaparece en cuanto no quedan reportes abiertos.
  const [flash, setFlash] = useState<{ key: string; text: string } | null>(null)
  // Por clave, no booleano: al cambiar de pregunta el editor se cierra solo.
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const editing = editingKey === contentKey

  useEffect(() => {
    let alive = true
    const token = `${contentKey}#${reloadToken}`
    adminApi
      .detail(contentKey)
      .then((d) => {
        if (alive) setResult({ token, data: d })
      })
      .catch((e: Error) => {
        if (alive) setResult({ token, error: e.message })
      })
    return () => {
      alive = false
    }
  }, [contentKey, reloadToken])

  const reload = (message?: string) => {
    if (message) setFlash({ key: contentKey, text: message })
    setReloadToken((t) => t + 1)
    onChanged()
  }

  if (loading && !data) {
    return (
      <div className="space-y-3 p-6">
        <div className="h-8 w-1/2 animate-pulse rounded-xl bg-[#F5F1EE]" />
        <div className="h-32 animate-pulse rounded-2xl bg-[#F5F1EE]" />
        <div className="h-48 animate-pulse rounded-2xl bg-[#F5F1EE]" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-3 p-6">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver a la lista"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#EAE4E2] text-[#7D8A96] lg:hidden"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
        ) : null}
        <p className="text-sm text-[#C4655A]">{error ?? 'No se pudo cargar'}</p>
      </div>
    )
  }

  const open = data.reports.filter((r) => r.status === 'open')
  const closed = data.reports.filter((r) => r.status !== 'open')
  const isQuestion = contentKey.startsWith('q:')
  const questionId = isQuestion ? Number(contentKey.slice(2)) : null
  const latestGuideSnapshot = !isQuestion ? data.reports[0]?.snapshot ?? null : null
  const title = contentTitle({
    content_key: contentKey,
    year: data.current?.year ?? data.queue?.year,
    question_number: data.current?.question_number ?? data.queue?.question_number,
    guide_ref: data.queue?.guide_ref ?? data.reports[0]?.guide_ref,
    guide_title: latestGuideSnapshot?.guide_title ?? null,
  })

  return (
    <div className="flex flex-col gap-5 p-5 sm:p-6">
      <header className="flex flex-wrap items-start gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver a la lista"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#EAE4E2] text-[#7D8A96] lg:hidden"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-[#2C3E50]">{title}</h2>
            {data.queue ? (
              <span
                className="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                style={{ color: TIER_META[data.queue.tier].color, background: TIER_META[data.queue.tier].soft }}
              >
                {TIER_META[data.queue.tier].label} · {data.queue.score}
              </span>
            ) : null}
            {data.current?.anulada ? (
              <span className="rounded-full bg-[#2C3E50] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                Anulada
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-[#7D8A96]">
            {[data.current?.subject, data.current?.topic, `id ${contentKey.slice(2)}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        {isQuestion && data.current && !editing ? (
          <button
            type="button"
            onClick={() => setEditingKey(contentKey)}
            className="flex items-center gap-1 rounded-xl border border-[#5B7D99] px-3 py-1.5 text-xs font-bold text-[#5B7D99] hover:bg-[#F3F7FA]"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
            Editar
          </button>
        ) : null}
        {!isQuestion && data.reports[0]?.guide_ref ? (
          <a
            href={guideHref(data.reports[0].guide_ref)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-xl border border-[#EAE4E2] px-3 py-1.5 text-xs font-semibold text-[#2C3E50] hover:bg-[#F7F4F2]"
          >
            Abrir guía
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
          </a>
        ) : null}
      </header>

      {isQuestion && data.current && editing && questionId ? (
        <QuestionEditor
          key={`${contentKey}#${reloadToken}`}
          questionId={questionId}
          current={data.current}
          openReports={open.length}
          onCancel={() => setEditingKey(null)}
          onSaved={(r) => {
            setEditingKey(null)
            reload(editMessage(r))
          }}
        />
      ) : null}
      {isQuestion && data.current && !editing ? (
        <QuestionView current={data.current} stats={data.stats} suggested={data.queue?.suggested_answers ?? null} />
      ) : null}
      {isQuestion && !data.current ? (
        <p className="rounded-xl bg-[#FBEDEA] px-4 py-3 text-sm text-[#A0524A]">Esta pregunta ya no existe.</p>
      ) : null}
      {!isQuestion && latestGuideSnapshot ? <GuideSnapshotView snapshot={latestGuideSnapshot} /> : null}

      {flash && flash.key === contentKey ? (
        <p className="flex items-center gap-2 rounded-xl bg-[#EAF2E9] px-4 py-2.5 text-sm font-semibold text-[#4F7A4B]">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          {flash.text}
        </p>
      ) : null}

      {/* Mientras se edita, el editor lleva su propio "guardar y aceptar". */}
      {open.length > 0 && !editing ? (
        <ResolveBox contentKey={contentKey} openCount={open.length} onDone={reload} />
      ) : null}

      {questionId && data.current ? (
        <AnuladaToggle questionId={questionId} anulada={!!data.current.anulada} onDone={reload} />
      ) : null}

      {questionId ? <QuestionRevisions questionId={questionId} version={reloadToken} onReverted={reload} /> : null}

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[#7D8A96]">
          Reportes abiertos ({open.length})
        </h3>
        {open.length === 0 ? (
          <p className="text-sm text-[#7D8A96]">Ninguno.</p>
        ) : (
          open.map((r) => <ReportCard key={r.id} report={r} current={isQuestion ? data.current : null} />)
        )}
      </section>

      {closed.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[#7D8A96]">
            Resueltos ({closed.length})
          </h3>
          {closed.map((r) => (
            <ReportCard key={r.id} report={r} current={isQuestion ? data.current : null} />
          ))}
        </section>
      ) : null}
    </div>
  )
}

function editMessage(r: EditResult): string {
  if (r.unchanged) return 'No había cambios que guardar'
  let text = `Guardado (${r.changedFields.map((f) => FIELD_LABEL[f]).join(', ')}) · revisión #${r.revisionId}`
  if (r.resolved) {
    text += ` · ${r.resolved.resolved} reporte${r.resolved.resolved === 1 ? '' : 's'} aceptado${r.resolved.resolved === 1 ? '' : 's'}`
    if (r.resolved.xp_awarded) text += ` · ${r.resolved.xp_awarded} XP`
  }
  if (r.resolveError) text += ` · ⚠ ${r.resolveError}`
  return text
}

function guideHref(guideRef: string): string {
  const [guide, ...rest] = guideRef.split('/')
  const where = rest.join('/')
  const hash = /^q\d+$/.test(where) ? `#pregunta-${where.slice(1)}` : ''
  return `/library/${guide}/guia${hash}`
}

// ---------------------------------------------------------------------------

function QuestionView({
  current,
  stats,
  suggested,
}: {
  current: QuestionSnapshot
  stats: ReportDetailData['stats']
  suggested: Record<string, number> | null
}) {
  const correct = toAnswerNumber(current.correct_answer)
  const answered = stats.filter((s) => s.selected_option != null)
  const total = answered.reduce((acc, s) => acc + s.n, 0)
  const blank = stats.find((s) => s.selected_option == null)?.n ?? 0
  const hits = answered.reduce((acc, s) => acc + s.n_correct, 0)
  const byOption = new Map(answered.map((s) => [s.selected_option as number, s.n]))

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-[#EAE4E2] bg-white p-5">
      <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-[#2C3E50]">{current.statement}</p>

      {current.image_url ? (
        <div className="flex justify-center rounded-xl bg-[#F9F8F7] p-3">
          <ZoomableImage url={current.image_url} alt="Imagen de la pregunta" className="max-h-64 w-auto rounded-lg object-contain" />
        </div>
      ) : current.has_image ? (
        <p className="rounded-xl bg-[#FBEDEA] px-3 py-2 text-xs font-semibold text-[#A0524A]">
          Marcada con imagen pero sin URL
        </p>
      ) : null}

      <ol className="flex flex-col gap-1.5">
        {(current.options ?? []).map((opt, i) => {
          const n = i + 1
          const isCorrect = n === correct
          const count = byOption.get(n) ?? 0
          const pct = total ? Math.round((count / total) * 100) : 0
          const proposals = suggested?.[String(n)] ?? 0
          return (
            <li
              key={i}
              className={`relative overflow-hidden rounded-lg px-3 py-2 text-sm ${
                isCorrect ? 'ring-1 ring-[#8BA888]/60' : ''
              }`}
            >
              {/* Barra de fondo: % de usuarios que la eligieron */}
              <span
                className="absolute inset-y-0 left-0"
                style={{ width: `${pct}%`, background: isCorrect ? '#8BA88833' : '#E8A59826' }}
              />
              <span className="relative flex items-start gap-2.5">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    isCorrect ? 'bg-[#8BA888] text-white' : 'bg-white text-[#7D8A96] ring-1 ring-[#EAE4E2]'
                  }`}
                >
                  {letter(n)}
                </span>
                <span className="flex-1 text-[#2C3E50]">{opt}</span>
                {proposals > 0 ? (
                  <span className="shrink-0 rounded-full bg-[#C4655A] px-2 py-0.5 text-[10px] font-bold text-white">
                    Proponen ×{proposals}
                  </span>
                ) : null}
                <span className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums text-[#7D8A96]">
                  {total ? `${pct} % · ${count}` : ''}
                </span>
              </span>
            </li>
          )
        })}
      </ol>

      <p className="text-xs text-[#7D8A96]">
        {total
          ? `${total} usuario${total === 1 ? '' : 's'} (primer intento) · ${Math.round((hits / total) * 100)} % de acierto${blank ? ` · ${blank} en blanco` : ''}`
          : 'Nadie la ha respondido todavía.'}
      </p>

      {current.explanation ? (
        <div className="rounded-xl border-l-4 border-[#8BA888] bg-[#8BA888]/10 p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#2C3E50]">{current.explanation}</p>
        </div>
      ) : (
        <p className="text-xs italic text-[#7D8A96]">Sin explicación.</p>
      )}
    </section>
  )
}

function GuideSnapshotView({ snapshot }: { snapshot: QuestionSnapshot }) {
  if (!snapshot.stem) {
    return (
      <p className="rounded-xl bg-[#F7F4F2] px-4 py-3 text-sm text-[#7D8A96]">
        Reporte general de la guía: el detalle está en el texto de cada reporte.
      </p>
    )
  }
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[#EAE4E2] bg-white p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7D8A96]">Tal como la vio el usuario</p>
      <p className="text-sm font-medium leading-relaxed text-[#2C3E50]">{snapshot.stem}</p>
      <ol className="flex flex-col gap-1">
        {(snapshot.options ?? []).map((o, i) => (
          <li
            key={i}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              snapshot.correct === i + 1 ? 'bg-[#8BA888]/15 font-semibold text-[#3F5E3C]' : 'text-[#2C3E50]'
            }`}
          >
            {i + 1}. {o}
          </li>
        ))}
      </ol>
      {snapshot.explanation ? <p className="text-sm text-[#2C3E50]">{snapshot.explanation}</p> : null}
      <p className="text-xs text-[#7D8A96]">
        La guía vive en el código del frontend (<code>src/lib/studyGuides/</code>): se corrige con un commit.
      </p>
    </section>
  )
}

// ---------------------------------------------------------------------------

function ReportCard({ report, current }: { report: AdminReport; current: QuestionSnapshot | null }) {
  const [showSnapshot, setShowSnapshot] = useState(false)
  const diff = useMemo(() => snapshotDiff(report.snapshot ?? {}, current), [report.snapshot, current])
  const r = report.reporter
  const status = STATUS_META[report.status]

  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-[#EAE4E2] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-[#2C3E50]">{categoryLabel(report.category)}</span>
        {report.subcategory ? (
          <span className="text-xs text-[#7D8A96]">({SUBCATEGORY_LABEL[report.subcategory] ?? report.subcategory})</span>
        ) : null}
        {report.suggested_answer ? (
          <span className="rounded-full bg-[#FBEDEA] px-2 py-0.5 text-[11px] font-bold text-[#A0524A]">
            Propone la {letter(report.suggested_answer)}
          </span>
        ) : null}
        {report.snapshot?.image_status && report.snapshot.image_status !== '200' ? (
          <span className="rounded-full bg-[#C4655A] px-2 py-0.5 text-[11px] font-bold text-white">
            Imagen: {report.snapshot.image_status}
          </span>
        ) : null}
        {report.status !== 'open' ? (
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ color: status.color, background: status.soft }}
          >
            {status.label}
          </span>
        ) : null}
      </div>

      {report.message ? (
        <p className="whitespace-pre-wrap rounded-xl bg-[#FAF7F4] px-3 py-2 text-sm text-[#2C3E50]">{report.message}</p>
      ) : null}

      <p className="text-xs leading-relaxed text-[#7D8A96]">
        {r ? (
          <>
            <span className="font-semibold text-[#2C3E50]">{r.name}</span> ({r.accepted} aceptados · {r.rejected} rechazados)
            {' · '}
          </>
        ) : null}
        {ORIGIN_LABEL[report.origin] ?? report.origin}
        {' · '}
        {report.answered
          ? report.user_answer
            ? `respondió ${letter(report.user_answer)}${report.user_was_correct == null ? '' : report.user_was_correct ? ' (acierto)' : ' (fallo)'}`
            : report.user_was_correct == null
              ? 'ya había respondido'
              : report.user_was_correct
                ? 'acertó'
                : 'falló'
          : 'antes de responder'}
        {' · '}
        {report.platform}
        {report.app_version ? ` ${report.app_version}` : ''}
        {' · '}
        {timeAgo(report.updated_at)}
      </p>

      {report.resolution_note ? (
        <p className="text-xs text-[#7D8A96]">
          Nota al cerrar: <span className="text-[#2C3E50]">{report.resolution_note}</span>
        </p>
      ) : null}

      {diff.length > 0 ? (
        <div className="rounded-xl bg-[#EAF1F7] px-3 py-2 text-xs text-[#3E5C76]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">difference</span>
            <span>
              Desde este reporte ha cambiado: <b>{diff.map((d) => d.label).join(', ')}</b>
            </span>
            <button
              type="button"
              onClick={() => setShowSnapshot((v) => !v)}
              className="ml-auto font-semibold underline"
            >
              {showSnapshot ? 'Ocultar' : 'Ver cómo estaba'}
            </button>
          </div>
          {showSnapshot ? (
            <dl className="mt-2 flex flex-col gap-1.5">
              {diff.map((d) => (
                <div key={d.key}>
                  <dt className="font-semibold capitalize">{d.label}</dt>
                  <dd className="whitespace-pre-wrap text-[#2C3E50]">
                    {formatSnapshotValue(report.snapshot[d.key], d.key)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function formatSnapshotValue(value: unknown, key: keyof QuestionSnapshot): string {
  if (value == null) return '—'
  if (key === 'options' && Array.isArray(value)) return value.map((o, i) => `${letter(i + 1)}) ${o}`).join('\n')
  if (key === 'correct_answer') return letter(toAnswerNumber(value))
  if (typeof value === 'boolean') return value ? 'sí' : 'no'
  return String(value)
}

// ---------------------------------------------------------------------------

// Cerrar los reportes abiertos. Notifica a cada usuario, así que pide un
// segundo clic para confirmar (no se puede deshacer).
function ResolveBox({
  contentKey,
  openCount,
  onDone,
}: {
  contentKey: string
  openCount: number
  onDone: (message: string) => void
}) {
  const [note, setNote] = useState('')
  const [xp, setXp] = useState(25)
  const [armed, setArmed] = useState<Outcome | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const disarm = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (disarm.current) clearTimeout(disarm.current)
  }, [])

  const click = async (outcome: Outcome) => {
    if (busy) return
    if (armed !== outcome) {
      setArmed(outcome)
      if (disarm.current) clearTimeout(disarm.current)
      disarm.current = setTimeout(() => setArmed(null), 4000)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const r = await adminApi.resolve(contentKey, outcome, note, xp)
      setNote('')
      setArmed(null)
      onDone(
        `${r.resolved} reporte${r.resolved === 1 ? '' : 's'} cerrado${r.resolved === 1 ? '' : 's'} · ${r.notified} aviso${r.notified === 1 ? '' : 's'}${r.xp_awarded ? ` · ${r.xp_awarded} XP` : ''}`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo resolver')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-[#2c3e50] bg-white p-4" style={{ boxShadow: '5px 5px 0 0 #2c3e50' }}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black text-[#2C3E50]">
          Resolver {openCount} reporte{openCount === 1 ? '' : 's'} abierto{openCount === 1 ? '' : 's'}
        </h3>
        <label className="flex items-center gap-1.5 text-xs text-[#7D8A96]">
          XP si se acepta
          <input
            type="number"
            min={0}
            max={100}
            value={xp}
            onChange={(e) => setXp(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
            className="w-16 rounded-lg border border-[#EAE4E2] bg-[#FAF7F4] px-2 py-1 text-right text-sm text-[#2C3E50] outline-none"
          />
        </label>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 500))}
        rows={2}
        placeholder="Nota para el usuario (la leerá en la notificación). P. ej.: «Clave corregida a C según la plantilla definitiva.»"
        className="w-full resize-none rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2 text-sm text-[#2C3E50] outline-none focus:bg-white"
      />
      <div className="flex flex-wrap gap-2">
        {OUTCOME_BUTTONS.map((b) => (
          <button
            key={b.outcome}
            type="button"
            disabled={busy}
            onClick={() => void click(b.outcome)}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: armed === b.outcome ? '#C4655A' : b.bg }}
          >
            <span className="material-symbols-outlined text-[18px]">{armed === b.outcome ? 'warning' : b.icon}</span>
            {armed === b.outcome ? `Confirmar: ${b.label.toLowerCase()}` : b.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-[#7D8A96]">
        Aceptar = tenía razón (aviso + XP). Rechazar = el contenido está bien. Ya estaba = ya lo teníamos corregido o en marcha. Si hay que corregir
        algo, usa <b>Editar</b> y «Guardar y aceptar»: el aviso dice «hemos corregido».
      </p>
      {error ? <p className="text-sm font-semibold text-[#C4655A]">{error}</p> : null}
    </section>
  )
}

function AnuladaToggle({
  questionId,
  anulada,
  onDone,
}: {
  questionId: number
  anulada: boolean
  onDone: (message: string) => void
}) {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const click = async () => {
    if (!armed) {
      setArmed(true)
      setTimeout(() => setArmed(false), 4000)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await adminApi.setAnulada(questionId, !anulada)
      setArmed(false)
      onDone(anulada ? 'Anulación retirada' : 'Pregunta anulada')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#F7F4F2] px-4 py-3">
      <p className="flex-1 text-xs text-[#7D8A96]">
        {anulada
          ? 'Anulada: no puntúa en simulacros y no sale en el daily.'
          : 'Anular: deja de puntuar en simulacros y no sale en el daily. Conserva la clave.'}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void click()}
        className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
          armed ? 'border-[#C4655A] bg-[#C4655A] text-white' : 'border-[#2C3E50] bg-white text-[#2C3E50] hover:bg-[#2C3E50] hover:text-white'
        }`}
      >
        {armed ? 'Confirmar' : anulada ? 'Quitar anulación' : 'Anular pregunta'}
      </button>
      {error ? <p className="w-full text-xs font-semibold text-[#C4655A]">{error}</p> : null}
    </div>
  )
}

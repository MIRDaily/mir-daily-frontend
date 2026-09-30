'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import ReportDetail from '@/components/admin/ReportDetail'
import { categoryLabel, QUESTION_CATEGORIES, GUIDE_CATEGORIES } from '@/lib/reports/categories'
import {
  AdminError,
  STATUS_META,
  TIER_META,
  adminApi,
  contentTitle,
  letter,
  timeAgo,
  type HistoryItem,
  type QueueItem,
  type SuspiciousItem,
  type Tier,
} from '@/lib/admin/reports'

type Tab = 'cola' | 'sospechosas' | 'historial'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'cola', label: 'Cola', icon: 'inbox' },
  { key: 'sospechosas', label: 'Sospechosas', icon: 'query_stats' },
  { key: 'historial', label: 'Historial', icon: 'history' },
]

const ALL_CATEGORIES = [...QUESTION_CATEGORIES, ...GUIDE_CATEGORIES.filter((g) => !QUESTION_CATEGORIES.some((q) => q.key === g.key))]

export default function AdminReportsPage() {
  return (
    <Suspense fallback={null}>
      <AdminReports />
    </Suspense>
  )
}

function AdminReports() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  // Pestaña y contenido abierto van en la URL: el aviso de Telegram puede
  // enlazar directo a ?key=q:4265, y el botón de atrás funciona.
  const tab = (TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'cola') as Tab
  const selectedKey = params.get('key')

  const setParams = useCallback(
    (next: { tab?: Tab; key?: string | null }) => {
      const sp = new URLSearchParams(params.toString())
      if (next.tab) sp.set('tab', next.tab)
      if (next.key === null) sp.delete('key')
      else if (next.key) sp.set('key', next.key)
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
    },
    [params, pathname, router],
  )

  const [access, setAccess] = useState<'loading' | 'ok' | 'denied' | 'error'>('loading')
  useEffect(() => {
    adminApi
      .me()
      .then(() => setAccess('ok'))
      .catch((e) => setAccess(e instanceof AdminError && (e.status === 403 || e.status === 401) ? 'denied' : 'error'))
  }, [])

  const [queue, setQueue] = useState<QueueItem[] | null>(null)
  const [queueError, setQueueError] = useState<string | null>(null)
  const loadQueue = useCallback(() => {
    adminApi
      .queue()
      .then((items) => {
        setQueue(items)
        setQueueError(null)
      })
      .catch((e: Error) => setQueueError(e.message))
  }, [])

  useEffect(() => {
    if (access === 'ok') loadQueue()
  }, [access, loadQueue])

  if (access === 'loading') {
    return <Shell><div className="h-40 animate-pulse rounded-3xl bg-white/70" /></Shell>
  }
  if (access !== 'ok') {
    return (
      <Shell>
        <div className="rounded-3xl bg-white p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-[#C4655A]">lock</span>
          <p className="mt-2 text-lg font-black text-[#2C3E50]">
            {access === 'denied' ? 'Solo administradores' : 'No se pudo comprobar el acceso'}
          </p>
        </div>
      </Shell>
    )
  }

  const counts = {
    critica: queue?.filter((q) => q.tier === 'critica').length ?? 0,
    total: queue?.length ?? 0,
  }

  return (
    <Shell>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#C45B4B]">Administración</p>
          <h1 className="mt-1 text-3xl font-black text-[#2C3E50]">Reportes</h1>
          <p className="mt-1 text-sm text-[#7D8A96]">
            {counts.total} abierto{counts.total === 1 ? '' : 's'}
            {counts.critica ? ` · ${counts.critica} crítico${counts.critica === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        <div className="inline-flex gap-1 rounded-xl bg-[#F5F1EE] p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setParams({ tab: t.key, key: null })}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                tab === t.key ? 'bg-white text-[#C45B4B] shadow-sm' : 'text-[#7D8A96] hover:text-[#2C3E50]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
              {t.label}
              {t.key === 'cola' && counts.total ? (
                <span className="rounded-full bg-[#C4655A] px-1.5 text-[10px] font-bold text-white">{counts.total}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(320px,400px)_1fr]">
        {/* En móvil, lista o detalle; en escritorio, las dos columnas. */}
        <div className={selectedKey ? 'hidden lg:block' : ''}>
          {tab === 'cola' ? (
            <QueuePanel items={queue} error={queueError} selectedKey={selectedKey} onSelect={(key) => setParams({ key })} />
          ) : tab === 'sospechosas' ? (
            <SuspiciousPanel selectedKey={selectedKey} onSelect={(key) => setParams({ key })} />
          ) : (
            <HistoryPanel selectedKey={selectedKey} onSelect={(key) => setParams({ key })} />
          )}
        </div>
        <div className={`min-w-0 ${selectedKey ? '' : 'hidden lg:block'}`}>
          <div className="rounded-3xl border border-white/60 bg-white/90 shadow-[0_18px_40px_rgba(125,138,150,0.16)] ring-1 ring-white/70 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
            {selectedKey ? (
              <ReportDetail contentKey={selectedKey} onChanged={loadQueue} onBack={() => setParams({ key: null })} />
            ) : (
              <div className="flex flex-col items-center gap-2 p-12 text-center text-[#7D8A96]">
                <span className="material-symbols-outlined text-4xl">touch_app</span>
                <p className="text-sm">Elige un elemento de la lista para revisarlo.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#2D3748]">
      <main className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}

// ---------------------------------------------------------------------------

function QueuePanel({
  items,
  error,
  selectedKey,
  onSelect,
}: {
  items: QueueItem[] | null
  error: string | null
  selectedKey: string | null
  onSelect: (key: string) => void
}) {
  const [tier, setTier] = useState<Tier | 'all'>('all')
  const [category, setCategory] = useState('')
  const [subject, setSubject] = useState('')

  const subjects = useMemo(
    () => [...new Set((items ?? []).map((i) => i.subject).filter((s): s is string => !!s))].sort(),
    [items],
  )
  const filtered = useMemo(
    () =>
      (items ?? []).filter(
        (i) =>
          (tier === 'all' || i.tier === tier) &&
          (!category || i.categories.includes(category as never)) &&
          (!subject || i.subject === subject),
      ),
    [items, tier, category, subject],
  )

  if (error) return <p className="rounded-2xl bg-white p-4 text-sm text-[#C4655A]">{error}</p>
  if (!items) return <ListSkeleton />

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {(['all', 'critica', 'revisar', 'espera'] as const).map((t) => {
          const n = t === 'all' ? items.length : items.filter((i) => i.tier === t).length
          const active = tier === t
          const color = t === 'all' ? '#2C3E50' : TIER_META[t].color
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              className="rounded-full border px-3 py-1 text-xs font-bold transition"
              style={active ? { background: color, borderColor: color, color: '#fff' } : { borderColor: '#EAE4E2', color }}
            >
              {t === 'all' ? 'Todas' : TIER_META[t].label} · {n}
            </button>
          )
        })}
      </div>
      <div className="flex gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-[#EAE4E2] bg-white px-2 py-1.5 text-xs text-[#2C3E50]"
        >
          <option value="">Todos los tipos</option>
          {ALL_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-[#EAE4E2] bg-white px-2 py-1.5 text-xs text-[#2C3E50]"
        >
          <option value="">Todas las asignaturas</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Empty text={items.length ? 'Nada con estos filtros.' : 'No hay reportes abiertos. 🎉'} />
      ) : (
        filtered.map((item) => (
          <ListCard key={item.content_key} active={item.content_key === selectedKey} onClick={() => onSelect(item.content_key)}>
            <div className="flex items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ color: TIER_META[item.tier].color, background: TIER_META[item.tier].soft }}
              >
                {TIER_META[item.tier].label}
              </span>
              <span className="truncate text-sm font-black text-[#2C3E50]">{contentTitle(item)}</span>
              <span className="ml-auto shrink-0 text-xs font-bold tabular-nums text-[#7D8A96]">{item.score}</span>
            </div>
            {item.subject ? <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-[#E8A598]">{item.subject}</p> : null}
            {item.statement_preview ? (
              <p className="mt-1 line-clamp-2 text-xs text-[#4B5563]">{item.statement_preview}</p>
            ) : item.messages[0] ? (
              <p className="mt-1 line-clamp-2 text-xs italic text-[#4B5563]">«{item.messages[0]}»</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[#7D8A96]">
              <span>
                {item.n_users} usuario{item.n_users === 1 ? '' : 's'}
              </span>
              <span>·</span>
              <span className="truncate">{item.categories.map(categoryLabel).join(', ')}</span>
              {item.image_broken ? <Badge text="Imagen rota" color="#C4655A" /> : null}
              {item.data_supports ? <Badge text="Los datos apoyan" color="#A9821F" /> : null}
              {item.anulada ? <Badge text="Anulada" color="#2C3E50" /> : null}
              <span className="ml-auto">{timeAgo(item.last_at)}</span>
            </div>
          </ListCard>
        ))
      )}
    </div>
  )
}

function SuspiciousPanel({ selectedKey, onSelect }: { selectedKey: string | null; onSelect: (key: string) => void }) {
  const [min, setMin] = useState(10)
  const [maxPct, setMaxPct] = useState(0.25)
  const query = `${min}|${maxPct}`
  const [result, setResult] = useState<{ query: string; items?: SuspiciousItem[]; error?: string } | null>(null)
  const items = result?.query === query ? result.items ?? null : null
  const error = result?.query === query ? result.error ?? null : null

  useEffect(() => {
    let alive = true
    const q = `${min}|${maxPct}`
    adminApi
      .suspicious(min, maxPct)
      .then((r) => alive && setResult({ query: q, items: r }))
      .catch((e: Error) => alive && setResult({ query: q, error: e.message }))
    return () => {
      alive = false
    }
  }, [min, maxPct])

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-[#7D8A96]">
        Preguntas cuya opción más elegida (primer intento de cada usuario) no es la clave y se aciertan poco. Suele ser una clave errónea o una pregunta ambigua.
      </p>
      <div className="flex gap-2">
        <label className="flex flex-1 items-center gap-1.5 text-xs text-[#7D8A96]">
          Mín. usuarios
          <select value={min} onChange={(e) => setMin(Number(e.target.value))} className="flex-1 rounded-xl border border-[#EAE4E2] bg-white px-2 py-1.5 text-xs text-[#2C3E50]">
            {[5, 10, 20, 30, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 items-center gap-1.5 text-xs text-[#7D8A96]">
          Acierto ≤
          <select value={maxPct} onChange={(e) => setMaxPct(Number(e.target.value))} className="flex-1 rounded-xl border border-[#EAE4E2] bg-white px-2 py-1.5 text-xs text-[#2C3E50]">
            {[0.15, 0.25, 0.35, 0.5].map((n) => (
              <option key={n} value={n}>
                {Math.round(n * 100)} %
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="rounded-2xl bg-white p-4 text-sm text-[#C4655A]">{error}</p>
      ) : !items ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <Empty text="Ninguna con estos umbrales. Con pocos datos es normal: baja el mínimo de usuarios." />
      ) : (
        items.map((item) => {
          const key = `q:${item.question_id}`
          return (
            <ListCard key={key} active={key === selectedKey} onClick={() => onSelect(key)}>
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-black text-[#2C3E50]">
                  {contentTitle({ content_key: key, year: item.year, question_number: item.question_number })}
                </span>
                {item.open_reports ? <Badge text={`${item.open_reports} reporte${item.open_reports === 1 ? '' : 's'}`} color="#C4655A" /> : null}
                {item.anulada ? <Badge text="Anulada" color="#2C3E50" /> : null}
              </div>
              {item.subject ? <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-[#E8A598]">{item.subject}</p> : null}
              <p className="mt-1 line-clamp-2 text-xs text-[#4B5563]">{item.statement_preview}</p>
              <p className="mt-2 text-[11px] text-[#7D8A96]">
                Clave {letter(item.correct_answer)} · la mayoría elige <b className="text-[#C4655A]">{letter(item.top_option)}</b> (
                {Math.round(item.top_option_pct * 100)} %) · {Math.round(item.pct_correct * 100)} % de acierto · {item.n_answers} usuarios
              </p>
            </ListCard>
          )
        })
      )}
    </div>
  )
}

function HistoryPanel({ selectedKey, onSelect }: { selectedKey: string | null; onSelect: (key: string) => void }) {
  const [items, setItems] = useState<HistoryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminApi.history().then(setItems).catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <p className="rounded-2xl bg-white p-4 text-sm text-[#C4655A]">{error}</p>
  if (!items) return <ListSkeleton />
  if (items.length === 0) return <Empty text="Todavía no se ha resuelto ningún reporte." />

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => {
        const meta = STATUS_META[item.status]
        return (
          <ListCard key={item.id} active={item.content_key === selectedKey} onClick={() => onSelect(item.content_key)}>
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-black text-[#2C3E50]">{contentTitle(item)}</span>
              <span className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: meta.color, background: meta.soft }}>
                {meta.label}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[#7D8A96]">
              {categoryLabel(item.category)} · {timeAgo(item.resolved_at)}
            </p>
            {item.resolution_note ? <p className="mt-1 line-clamp-2 text-xs text-[#4B5563]">{item.resolution_note}</p> : null}
          </ListCard>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------

function ListCard({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border bg-white p-4 text-left transition ${
        active ? 'border-[#2C3E50] shadow-[4px_4px_0_0_#2c3e50]' : 'border-[#EAE4E2] hover:border-[#E8A598]/60'
      }`}
    >
      {children}
    </button>
  )
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: color }}>
      {text}
    </span>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-[#E3DCD9] bg-white/60 p-6 text-center text-sm text-[#7D8A96]">{text}</p>
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/70" />
      ))}
    </div>
  )
}

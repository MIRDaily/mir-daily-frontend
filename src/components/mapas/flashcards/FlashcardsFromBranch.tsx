'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, ExternalLink, Loader2, WalletCards, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseBrowser'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import { buildCards, MAX_CARD_CHARS, MAX_CARDS, type CardDraft } from '@/lib/mapas/flashcards'
import { plainText } from '@/lib/mapas/export/richtext'
import { createFlashcard, createFlashcardDeck, fetchFlashcardDecks, type FlashcardDeck } from '@/lib/studioFlashcards'
import { DEFAULT_COLOR_KEY, DEFAULT_ICON } from '@/lib/flashcardTheme'

// «Crear flashcards» desde una rama del mapa (informe 75): vista previa editable de las tarjetas
// (las hojas «Faceta: dato», las hojas sueltas de un mismo nodo y las filas de las tablas) y luego
// un grupo de flashcards nuevo o uno que ya exista, con los endpoints de /flashcards de siempre
// (un grupo es un mazo con kind='flashcards'; nada de esto cuenta para las estadísticas).

type Fase = { kind: 'preview' } | { kind: 'creating'; done: number; total: number } | { kind: 'done'; deckId: string; deckName: string; count: number }

const CONCURRENCIA = 3

/** Alto de un cuadro de texto según lo que lleva (2 a 6 líneas de unos 38 caracteres). */
const rowsFor = (s: string) =>
  Math.min(6, Math.max(2, s.split('\n').reduce((k, l) => k + Math.max(1, Math.ceil(l.length / 38)), 0)))

async function token(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Inicia sesión para crear flashcards.')
  return session.access_token
}

export function FlashcardsFromBranch({ mapTitle }: { mapTitle: string }) {
  const from = useUIStore((s) => s.flashcardsFrom)
  if (!from) return null
  return <Dialog key={from} nodeId={from} mapTitle={mapTitle} />
}

function Dialog({ nodeId, mapTitle }: { nodeId: string; mapTitle: string }) {
  const t = useTheme()
  const close = () => useUIStore.getState().setFlashcardsFrom(null)

  // Las tarjetas se calculan una vez al abrir (lo que se edite luego es de la vista previa).
  const [initial] = useState(() => {
    const { nodes } = useMindMapStore.getState()
    const node = nodes.find((n) => n.id === nodeId)
    const isRoot = !node?.data.parentId
    const branch = node ? (node.data.table ? node.data.table.title : plainText(node.data.label)) : ''
    const cards = buildCards(
      nodes.map((n) => ({ id: n.id, label: n.data.label, parentId: n.data.parentId, table: n.data.table, y: n.position.y })),
      nodeId,
    )
    return { branch, cards, groupName: (isRoot ? mapTitle : branch).trim().slice(0, 80) || mapTitle }
  })
  const [cards, setCards] = useState<CardDraft[]>(initial.cards)
  const [dest, setDest] = useState<'new' | 'existing'>('new')
  const [groupName, setGroupName] = useState(initial.groupName)
  const [decks, setDecks] = useState<FlashcardDeck[] | null>(null)
  const [deckId, setDeckId] = useState('')
  const [fase, setFase] = useState<Fase>({ kind: 'preview' })
  const [error, setError] = useState<string | null>(null)
  // Lo ya creado (si algo falla a medias, «Reintentar» sigue donde se quedó).
  const created = useRef<{ deckId: string; deckName: string; keys: Set<string> } | null>(null)

  useEffect(() => {
    let cancel = false
    token()
      .then((tk) => fetchFlashcardDecks(tk))
      .then((d) => !cancel && setDecks(d))
      .catch(() => !cancel && setDecks([]))
    return () => {
      cancel = true
    }
  }, [])

  // Esc cierra (salvo mientras se crean).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || fase.kind === 'creating') return
      e.stopPropagation()
      close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [fase.kind])

  const chosen = cards.filter((c) => c.include && c.front.trim() && c.back.trim())
  const target = decks?.find((d) => d.id === deckId)
  const overLimit = dest === 'existing' && target ? target.totalCards + chosen.length > MAX_CARDS : chosen.length > MAX_CARDS
  const nameOk = groupName.trim().length >= 3
  const canCreate = chosen.length > 0 && !overLimit && (dest === 'new' ? nameOk : !!target)
  const topics = useMemo(() => {
    const out: { topic: string; items: number[] }[] = []
    cards.forEach((c, i) => {
      const last = out[out.length - 1]
      if (last && last.topic === c.topic) last.items.push(i)
      else out.push({ topic: c.topic, items: [i] })
    })
    return out
  }, [cards])

  const patch = (i: number, p: Partial<CardDraft>) => setCards((cs) => cs.map((c, k) => (k === i ? { ...c, ...p } : c)))

  const create = async () => {
    if (!canCreate) return
    setError(null)
    try {
      const tk = await token()
      if (!created.current) {
        const deck =
          dest === 'new'
            ? await createFlashcardDeck(tk, { name: groupName.trim(), color: DEFAULT_COLOR_KEY, icon: DEFAULT_ICON })
            : target!
        created.current = { deckId: deck.id, deckName: deck.name, keys: new Set() }
      }
      const ctx = created.current
      const pending = chosen.filter((c) => !ctx.keys.has(c.key))
      let done = chosen.length - pending.length
      setFase({ kind: 'creating', done, total: chosen.length })
      let next = 0
      let fallo: Error | null = null
      const worker = async () => {
        while (!fallo && next < pending.length) {
          const c = pending[next++]
          try {
            await createFlashcard(tk, ctx.deckId, { front: c.front.trim(), back: c.back.trim(), topic: c.topic.slice(0, 120) })
            ctx.keys.add(c.key)
            done += 1
            setFase({ kind: 'creating', done, total: chosen.length })
          } catch (e) {
            fallo = e instanceof Error ? e : new Error('No se pudo crear una tarjeta')
          }
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCIA }, worker))
      if (fallo) throw fallo
      setFase({ kind: 'done', deckId: ctx.deckId, deckName: ctx.deckName, count: ctx.keys.size })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo crear el grupo'
      const parcial = created.current?.keys.size
      setError(parcial ? `${msg}. Se crearon ${parcial} de ${chosen.length}: «Reintentar» sigue con las que faltan.` : msg)
      setFase({ kind: 'preview' })
    }
  }

  const ink = t.isDark ? '#FAF7F4' : '#2C3E50'
  const stickerBorder = t.isDark ? t.border2 : '#2C3E50'
  const field: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    border: `1.5px solid ${t.border}`,
    borderRadius: 9,
    background: t.bgPanel,
    color: t.textPrimary,
    padding: '6px 9px',
    fontFamily: 'inherit',
    fontSize: '0.82rem',
    lineHeight: 1.4,
    resize: 'vertical',
    outline: 'none',
  }
  const locked = fase.kind === 'creating' || !!created.current

  return (
    <div
      onMouseDown={(e) => e.target === e.currentTarget && fase.kind !== 'creating' && close()}
      style={{ position: 'absolute', inset: 0, zIndex: 1400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(44,62,80,0.35)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fc-rama-titulo"
        style={{
          width: 'min(720px, 100%)',
          maxHeight: 'calc(100% - 32px)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 20,
          border: `2px solid ${stickerBorder}`,
          boxShadow: `6px 6px 0 0 ${t.isDark ? '#000' : '#2C3E50'}`,
          background: t.isDark ? t.bgPanel2 : '#FAF7F4',
          color: ink,
          overflow: 'hidden',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '16px 18px 10px' }}>
          <WalletCards size={22} color={t.accent} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="fc-rama-titulo" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>
              Crear flashcards
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: t.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              De la rama «{initial.branch}»
            </p>
          </div>
          <button type="button" onClick={close} disabled={fase.kind === 'creating'} aria-label="Cerrar" style={{ background: 'none', border: 0, cursor: 'pointer', color: t.textSecondary, padding: 4, display: 'flex' }}>
            <X size={18} />
          </button>
        </header>

        {fase.kind === 'done' ? (
          <div style={{ padding: '18px 18px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
            <span style={{ width: 44, height: 44, borderRadius: '50%', background: t.accentGreen, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${stickerBorder}` }}>
              <Check size={24} />
            </span>
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
              {fase.count} {fase.count === 1 ? 'flashcard creada' : 'flashcards creadas'} en «{fase.deckName}»
            </p>
            <p style={{ margin: 0, fontSize: '0.82rem', color: t.textSecondary }}>Ya puedes estudiarlas con repaso espaciado desde Flashcards.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button type="button" onClick={close} style={btnGhost(t)}>
                Seguir en el mapa
              </button>
              <Link href={`/flashcards/${fase.deckId}`} style={{ ...btnMain(t, stickerBorder), textDecoration: 'none' }}>
                <ExternalLink size={15} />
                Abrir el grupo
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div style={{ overflowY: 'auto', padding: '0 18px 12px' }}>
              {error && (
                <div role="alert" style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 12, background: t.isDark ? '#3A2522' : '#FAEAED', color: t.isDark ? '#F2B8AE' : '#B04A5E', fontSize: '0.82rem', fontWeight: 600 }}>
                  {error}
                </div>
              )}

              {/* Destino */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {(['new', 'existing'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={dest === d}
                    disabled={locked || (d === 'existing' && !decks?.length)}
                    onClick={() => setDest(d)}
                    style={{
                      ...btnGhost(t),
                      borderColor: dest === d ? t.accent : t.border,
                      background: dest === d ? `${t.accent}1F` : t.bgPanel,
                      color: dest === d ? t.accent : t.textSecondary,
                      opacity: locked || (d === 'existing' && !decks?.length) ? 0.5 : 1,
                    }}
                  >
                    {d === 'new' ? 'Grupo nuevo' : decks === null ? 'Grupo existente…' : 'Grupo existente'}
                  </button>
                ))}
              </div>
              {dest === 'new' ? (
                <label style={{ display: 'block', marginBottom: 12 }}>
                  <span style={labelStyle(t)}>Nombre del grupo</span>
                  <input value={groupName} disabled={locked} maxLength={80} onChange={(e) => setGroupName(e.target.value)} style={{ ...field, resize: undefined }} />
                  {!nameOk && <span style={{ fontSize: '0.75rem', color: t.danger }}>Al menos 3 caracteres.</span>}
                </label>
              ) : (
                <label style={{ display: 'block', marginBottom: 12 }}>
                  <span style={labelStyle(t)}>Añadir a</span>
                  <select value={deckId} disabled={locked} onChange={(e) => setDeckId(e.target.value)} style={{ ...field, resize: undefined }}>
                    <option value="">Elige un grupo…</option>
                    {(decks ?? []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.totalCards})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, margin: '4px 0 8px' }}>
                <span style={labelStyle(t)}>
                  Vista previa · {chosen.length} de {cards.length} {cards.length === 1 ? 'tarjeta' : 'tarjetas'}
                </span>
                {cards.length > 0 && (
                  <button type="button" disabled={locked} onClick={() => setCards((cs) => cs.map((c) => ({ ...c, include: chosen.length < cs.length })))} style={{ background: 'none', border: 0, color: t.accent, fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                    {chosen.length < cards.length ? 'Marcar todas' : 'Desmarcar todas'}
                  </button>
                )}
              </div>

              {cards.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: t.textSecondary, lineHeight: 1.5 }}>
                  Esta rama no tiene hojas «Faceta: dato», hojas sueltas ni tablas de las que sacar tarjetas. Elige un nodo con datos
                  debajo (una enfermedad o un bloque).
                </p>
              ) : (
                topics.map((g) => (
                  <section key={`${g.topic}-${g.items[0]}`} style={{ marginBottom: 10 }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: '0.78rem', fontWeight: 800, color: t.textSecondary }}>{g.topic}</h3>
                    {g.items.map((i) => {
                      const c = cards[i]
                      return (
                        <div
                          key={c.key}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'auto 1fr 1fr',
                            gap: 8,
                            alignItems: 'start',
                            padding: 8,
                            marginBottom: 6,
                            borderRadius: 12,
                            border: `1.5px solid ${c.include ? (t.isDark ? t.border2 : '#2C3E50') : t.border}`,
                            background: t.bgPanel,
                            opacity: c.include ? 1 : 0.55,
                          }}
                        >
                          <input type="checkbox" checked={c.include} disabled={locked} onChange={(e) => patch(i, { include: e.target.checked })} aria-label="Incluir esta tarjeta" style={{ accentColor: t.accent, width: 16, height: 16, marginTop: 6 }} />
                          <textarea value={c.front} disabled={locked} maxLength={MAX_CARD_CHARS} rows={rowsFor(c.front)} onChange={(e) => patch(i, { front: e.target.value })} aria-label="Anverso" style={{ ...field, fontWeight: 700 }} />
                          <textarea value={c.back} disabled={locked} maxLength={MAX_CARD_CHARS} rows={rowsFor(c.back)} onChange={(e) => patch(i, { back: e.target.value })} aria-label="Reverso" style={field} />
                        </div>
                      )
                    })}
                  </section>
                ))
              )}
            </div>

            <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '12px 18px', borderTop: `1px solid ${t.border}`, background: t.bgPanel, flexWrap: 'wrap' }}>
              {overLimit && <span style={{ fontSize: '0.78rem', color: t.danger, marginRight: 'auto' }}>Un grupo admite como mucho {MAX_CARDS} tarjetas.</span>}
              {fase.kind === 'creating' && (
                <span role="status" style={{ fontSize: '0.82rem', color: t.textSecondary, marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Loader2 size={15} className="animate-spin" /> Creando {fase.done} de {fase.total}…
                </span>
              )}
              <button type="button" onClick={close} disabled={fase.kind === 'creating'} style={btnGhost(t)}>
                Cancelar
              </button>
              <button type="button" onClick={() => void create()} disabled={!canCreate || fase.kind === 'creating'} style={{ ...btnMain(t, stickerBorder), opacity: !canCreate || fase.kind === 'creating' ? 0.5 : 1 }}>
                <WalletCards size={15} />
                {created.current ? 'Reintentar' : `Crear ${chosen.length} ${chosen.length === 1 ? 'flashcard' : 'flashcards'}`}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}

type Theme = ReturnType<typeof useTheme>

function labelStyle(t: Theme): React.CSSProperties {
  return { display: 'block', marginBottom: 4, fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: t.textSecondary }
}

function btnGhost(t: Theme): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 34,
    padding: '0 12px',
    borderRadius: 10,
    border: `1.5px solid ${t.border}`,
    background: t.bgPanel,
    color: t.textSecondary,
    fontFamily: 'inherit',
    fontSize: '0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
  }
}

function btnMain(t: Theme, border: string): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 34,
    padding: '0 14px',
    borderRadius: 10,
    border: `2px solid ${border}`,
    boxShadow: `3px 3px 0 0 ${t.isDark ? '#000' : '#2C3E50'}`,
    background: t.accent,
    color: '#FFFFFF',
    fontFamily: 'inherit',
    fontSize: '0.82rem',
    fontWeight: 800,
    cursor: 'pointer',
  }
}

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FileDown, FileJson, FileText, Image as ImageIcon, Loader2, X } from 'lucide-react'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { pageStats, DEFAULT_EXPORT, renderPreviews, runExport, selectionSize, type Background, type ExportOptions } from '@/lib/mapas/export'
import { PAPER_LABEL, type Distribution, type Orientation, type PaperId } from '@/lib/mapas/export/pages'
import type { Scope } from '@/lib/mapas/export/collect'
import { INK_LABEL, type InkMode } from '@/lib/mapas/export/print'

type Theme = ReturnType<typeof useTheme>
type Tab = 'pdf' | 'png' | 'json'

/**
 * Exportar: PDF vectorial para imprimir (todo, solo lo seleccionado o una hoja por rama), PNG de
 * alta resolución y copia en JSON. El PDF se dibuja desde los datos del mapa, no es una captura.
 */
export function ExportDialog({ mapTitle, onExportJson }: { mapTitle: string; onExportJson: () => void }) {
  const open = useUIStore((s) => s.exportOpen)
  const setOpen = useUIStore((s) => s.setExportOpen)
  return <AnimatePresence>{open && <ExportBody mapTitle={mapTitle} onExportJson={onExportJson} onClose={() => setOpen(false)} />}</AnimatePresence>
}

function ExportBody({ mapTitle, onExportJson, onClose }: { mapTitle: string; onExportJson: () => void; onClose: () => void }) {
  const t = useTheme()
  const [tab, setTab] = useState<Tab>('pdf')
  const [opts, setOpts] = useState<Omit<ExportOptions, 'mapTitle' | 'format'>>({ ...DEFAULT_EXPORT })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const selected = useMemo(() => selectionSize(), [])

  // Si no hay nada seleccionado, "selección" no es una opción válida.
  useEffect(() => {
    if (selected === 0 && opts.scope === 'selection') setOpts((o) => ({ ...o, scope: 'all' }))
  }, [selected, opts.scope])
  // El PNG es una sola imagen: no tiene sentido «una hoja por rama».
  useEffect(() => {
    if (tab === 'png' && opts.scope === 'branches') setOpts((o) => ({ ...o, scope: 'all' }))
  }, [tab, opts.scope])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const full: ExportOptions = { ...opts, format: tab === 'png' ? 'png' : 'pdf', mapTitle }
  const stats = useMemo(() => {
    if (tab === 'json') return { pages: 0, minFontPt: null as number | null }
    try {
      return pageStats(full)
    } catch {
      return { pages: 0, minFontPt: null as number | null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, opts])
  const pages = stats.pages

  const set = <K extends keyof typeof opts>(k: K, v: (typeof opts)[K]) => {
    setDone(null)
    setOpts((o) => ({ ...o, [k]: v }))
  }

  const go = async () => {
    if (tab === 'json') {
      onExportJson()
      onClose()
      return
    }
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const r = await runExport(full)
      setDone(`Descargado: ${r.filename}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo exportar.')
    } finally {
      setBusy(false)
    }
  }

  const scopes: { id: Scope; label: string; hint: string; disabled?: boolean }[] = [
    { id: 'all', label: 'Todo el mapa', hint: 'Lo que ves ahora, con las ramas plegadas cerradas' },
    {
      id: 'selection',
      label: selected > 0 ? `Lo seleccionado (${selected} nodos)` : 'Lo seleccionado',
      hint: selected > 0 ? 'Los nodos elegidos con todo lo que cuelga de ellos' : 'Selecciona nodos antes de exportar',
      disabled: selected === 0,
    },
    { id: 'branches', label: 'Una hoja por rama', hint: 'Portada con el mapa entero y cada rama principal en su hoja', disabled: tab === 'png' },
  ]

  return (
    <motion.div
      data-tuto="export-dialog"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 'var(--mapa-inset-left, 0px)',
        zIndex: 1500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(42,36,32,0.32)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Exportar mapa"
        initial={{ scale: 0.96, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.97, y: 6, transition: { duration: 0.12 } }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        style={{
          width: 880,
          maxWidth: '100%',
          maxHeight: '100%',
          overflowY: 'auto',
          background: t.bgPanel,
          border: `1px solid ${t.border}`,
          borderRadius: 18,
          padding: '16px 20px 18px',
          boxShadow: `0 16px 60px ${t.shadow}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: t.textPrimary, fontWeight: 700, fontSize: 15 }}>Exportar</div>
            <div style={{ color: t.textMuted, fontSize: 11.5, marginTop: 2 }}>
              El PDF es vectorial: se imprime nítido a cualquier tamaño.
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, display: 'flex', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Formato */}
        <div role="tablist" style={{ display: 'flex', gap: 6 }}>
          {([
            ['pdf', 'PDF para imprimir', FileText],
            ['png', 'Imagen PNG', ImageIcon],
            ['json', 'Copia JSON', FileJson],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              data-format={id}
              onClick={() => {
                setTab(id)
                setDone(null)
                setError(null)
              }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                padding: '8px 10px',
                borderRadius: 10,
                border: `1.5px solid ${tab === id ? t.accent : t.border}`,
                background: tab === id ? `${t.accent}1A` : 'transparent',
                color: tab === id ? t.textPrimary : t.textSecondary,
                cursor: 'pointer',
                fontSize: 12.5,
                fontWeight: 600,
                fontFamily: 'inherit',
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {tab === 'json' ? (
          <p style={{ color: t.textSecondary, fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>
            Descarga el mapa completo (con posiciones, colores y ramas plegadas) como copia de seguridad. Se puede volver a
            importar desde «Importar JSON» en la lista de mapas.
          </p>
        ) : (
          <>
            <Field label="Qué exportar" t={t}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {scopes.map((s) => (
                  <Choice key={s.id} active={opts.scope === s.id} disabled={s.disabled} onClick={() => set('scope', s.id)} t={t} title={s.label} hint={s.hint} />
                ))}
              </div>
            </Field>

            {tab === 'pdf' ? (
              <>
                {opts.scope !== 'branches' && (
                  <Field label="Distribución" t={t}>
                    <Segmented<Distribution>
                      value={opts.distribution}
                      onChange={(v) => set('distribution', v)}
                      t={t}
                      options={[
                        ['fit', 'Entero en una hoja'],
                        ['tiles', 'Tamaño real, en varias hojas'],
                      ]}
                    />
                  </Field>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label="Papel" t={t}>
                    <Segmented<PaperId>
                      value={opts.paper}
                      onChange={(v) => set('paper', v)}
                      t={t}
                      options={(Object.keys(PAPER_LABEL) as PaperId[]).map((p) => [p, PAPER_LABEL[p]] as [PaperId, string])}
                    />
                  </Field>
                  <Field label="Orientación" t={t}>
                    <Segmented<Orientation>
                      value={opts.orientation}
                      onChange={(v) => set('orientation', v)}
                      t={t}
                      options={[
                        ['auto', 'Auto'],
                        ['landscape', 'Apaisada'],
                        ['portrait', 'Vertical'],
                      ]}
                    />
                  </Field>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: t.textSecondary, fontSize: 12.5, cursor: 'pointer' }}>
                  <input type="checkbox" checked={opts.withTitle} onChange={(e) => set('withTitle', e.target.checked)} style={{ accentColor: t.accent }} />
                  Título del mapa arriba y fecha abajo
                </label>
              </>
            ) : (
              <Field label="Detalle" t={t}>
                <Segmented<2 | 3 | 4>
                  value={opts.quality}
                  onChange={(v) => set('quality', v)}
                  t={t}
                  options={[
                    [2, 'Normal'],
                    [3, 'Alta'],
                    [4, 'Máxima'],
                  ]}
                />
              </Field>
            )}

            <Field label="Fondo" t={t}>
              <Segmented<Background>
                value={opts.background}
                onChange={(v) => set('background', v)}
                t={t}
                options={
                  tab === 'png'
                    ? [['white', 'Blanco'], ['cream', 'Crema'], ['transparent', 'Transparente']]
                    : [['white', 'Blanco'], ['cream', 'Crema']]
                }
              />
            </Field>

            <Field label="Impresión" t={t}>
              <Segmented<InkMode>
                value={opts.ink}
                onChange={(v) => set('ink', v)}
                t={t}
                options={(Object.keys(INK_LABEL) as InkMode[]).map((k) => [k, INK_LABEL[k]] as [InkMode, string])}
              />
              <div style={{ color: t.textMuted, fontSize: 11.5, marginTop: 6, lineHeight: 1.45 }}>
                {opts.ink === 'color'
                  ? 'Tal como se ve en pantalla.'
                  : opts.ink === 'save'
                    ? 'Sin rellenos: cada nodo queda en un contorno del color de su categoría y la letra en oscuro. Casi no gasta tinta.'
                    : 'Lo mismo, en escala de grises, para impresoras en blanco y negro.'}
              </div>
            </Field>
          </>
        )}

        </div>
        {tab === 'pdf' && <PreviewPane opts={full} t={t} />}
        </div>

        {tab !== 'json' && (
          <div style={{ color: t.textMuted, fontSize: 12, lineHeight: 1.5 }}>
            {tab === 'pdf'
              ? pages > 0
                ? `Saldrá${pages === 1 ? '' : 'n'} ${pages} hoja${pages === 1 ? '' : 's'} ${PAPER_LABEL[opts.paper]}${stats.minFontPt ? ` · letra de unos ${stats.minFontPt.toFixed(1).replace('.', ',')} pt` : ''}.`
                : 'No hay nada que exportar.'
              : 'Una imagen del tamaño del mapa, sin recortes.'}
            {tab === 'pdf' && stats.minFontPt !== null && stats.minFontPt < 6.5 && (
              <div style={{ color: t.warning, fontWeight: 600 }}>
                La letra queda muy pequeña para leerla impresa: prueba «Una hoja por rama» o «Tamaño real, en varias hojas».
              </div>
            )}
          </div>
        )}
        {error && <div style={{ color: t.danger, fontSize: 12.5, fontWeight: 600 }}>{error}</div>}
        {done && <div style={{ color: t.accentGreen, fontSize: 12.5, fontWeight: 600 }}>{done}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ border: `1px solid ${t.border}`, background: 'transparent', color: t.textSecondary, borderRadius: 10, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
          >
            {done ? 'Cerrar' : 'Cancelar'}
          </button>
          <button
            data-tuto="export-go"
            onClick={() => void go()}
            disabled={busy || (tab !== 'json' && pages === 0)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              border: 'none',
              background: t.accent,
              color: '#fff',
              borderRadius: 10,
              padding: '8px 16px',
              fontSize: 12.5,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: busy ? 'default' : 'pointer',
              opacity: busy || (tab !== 'json' && pages === 0) ? 0.6 : 1,
            }}
          >
            {busy ? <Loader2 size={14} style={{ animation: 'mapa-spin 1s linear infinite' }} /> : <FileDown size={14} />}
            {busy ? 'Preparando…' : tab === 'json' ? 'Descargar JSON' : tab === 'png' ? 'Descargar PNG' : 'Descargar PDF'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Field({ label, children, t }: { label: string; children: React.ReactNode; t: Theme }) {
  return (
    <div>
      <div style={{ color: t.textMuted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>{label}</div>
      {children}
    </div>
  )
}

function Choice({ active, disabled, onClick, title, hint, t }: { active: boolean; disabled?: boolean; onClick: () => void; title: string; hint: string; t: Theme }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      style={{
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        padding: '8px 12px',
        borderRadius: 10,
        border: `1.5px solid ${active ? t.accent : t.border}`,
        background: active ? `${t.accent}14` : 'transparent',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ color: t.textPrimary, fontSize: 12.5, fontWeight: 600 }}>{title}</span>
      <span style={{ color: t.textMuted, fontSize: 11 }}>{hint}</span>
    </button>
  )
}

function Segmented<V extends string | number>({ value, onChange, options, t }: { value: V; onChange: (v: V) => void; options: [V, string][]; t: Theme }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(([v, label]) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          style={{
            flex: 1,
            padding: '6px 8px',
            borderRadius: 8,
            border: `1.5px solid ${value === v ? t.accent : t.border}`,
            background: value === v ? `${t.accent}1A` : 'transparent',
            color: value === v ? t.textPrimary : t.textSecondary,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'inherit',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** Vista previa de las primeras hojas del PDF, con el papel, la tinta y el reparto elegidos. */
function PreviewPane({ opts, t }: { opts: ExportOptions; t: Theme }) {
  const [state, setState] = useState<{ urls: string[]; total: number; busy: boolean }>({ urls: [], total: 0, busy: true })
  const key = JSON.stringify([opts.scope, opts.paper, opts.orientation, opts.distribution, opts.background, opts.withTitle, opts.ink, opts.mapTitle])
  useEffect(() => {
    let cancelled = false
    const id = setTimeout(() => {
      renderPreviews(opts, 4)
        .then((r) => {
          if (!cancelled) setState({ urls: r.urls, total: r.total, busy: false })
        })
        .catch(() => {
          if (!cancelled) setState({ urls: [], total: 0, busy: false })
        })
    }, 160)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return (
    <div data-tuto="export-preview" style={{ flex: '0 1 300px', minWidth: 240 }}>
      <div style={{ color: t.textMuted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>
        Vista previa{state.total > 0 ? ` · ${state.total} hoja${state.total === 1 ? '' : 's'}` : ''}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: state.urls.length > 1 ? '1fr 1fr' : '1fr',
          gap: 8,
          padding: 10,
          borderRadius: 12,
          background: t.bgPanel2,
          opacity: state.busy ? 0.55 : 1,
          transition: 'opacity 150ms',
        }}
      >
        {state.urls.length === 0 && (
          <div style={{ color: t.textMuted, fontSize: 12, padding: '30px 0', textAlign: 'center', gridColumn: '1 / -1' }}>
            {state.busy ? 'Preparando…' : 'Sin vista previa'}
          </div>
        )}
        {state.urls.map((u, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={u} alt={`Hoja ${i + 1}`} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 3, border: `1px solid ${t.border}`, background: '#fff' }} />
        ))}
      </div>
      {state.total > state.urls.length && (
        <div style={{ color: t.textMuted, fontSize: 11.5, marginTop: 6 }}>y {state.total - state.urls.length} hoja{state.total - state.urls.length === 1 ? '' : 's'} más</div>
      )}
    </div>
  )
}

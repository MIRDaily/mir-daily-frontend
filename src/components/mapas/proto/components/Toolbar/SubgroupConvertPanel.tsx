import { useEffect, useState } from 'react'
import { Check, Tags, X } from 'lucide-react'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import { convertToLabels, subgroupCandidates, type SubgroupCandidate } from '@/components/mapas/proto/utils/subgroups'
import { goToNode } from '@/components/mapas/proto/utils/reveal'

/**
 * «Convertir subgrupos en rótulos» (menú Vista): lista de los nodos que parecen subgrupos
 * («Concepto y epidemiología»), todos marcados; el usuario quita los que no y confirma. Pulsar un
 * nombre lleva hasta él. Un solo paso de deshacer (Ctrl+Z).
 */
export function SubgroupConvertPanel() {
  const open = useUIStore((s) => s.subgroupConvertOpen)
  if (!open) return null
  return <Panel />
}

function Panel() {
  const t = useTheme()
  const close = () => useUIStore.getState().setSubgroupConvertOpen(false)
  // Los candidatos se calculan al abrir (lo que cambie después se ve al volver a abrir).
  const [candidates] = useState<SubgroupCandidate[]>(() => subgroupCandidates())
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(candidates.map((c) => c.id)))
  const [done, setDone] = useState<number | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      close()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const ink = t.isDark ? '#FAF7F4' : '#2C3E50'
  const border = t.isDark ? t.border2 : '#2C3E50'
  const btn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 32,
    padding: '0 12px',
    borderRadius: 10,
    border: `1.5px solid ${t.border}`,
    background: t.bgPanel,
    color: t.textSecondary,
    fontFamily: 'inherit',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
  }

  return (
    <div
      role="dialog"
      aria-label="Convertir subgrupos en rótulos"
      style={{
        position: 'absolute',
        top: 14,
        right: 16,
        zIndex: 1100,
        width: 'min(360px, calc(100% - 32px))',
        maxHeight: 'calc(100% - 40px)',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 16,
        border: `2px solid ${border}`,
        boxShadow: `4px 4px 0 0 ${t.isDark ? '#000' : '#2C3E50'}`,
        background: t.bgPanel,
        color: ink,
        overflow: 'hidden',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 12px 8px 14px' }}>
        <Tags size={18} color={t.accent} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 900 }}>Subgrupos como rótulo</div>
          <div style={{ fontSize: '0.75rem', color: t.textSecondary, lineHeight: 1.4, marginTop: 2 }}>
            Los nodos que reparten una enfermedad por aspectos pasan a ser un rótulo sobre la rama, sin caja. Quita
            los que no lo sean.
          </div>
        </div>
        <button type="button" onClick={close} aria-label="Cerrar" style={{ background: 'none', border: 0, cursor: 'pointer', color: t.textSecondary, padding: 2, display: 'flex' }}>
          <X size={16} />
        </button>
      </header>

      <div style={{ overflowY: 'auto', padding: '0 10px 8px' }}>
        {done !== null ? (
          <p style={{ margin: '6px 4px 10px', fontSize: '0.82rem', lineHeight: 1.45 }}>
            <Check size={14} color={t.accentGreen} style={{ verticalAlign: '-2px' }} /> {done}{' '}
            {done === 1 ? 'nodo convertido' : 'nodos convertidos'}. Ctrl+Z lo deshace; también puedes cambiar la forma de uno en
            su panel de estilo.
          </p>
        ) : candidates.length === 0 ? (
          <p style={{ margin: '6px 4px 10px', fontSize: '0.82rem', color: t.textSecondary, lineHeight: 1.45 }}>
            No hay subgrupos que convertir en este mapa. Puedes poner cualquier nodo como rótulo desde su panel de estilo
            (Forma → Rótulo).
          </p>
        ) : (
          candidates.map((c) => {
            const on = chosen.has(c.id)
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', borderRadius: 8 }}>
                <input
                  type="checkbox"
                  checked={on}
                  aria-label={`Convertir «${c.label}»`}
                  onChange={() =>
                    setChosen((s) => {
                      const n = new Set(s)
                      if (on) n.delete(c.id)
                      else n.add(c.id)
                      return n
                    })
                  }
                  style={{ accentColor: t.accent, width: 15, height: 15, flexShrink: 0 }}
                />
                <button
                  type="button"
                  onClick={() => goToNode(c.id)}
                  title="Ir al nodo"
                  style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: 'inherit', color: ink }}
                >
                  <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.label}
                  </span>
                  <span style={{ display: 'block', fontSize: '0.72rem', color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    en {c.parent}
                  </span>
                </button>
              </div>
            )
          })
        )}
      </div>

      <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 12px', borderTop: `1px solid ${t.border}` }}>
        <button type="button" onClick={close} style={btn}>
          {done !== null || candidates.length === 0 ? 'Cerrar' : 'Cancelar'}
        </button>
        {done === null && candidates.length > 0 && (
          <button
            type="button"
            disabled={chosen.size === 0}
            onClick={() => setDone(convertToLabels([...chosen]))}
            style={{ ...btn, border: `2px solid ${border}`, background: t.accent, color: '#FFFFFF', opacity: chosen.size ? 1 : 0.5, boxShadow: `2px 2px 0 0 ${t.isDark ? '#000' : '#2C3E50'}` }}
          >
            Convertir {chosen.size}
          </button>
        )}
      </footer>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FilePlus2, FileUp, Loader2, X } from 'lucide-react'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import { nanoid } from '@/components/mapas/proto/utils/nanoid'
import { syncCollapse } from '@/components/mapas/proto/utils/tree'
import { ProgresoIA } from '@/components/mapas/ia/ProgresoIA'
import { SelectorParte } from '@/components/mapas/ia/SelectorParte'
import { iaEstado, iaGenerar } from '@/lib/mapas/ia/api'
import { extraerDocumento, FORMATOS_ACEPTADOS } from '@/lib/mapas/ia/extract'
import { construirIndice, resumenSeleccion } from '@/lib/mapas/ia/indice'
import { aplicarAnadido, planAnadir, type PlanAnadir } from '@/lib/mapas/ia/anadir'
import { plainText } from '@/lib/mapas/export/richtext'
import { aplicarEvento, type FaseIA, type LineaProvisional } from '@/lib/mapas/ia/stream'
import { ExtractError, type EstadoIA, type Extraido, type ModoIA } from '@/lib/mapas/ia/types'
import type { MapDoc } from '@/lib/mapas/types'
import type { MindMapNode } from '@/components/mapas/proto/types/node.types'
import type { MindMapEdge } from '@/components/mapas/proto/types/edge.types'

// «Añadir un documento al mapa» (informe 76): p. ej., el mapa de los apuntes más el PowerPoint de
// clase. El servidor genera el mapa del documento nuevo con los bloques y enfermedades de este como
// guía; el navegador decide dónde va cada cosa y quita lo repetido (lib/mapas/ia/anadir.ts). Antes
// de tocar el mapa se enseña la vista previa; al aplicar, una sola acción (Ctrl+Z) y lo nuevo queda
// marcado para la revisión guiada. El archivo no se sube: solo su texto (lo marcado).

type Paso = 'elegir' | 'leyendo' | 'ajustes' | 'generando' | 'vista'

const fmt = (n: number) => n.toLocaleString('es-ES')

export function AnadirDocumentoIA({ mapTitle }: { mapTitle: string }) {
  const abierto = useUIStore((s) => s.anadirDoc)
  const [aviso, setAviso] = useState<string | null>(null)
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(t)
  }, [aviso])
  return (
    <>
      {abierto && <Dialogo mapTitle={mapTitle} onHecho={setAviso} />}
      {aviso && (
        <div
          role="status"
          style={{
            position: 'absolute', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 1450,
            padding: '8px 14px', borderRadius: 12, border: '2px solid #2C3E50', boxShadow: '3px 3px 0 0 #2C3E50',
            background: '#FFFFFF', color: '#2C3E50', fontSize: '0.82rem', fontWeight: 700,
          }}
        >
          {aviso}
        </div>
      )}
    </>
  )
}

/** Bloques (hijos de la raíz) y enfermedades o apartados (nodos con hijos más abajo) del mapa. */
function guiaDelMapa() {
  const { nodes } = useMindMapStore.getState()
  const texto = (n: MindMapNode) => plainText(n.data.label).replace(/\s+/g, ' ').trim()
  const conHijos = new Set(nodes.map((n) => n.data.parentId).filter(Boolean) as string[])
  const raiz = nodes.find((n) => !n.data.parentId)
  const bloques = nodes.filter((n) => n.data.parentId === raiz?.id && !n.data.table).map(texto)
  const entidades = nodes.filter((n) => n.data.parentId && n.data.parentId !== raiz?.id && conHijos.has(n.id) && !n.data.table).map(texto)
  return { bloques: bloques.slice(0, 40), entidades: entidades.slice(0, 200) }
}

function Dialogo({ mapTitle, onHecho }: { mapTitle: string; onHecho: (m: string) => void }) {
  const t = useTheme()
  const fuente = useUIStore((s) => s.fuente)
  const [paso, setPaso] = useState<Paso>('elegir')
  const [estado, setEstado] = useState<EstadoIA | null>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [ext, setExt] = useState<Extraido | null>(null)
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [modo, setModo] = useState<ModoIA>(fuente?.modo ?? 'esquema')
  const [error, setError] = useState<string | null>(null)
  const [fase, setFase] = useState<FaseIA>('leyendo')
  const [lineas, setLineas] = useState<LineaProvisional[]>([])
  const [segundos, setSegundos] = useState(0)
  const [plan, setPlan] = useState<PlanAnadir | null>(null)
  const ctl = useRef<AbortController | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const cerrar = () => {
    ctl.current?.abort()
    useUIStore.getState().setAnadirDoc(false)
  }

  useEffect(() => {
    let vivo = true
    void iaEstado().then((e) => vivo && setEstado(e))
    return () => {
      vivo = false
      ctl.current?.abort()
    }
  }, [])
  useEffect(() => {
    if (paso !== 'generando') return
    const i = setInterval(() => setSegundos((s) => s + 1), 1000)
    return () => clearInterval(i)
  }, [paso])

  const maxChars = estado?.limites.maxChars ?? 150000
  const indice = useMemo(() => (ext ? construirIndice(ext.secciones, ext.marcadores) : []), [ext])
  const eleccion = useMemo(() => (ext ? resumenSeleccion(ext.secciones, sel) : null), [ext, sel])
  const caracteres = eleccion?.caracteres ?? 0
  const restantes = estado ? Math.max(0, estado.cupo.maxGeneracionesDia - estado.cupo.generacionesHoy) : 0
  const puede = !!ext && caracteres >= 200 && caracteres <= maxChars && restantes > 0

  const leer = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setArchivo(file)
    setPaso('leyendo')
    try {
      const r = await extraerDocumento(file, { maxChars: maxChars * 4 })
      setExt(r)
      const cabe = r.caracteres <= maxChars
      setSel(cabe ? new Set(r.secciones.map((_, i) => i)) : new Set())
      setSelectorAbierto(!cabe)
      setPaso('ajustes')
    } catch (e) {
      setError(e instanceof ExtractError ? e.message : 'No se pudo leer el archivo.')
      setPaso('elegir')
    }
  }

  const generar = async () => {
    if (!ext || !eleccion || !puede) return
    setError(null)
    setSegundos(0)
    setLineas([])
    setFase('leyendo')
    setPaso('generando')
    const c = new AbortController()
    ctl.current = c
    try {
      const r = await iaGenerar(
        {
          titulo: mapTitle,
          modo,
          secciones: eleccion.elegidas,
          paginas: Math.max(1, eleccion.paginas),
          guia: guiaDelMapa(),
          ...(ext.unidad === 'diapositiva' ? { unidad: 'diapositiva' as const } : {}),
        },
        c.signal,
        (e) => {
          if (c.signal.aborted) return
          if (e.tipo === 'fase') setFase(e.fase)
          else if (e.tipo === 'rama' || e.tipo === 'reinicio') setLineas((ls) => aplicarEvento(ls, e))
        },
      )
      if (c.signal.aborted) return
      const p = planAnadir(useMindMapStore.getState().nodes, r.doc as MapDoc)
      setPlan(p)
      setPaso('vista')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'No se pudo generar')
      setPaso('ajustes')
    }
  }

  const aplicar = () => {
    if (!plan || !archivo) return
    const store = useMindMapStore.getState()
    const ui = useUIStore.getState()
    const hecho = aplicarAnadido<MindMapNode, MindMapEdge>(store.nodes, store.edges, plan, {
      nuevoId: nanoid,
      categoryStyles: ui.categoryStyles,
      labelFont: ui.labelStyle.fontSize,
      origen: archivo.name.slice(0, 50),
    })
    if (!hecho) {
      setError('No había nada nuevo que añadir.')
      return
    }
    // Una sola acción: foto para Ctrl+Z y todo lo nuevo en su sitio. Copias propias (los nodos de
    // la store están congelados y syncCollapse les escribe).
    useHistoryStore.getState().pushSnapshot(store.nodes, store.edges)
    const nodes = hecho.nodes.map((n) => ({ ...n, data: { ...n.data } }))
    const edges = hecho.edges.map((e) => ({ ...e, ...(e.data ? { data: { ...e.data } } : {}) }))
    syncCollapse(nodes, edges)
    useMindMapStore.setState({ nodes, edges })
    onHecho(`Añadidos ${fmt(hecho.nuevos.length)} nodos de «${archivo.name}» (en ámbar para revisar). Ctrl+Z lo deshace.`)
    useUIStore.getState().setAnadirDoc(false)
  }

  const ink = t.isDark ? '#FAF7F4' : '#2C3E50'
  const borde = t.isDark ? t.border2 : '#2C3E50'
  const boton = (principal: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 10,
    border: `2px solid ${principal ? borde : t.border}`, boxShadow: principal ? `3px 3px 0 0 ${t.isDark ? '#000' : '#2C3E50'}` : 'none',
    background: principal ? t.accent : t.bgPanel, color: principal ? '#FFFFFF' : t.textSecondary,
    fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer',
  })

  return (
    <div
      onMouseDown={(e) => e.target === e.currentTarget && paso !== 'generando' && cerrar()}
      style={{ position: 'absolute', inset: 0, zIndex: 1400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(44,62,80,0.35)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="anadir-doc-titulo"
        style={{
          width: 'min(620px, 100%)', maxHeight: 'calc(100% - 32px)', overflowY: 'auto', borderRadius: 20,
          border: `2px solid ${borde}`, boxShadow: `6px 6px 0 0 ${t.isDark ? '#000' : '#2C3E50'}`,
          background: t.isDark ? t.bgPanel2 : '#FAF7F4', color: ink, padding: '16px 18px',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <FilePlus2 size={22} color={t.accent} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="anadir-doc-titulo" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>Añadir un documento al mapa</h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: t.textSecondary }}>
              Lo nuevo va a su bloque; lo que ya está en el mapa no se repite.
            </p>
          </div>
          <button type="button" onClick={cerrar} aria-label="Cerrar" style={{ background: 'none', border: 0, cursor: 'pointer', color: t.textSecondary, padding: 4, display: 'flex' }}>
            <X size={18} />
          </button>
        </header>

        {error && (
          <p role="alert" style={{ margin: '12px 0 0', padding: '8px 12px', borderRadius: 12, background: t.isDark ? '#3A2522' : '#FAEAED', color: t.isDark ? '#F2B8AE' : '#B04A5E', fontSize: '0.82rem', fontWeight: 600 }}>
            {error}
          </p>
        )}

        {(paso === 'elegir' || paso === 'leyendo') && (
          <div style={{ marginTop: 14 }}>
            <input ref={input} type="file" accept={FORMATOS_ACEPTADOS} style={{ display: 'none' }} onChange={(e) => { void leer(e.target.files?.[0]); e.target.value = '' }} />
            <button
              type="button"
              disabled={paso === 'leyendo'}
              onClick={() => input.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); void leer(e.dataTransfer.files?.[0]) }}
              style={{ width: '100%', padding: '28px 16px', borderRadius: 16, border: `2px dashed ${t.border2}`, background: t.bgPanel, color: ink, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
            >
              {paso === 'leyendo' ? <Loader2 size={26} className="animate-spin" color={t.accent} /> : <FileUp size={26} color={t.accent} />}
              <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{paso === 'leyendo' ? `Leyendo ${archivo?.name}…` : 'Elige el documento o suéltalo aquí'}</span>
              <span style={{ fontSize: '0.75rem', color: t.textSecondary }}>PDF con texto, Word (.docx) o PowerPoint (.pptx) del mismo tema</span>
            </button>
          </div>
        )}

        {paso === 'ajustes' && ext && (
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: 0, fontSize: '0.82rem' }}>
              <b>{archivo?.name}</b> · {fmt(ext.paginas)} {ext.unidad ?? 'página'}{ext.paginas === 1 ? '' : 's'} · {fmt(ext.caracteres)} caracteres
            </p>
            <SelectorParte
              secciones={ext.secciones}
              indice={indice}
              sel={sel}
              onChange={setSel}
              unidad={ext.unidad ?? 'página'}
              abierto={selectorAbierto}
              onAbrir={setSelectorAbierto}
              resumen={sel.size === ext.secciones.length ? `Todo el documento · ${fmt(caracteres)} caracteres` : `${fmt(sel.size)} de ${fmt(ext.secciones.length)} secciones · ${fmt(caracteres)} caracteres`}
            />
            <div role="radiogroup" aria-label="Estilo" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {(['esquema', 'detalle'] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={modo === m} onClick={() => setModo(m)} style={{ ...boton(false), border: `2px solid ${modo === m ? t.accent : t.border}`, color: modo === m ? ink : t.textSecondary }}>
                  {m === 'esquema' ? 'Esquemático' : 'Con más contenido'}
                </button>
              ))}
            </div>
            <p style={{ margin: '10px 0 0', fontSize: '0.75rem', color: caracteres > maxChars || caracteres < 200 ? (t.isDark ? '#F2B8AE' : '#B04A5E') : t.textSecondary }}>
              {caracteres < 200
                ? 'Marca al menos una parte del documento.'
                : caracteres > maxChars
                  ? `Lo marcado tiene ${fmt(caracteres)} caracteres; el máximo es ${fmt(maxChars)}. Desmarca alguna parte.`
                  : `Cuenta como un mapa con IA (te quedan ${restantes}). Antes de cambiar nada verás qué se añade y dónde.`}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button type="button" onClick={cerrar} style={boton(false)}>Cancelar</button>
              <button type="button" onClick={() => void generar()} disabled={!puede} style={{ ...boton(true), opacity: puede ? 1 : 0.5 }}>
                <FilePlus2 size={15} /> Ver qué se añade
              </button>
            </div>
          </div>
        )}

        {paso === 'generando' && (
          <div>
            <ProgresoIA fases={['leyendo', 'estructura', 'ordenando']} fase={fase} lineas={lineas} segundos={segundos} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" onClick={() => { ctl.current?.abort(); setPaso('ajustes') }} style={boton(false)}>Cancelar</button>
            </div>
          </div>
        )}

        {paso === 'vista' && plan && (
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800 }}>
              {plan.total
                ? `Se añadirán ${fmt(plan.total)} nodos en ${fmt(plan.anadidos.length)} ${plan.anadidos.length === 1 ? 'sitio' : 'sitios'}`
                : 'Nada nuevo: todo lo del documento ya está en el mapa'}
              {plan.repetidas.length ? <span style={{ fontWeight: 600, color: t.textSecondary }}> · {fmt(plan.repetidas.length)} ya estaban y no se repiten</span> : null}
            </p>
            <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, maxHeight: '18rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {plan.anadidos.map((a) => (
                <li key={a.destinoId} style={{ padding: '8px 10px', borderRadius: 12, background: t.bgPanel, border: `1.5px solid ${t.border}` }}>
                  <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 800 }}>
                    {a.ruta.slice(1).join(' › ') || 'Raíz del mapa'} <span style={{ color: t.accent }}>+{fmt(a.nodos)}</span>
                  </p>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: '0.75rem', color: t.textSecondary }}>
                    {a.muestra.map((m) => <li key={m}>{m}</li>)}
                    {a.nodos > a.muestra.length && <li>…</li>}
                  </ul>
                </li>
              ))}
            </ul>
            {plan.repetidas.length > 0 && (
              <details style={{ marginTop: 8, fontSize: '0.75rem', color: t.textSecondary }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Ver lo que ya estaba</summary>
                <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>{plan.repetidas.map((r) => <li key={r}>{r}</li>)}</ul>
              </details>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button type="button" onClick={cerrar} style={boton(false)}>Descartar</button>
              <button type="button" onClick={aplicar} disabled={!plan.total} style={{ ...boton(true), opacity: plan.total ? 1 : 0.5 }}>
                <FilePlus2 size={15} /> Añadir al mapa
              </button>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '0.7rem', color: t.textSecondary }}>Se añade en una sola acción (Ctrl+Z la deshace) y lo nuevo queda en ámbar para revisarlo.</p>
          </div>
        )}
      </div>
    </div>
  )
}

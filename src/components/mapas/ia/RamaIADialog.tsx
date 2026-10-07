'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FileUp, Loader2, Sparkles, X } from 'lucide-react'
import { useMindMapStore } from '@/components/mapas/proto/store/mindmap.store'
import { useHistoryStore } from '@/components/mapas/proto/store/history.store'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'
import { useTheme } from '@/components/mapas/proto/hooks/useTheme'
import { nanoid } from '@/components/mapas/proto/utils/nanoid'
import { syncCollapse } from '@/components/mapas/proto/utils/tree'
import { ProgresoIA } from '@/components/mapas/ia/ProgresoIA'
import { iaRama } from '@/lib/mapas/ia/api'
import { borrarDocumento, guardarDocumento, hashArchivo, leerDocumento, type DocumentoGuardado } from '@/lib/mapas/ia/docs'
import { extraerDocumento, FORMATOS_ACEPTADOS } from '@/lib/mapas/ia/extract'
import { ACCIONES_RAMA, aplicarRama, fragmentoParaRama, ramaDeNodo } from '@/lib/mapas/ia/rama'
import { aplicarEvento, type FaseIA, type LineaProvisional } from '@/lib/mapas/ia/stream'
import { ExtractError, IAError, type ModoIA } from '@/lib/mapas/ia/types'
import type { MapDoc } from '@/lib/mapas/types'
import type { MindMapNode } from '@/components/mapas/proto/types/node.types'
import type { MindMapEdge } from '@/components/mapas/proto/types/edge.types'

// Rehacer, ampliar o resumir UNA rama con la IA (informe 76). Hace falta el documento del que salió
// el mapa: se guarda SOLO en este navegador (IndexedDB, 30 días). Si no está, se pide volver a
// elegir el archivo y se comprueba con el hash del mapa que es el mismo. Al servidor viaja la rama
// y el fragmento del documento de donde sale. La rama nueva sustituye a la vieja en UNA acción que
// se deshace con Ctrl+Z.

type Paso = 'buscando' | 'sinDocumento' | 'leyendo' | 'listo' | 'generando'

const fmt = (n: number) => n.toLocaleString('es-ES')

export function RamaIADialog({ mapTitle }: { mapTitle: string }) {
  const abierto = useUIStore((s) => s.ramaIA)
  const [aviso, setAviso] = useState<string | null>(null)
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(t)
  }, [aviso])
  return (
    <>
      {abierto && <Dialogo key={`${abierto.id}-${abierto.accion}`} nodeId={abierto.id} accion={abierto.accion} mapTitle={mapTitle} onHecho={setAviso} />}
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

function Dialogo({
  nodeId,
  accion,
  mapTitle,
  onHecho,
}: {
  nodeId: string
  accion: 'detalle' | 'resumir' | 'rehacer'
  mapTitle: string
  onHecho: (msg: string) => void
}) {
  const t = useTheme()
  const mapaId = useUIStore((s) => s.mapaId)
  const fuente = useUIStore((s) => s.fuente)
  const [paso, setPaso] = useState<Paso>('buscando')
  const [doc, setDoc] = useState<DocumentoGuardado | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modo, setModo] = useState<ModoIA>(fuente?.modo ?? 'esquema')
  const [fase, setFase] = useState<FaseIA>('leyendo')
  const [lineas, setLineas] = useState<LineaProvisional[]>([])
  const [segundos, setSegundos] = useState(0)
  const ctl = useRef<AbortController | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const cerrar = () => {
    ctl.current?.abort()
    useUIStore.getState().setRamaIA(null)
  }
  const info = ACCIONES_RAMA.find((a) => a.id === accion)!

  // La rama tal como está ahora (se calcula al abrir).
  const [rama] = useState(() => ramaDeNodo(useMindMapStore.getState().nodes, nodeId))
  const fragmento = useMemo(
    () => (doc && rama ? fragmentoParaRama(doc.secciones, rama.paginas, rama.rama.map((x) => x.t).join(' ')) : []),
    [doc, rama],
  )
  const charsFragmento = fragmento.reduce((n, s) => n + s.texto.length, 0)
  const paginas = fragmento.map((s) => s.pagina).filter((p): p is number => !!p)

  useEffect(() => {
    let vivo = true
    if (!mapaId) {
      setPaso('sinDocumento')
      return
    }
    void leerDocumento(mapaId).then((d) => {
      if (!vivo) return
      setDoc(d)
      setPaso(d ? 'listo' : 'sinDocumento')
    })
    return () => {
      vivo = false
      ctl.current?.abort()
    }
  }, [mapaId])

  useEffect(() => {
    if (paso !== 'generando') return
    const i = setInterval(() => setSegundos((s) => s + 1), 1000)
    return () => clearInterval(i)
  }, [paso])

  const elegirArchivo = async (file: File | undefined) => {
    if (!file || !mapaId) return
    setError(null)
    setPaso('leyendo')
    try {
      const hash = await hashArchivo(file)
      if (fuente?.hash && fuente.hash !== hash) {
        setError(`No es el mismo archivo con el que se hizo el mapa${fuente.nombre ? ` («${fuente.nombre}»)` : ''}. Elige ese.`)
        setPaso('sinDocumento')
        return
      }
      const ext = await extraerDocumento(file, { maxChars: 1_000_000 })
      const d = { hash, nombre: file.name, secciones: ext.secciones, ...(ext.unidad ? { unidad: ext.unidad } : {}) }
      await guardarDocumento(mapaId, d).catch(() => {})
      // Un mapa sin archivo de origen conocido (de antes, o hecho a mano) se queda con este.
      if (!fuente) useUIStore.getState().setFuente({ hash, nombre: file.name.slice(0, 160), modo })
      setDoc({ mapId: mapaId, ...d, guardado: Date.now(), caduca: Date.now() + 1 })
      setPaso('listo')
    } catch (e) {
      setError(e instanceof ExtractError ? e.message : 'No se pudo leer el archivo.')
      setPaso('sinDocumento')
    }
  }

  const generar = async () => {
    if (!doc || !rama || !fragmento.length) return
    setError(null)
    setSegundos(0)
    setLineas([])
    setFase('leyendo')
    setPaso('generando')
    const c = new AbortController()
    ctl.current = c
    try {
      const r = await iaRama(
        {
          accion,
          modo,
          titulo: mapTitle,
          ruta: rama.ruta,
          rama: rama.rama,
          vecinos: rama.vecinos,
          secciones: fragmento,
          ...(doc.unidad === 'diapositiva' ? { unidad: 'diapositiva' as const } : {}),
        },
        c.signal,
        (e) => {
          if (c.signal.aborted) return
          if (e.tipo === 'fase') setFase(e.fase)
          else if (e.tipo === 'rama' || e.tipo === 'reinicio') setLineas((ls) => aplicarEvento(ls, e))
        },
      )
      if (c.signal.aborted) return
      // Una sola acción: foto para Ctrl+Z y la rama nueva en su sitio.
      const store = useMindMapStore.getState()
      const ui = useUIStore.getState()
      const hecho = aplicarRama<MindMapNode, MindMapEdge>(store.nodes, store.edges, nodeId, r.doc as MapDoc, {
        nuevoId: nanoid,
        categoryStyles: ui.categoryStyles,
        labelFont: ui.labelStyle.fontSize,
      })
      if (!hecho) throw new IAError('La rama ya no existe en el mapa.')
      useHistoryStore.getState().pushSnapshot(store.nodes, store.edges)
      // Copias propias: los nodos que vienen de la store están congelados (immer) y syncCollapse
      // les escribe lo que pinta el botón de plegar.
      const nodes = hecho.nodes.map((n) => ({ ...n, data: { ...n.data } }))
      const edges = hecho.edges.map((e) => ({ ...e, ...(e.data ? { data: { ...e.data } } : {}) }))
      syncCollapse(nodes, edges)
      useMindMapStore.setState({ nodes, edges })
      onHecho(`${info.titulo}: ${fmt(rama.rama.length - 1)} → ${fmt(hecho.nuevos.length)} nodos. Ctrl+Z lo deshace.`)
      useUIStore.getState().setRamaIA(null)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'No se pudo completar')
      setPaso('listo')
    }
  }

  const ink = t.isDark ? '#FAF7F4' : '#2C3E50'
  const borde = t.isDark ? t.border2 : '#2C3E50'
  const boton = (principal: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 10,
    border: `2px solid ${principal ? borde : t.border}`, boxShadow: principal ? `3px 3px 0 0 ${t.isDark ? '#000' : '#2C3E50'}` : 'none',
    background: principal ? t.accent : t.bgPanel, color: principal ? '#FFFFFF' : t.textSecondary,
    fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer',
  })
  const raizTexto = rama?.rama[0]?.t ?? ''

  return (
    <div
      onMouseDown={(e) => e.target === e.currentTarget && paso !== 'generando' && cerrar()}
      style={{ position: 'absolute', inset: 0, zIndex: 1400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(44,62,80,0.35)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rama-ia-titulo"
        style={{
          width: 'min(560px, 100%)', maxHeight: 'calc(100% - 32px)', overflowY: 'auto', borderRadius: 20,
          border: `2px solid ${borde}`, boxShadow: `6px 6px 0 0 ${t.isDark ? '#000' : '#2C3E50'}`,
          background: t.isDark ? t.bgPanel2 : '#FAF7F4', color: ink, padding: '16px 18px',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Sparkles size={22} color={t.accent} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="rama-ia-titulo" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>{info.titulo}</h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: t.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              «{raizTexto}» · {fmt(Math.max(0, (rama?.rama.length ?? 1) - 1))} nodos
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

        {(paso === 'buscando' || paso === 'leyendo') && (
          <p style={{ margin: '16px 0 4px', fontSize: '0.85rem', color: t.textSecondary, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader2 size={16} className="animate-spin" /> {paso === 'buscando' ? 'Buscando el documento en este navegador…' : 'Leyendo el archivo…'}
          </p>
        )}

        {paso === 'sinDocumento' && (
          <div style={{ marginTop: 14 }}>
            <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.45 }}>
              Para trabajar con esta rama hace falta el documento del que salió el mapa, y este navegador no lo tiene (otro
              dispositivo, datos del navegador borrados o han pasado más de 30 días).{' '}
              {fuente?.nombre ? <>Vuelve a elegir <b>«{fuente.nombre}»</b>: se comprueba que es el mismo archivo.</> : 'Elige el archivo con el que se hizo.'}
            </p>
            <input ref={input} type="file" accept={FORMATOS_ACEPTADOS} style={{ display: 'none' }} onChange={(e) => { void elegirArchivo(e.target.files?.[0]); e.target.value = '' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button type="button" onClick={cerrar} style={boton(false)}>Cancelar</button>
              <button type="button" onClick={() => input.current?.click()} style={boton(true)}>
                <FileUp size={15} /> Elegir el archivo
              </button>
            </div>
          </div>
        )}

        {paso === 'listo' && doc && (
          <div style={{ marginTop: 14 }}>
            <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.45 }}>{info.descripcion}</p>
            <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: t.textSecondary, lineHeight: 1.45 }}>
              Usará {paginas.length ? (
                <>las {doc.unidad === 'diapositiva' ? 'diapositivas' : 'páginas'} {Math.min(...paginas)}–{Math.max(...paginas)}</>
              ) : (
                <>{fmt(fragmento.length)} {fragmento.length === 1 ? 'sección' : 'secciones'}</>
              )}{' '}
              de «{doc.nombre}» ({fmt(charsFragmento)} caracteres). Solo ese fragmento va al servidor.
            </p>
            <div role="radiogroup" aria-label="Estilo" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {(['esquema', 'detalle'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={modo === m}
                  onClick={() => setModo(m)}
                  style={{ ...boton(false), border: `2px solid ${modo === m ? t.accent : t.border}`, color: modo === m ? ink : t.textSecondary }}
                >
                  {m === 'esquema' ? 'Esquemático' : 'Con más contenido'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => {
                  if (mapaId) void borrarDocumento(mapaId)
                  setDoc(null)
                  setPaso('sinDocumento')
                }}
                style={{ marginRight: 'auto', background: 'none', border: 0, padding: 0, color: t.textSecondary, fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}
              >
                Olvidar el documento en este navegador
              </button>
              <button type="button" onClick={cerrar} style={boton(false)}>Cancelar</button>
              <button type="button" onClick={() => void generar()} disabled={!fragmento.length} style={boton(true)}>
                <Sparkles size={15} /> {info.titulo}
              </button>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: '0.7rem', color: t.textSecondary }}>
              La rama nueva sustituye a la de ahora en una sola acción: Ctrl+Z la deshace. La IA puede equivocarse: lo dudoso sale en ámbar.
            </p>
          </div>
        )}

        {paso === 'generando' && (
          <div>
            <ProgresoIA fases={['leyendo', 'estructura', 'ordenando']} fase={fase} lineas={lineas} segundos={segundos} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" onClick={() => { ctl.current?.abort(); setPaso('listo') }} style={boton(false)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

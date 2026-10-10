'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { LEVEL_INFO } from '@/lib/studioFlashcards'
import { cambiarNivel, desplazarNivelesDe, NIVELES, textoCambioNiveles, type Hueco, type Nivel } from '@/lib/resumenes/huecos'
import type { FuenteFirmada, ModoResumen, ParrafoBorrador } from '@/lib/resumenes/borrador'
import {
  anadirParrafos,
  anadirParrafosIA,
  buscarParecidos,
  crearGrupo,
  listarGrupos,
  type GrupoResumen,
  type Parecido,
  type ParrafoNuevo,
  type UsoLiteral,
} from '@/lib/resumenes/api'
import { excesosLiteral, literalPorDocumento, seGuarda, tandasDeGuardado } from '@/lib/resumenes/guardado'
import {
  CANTIDAD_MAS_DEFECTO,
  CANTIDADES_MAS,
  deshacerEnSitio,
  insertarNuevos,
  nivelesDeOpcion,
  OPCIONES_MAS,
  parrafosDeTema,
  rehacerEnSitio,
  textoMas,
  vecinosDeTema,
  type OpcionMas,
} from '@/lib/resumenes/ampliar'
import type { MasResumenes } from '@/lib/resumenes/ia'
import { INK, NivelNuevo, ParrafoHuecos, ResumenHuecos } from './ParrafoHuecos'
import { EditorParrafo } from './EditorParrafo'

// Vista previa de los resúmenes activos con IA: por tema y párrafo. Se puede quitar un párrafo (o
// desmarcarlo), editar su texto, tocar una palabra o seleccionar un trozo para crear un hueco, tocar un
// hueco para cambiar su nivel o quitarlo. Cada cambio se guarda en el borrador (IndexedDB) con
// `persistir`. Al final se guarda en un grupo nuevo o en uno que ya existe (sin duplicar: lo valida el
// servidor) o, tema a tema, uno por tema del libro.
//
// Informe 82: al elegir un grupo que ya existe, los párrafos casi iguales a uno suyo se marcan («Ya
// tienes uno parecido») y no se guardan salvo «Incluir igual»; y en «Texto original» se avisa ANTES de
// guardar si lo copiado de un documento pasaría del 30 % de su texto en ese grupo (el servidor lo
// comprueba igual).
//
// Revisar RÁPIDO, como las flashcards: si hay dudosos se abre en ellos; todo con el teclado (↑ ↓
// párrafo, ← → hueco, Espacio incluir, 1-4 nivel del hueco, E editar, Esc); por tema, «incluir todo»
// y «Huecos − / +» (bajar o subir un nivel todos sus huecos), y lo mismo para todo lo marcado. Con 150
// párrafos sigue fluida: Tarjeta en memo con manejadores estables, y una tecla solo repinta las dos
// tarjetas implicadas.
//
// Con la IA de admin (como las flashcards): «Más» en la cabecera de cada tema pide párrafos NUEVOS de
// ese tema (de todo, más difíciles o más fáciles; 3, 5 o 10), que entran tras el último del tema,
// marcados como nuevos hasta que se tocan. «Rehacer» (o R) en cada párrafo pide otra versión con los
// mismos datos en los huecos y la pone en su sitio; «Deshacer» devuelve la anterior. Quién abre la
// vista previa decide qué fragmento del documento viaja (`mas`, `rehacer`).

/** «Más de este tema»: lo pone quien abre la vista previa (tiene el texto del documento). */
export type MasConfig = {
  pedir: (
    p: { grupo: string; tema: string; niveles: Nivel[]; cantidad: number; parrafos: ParrafoBorrador[]; vecinos: string[] },
    signal: AbortSignal,
  ) => Promise<MasResumenes>
  /** Los niveles de la generación («Más de todo»). */
  niveles: Nivel[]
  /** Las cantidades que admite el servidor. */
  cantidades: number[]
  /** Si ahora no se puede (falta el texto del documento): la explicación y cómo arreglarlo. */
  bloqueo?: React.ReactNode
  /** Cuántas veces quedan hoy (si se sabe). */
  restantes?: number
}

/** «Rehacer este párrafo»: lo pone quien abre la vista previa. */
export type RehacerConfig = {
  pedir: (p: { parrafo: ParrafoBorrador; delTema: ParrafoBorrador[] }, signal: AbortSignal) => Promise<ParrafoBorrador>
  bloqueo?: React.ReactNode
  restantes?: number
}

type EstadoMas = { clave: string; cargando: boolean; mensaje?: string; error?: string }

type Destino = 'nuevo' | 'existente' | 'porTema'
/** Ver solo los dudosos o solo los casi duplicados (se excluyen entre sí). */
type Filtro = 'dudosos' | 'parecidos' | null
type Hecho = { grupos: { id: string; name: string }[]; creados: number; duplicados: number; parecidos: number }

const fmt = (n: number) => n.toLocaleString('es-ES')
/** La clave de un tema (para plegarlo): dentro de su bloque del libro. */
const claveTema = (grupo: string, tema: string) => `${grupo}|${tema}`
const mismoNombre = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Un campo de texto (no una casilla): ahí las teclas son para escribir. */
const esCampo = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && !/^(checkbox|radio)$/.test((el as HTMLInputElement).type)))
/** Un botón (o casilla, o hueco) con el foco: Enter y Espacio son suyos. */
const esBoton = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || /^(button|menuitem|menuitemradio|radio|checkbox)$/.test(el.getAttribute('role') ?? ''))
const SIN_TEMAS: string[] = []
const sinClave = <T,>(m: Map<string, T>, key: string) => {
  if (!m.has(key)) return m
  const n = new Map(m)
  n.delete(key)
  return n
}
/** Quita la marca de «nuevo» (tocar o activar un párrafo de «Más» la quita). */
function sinNuevo(p: ParrafoBorrador): ParrafoBorrador {
  if (!p.nuevo) return p
  const resto = { ...p }
  delete resto.nuevo
  return resto
}
/** Una huella corta del texto (para saber si ha cambiado sin guardar el texto entero en la firma). */
function huella(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return `${s.length}.${(h >>> 0).toString(36)}`
}

/** Una tecla en la chuleta de atajos (igual que en la vista previa de las flashcards). */
function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="mx-[1px] inline-block rounded border border-[#D9D0CB] bg-[#FBF8F6] px-1 text-[0.65rem] font-bold text-[#8A7F79]">{children}</kbd>
}

/** «Incluir todo el tema»: marcada (todos), a medias (algunos) o sin marcar (ninguno). */
function CasillaTema({ estado, onChange, tema }: { estado: 'todos' | 'algunos' | 'ninguno'; onChange: () => void; tema: string }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = estado === 'algunos'
  }, [estado])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={estado === 'todos'}
      onChange={onChange}
      aria-label={`Incluir todo el tema «${tema}»`}
      title={estado === 'todos' ? 'Quitar todos los párrafos de este tema' : 'Incluir todos los párrafos de este tema'}
      className="h-4 w-4 shrink-0 accent-[#E8A598]"
    />
  )
}

/** «Huecos − / +»: bajar o subir un nivel (de 1 a 4) todos los huecos de unos párrafos. */
function NivelesMasMenos({ onBajar, onSubir, de, disabled = false }: { onBajar: () => void; onSubir: () => void; de: string; disabled?: boolean }) {
  const boton = 'flex h-5 w-5 items-center justify-center rounded-md text-[0.8rem] font-black leading-none text-[#2C3E50] hover:bg-[#FAF7F4] disabled:opacity-40'
  return (
    <span className="inline-flex items-center gap-0.5 rounded-lg bg-white px-0.5" style={{ border: '1.5px solid rgba(44,62,80,0.25)' }}>
      <button type="button" onClick={onBajar} disabled={disabled} className={boton} title={`Bajar un nivel todos los huecos de ${de} (los fáciles se quedan en fácil)`} aria-label={`Bajar un nivel los huecos de ${de}`}>
        −
      </button>
      <button type="button" onClick={onSubir} disabled={disabled} className={boton} title={`Subir un nivel todos los huecos de ${de} (los demenciales se quedan en demencial)`} aria-label={`Subir un nivel los huecos de ${de}`}>
        +
      </button>
    </span>
  )
}

const Tarjeta = memo(function Tarjeta({
  p,
  nivel,
  temas,
  parecido,
  activa,
  editando,
  huecoSeleccionado,
  registrar,
  onActivar,
  onEditar,
  onCerrarEditor,
  onCambiar,
  onQuitar,
  onAviso,
  rehacible = false,
  rehaciendo = false,
  rehecho = false,
  errorRehacer,
  bloqueo,
  onRehacer,
  onDeshacer,
  onCerrarBloqueo,
}: {
  p: ParrafoBorrador
  nivel: Nivel
  /** Solo para la que se edita (a las demás, siempre la misma lista vacía: no se repintan). */
  temas: string[]
  parecido: Parecido | null | undefined
  activa: boolean
  editando: boolean
  /** El hueco elegido con ← → (solo en la activa). */
  huecoSeleccionado: number | undefined
  registrar: (key: string, el: HTMLDivElement | null) => void
  /** Activar al tocarla (y, si se ha tocado un hueco, elegirlo). */
  onActivar: (key: string, hueco?: number) => void
  onEditar: (key: string) => void
  onCerrarEditor: () => void
  onCambiar: (key: string, cambio: Partial<ParrafoBorrador>) => void
  onQuitar: (key: string) => void
  onAviso: (m: string) => void
  /** Se ofrece «Rehacer» (IA de admin). */
  rehacible?: boolean
  rehaciendo?: boolean
  /** Rehecho: se puede volver a la versión anterior. */
  rehecho?: boolean
  /** Por qué no se ha podido rehacer (se cierra solo). */
  errorRehacer?: string
  /** Falta el texto del documento: cómo arreglarlo (solo en la tarjeta donde se pidió). */
  bloqueo?: React.ReactNode
  onRehacer?: (key: string) => void
  onDeshacer?: (key: string) => void
  onCerrarBloqueo?: () => void
}) {
  const cambiarHuecos = useCallback((huecos: Hueco[]) => onCambiar(p.key, { huecos }), [onCambiar, p.key])
  const refEl = useCallback((el: HTMLDivElement | null) => registrar(p.key, el), [registrar, p.key])
  if (editando) {
    return (
      <div ref={refEl} data-editor-parrafo={p.key}>
        <EditorParrafo
          inicial={{ texto: p.texto, huecos: p.huecos, tema: p.tema }}
          temas={temas}
          textoBoton="Aplicar"
          onCancelar={onCerrarEditor}
          onGuardar={(x) => {
            onCambiar(p.key, { texto: x.texto, huecos: x.huecos, tema: x.tema || p.tema })
            onCerrarEditor()
          }}
        />
      </div>
    )
  }
  const pagina = p.ia?.pagina ?? p.ia?.diapositiva
  const entra = seGuarda(p, parecido)
  return (
    <div
      ref={refEl}
      // En captura: tocar un hueco para de propagar el clic (abre su menú), pero la tarjeta se activa igual.
      onClickCapture={(e) => {
        const h = e.target instanceof HTMLElement ? e.target.closest<HTMLElement>('[data-hueco]') : null
        onActivar(p.key, h ? Number(h.dataset.hueco) : undefined)
      }}
      className={`rounded-2xl bg-white px-3 py-2.5 transition-opacity ${p.incluir ? '' : 'opacity-45'}`}
      style={{
        border: `2px solid ${activa ? INK : parecido ? '#7D8A96' : p.nuevo ? '#5E8C5A' : p.ia?.dudoso ? '#D9A441' : 'rgba(44,62,80,0.18)'}`,
        boxShadow: activa ? `3px 3px 0 0 ${INK}` : undefined,
      }}
      data-parrafo={p.key}
      {...(activa ? { 'data-activa': true } : {})}
      {...(parecido ? { 'data-parecido': parecido.igual ? 'igual' : 'parecido' } : {})}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={p.incluir}
          onChange={(e) => onCambiar(p.key, { incluir: e.target.checked })}
          aria-label="Incluir este párrafo"
          className="mt-1.5 h-4 w-4 shrink-0 accent-[#E8A598]"
        />
        <div className="min-w-0 flex-1">
          {/* Con un parecido que no se va a guardar, se atenúa el párrafo pero no el aviso ni su botón. */}
          <div className={p.incluir && !entra ? 'opacity-50' : ''}>
            <ParrafoHuecos
              texto={p.texto}
              huecos={p.huecos}
              onChange={cambiarHuecos}
              nivel={nivel}
              editable={p.incluir}
              onAviso={onAviso}
              seleccionado={huecoSeleccionado}
            />
          </div>
          {parecido && p.incluir ? (
            <div className="mt-2 rounded-xl bg-[#F2EFED] px-2.5 py-1.5 text-[0.72rem] text-[#2C3E50]">
              <p className="flex flex-wrap items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#7D8A96]">content_copy</span>
                <b>{parecido.igual ? 'Ya está en el grupo' : 'Ya tienes uno parecido'}</b>
                {parecido.tema ? <span className="text-[#7D8A96]">en «{parecido.tema}»</span> : null}
                {parecido.igual ? (
                  <span className="text-[#7D8A96]">· no se guardará</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCambiar(p.key, { incluirParecido: !p.incluirParecido })}
                    className="ml-auto rounded-lg px-2 py-0.5 font-bold"
                    style={{ border: `1.5px solid ${INK}`, background: p.incluirParecido ? '#E8A598' : '#fff', color: p.incluirParecido ? '#fff' : INK }}
                    aria-pressed={!!p.incluirParecido}
                  >
                    {p.incluirParecido ? 'Se incluirá igual' : 'Incluir igual'}
                  </button>
                )}
              </p>
              <p className="mt-1 line-clamp-2 italic text-[#7D8A96]" title={parecido.texto}>
                «{parecido.texto}»
              </p>
            </div>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.7rem] text-[#7D8A96]">
            {p.nuevo ? (
              <span className="rounded-full bg-[#E7F0E5] px-2 py-0.5 text-[0.66rem] font-extrabold uppercase tracking-wide text-[#5E8C5A]">Nuevo</span>
            ) : null}
            {rehecho ? (
              <span className="flex items-center gap-1">
                <span className="rounded-full bg-[#E7F0E5] px-2 py-0.5 text-[0.66rem] font-extrabold uppercase tracking-wide text-[#5E8C5A]">Rehecho</span>
                <button
                  type="button"
                  onClick={() => onDeshacer?.(p.key)}
                  title="Volver a la versión anterior de este párrafo"
                  className="rounded-lg px-1.5 py-0.5 font-bold underline hover:text-[#2C3E50]"
                >
                  Deshacer
                </button>
              </span>
            ) : null}
            <ResumenHuecos huecos={p.huecos} />
            {pagina ? <span>{p.ia?.diapositiva ? 'Diapositiva' : 'Pág.'} {pagina}</span> : null}
            {p.ia?.dudoso ? (
              <span className="rounded-md bg-[#FBF3E1] px-1.5 py-0.5 font-bold text-[#8A6418]" title="La revisión no lo encuentra bien en el documento: compruébalo">
                Revisar
              </span>
            ) : null}
            <span className="ml-auto flex gap-1" data-acciones-parrafo>
              {rehacible && (
                <button
                  type="button"
                  onClick={() => onRehacer?.(p.key)}
                  disabled={rehaciendo}
                  title="Pedir a la IA otra versión de este párrafo, con los mismos datos en los huecos (R)"
                  className="flex items-center gap-1 rounded-lg px-2 py-0.5 font-bold hover:bg-[#FCEFEC] hover:text-[#C4655A] disabled:opacity-60"
                >
                  <span aria-hidden className={`inline-block ${rehaciendo ? 'animate-spin' : ''}`}>
                    <span className="material-symbols-outlined text-[0.95rem] leading-none">autorenew</span>
                  </span>
                  {rehaciendo ? 'Rehaciendo…' : 'Rehacer'}
                </button>
              )}
              <button type="button" onClick={() => onEditar(p.key)} className="rounded-lg px-2 py-0.5 font-bold hover:bg-[#FAF7F4] hover:text-[#2C3E50]">
                Editar texto
              </button>
              <button type="button" onClick={() => onQuitar(p.key)} className="rounded-lg px-2 py-0.5 font-bold hover:bg-[#FAEAED] hover:text-[#B04A5E]">
                Quitar
              </button>
            </span>
          </div>
          {errorRehacer ? (
            <p role="alert" className="mt-2 rounded-xl bg-[#FBF3E1] px-2.5 py-1.5 text-[0.72rem] font-semibold text-[#8A6418]">
              {errorRehacer}
            </p>
          ) : null}
          {bloqueo ? (
            // Como el panel «Más»: dentro, el teclado es suyo y Esc lo cierra.
            <div data-mas-panel className="mt-2 rounded-xl bg-white p-3 text-[0.78rem] text-[#2C3E50]" style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}>
              {bloqueo}
              <button type="button" onClick={onCerrarBloqueo} className="mt-1 rounded-lg px-2 py-1 text-[0.74rem] font-bold text-[#7D8A96] hover:text-[#2C3E50]">
                Cerrar
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
})

/** El panel «Más» de un tema (debajo de su cabecera). */
function PanelMas({
  tema,
  mas,
  opcion,
  setOpcion,
  cantidad,
  setCantidad,
  cargando,
  error,
  onPedir,
  onCerrar,
}: {
  tema: string
  mas: MasConfig
  opcion: OpcionMas
  setOpcion: (o: OpcionMas) => void
  cantidad: number
  setCantidad: (n: number) => void
  cargando: boolean
  error?: string
  onPedir: () => void
  onCerrar: () => void
}) {
  const sinCupo = mas.restantes !== undefined && mas.restantes <= 0
  const cantidades = mas.cantidades.length ? mas.cantidades : [...CANTIDADES_MAS]
  return (
    <div data-mas-panel className="mb-2 rounded-xl bg-white p-3" style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}>
      {mas.bloqueo ? (
        <div className="text-[0.78rem] text-[#2C3E50]">{mas.bloqueo}</div>
      ) : (
        <>
          <div className="grid gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label={`Qué párrafos añadir a ${tema}`}>
            {OPCIONES_MAS.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={opcion === o.id}
                disabled={cargando}
                onClick={() => setOpcion(o.id)}
                className="rounded-lg px-2.5 py-1.5 text-left"
                style={{ border: `2px solid ${opcion === o.id ? '#E8A598' : '#EDE6DE'}`, background: opcion === o.id ? '#FCEFEC' : '#FFFFFF' }}
              >
                <span className="block text-[0.76rem] font-extrabold text-[#2C3E50]">{o.titulo}</span>
                <span className="block text-[0.68rem] text-[#7D8A96]">{o.descripcion}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[0.72rem] font-bold text-[#7D8A96]">Cuántos</span>
            <div className="flex gap-1" role="radiogroup" aria-label="Cuántos párrafos">
              {cantidades.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={cantidad === n}
                  disabled={cargando}
                  onClick={() => setCantidad(n)}
                  className="min-w-[2.2rem] rounded-lg px-2 py-0.5 text-[0.76rem] font-extrabold"
                  style={{ border: `2px solid ${cantidad === n ? '#E8A598' : '#EDE6DE'}`, color: cantidad === n ? '#2C3E50' : '#7D8A96' }}
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="ml-auto flex items-center gap-2">
              <button type="button" onClick={onCerrar} className="rounded-lg px-2 py-1 text-[0.74rem] font-bold text-[#7D8A96] hover:text-[#2C3E50]">
                {cargando ? 'Cancelar' : 'Cerrar'}
              </button>
              <button
                type="button"
                onClick={onPedir}
                disabled={cargando || sinCupo}
                className="flex items-center gap-1 rounded-lg bg-[#E8A598] px-3 py-1 text-[0.76rem] font-extrabold text-white disabled:opacity-60"
                style={{ border: `2px solid ${INK}` }}
              >
                <span aria-hidden className={`inline-block ${cargando ? 'animate-spin' : ''}`}>
                  <span className="material-symbols-outlined text-[0.95rem] leading-none">{cargando ? 'progress_activity' : 'auto_awesome'}</span>
                </span>
                {cargando ? 'Generando…' : 'Pedir'}
              </button>
            </span>
          </div>
          <p className="mt-1.5 text-[0.68rem] text-[#7D8A96]">
            Solo de este tema y sin repetir los que ya hay. Viaja el texto de este tema, no el documento entero.
            {mas.restantes !== undefined ? ` Hoy te quedan ${Math.max(0, mas.restantes)}.` : ''}
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-[0.74rem] font-bold text-[#B04A5E]">
          {error}
        </p>
      )}
    </div>
  )
}

export function VistaPreviaResumenes({
  inicial,
  nombreGrupo,
  modo,
  fuente,
  fuentes,
  persistir,
  alGuardar,
  onVolver,
  onCerrar,
  mas,
  rehacer,
}: {
  inicial: ParrafoBorrador[]
  nombreGrupo: string
  modo: ModoResumen
  fuente: { nombre?: string; unidad?: 'pagina' | 'diapositiva' }
  /** Las fuentes firmadas (vacío en un borrador de antes del informe 82: se guarda por la ruta de siempre). */
  fuentes: FuenteFirmada[]
  persistir: (lista: ParrafoBorrador[]) => void
  alGuardar: () => void
  onVolver?: () => void
  onCerrar: () => void
  /** «Más de este tema» (sin esto, no se ofrece). */
  mas?: MasConfig
  /** «Rehacer este párrafo» (sin esto, no se ofrece). */
  rehacer?: RehacerConfig
}) {
  const [lista, setLista] = useState(inicial)
  const [nivel, setNivel] = useState<Nivel>(2)
  const [plegados, setPlegados] = useState<Set<string>>(new Set())
  const [aviso, setAviso] = useState<string | null>(null)
  const porLibro = lista.some((p) => p.grupo)
  const [destino, setDestino] = useState<Destino>(porLibro ? 'porTema' : 'nuevo')
  const [nombre, setNombre] = useState(nombreGrupo)
  const [grupos, setGrupos] = useState<GrupoResumen[] | null>(null)
  const [elegido, setElegido] = useState('')
  const [guardando, setGuardando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<Hecho | null>(null)
  // Lo que dice el servidor del grupo de destino: los parecidos (por párrafo) y el literal de cada documento (por grupo).
  const [parecidos, setParecidos] = useState<Map<string, Parecido | null>>(new Map())
  const [usos, setUsos] = useState<Map<string, UsoLiteral[]>>(new Map())
  const [comprobando, setComprobando] = useState(false)
  // Revisar rápido (como las flashcards): si hay dudosos, se abre en ellos; el resto se da por bueno.
  const [filtro, setFiltro] = useState<Filtro>(() => (inicial.some((p) => p.ia?.dudoso) ? 'dudosos' : null))
  // Teclado: el párrafo activo, su hueco elegido (← →) y el que se edita.
  const [activo, setActivo] = useState<string | null>(null)
  const [huecoSel, setHuecoSel] = useState(0)
  const [editando, setEditando] = useState<string | null>(null)
  const activoRef = useRef<string | null>(null)
  const tarjetasRef = useRef(new Map<string, HTMLDivElement>())
  const contenedor = useRef<HTMLDivElement>(null)
  // El aviso tras subir o bajar de nivel muchos huecos a la vez.
  const [avisoNiveles, setAvisoNiveles] = useState<string | null>(null)
  // «Más de este tema»: el tema (su clave) con el panel abierto, lo elegido y en qué está.
  const [masAbierto, setMasAbierto] = useState<string | null>(null)
  const [masOpcion, setMasOpcion] = useState<OpcionMas>('todo')
  const [masCantidad, setMasCantidad] = useState<number>(CANTIDAD_MAS_DEFECTO)
  const [masEstado, setMasEstado] = useState<EstadoMas | null>(null)
  const masAbort = useRef<AbortController | null>(null)
  const cantidadesMas: readonly number[] = mas?.cantidades.length ? mas.cantidades : CANTIDADES_MAS
  const cantidadMas = cantidadesMas.includes(masCantidad) ? masCantidad : cantidadesMas[0]
  // Tras añadir los de «Más», el primero a la vista.
  const irA = useRef<string | null>(null)
  // «Rehacer»: de uno en uno (el servidor no admite dos a la vez). La versión anterior de cada párrafo
  // rehecho vive en memoria (una por párrafo); a las tarjetas solo les llega un booleano.
  const [rehaciendo, setRehaciendo] = useState<string | null>(null)
  const rehaciendoRef = useRef<string | null>(null)
  const rehacerAbort = useRef<AbortController | null>(null)
  const anteriores = useRef(new Map<string, ParrafoBorrador>())
  const [rehechos, setRehechos] = useState<ReadonlySet<string>>(new Set())
  const [erroresRehacer, setErroresRehacer] = useState<Map<string, string>>(new Map())
  // La tarjeta donde se enseña «vuelve a elegir el archivo» (falta el texto del documento).
  const [bloqueoEn, setBloqueoEn] = useState<string | null>(null)
  // Lo último de la lista y de `rehacer`, para los manejadores estables.
  const listaRef = useRef(lista)
  const rehacerRef = useRef(rehacer)
  useEffect(() => {
    listaRef.current = lista
  }, [lista])
  useEffect(() => {
    rehacerRef.current = rehacer
  }, [rehacer])
  const montado = useRef(true)
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
      masAbort.current?.abort()
      rehacerAbort.current?.abort()
    }
  }, [])

  // El borrador se guarda (con un respiro) a cada cambio.
  const primera = useRef(true)
  useEffect(() => {
    if (primera.current) {
      primera.current = false
      return
    }
    const t = setTimeout(() => persistir(lista), 400)
    return () => clearTimeout(t)
  }, [lista, persistir])

  // Los grupos se cargan siempre: «Grupo nuevo» con el nombre de uno que ya existe lo reutiliza.
  useEffect(() => {
    void listarGrupos()
      .then((g) => {
        setGrupos(g)
        setElegido((x) => x || g[0]?.id || '')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar los grupos'))
  }, [])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 3500)
    return () => clearTimeout(t)
  }, [aviso])

  const cambiar = useCallback((key: string, cambio: Partial<ParrafoBorrador>) => {
    setLista((ls) => ls.map((p) => (p.key === key ? { ...sinNuevo(p), ...cambio } : p)))
  }, [])
  const quitar = useCallback((key: string) => setLista((ls) => ls.filter((p) => p.key !== key)), [])

  // Manejadores ESTABLES (la clave como argumento): con Tarjeta en memo, una tecla solo repinta las
  // tarjetas que cambian (la que deja de ser activa y la que pasa a serlo).
  /** Activar un párrafo: con el hueco tocado o, si es otro párrafo, con el primero. null = ninguno. */
  const activar = useCallback((key: string | null, hueco?: number) => {
    if (hueco !== undefined && Number.isInteger(hueco)) setHuecoSel(hueco)
    else if (activoRef.current !== key) setHuecoSel(0)
    activoRef.current = key
    setActivo(key)
    // Activarlo es haberlo visto: deja de ser «nuevo» (si no lo era, la lista no cambia y no repinta).
    if (key) setLista((ls) => (ls.some((p) => p.key === key && p.nuevo) ? ls.map((p) => (p.key === key ? sinNuevo(p) : p)) : ls))
  }, [])
  const editar = useCallback(
    (key: string) => {
      activar(key)
      setEditando(key)
    },
    [activar],
  )
  const cerrarEditor = useCallback(() => {
    setEditando(null)
    contenedor.current?.focus({ preventScroll: true })
  }, [])
  const registrar = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) tarjetasRef.current.set(key, el)
    else tarjetasRef.current.delete(key)
  }, [])
  const alternarPlegado = (clave: string) =>
    setPlegados((s) => {
      const n = new Set(s)
      if (n.has(clave)) n.delete(clave)
      else n.add(clave)
      return n
    })

  // Al abrir, el foco a la lista (no en el botón de la página que la abrió: Espacio lo volvería a pulsar).
  useEffect(() => {
    contenedor.current?.focus({ preventScroll: true })
  }, [])

  // El párrafo activo, siempre a la vista.
  useEffect(() => {
    if (activo) tarjetasRef.current.get(activo)?.scrollIntoView({ block: 'nearest' })
  }, [activo])

  useEffect(() => {
    if (!avisoNiveles) return
    const t = setTimeout(() => setAvisoNiveles(null), 4000)
    return () => clearTimeout(t)
  }, [avisoNiveles])

  // Tras añadir los de «Más», el primero a la vista (sin activarlo: seguiría siendo nuevo).
  useEffect(() => {
    if (!irA.current) return
    tarjetasRef.current.get(irA.current)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    irA.current = null
  }, [lista])

  /** Por qué no se ha podido rehacer un párrafo: en su tarjeta, y se cierra solo. */
  const avisarRehacer = useCallback((key: string, m: string) => {
    setErroresRehacer((x) => new Map(x).set(key, m))
    setTimeout(() => {
      if (montado.current) setErroresRehacer((x) => (x.get(key) === m ? sinClave(x, key) : x))
    }, 6000)
  }, [])

  /** «Rehacer» (botón o R): otra versión del párrafo, en su sitio; la anterior queda para «Deshacer». */
  const rehacerParrafo = useCallback(
    async (key: string) => {
      const cfg = rehacerRef.current
      if (!cfg || rehaciendoRef.current === key) return
      if (cfg.bloqueo) {
        setBloqueoEn(key)
        return
      }
      if (rehaciendoRef.current) return avisarRehacer(key, 'Ya se está rehaciendo otro párrafo: espera a que termine.')
      if (cfg.restantes !== undefined && cfg.restantes <= 0) return avisarRehacer(key, 'Has llegado al máximo de párrafos rehechos de hoy. Vuelve mañana.')
      const ahora = listaRef.current
      const p = ahora.find((x) => x.key === key)
      if (!p) return
      const ctl = new AbortController()
      rehacerAbort.current = ctl
      rehaciendoRef.current = key
      setRehaciendo(key)
      setErroresRehacer((x) => sinClave(x, key))
      try {
        const nuevo = await cfg.pedir({ parrafo: p, delTema: parrafosDeTema(ahora, p.grupo ?? '', p.tema) }, ctl.signal)
        if (ctl.signal.aborted || !montado.current) return
        // Si mientras tanto se ha editado, la anterior es la editada (y si se ha quitado, nada).
        const actual = listaRef.current.find((x) => x.key === key)
        if (!actual) return
        anteriores.current.set(key, actual)
        setRehechos((s) => (s.has(key) ? s : new Set(s).add(key)))
        setLista((ls) => rehacerEnSitio(ls, key, nuevo))
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        if (montado.current) avisarRehacer(key, e instanceof Error ? e.message : 'No se pudo rehacer el párrafo.')
      } finally {
        if (rehaciendoRef.current === key) {
          rehaciendoRef.current = null
          if (montado.current) setRehaciendo(null)
        }
      }
    },
    [avisarRehacer],
  )
  const deshacer = useCallback((key: string) => {
    const a = anteriores.current.get(key)
    if (!a) return
    anteriores.current.delete(key)
    setRehechos((s) => {
      const n = new Set(s)
      n.delete(key)
      return n
    })
    setLista((ls) => deshacerEnSitio(ls, key, a))
  }, [])
  const cerrarBloqueo = useCallback(() => setBloqueoEn(null), [])

  /** «Más de este tema»: párrafos nuevos tras el último del tema; si estaba plegado o filtrado, se ve. */
  const pedirMas = async (grupo: string, tema: string, cantidad: number) => {
    const clave = claveTema(grupo, tema)
    if (!mas || masEstado?.cargando) return
    masAbort.current?.abort()
    const ctl = new AbortController()
    masAbort.current = ctl
    setMasEstado({ clave, cargando: true })
    try {
      const r = await mas.pedir(
        {
          grupo,
          tema,
          niveles: nivelesDeOpcion(masOpcion, mas.niveles),
          cantidad,
          parrafos: parrafosDeTema(lista, grupo, tema),
          vecinos: vecinosDeTema(lista, grupo, tema),
        },
        ctl.signal,
      )
      if (ctl.signal.aborted || !montado.current) return
      const quitados = r.repetidos + r.casiDuplicados
      if (!r.parrafos.length) {
        setMasEstado({ clave, cargando: false, error: `No han salido párrafos nuevos de este tema${quitados ? ` (${quitados} repetían uno que ya tenías)` : ''}.` })
        return
      }
      const sello = Date.now().toString(36)
      setLista((l) => {
        const x = insertarNuevos(l, grupo, tema, r.parrafos, sello)
        irA.current = x.primera
        return x.lista
      })
      setPlegados((s) => {
        if (!s.has(clave)) return s
        const n = new Set(s)
        n.delete(clave)
        return n
      })
      setFiltro(null)
      setMasEstado({ clave, cargando: false, mensaje: textoMas(r.parrafos.length, quitados) })
      setMasAbierto(null)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      if (montado.current) setMasEstado({ clave, cargando: false, error: e instanceof Error ? e.message : 'No se pudieron generar más párrafos.' })
    }
  }

  /** Subir o bajar un nivel todos los huecos de esos párrafos, y avisar de cuántos (y de los que ya estaban en el tope). */
  const moverNiveles = (claves: Set<string>, d: 1 | -1) => {
    const r = desplazarNivelesDe(lista, claves, d)
    if (r.huecos) setLista((ls) => desplazarNivelesDe(ls, claves, d).lista)
    setAvisoNiveles(textoCambioNiveles(r, d))
  }
  /** La casilla de un tema: si están todos, se quitan todos; si no, se incluyen todos. */
  const alternarTema = (ps: ParrafoBorrador[]) => {
    const todos = ps.every((p) => p.incluir)
    const claves = new Set(ps.map((p) => p.key))
    setLista((ls) => ls.map((p) => (claves.has(p.key) && p.incluir === todos ? { ...p, incluir: !todos } : p)))
  }

  /** El grupo (que ya existe) al que iría cada párrafo, o null si va a uno nuevo. */
  const grupoExistenteDe = useCallback(
    (p: ParrafoBorrador): GrupoResumen | null => {
      if (!grupos) return null
      if (destino === 'existente') return grupos.find((g) => g.id === elegido) ?? null
      const n = destino === 'porTema' ? (p.grupo ?? nombreGrupo).slice(0, 80) : nombre
      return grupos.find((g) => mismoNombre(g.name, n)) ?? null
    },
    [grupos, destino, elegido, nombre, nombreGrupo],
  )

  // Qué se compara con cada grupo: los textos (no los «incluir»: marcar o desmarcar no vuelve a preguntar).
  const consulta = useMemo(() => {
    const porGrupo = new Map<string, ParrafoBorrador[]>()
    for (const p of lista) {
      const g = grupoExistenteDe(p)
      if (!g) continue
      const xs = porGrupo.get(g.id)
      if (xs) xs.push(p)
      else porGrupo.set(g.id, [p])
    }
    // Con una huella del texto (no solo su largo): un párrafo rehecho o editado con el mismo largo
    // también se vuelve a comprobar.
    const firma = [...porGrupo].map(([id, ps]) => `${id}:${ps.map((p) => `${p.key}=${huella(p.texto)}`).join(',')}`).join('|')
    return { porGrupo, firma }
  }, [lista, grupoExistenteDe])

  useEffect(() => {
    if (!consulta.porGrupo.size) {
      setParecidos(new Map())
      setUsos(new Map())
      return
    }
    let vivo = true
    const t = setTimeout(() => {
      setComprobando(true)
      void (async () => {
        const nuevos = new Map<string, Parecido | null>()
        const nuevosUsos = new Map<string, UsoLiteral[]>()
        try {
          for (const [id, ps] of consulta.porGrupo) {
            const docs = new Set(ps.map((p) => p.doc).filter(Boolean))
            const r = await buscarParecidos(id, ps.map((p) => p.texto), fuentes.filter((f) => docs.has(f.hash)))
            ps.forEach((p, k) => nuevos.set(p.key, r.parecidos[k] ?? null))
            nuevosUsos.set(id, r.literal)
          }
          if (!vivo) return
          setParecidos(nuevos)
          setUsos(nuevosUsos)
        } catch {
          // Sin la comprobación se puede guardar igual: el servidor no guarda los casi iguales ni pasa del tope.
        } finally {
          if (vivo) setComprobando(false)
        }
      })()
    }, 350)
    return () => {
      vivo = false
      clearTimeout(t)
    }
    // La firma resume `porGrupo`: no hace falta repetir la consulta si no cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta.firma, fuentes])

  // Por bloque del libro (si lo hay) y, dentro, por tema; en el orden en que llegaron.
  const bloques = useMemo(() => {
    const out: { grupo: string; temas: { tema: string; parrafos: ParrafoBorrador[] }[] }[] = []
    for (const p of lista) {
      const g = p.grupo ?? ''
      let b = out.find((x) => x.grupo === g)
      if (!b) out.push((b = { grupo: g, temas: [] }))
      let t = b.temas.find((x) => x.tema === p.tema)
      if (!t) b.temas.push((t = { tema: p.tema, parrafos: [] }))
      t.parrafos.push(p)
    }
    return out
  }, [lista])
  const temas = useMemo(() => [...new Set(lista.map((p) => p.tema))], [lista])
  const marcados = lista.filter((p) => seGuarda(p, parecidos.get(p.key)))
  const huecosMarcados = marcados.reduce((n, p) => n + p.huecos.length, 0)
  const porNivel = NIVELES.map((n) => marcados.reduce((c, p) => c + p.huecos.filter((h) => h.n === n).length, 0))
  const nParecidos = lista.filter((p) => p.incluir && parecidos.get(p.key)).length
  const nDudosos = lista.filter((p) => p.ia?.dudoso).length
  const nCasi = lista.filter((p) => parecidos.get(p.key)).length
  // Un filtro que se queda vacío (otro grupo de destino, sin parecidos) deja de filtrar.
  const filtroEf: Filtro = filtro === 'dudosos' && nDudosos ? 'dudosos' : filtro === 'parecidos' && nCasi ? 'parecidos' : null
  const pasaFiltro = useCallback(
    (p: ParrafoBorrador) => (filtroEf === 'dudosos' ? !!p.ia?.dudoso : filtroEf === 'parecidos' ? !!parecidos.get(p.key) : true),
    [filtroEf, parecidos],
  )
  const todasLasClaves = useMemo(() => bloques.flatMap((b) => b.temas.map((t) => claveTema(b.grupo, t.tema))), [bloques])

  // Lo que se ve, en orden (para moverse con ↑ ↓): sin los temas plegados y con el filtro.
  const visibles = useMemo(
    () => bloques.flatMap((b) => b.temas.filter((t) => !plegados.has(claveTema(b.grupo, t.tema))).flatMap((t) => t.parrafos.filter(pasaFiltro).map((p) => p.key))),
    [bloques, plegados, pasaFiltro],
  )
  const posVisible = useMemo(() => new Map(visibles.map((k, i) => [k, i])), [visibles])
  const indiceDe = useMemo(() => new Map(lista.map((p, i) => [p.key, i])), [lista])
  // «Huecos de lo marcado»: los incluidos que se ven con el filtro (los plegados cuentan: solo están recogidos).
  const marcadosVisibles = useMemo(() => new Set(lista.filter((p) => p.incluir && pasaFiltro(p)).map((p) => p.key)), [lista, pasaFiltro])

  /** El hueco elegido del párrafo activo, dentro de los que tiene (null si no tiene). */
  const huecoDe = (p: ParrafoBorrador | undefined) => (p && p.huecos.length ? Math.min(huecoSel, p.huecos.length - 1) : null)
  const pActivo = activo ? lista[indiceDe.get(activo) ?? -1] : undefined
  const selActivo = huecoDe(pActivo)

  // Teclado. En captura y parando la propagación (como en las flashcards): mientras se revisa, las
  // teclas son de la vista previa. Dentro de un campo, del editor o del panel «Más», solo Esc.
  useEffect(() => {
    if (hecho || guardando) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target instanceof HTMLElement ? e.target : null
      // Un menú de hueco abierto (en la tarjeta o en el editor): su Esc lo cierra.
      const menuAbierto = () => !!t?.closest('[data-parrafo], [data-editor-parrafo]')?.querySelector('[role="menu"]')
      if (t?.closest('[data-mas-panel]')) {
        // El panel «Más de este tema» (o el aviso de «vuelve a elegir el archivo»): Esc lo cierra; el resto, del panel.
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          setMasAbierto(null)
          setBloqueoEn(null)
          contenedor.current?.focus({ preventScroll: true })
        }
        return
      }
      if (editando) {
        if (e.key === 'Escape' && !menuAbierto()) {
          e.preventDefault()
          e.stopPropagation()
          cerrarEditor()
        }
        return
      }
      if (esCampo(t)) return
      if (e.key === 'Escape' && menuAbierto()) return
      // Un botón o casilla con el foco: Enter y Espacio lo pulsan. Un hueco con el foco: 1-4 y Supr son suyos.
      if (esBoton(t) && (e.key === 'Enter' || e.key === ' ')) return
      if (t?.dataset.hueco !== undefined && /^([1-4]|Delete|Backspace)$/.test(e.key)) return
      e.stopPropagation()
      // Moverse con las flechas es ponerse con los párrafos: el foco sale del botón que lo tuviera (si
      // no, Espacio y Enter seguirían pulsándolo).
      if (/^Arrow/.test(e.key) && esBoton(t)) contenedor.current?.focus({ preventScroll: true })
      const pos = activo ? (posVisible.get(activo) ?? -1) : -1
      const mover = (d: number) => {
        e.preventDefault()
        if (!visibles.length) return
        activar(visibles[Math.min(visibles.length - 1, Math.max(0, pos < 0 ? 0 : pos + d))])
      }
      if (e.key === 'ArrowDown' || e.key === 'j') return mover(1)
      if (e.key === 'ArrowUp' || e.key === 'k') return mover(-1)
      if (!pActivo) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        if (selActivo !== null) setHuecoSel(Math.min(pActivo.huecos.length - 1, Math.max(0, selActivo + (e.key === 'ArrowRight' ? 1 : -1))))
      } else if (e.key === ' ') {
        e.preventDefault()
        cambiar(pActivo.key, { incluir: !pActivo.incluir })
      } else if (/^[1-4]$/.test(e.key)) {
        e.preventDefault()
        if (selActivo !== null) cambiar(pActivo.key, { huecos: cambiarNivel(pActivo.huecos, selActivo, Number(e.key) as Nivel) })
      } else if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
        e.preventDefault()
        editar(pActivo.key)
      } else if ((e.key === 'r' || e.key === 'R') && rehacerRef.current) {
        e.preventDefault()
        void rehacerParrafo(pActivo.key)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        activar(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [hecho, guardando, editando, activo, pActivo, selActivo, visibles, posVisible, activar, editar, cerrarEditor, cambiar, rehacerParrafo])

  // «Texto original»: lo que se pasaría del 30 % de su documento en cada grupo de destino.
  const excesos = useMemo(() => {
    const out: { grupo: string; hash: string; usado: number; tope: number; nuevos: number; sobran: number }[] = []
    for (const [id, ps] of consulta.porGrupo) {
      const nombreG = grupos?.find((g) => g.id === id)?.name ?? ''
      for (const e of excesosLiteral(literalPorDocumento(ps, modo, parecidos), usos.get(id) ?? [])) out.push({ grupo: nombreG, ...e })
    }
    return out
  }, [consulta.porGrupo, grupos, modo, parecidos, usos])

  const aNuevo = (p: ParrafoBorrador): ParrafoNuevo => {
    const pagina = p.ia?.pagina ?? p.ia?.diapositiva
    // El fragmento del documento («Ver de dónde sale»), solo en «Resumen»: en «Texto original» el párrafo ya es el texto.
    const fragmento = modo !== 'literal' ? p.ia?.fragmento : undefined
    return {
      tema: p.tema,
      modo,
      texto: p.texto,
      huecos: p.huecos,
      ...(fuente.nombre || pagina || fragmento
        ? {
            origen: {
              ...(fuente.nombre ? { name: fuente.nombre } : {}),
              ...(pagina ? { page: pagina, unit: p.ia?.diapositiva ? 'diapositiva' : 'pagina' } : {}),
              ...(fragmento ? { fragmento } : {}),
            },
          }
        : {}),
    }
  }

  /** El grupo con ese nombre: se crea o, si ya existe, se usa. */
  const grupoDe = async (name: string, existentes: GrupoResumen[] | null): Promise<GrupoResumen> => {
    const ya = existentes?.find((g) => mismoNombre(g.name, name))
    if (ya) return ya
    try {
      return await crearGrupo(name)
    } catch (e) {
      const otra = (await listarGrupos()).find((g) => mismoNombre(g.name, name))
      if (otra) return otra
      throw e
    }
  }

  /** Guarda unos párrafos en un grupo: con su documento de origen si lo hay; si no (borrador antiguo), como siempre. */
  const guardarEn = async (grupo: GrupoResumen, ps: ParrafoBorrador[], progreso?: (n: number) => void) => {
    if (fuentes.length) {
      const r = await anadirParrafosIA(grupo.id, tandasDeGuardado(ps, aNuevo, fuentes, parecidos), progreso)
      return r
    }
    const r = await anadirParrafos(grupo.id, ps.filter((p) => seGuarda(p, parecidos.get(p.key))).map(aNuevo), true, progreso)
    return { ...r, parecidos: 0 }
  }

  const guardar = async () => {
    if (!marcados.length || guardando || excesos.length) return
    setError(null)
    try {
      const r: Hecho = { grupos: [], creados: 0, duplicados: 0, parecidos: 0 }
      const sumar = (x: { creados: number; duplicados: number; parecidos: number }) => {
        r.creados += x.creados
        r.duplicados += x.duplicados
        r.parecidos += x.parecidos
      }
      if (destino === 'porTema') {
        const nombres = [...new Set(marcados.map((p) => p.grupo ?? nombreGrupo))]
        const todos = await listarGrupos()
        for (const [k, g] of nombres.entries()) {
          setGuardando(`Tema ${k + 1} de ${nombres.length}…`)
          const grupo = await grupoDe(g.slice(0, 80), todos)
          sumar(await guardarEn(grupo, lista.filter((p) => (p.grupo ?? nombreGrupo) === g)))
          r.grupos.push({ id: grupo.id, name: grupo.name })
        }
      } else {
        setGuardando('Guardando…')
        const grupo = destino === 'nuevo' ? await grupoDe(nombre.trim(), grupos) : ((grupos ?? []).find((g) => g.id === elegido) ?? null)
        if (!grupo) throw new Error('Elige un grupo')
        sumar(await guardarEn(grupo, lista, (n) => setGuardando(`Guardando ${n} de ${marcados.length}…`)))
        r.grupos.push({ id: grupo.id, name: grupo.name })
      }
      setHecho(r)
      alGuardar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setGuardando(null)
    }
  }

  if (hecho) {
    const uno = hecho.grupos.length === 1 ? hecho.grupos[0] : null
    return (
      <div className="px-6 pb-6">
        <div className="rounded-2xl bg-white p-5 text-center" style={{ border: `2px solid ${INK}`, boxShadow: `4px 4px 0 0 ${INK}` }}>
          <span className="material-symbols-outlined text-[40px] text-[#5E8C5A]">task_alt</span>
          <p className="mt-1 text-lg font-extrabold text-[#2C3E50]">
            {hecho.creados} {hecho.creados === 1 ? 'párrafo guardado' : 'párrafos guardados'}
          </p>
          {hecho.duplicados > 0 && (
            <p className="text-sm text-[#7D8A96]">
              {hecho.duplicados} {hecho.duplicados === 1 ? 'ya estaba' : 'ya estaban'} en el grupo y no se ha{hecho.duplicados === 1 ? '' : 'n'} repetido.
            </p>
          )}
          {hecho.parecidos > 0 && (
            <p className="text-sm text-[#7D8A96]">
              {hecho.parecidos} {hecho.parecidos === 1 ? 'se parecía' : 'se parecían'} a uno que ya tenías y no se ha{hecho.parecidos === 1 ? '' : 'n'} guardado.
            </p>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {uno ? (
              <>
                <Link
                  href={`/resumenes/${uno.id}?estudiar=1`}
                  className="rounded-xl bg-[#E8A598] px-4 py-2 text-sm font-extrabold text-white"
                  style={{ border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}
                >
                  Empezar a estudiar
                </Link>
                <Link href={`/resumenes/${uno.id}`} className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#2C3E50]" style={{ border: `2px solid ${INK}` }}>
                  Abrir «{uno.name}»
                </Link>
              </>
            ) : (
              hecho.grupos.map((g) => (
                <Link key={g.id} href={`/resumenes/${g.id}`} className="rounded-xl bg-white px-3 py-1.5 text-sm font-bold text-[#2C3E50]" style={{ border: `2px solid ${INK}` }}>
                  {g.name}
                </Link>
              ))
            )}
            <button type="button" onClick={onCerrar} className="rounded-xl px-4 py-2 text-sm font-bold text-[#7D8A96] hover:text-[#2C3E50]">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#7D8A96]/15 px-6 pb-3 text-xs text-[#7D8A96]">
        <span className="font-bold text-[#2C3E50]">
          {marcados.length} de {lista.length} párrafos · {huecosMarcados} huecos
        </span>
        <span className="flex gap-1">
          {NIVELES.map((n, k) => (
            <span key={n} className="rounded-md px-1.5 py-0.5 font-extrabold" style={{ background: LEVEL_INFO[n].soft, color: LEVEL_INFO[n].color }}>
              {porNivel[k]} {LEVEL_INFO[n].name.toLowerCase()}
            </span>
          ))}
        </span>
        <span className="ml-auto flex items-center gap-2">
          Nivel al marcar <NivelNuevo nivel={nivel} onChange={setNivel} />
        </span>
      </div>
      <p className="px-6 pt-2 text-[0.72rem] text-[#7D8A96]">
        Toca una palabra o selecciona un trozo para taparlo; toca un hueco para cambiar su nivel o quitarlo.
        {modo === 'literal' ? ' Texto original: «[…]» marca lo que se ha saltado del documento.' : ''}
      </p>
      {nParecidos > 0 && (
        <p className="px-6 pt-1 text-[0.72rem] font-semibold text-[#2C3E50]" data-aviso-parecidos>
          {nParecidos === 1 ? 'Uno se parece' : `${nParecidos} se parecen`} a párrafos que ya tienes en el grupo: no se guardarán salvo que marques «Incluir igual».
        </p>
      )}
      {aviso && <p className="px-6 pt-1 text-xs font-bold text-[#B04A5E]">{aviso}</p>}

      <div className="flex flex-wrap items-center gap-1.5 px-6 pt-2">
        {nDudosos > 0 && (
          <button
            type="button"
            onClick={() => setFiltro(filtroEf === 'dudosos' ? null : 'dudosos')}
            aria-pressed={filtroEf === 'dudosos'}
            className="rounded-full px-2.5 py-1 text-[0.72rem] font-extrabold"
            style={{ border: '1.5px solid #D9A441', background: filtroEf === 'dudosos' ? '#D9A441' : '#FBF3E1', color: filtroEf === 'dudosos' ? '#FFFFFF' : '#8A6418' }}
          >
            {filtroEf === 'dudosos' ? 'Ver todos' : `Revisar ${nDudosos} ${nDudosos === 1 ? 'dudoso' : 'dudosos'}`}
          </button>
        )}
        {nCasi > 0 && (
          <button
            type="button"
            onClick={() => setFiltro(filtroEf === 'parecidos' ? null : 'parecidos')}
            aria-pressed={filtroEf === 'parecidos'}
            className="rounded-full px-2.5 py-1 text-[0.72rem] font-extrabold"
            style={{ border: '1.5px solid #7D8A96', background: filtroEf === 'parecidos' ? '#7D8A96' : '#F2EFED', color: filtroEf === 'parecidos' ? '#FFFFFF' : INK }}
          >
            {filtroEf === 'parecidos' ? 'Ver todos' : `${nCasi} ${nCasi === 1 ? 'casi duplicado' : 'casi duplicados'}`}
          </button>
        )}
        <button
          type="button"
          onClick={() => setPlegados(plegados.size ? new Set() : new Set(todasLasClaves))}
          className="rounded-full px-2.5 py-1 text-[0.72rem] font-bold text-[#7D8A96] underline"
        >
          {plegados.size ? 'Desplegar todo' : 'Plegar todo'}
        </button>
        <span className="ml-auto flex items-center gap-1 text-[0.72rem] font-bold text-[#7D8A96]">
          Huecos de lo marcado
          <NivelesMasMenos
            onBajar={() => moverNiveles(marcadosVisibles, -1)}
            onSubir={() => moverNiveles(marcadosVisibles, 1)}
            disabled={!marcadosVisibles.size}
            de={filtroEf ? 'los párrafos marcados que se ven con este filtro' : 'todos los párrafos marcados'}
          />
        </span>
      </div>
      {filtroEf === 'dudosos' ? (
        <p className="mx-6 mt-2 rounded-xl bg-[#FBF3E1] px-3 py-2 text-[0.75rem] font-semibold text-[#8A6418]">
          Solo los dudosos: la revisión no los encuentra bien en el documento. Los demás se guardan tal cual; si quieres verlos, «Ver todos».
        </p>
      ) : filtroEf === 'parecidos' ? (
        <p className="mx-6 mt-2 rounded-xl bg-[#F2EFED] px-3 py-2 text-[0.75rem] font-semibold text-[#2C3E50]">
          Solo los casi duplicados: el grupo ya tiene uno igual o muy parecido. No se guardan salvo «Incluir igual»; para ver el resto, «Ver todos».
        </p>
      ) : null}
      <p className="px-6 pt-1.5 text-[0.7rem] text-[#7D8A96]" aria-label="Atajos de teclado">
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd> párrafo · <Kbd>←</Kbd>
        <Kbd>→</Kbd> hueco · <Kbd>Espacio</Kbd> incluir · <Kbd>1</Kbd>–<Kbd>4</Kbd> nivel del hueco · <Kbd>E</Kbd> editar
        {rehacer ? (
          <>
            {' '}
            · <Kbd>R</Kbd> rehacer
          </>
        ) : null}{' '}
        · <Kbd>Esc</Kbd> salir
      </p>
      {avisoNiveles && (
        <p role="status" className="px-6 pt-1 text-xs font-bold text-[#5E8C5A]">
          {avisoNiveles}
        </p>
      )}

      <div ref={contenedor} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto px-6 py-3 outline-none">
        {bloques.map((b) => {
          const temasVisibles = b.temas.map((t) => ({ ...t, vis: t.parrafos.filter(pasaFiltro) })).filter((t) => t.vis.length)
          if (!temasVisibles.length) return null
          return (
            <section key={b.grupo || '-'} className="mb-4">
              {b.grupo ? <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-[#2C3E50]">{b.grupo}</h3> : null}
              {temasVisibles.map((t) => {
                const clave = claveTema(b.grupo, t.tema)
                const plegado = plegados.has(clave)
                const incluidos = t.parrafos.filter((p) => p.incluir).length
                const claves = () => new Set(t.parrafos.map((p) => p.key))
                return (
                  <div key={clave} className="mb-3">
                    <div className="mb-1.5 flex items-center gap-2">
                      <CasillaTema
                        estado={incluidos === 0 ? 'ninguno' : incluidos === t.parrafos.length ? 'todos' : 'algunos'}
                        onChange={() => alternarTema(t.parrafos)}
                        tema={t.tema}
                      />
                      <button type="button" onClick={() => alternarPlegado(clave)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={!plegado}>
                        <span className="material-symbols-outlined text-[18px] text-[#7D8A96]">{plegado ? 'chevron_right' : 'expand_more'}</span>
                        <span className="min-w-0 truncate font-extrabold text-[#2C3E50]">{t.tema}</span>
                        <span className="shrink-0 text-xs text-[#7D8A96]">
                          {t.parrafos.filter((p) => seGuarda(p, parecidos.get(p.key))).length}/{t.parrafos.length}
                        </span>
                      </button>
                      {/* Acciones del tema: «Más» (pedir a la IA más párrafos de este tema; su panel, debajo) y los niveles de sus huecos. */}
                      <span className="flex shrink-0 items-center gap-1.5" data-acciones-tema>
                        {mas && (
                          <button
                            type="button"
                            onClick={() => setMasAbierto((x) => (x === clave ? null : clave))}
                            aria-expanded={masAbierto === clave}
                            disabled={!!guardando}
                            title="Pedir a la IA más párrafos de este tema"
                            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-[0.7rem] font-extrabold text-[#C4655A] hover:bg-[#FCEFEC] disabled:opacity-40"
                            style={{ border: '1.5px solid #E8A598' }}
                          >
                            <span aria-hidden className="inline-block">
                              <span className="material-symbols-outlined text-[0.95rem] leading-none">add</span>
                            </span>
                            Más
                          </button>
                        )}
                        <span className="flex items-center gap-1 text-[0.7rem] font-bold text-[#7D8A96]">
                          Huecos
                          <NivelesMasMenos onBajar={() => moverNiveles(claves(), -1)} onSubir={() => moverNiveles(claves(), 1)} de="todos los párrafos de este tema" />
                        </span>
                      </span>
                    </div>
                    {mas && masAbierto === clave && (
                      <PanelMas
                        tema={t.tema}
                        mas={mas}
                        opcion={masOpcion}
                        setOpcion={setMasOpcion}
                        cantidad={cantidadMas}
                        setCantidad={setMasCantidad}
                        cargando={masEstado?.clave === clave && masEstado.cargando}
                        error={masEstado?.clave === clave ? masEstado.error : undefined}
                        onPedir={() => void pedirMas(b.grupo, t.tema, cantidadMas)}
                        onCerrar={() => {
                          masAbort.current?.abort()
                          setMasEstado(null)
                          setMasAbierto(null)
                        }}
                      />
                    )}
                    {masEstado?.clave === clave && masEstado.mensaje && masAbierto !== clave && (
                      <p role="status" className="mb-1.5 text-[0.72rem] font-bold text-[#5E8C5A]">
                        {masEstado.mensaje}
                      </p>
                    )}
                    {!plegado && (
                      <div className="flex flex-col gap-2 pl-6">
                        {t.vis.map((p) => {
                          const esActivo = activo === p.key
                          return (
                            <Tarjeta
                              key={p.key}
                              p={p}
                              nivel={nivel}
                              temas={editando === p.key ? temas : SIN_TEMAS}
                              parecido={parecidos.get(p.key)}
                              activa={esActivo}
                              editando={editando === p.key}
                              huecoSeleccionado={esActivo ? (selActivo ?? undefined) : undefined}
                              registrar={registrar}
                              onActivar={activar}
                              onEditar={editar}
                              onCerrarEditor={cerrarEditor}
                              onCambiar={cambiar}
                              onQuitar={quitar}
                              onAviso={setAviso}
                              rehacible={!!rehacer}
                              rehaciendo={rehaciendo === p.key}
                              rehecho={rehechos.has(p.key)}
                              errorRehacer={erroresRehacer.get(p.key)}
                              bloqueo={bloqueoEn === p.key ? rehacer?.bloqueo : undefined}
                              onRehacer={rehacerParrafo}
                              onDeshacer={deshacer}
                              onCerrarBloqueo={cerrarBloqueo}
                            />
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          )
        })}
        {lista.length === 0 && <p className="py-8 text-center text-sm text-[#7D8A96]">No queda ningún párrafo.</p>}
      </div>

      <footer className="border-t border-[#7D8A96]/15 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-xs font-bold uppercase tracking-wide text-[#7D8A96]">Guardar en</span>
          {porLibro && (
            <label className="flex items-center gap-1.5 font-semibold text-[#2C3E50]">
              <input type="radio" checked={destino === 'porTema'} onChange={() => setDestino('porTema')} className="accent-[#E8A598]" />
              Un grupo por tema del libro
            </label>
          )}
          <label className="flex items-center gap-1.5 font-semibold text-[#2C3E50]">
            <input type="radio" checked={destino === 'nuevo'} onChange={() => setDestino('nuevo')} className="accent-[#E8A598]" />
            Grupo nuevo
          </label>
          <label className="flex items-center gap-1.5 font-semibold text-[#2C3E50]">
            <input type="radio" checked={destino === 'existente'} onChange={() => setDestino('existente')} className="accent-[#E8A598]" />
            Grupo que ya tengo
          </label>
          {comprobando && <span className="text-xs text-[#7D8A96]">Comprobando el grupo…</span>}
        </div>
        <div className="mt-2">
          {destino === 'nuevo' && (
            <>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value.slice(0, 80))}
                aria-label="Nombre del grupo nuevo"
                className="w-full rounded-xl border border-[#7D8A96]/25 bg-[#FAF7F4] px-3 py-2 text-sm font-semibold text-[#2C3E50] outline-none focus:border-[#E8A598]"
              />
              {grupos?.some((g) => mismoNombre(g.name, nombre)) && (
                <p className="mt-1 text-xs text-[#7D8A96]">Ya tienes un grupo con ese nombre: se añadirán a él.</p>
              )}
            </>
          )}
          {destino === 'existente' &&
            (grupos === null ? (
              <p className="text-xs text-[#7D8A96]">Cargando tus grupos…</p>
            ) : grupos.length === 0 ? (
              <p className="text-xs text-[#7D8A96]">Aún no tienes grupos de resúmenes.</p>
            ) : (
              <select
                value={elegido}
                onChange={(e) => setElegido(e.target.value)}
                aria-label="Grupo existente"
                className="w-full rounded-xl border border-[#7D8A96]/25 bg-[#FAF7F4] px-3 py-2 text-sm font-semibold text-[#2C3E50] outline-none"
              >
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.total})
                  </option>
                ))}
              </select>
            ))}
        </div>
        {excesos.map((e) => (
          <p key={`${e.grupo}:${e.hash}`} role="alert" className="mt-2 rounded-xl bg-[#FAEAED] px-3 py-2 text-[0.78rem] font-semibold text-[#B04A5E]" data-aviso-tope>
            Texto original: de este documento ya hay {fmt(e.usado)} caracteres en «{e.grupo}» y estos párrafos añaden {fmt(e.nuevos)}; el máximo es {fmt(e.tope)} (el 30 % del
            documento). Quita párrafos (sobran {fmt(e.sobran)} caracteres) o guárdalos en otro grupo.
          </p>
        ))}
        {error && <p className="mt-2 text-sm font-bold text-[#B04A5E]">{error}</p>}
        <div className="mt-3 flex items-center justify-end gap-3">
          {onVolver && (
            <button type="button" onClick={onVolver} className="mr-auto text-sm font-bold text-[#7D8A96] hover:text-[#2C3E50]">
              ← Otros ajustes
            </button>
          )}
          <button type="button" onClick={onCerrar} className="rounded-2xl px-4 py-2.5 text-sm font-bold text-[#7D8A96] hover:text-[#2C3E50]">
            Cerrar (queda el borrador)
          </button>
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={!marcados.length || !!guardando || excesos.length > 0 || (destino === 'nuevo' && nombre.trim().length < 3) || (destino === 'existente' && !elegido)}
            className="flex items-center gap-2 rounded-2xl bg-[#E8A598] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ border: `2px solid ${INK}`, boxShadow: `3px 3px 0 0 ${INK}` }}
          >
            <span className="material-symbols-outlined text-[20px]">save</span>
            {guardando ?? `Guardar ${marcados.length} ${marcados.length === 1 ? 'párrafo' : 'párrafos'}`}
          </button>
        </div>
      </footer>
    </>
  )
}

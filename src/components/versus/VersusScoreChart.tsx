'use client'

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { VersusPlayer, VersusSeries } from '@/lib/versus/types'

type VersusScoreChartProps = {
  series: VersusSeries[]
  players: VersusPlayer[]
  playerId: string | null
}

// Paleta categórica validada contra la superficie blanca de la tarjeta: banda
// de luminosidad, suelo de croma, separación para daltonismo y suelo de visión
// normal. El ORDEN es el mecanismo de seguridad, no decoración: se asigna por
// posición y NUNCA se cicla. Si hubiera más jugadores que colores, se recortan
// series en vez de repetir un color.
const SERIES_COLORS = [
  '#2a78d6', // azul
  '#eb6834', // naranja
  '#1baf7a', // aguamarina
  '#eda100', // amarillo
  '#e87ba4', // magenta
  '#008300', // verde
  '#4a3aa7', // violeta
  '#e34948', // rojo
] as const

const MAX_SERIES = SERIES_COLORS.length

const INK = '#2c3e50'
const MUTED = '#7D8A96'
const GRID = '#EAE4E2'
const SURFACE = '#ffffff'

const HEIGHT = 240
const PAD = { top: 16, right: 56, bottom: 28, left: 44 }

// Medir ANTES del pintado, para que no haya un fotograma con el SVG desbordando
// su hueco. En el servidor no hay layout que medir, así que allí cae a useEffect
// (que no llega a ejecutarse) y evita el aviso de React.
const useMeasureEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

// Trazado con arranque y frenada (no lineal), y cada jugador entrando algo
// después que el anterior, para poder seguir una línea a la vez en vez de ver
// todas dispararse a la vez.
const DRAW_MS = 2600
const STAGGER_MS = 500
const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)'

const LINE_WIDTH = 5
const DOT_RADIUS = 6

// Separación mínima entre rótulos del final. Cuando dos líneas acaban juntas
// los números se pisan (y con eso no se lee ninguno de los dos). A 11px de
// fuente la caja del texto mide 14, así que esto deja aire de sobra.
const LABEL_GAP = 17

// Quien ha pedido menos movimiento en el sistema ve el gráfico ya dibujado.
// Es un almacén externo, no estado propio: leerlo así lo hace seguro en SSR y
// además responde si el usuario cambia la preferencia con la página abierta.
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function useReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION)
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  )
}

function niceCeil(value: number) {
  if (value <= 0) return 100
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return Math.ceil(value / magnitude) * magnitude
}

// Interpolación cúbica MONÓTONA (Fritsch–Carlson). La suavidad normal (una
// spline de Catmull-Rom, por ejemplo) se pasa de largo al cambiar la pendiente,
// y aquí eso sería mentir: la puntuación es acumulada y NUNCA baja, así que un
// sobrepaso dibujaría una bajada que no ocurrió. Esta preserva la monotonía —
// lo plano se queda plano y lo que sube solo sube.
function monotonePath(points: { x: number; y: number }[]) {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  const n = points.length
  const dx: number[] = []
  const slope: number[] = []

  for (let i = 0; i < n - 1; i += 1) {
    const h = points[i + 1].x - points[i].x
    dx.push(h)
    slope.push(h === 0 ? 0 : (points[i + 1].y - points[i].y) / h)
  }

  // Tangente inicial en cada punto: media de las pendientes vecinas.
  const m: number[] = [slope[0]]
  for (let i = 1; i < n - 1; i += 1) m.push((slope[i - 1] + slope[i]) / 2)
  m.push(slope[n - 2])

  // Y aquí está el truco que evita el sobrepaso: donde el tramo es plano la
  // tangente se fuerza a 0, y en el resto se recorta al círculo de radio 3.
  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i] / slope[i]
    const b = m[i + 1] / slope[i]
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      m[i] = t * a * slope[i]
      m[i + 1] = t * b * slope[i]
    }
  }

  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i] / 3
    d += ` C ${points[i].x + h} ${points[i].y + m[i] * h}`
    d += ` ${points[i + 1].x - h} ${points[i + 1].y - m[i + 1] * h}`
    d += ` ${points[i + 1].x} ${points[i + 1].y}`
  }
  return d
}

export default function VersusScoreChart({
  series,
  players,
  playerId,
}: VersusScoreChartProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState<number | null>(null)
  const instant = useReducedMotion()

  // Se mide el ancho real en vez de escalar un viewBox: escalar encogería
  // también el texto, y en móvil los rótulos quedarían ilegibles.
  //
  // La medida directa es la que manda; ResizeObserver es solo un extra para
  // cuando cambia el hueco sin cambiar la ventana. No se depende de él: hay
  // entornos donde no llega a dispararse y el gráfico se quedaría con el ancho
  // por defecto, desbordando su tarjeta.
  useMeasureEffect(() => {
    const node = wrapRef.current
    if (!node) return

    const measure = () => setWidth(Math.max(280, Math.round(node.clientWidth)))
    measure()

    window.addEventListener('resize', measure)

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure)
      observer.observe(node)
    }

    return () => {
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [])

  const chart = useMemo(() => {
    const byId = new Map(players.map((p) => [p.id, p]))

    // Orden por puntuación final: los colores se reparten por posición fija.
    const ranked = [...series]
      .filter((s) => byId.has(s.playerId))
      .sort((a, b) => (b.points.at(-1) ?? 0) - (a.points.at(-1) ?? 0))

    // Nunca se cicla la paleta. Si sobra gente, se recorta dejando siempre al
    // jugador que mira, para que pueda compararse aunque no esté arriba.
    let shown = ranked.slice(0, MAX_SERIES)
    const hidden = ranked.length - shown.length
    if (hidden > 0 && playerId && !shown.some((s) => s.playerId === playerId)) {
      const mine = ranked.find((s) => s.playerId === playerId)
      if (mine) shown = [...shown.slice(0, MAX_SERIES - 1), mine]
    }

    const rounds = shown[0]?.points.length ?? 0
    const top = niceCeil(Math.max(1, ...shown.flatMap((s) => s.points)))

    return { shown, hidden, rounds, top, byId }
  }, [series, players, playerId])

  const { shown, hidden, rounds, top, byId } = chart

  if (shown.length === 0 || rounds === 0) return null

  const innerW = Math.max(1, width - PAD.left - PAD.right)
  const innerH = HEIGHT - PAD.top - PAD.bottom

  // El eje arranca en 0 = "antes de empezar", para que se vea el despegue.
  const x = (round: number) => PAD.left + (innerW * round) / rounds
  const y = (value: number) => PAD.top + innerH - (innerH * value) / top

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(top * f))

  // Con pocas series caben rótulos al final de cada línea; con muchas se
  // amontonarían y manda la leyenda.
  const directLabels = shown.length <= 4

  // Reparto de los rótulos del final. Cuando dos jugadores acaban con
  // puntuaciones parecidas sus números se pisan y no se lee ninguno, así que se
  // separan y se les dibuja un tirante hasta su línea: sin el tirante, un
  // número movido deja de pertenecer a nada.
  const labelSlots = (() => {
    if (!directLabels) return []

    const sorted = shown
      .map((serie, index) => ({
        index,
        value: serie.points.at(-1) ?? 0,
        anchor: y(serie.points.at(-1) ?? 0),
      }))
      .sort((a, b) => a.anchor - b.anchor)

    const top = PAD.top + 6
    const bottom = PAD.top + innerH - 2
    const at = sorted.map((slot) => slot.anchor)

    // Tres pasadas en vez de una: empujar hacia abajo, y luego recolocar contra
    // cada borde. Con una sola pasada, dos rótulos juntos al fondo del gráfico
    // se salían por abajo, y moverlos en bloque sacaba a los de arriba.
    for (let i = 1; i < at.length; i += 1) {
      at[i] = Math.max(at[i], at[i - 1] + LABEL_GAP)
    }
    if (at.length > 0 && at[at.length - 1] > bottom) {
      at[at.length - 1] = bottom
      for (let i = at.length - 2; i >= 0; i -= 1) {
        at[i] = Math.min(at[i], at[i + 1] - LABEL_GAP)
      }
    }
    if (at.length > 0 && at[0] < top) {
      at[0] = top
      for (let i = 1; i < at.length; i += 1) {
        at[i] = Math.max(at[i], at[i - 1] + LABEL_GAP)
      }
    }

    return sorted.map((slot, i) => ({ ...slot, at: at[i] }))
  })()

  function handleMove(event: React.MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - rect.left
    const ratio = (px - PAD.left) / innerW
    const round = Math.round(ratio * rounds)
    setHover(round >= 0 && round <= rounds ? round : null)
  }

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-[#7D8A96]/70">
        Cómo se decidió
      </h2>

      {/* El ancho se mide, pero si por lo que sea la medida se queda vieja (una
          rotación de pantalla que no dispare ningún evento), el gráfico scrollea
          dentro de su caja en vez de reventar el ancho de la página. */}
      <style>{`
        @keyframes versus-draw { from { stroke-dashoffset: 1.02 } to { stroke-dashoffset: 0 } }
        @keyframes versus-fade { from { opacity: 0 } to { opacity: 1 } }
      `}</style>

      <div ref={wrapRef} className="w-full overflow-x-auto">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label="Evolución de la puntuación acumulada de cada jugador"
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* Rejilla: un pelo, sólida y discreta */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={PAD.left + innerW}
                y1={y(tick)}
                y2={y(tick)}
                stroke={GRID}
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(tick) + 4}
                textAnchor="end"
                fontSize={11}
                fill={MUTED}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {tick}
              </text>
            </g>
          ))}

          {/* Eje X: solo los extremos y el punto sobre el que se pasa */}
          {[0, rounds].map((round) => (
            <text
              key={round}
              x={x(round)}
              y={HEIGHT - 8}
              textAnchor={round === 0 ? 'start' : 'end'}
              fontSize={11}
              fill={MUTED}
            >
              {round === 0 ? 'Inicio' : `P${round}`}
            </text>
          ))}

          {hover !== null && hover > 0 && hover < rounds ? (
            <text x={x(hover)} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill={MUTED}>
              P{hover}
            </text>
          ) : null}

          {/* Guía vertical del puntero */}
          {hover !== null ? (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke={MUTED}
              strokeWidth={1}
              strokeOpacity={0.35}
            />
          ) : null}

          {shown.map((serie, index) => {
            const color = SERIES_COLORS[index]
            const path = monotonePath(
              [0, ...serie.points].map((value, round) => ({ x: x(round), y: y(value) })),
            )
            const last = serie.points.at(-1) ?? 0
            const delay = index * STAGGER_MS
            const slot = labelSlots.find((s) => s.index === index)
            const nudged = slot ? Math.abs(slot.at - slot.anchor) > 1 : false

            return (
              <g key={serie.playerId}>
                {/* pathLength=1 normaliza el largo del trazo, así se puede
                    animar el dibujado sin medirlo en el DOM. */}
                {/* pathLength=1 normaliza el largo del trazo, así se puede
                    animar el dibujado sin medirlo en el DOM. El estado natural
                    es "dibujado" y la animación solo lo retrasa: si por lo que
                    sea no llegara a ejecutarse, el gráfico se ve igual. */}
                <path
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth={LINE_WIDTH}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  pathLength={1}
                  // Un pelín por encima de 1 a propósito: con el guion medido
                  // justo al largo del trazo, el redondeo deja a veces un
                  // mordisco en el último píxel, y con la línea gorda se ve.
                  strokeDasharray={1.02}
                  strokeDashoffset={0}
                  style={
                    instant
                      ? undefined
                      : { animation: `versus-draw ${DRAW_MS}ms ${EASE} ${delay}ms both` }
                  }
                />

                {/* Lo del final aparece cuando su línea ha terminado de
                    dibujarse, no antes. */}
                <g
                  style={
                    instant
                      ? undefined
                      : {
                          animation: `versus-fade 260ms ease-out ${
                            delay + DRAW_MS - 120
                          }ms both`,
                        }
                  }
                >
                  {/* Marcador final con anillo del color de la superficie, para
                      que siga leyéndose donde dos líneas se cruzan */}
                  <circle
                    cx={x(rounds)}
                    cy={y(last)}
                    r={DOT_RADIUS}
                    fill={color}
                    stroke={SURFACE}
                    strokeWidth={2}
                  />

                  {slot ? (
                    <>
                      {/* Tirante en gris fino, NO en el color de la serie: en
                          color se leía como si la línea siguiera bajando, justo
                          lo contrario de lo que dicen los datos. */}
                      {nudged ? (
                        <line
                          x1={x(rounds) + DOT_RADIUS + 1}
                          y1={slot.anchor}
                          x2={x(rounds) + DOT_RADIUS + 7}
                          y2={slot.at}
                          stroke={MUTED}
                          strokeWidth={1}
                          strokeOpacity={0.5}
                        />
                      ) : null}
                      <text
                        x={x(rounds) + DOT_RADIUS + (nudged ? 10 : 4)}
                        y={slot.at + 4}
                        fontSize={11}
                        fontWeight={700}
                        fill={INK}
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {slot.value}
                      </text>
                    </>
                  ) : null}
                </g>

                {hover !== null ? (
                  <circle
                    cx={x(hover)}
                    cy={y(hover === 0 ? 0 : (serie.points[hover - 1] ?? 0))}
                    r={DOT_RADIUS}
                    fill={color}
                    stroke={SURFACE}
                    strokeWidth={2}
                  />
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Leyenda: siempre con dos o más series. La identidad nunca depende solo
          del color, y el texto va en tinta, no en el color de la serie. */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {shown.map((serie, index) => {
          const player = byId.get(serie.playerId)
          const isMe = serie.playerId === playerId
          return (
            <li key={serie.playerId} className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-1 w-5 rounded-full"
                style={{ backgroundColor: SERIES_COLORS[index] }}
              />
              <span className={`text-xs ${isMe ? 'font-bold text-[#2c3e50]' : 'text-[#7D8A96]'}`}>
                {player?.nickname ?? 'Jugador'}
                {hover !== null ? (
                  <span className="ml-1 tabular-nums text-[#2c3e50]">
                    {hover === 0 ? 0 : (serie.points[hover - 1] ?? 0)}
                  </span>
                ) : null}
              </span>
            </li>
          )
        })}
        {hidden > 0 ? (
          <li className="text-xs text-[#7D8A96]/70">y {hidden} más</li>
        ) : null}
      </ul>
    </section>
  )
}

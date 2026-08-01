'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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

function niceCeil(value: number) {
  if (value <= 0) return 100
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return Math.ceil(value / magnitude) * magnitude
}

export default function VersusScoreChart({
  series,
  players,
  playerId,
}: VersusScoreChartProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState<number | null>(null)

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

  function handleMove(event: React.MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - rect.left
    const ratio = (px - PAD.left) / innerW
    const round = Math.round(ratio * rounds)
    setHover(round >= 0 && round <= rounds ? round : null)
  }

  return (
    <section className="mt-8">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wider text-[#7D8A96]/70">
        Cómo se decidió
      </h2>
      <p className="mb-4 text-xs text-[#7D8A96]">
        Puntuación acumulada tras cada pregunta. Una fallada suma 0 y la línea se
        queda plana.
      </p>

      {/* El ancho se mide, pero si por lo que sea la medida se queda vieja (una
          rotación de pantalla que no dispare ningún evento), el gráfico scrollea
          dentro de su caja en vez de reventar el ancho de la página. */}
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
            const path = [0, ...serie.points]
              .map((value, round) => `${round === 0 ? 'M' : 'L'} ${x(round)} ${y(value)}`)
              .join(' ')
            const last = serie.points.at(-1) ?? 0

            return (
              <g key={serie.playerId}>
                <path
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {/* Marcador final con anillo del color de la superficie, para
                    que siga leyéndose donde dos líneas se cruzan */}
                <circle
                  cx={x(rounds)}
                  cy={y(last)}
                  r={4}
                  fill={color}
                  stroke={SURFACE}
                  strokeWidth={2}
                />
                {hover !== null ? (
                  <circle
                    cx={x(hover)}
                    cy={y(hover === 0 ? 0 : (serie.points[hover - 1] ?? 0))}
                    r={4}
                    fill={color}
                    stroke={SURFACE}
                    strokeWidth={2}
                  />
                ) : null}
                {directLabels ? (
                  <text
                    x={x(rounds) + 8}
                    y={y(last) + 4}
                    fontSize={11}
                    fontWeight={700}
                    fill={INK}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {last}
                  </text>
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
                className="h-0.5 w-4 rounded-full"
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

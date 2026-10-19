'use client'

import { useState } from 'react'
import type { GuideTopicWithStats } from '@/lib/studyGuides/stats'
import { TIER_STYLES, cssVars } from '@/components/library/guide/guideStyles'
import GuideReveal from '@/components/library/guide/GuideReveal'

type GuideEffortMatrixProps = {
  topics: GuideTopicWithStats[]
}

type LabelOffset = { dx: number; dy: number; anchor: 'start' | 'end' | 'middle' }
type Box = { x1: number; y1: number; x2: number; y2: number }

const WIDTH = 640
const HEIGHT = 400
const PAD = { top: 20, right: 24, bottom: 48, left: 52 }
// Escala de los ejes: mínimos (crecen si algún tema es más largo o más preguntado), paso de las marcas,
// divisiones de los cuadrantes y, por debajo de `labelMin` preguntas, temas agrupados en una sola etiqueta.
// Las asignaturas pequeñas (ningún tema pasa de la mitad de la escala normal) usan la escala reducida;
// si no, sus puntos quedarían amontonados en la esquina de «Pasada rápida».
type Scale = { minPages: number; pageStep: number; minQuestions: number; questionStep: number; splitPages: number; splitQuestions: number; labelMin: number }
const SCALE_NORMAL: Scale = { minPages: 28, pageStep: 7, minQuestions: 20, questionStep: 10, splitPages: 12, splitQuestions: 10, labelMin: 6 }
const SCALE_SMALL: Scale = { minPages: 10, pageStep: 2, minQuestions: 10, questionStep: 2, splitPages: 5, splitQuestions: 5, labelMin: 3 }
const LABEL_FONT = 12
const CHAR_WIDTH = 7.4

// Ajustes a mano (Neurología); el resto de temas se colocan solos sin pisarse.
const LABEL_OFFSETS: Record<string, LabelOffset> = {
  neurocirugia: { dx: -12, dy: 4, anchor: 'end' },
  ictus: { dx: 12, dy: 4, anchor: 'start' },
  semiologia: { dx: 0, dy: 24, anchor: 'middle' },
  movimiento: { dx: -12, dy: -6, anchor: 'end' },
  epilepsia: { dx: 12, dy: 4, anchor: 'start' },
  'autoinmunes-snc': { dx: -12, dy: 4, anchor: 'end' },
  demencias: { dx: 12, dy: 12, anchor: 'start' },
  cefalea: { dx: -12, dy: 4, anchor: 'end' },
}

// Posiciones candidatas, en orden de preferencia, para las etiquetas automáticas.
const CANDIDATES: LabelOffset[] = [
  { dx: 12, dy: 4, anchor: 'start' },
  { dx: -12, dy: 4, anchor: 'end' },
  { dx: 0, dy: -13, anchor: 'middle' },
  { dx: 0, dy: 22, anchor: 'middle' },
  { dx: 12, dy: -8, anchor: 'start' },
  { dx: -12, dy: -8, anchor: 'end' },
  { dx: 12, dy: 16, anchor: 'start' },
  { dx: -12, dy: 16, anchor: 'end' },
]

function labelBox(cx: number, cy: number, offset: LabelOffset, text: string): Box {
  const width = text.length * CHAR_WIDTH + 2
  const x = cx + offset.dx
  const x1 = offset.anchor === 'start' ? x : offset.anchor === 'end' ? x - width : x - width / 2
  const baseline = cy + offset.dy
  return { x1, y1: baseline - LABEL_FONT + 2, x2: x1 + width, y2: baseline + 3 }
}

function overlaps(a: Box, b: Box) {
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2
}

export default function GuideEffortMatrix({ topics }: GuideEffortMatrixProps) {
  // Tema bajo el cursor (o con el foco): su nombre se resalta encima de todo.
  const [activeId, setActiveId] = useState<string | null>(null)
  const topPages = Math.max(...topics.map((topic) => topic.pages))
  const topQuestions = Math.max(...topics.map((topic) => topic.stats.historyCount))
  const small = topPages <= SCALE_NORMAL.minPages / 2 && topQuestions <= SCALE_NORMAL.minQuestions / 2
  const scale = small ? SCALE_SMALL : SCALE_NORMAL
  const maxPages = Math.max(scale.minPages, Math.ceil(topPages / scale.pageStep) * scale.pageStep)
  const maxQuestions = Math.max(scale.minQuestions, Math.ceil(topQuestions / scale.questionStep) * scale.questionStep)
  const x = (pages: number) => PAD.left + (pages / maxPages) * (WIDTH - PAD.left - PAD.right)
  const y = (questions: number) => HEIGHT - PAD.bottom - (questions / maxQuestions) * (HEIGHT - PAD.top - PAD.bottom)
  const xTicks = Array.from({ length: maxPages / scale.pageStep + 1 }, (_, i) => i * scale.pageStep)
  const yTicks = Array.from({ length: maxQuestions / scale.questionStep + 1 }, (_, i) => i * scale.questionStep)
  // Proporción entre la escala usada y la normal, para colocar el aviso de temas menores en el mismo sitio relativo.
  const ratio = scale.minPages / SCALE_NORMAL.minPages

  const splitX = x(scale.splitPages)
  const splitY = y(scale.splitQuestions)
  const minorCount = topics.filter((topic) => topic.stats.historyCount < scale.labelMin).length

  // Separa los puntos que caen exactamente en el mismo sitio.
  const sameSpot = new Map<string, string[]>()
  for (const topic of topics) {
    const key = `${topic.pages}|${topic.stats.historyCount}`
    sameSpot.set(key, [...(sameSpot.get(key) ?? []), topic.id])
  }
  const points = topics.map((topic) => {
    const group = sameSpot.get(`${topic.pages}|${topic.stats.historyCount}`) ?? [topic.id]
    const nudge = group.length > 1 ? (group.indexOf(topic.id) - (group.length - 1) / 2) * 0.7 : 0
    const major = topic.stats.historyCount >= scale.labelMin
    return { topic, cx: x(topic.pages + nudge), cy: y(topic.stats.historyCount), r: major ? 8 : 5.5, major }
  })

  // Coloca las etiquetas de mayor a menor peso evitando otras etiquetas, puntos y bordes.
  const placed: Box[] = []
  // Solo las etiquetas que se ven en reposo (las de los temas menores aparecen al pasar el cursor).
  const visibleLabels: Box[] = []
  const labels = new Map<string, LabelOffset>()
  const pointBoxes = points.map((p) => ({ id: p.topic.id, box: { x1: p.cx - p.r, y1: p.cy - p.r, x2: p.cx + p.r, y2: p.cy + p.r } }))
  // Rótulos fijos del gráfico (cuadrantes y aviso de temas menores): las etiquetas no deben pisarlos.
  const textBox = (tx: number, ty: number, text: string, anchor: 'start' | 'end', size = 12): Box => {
    const width = text.length * size * 0.6
    const x1 = anchor === 'start' ? tx : tx - width
    return { x1, y1: ty - size + 2, x2: x1 + width, y2: ty + 3 }
  }
  // Los rótulos de los cuadrantes inferiores bajan al pie del gráfico si tienen algún punto encima.
  const lowY = (tx: number, text: string) => {
    const box = textBox(tx, splitY + 22, text, 'end')
    return pointBoxes.some((pb) => overlaps(box, pb.box)) ? HEIGHT - PAD.bottom - 8 : splitY + 22
  }
  const pocoRentableY = lowY(WIDTH - PAD.right - 10, 'Poco rentable')
  const pasadaRapidaY = lowY(splitX - 10, 'Pasada rápida')
  const fixedBoxes: Box[] = [
    textBox(PAD.left + 10, PAD.top + 18, 'Máxima rentabilidad', 'start'),
    textBox(PAD.left + 10, PAD.top + 33, 'poco temario, muchas preguntas', 'start', 10.5),
    textBox(WIDTH - PAD.right - 10, PAD.top + 18, 'Pilares', 'end'),
    textBox(WIDTH - PAD.right - 10, PAD.top + 33, 'mucho temario, pero cae siempre', 'end', 10.5),
    textBox(WIDTH - PAD.right - 10, pocoRentableY, 'Poco rentable', 'end'),
    textBox(splitX - 10, pasadaRapidaY, 'Pasada rápida', 'end'),
  ]
  const inside = (box: Box) => box.x1 >= PAD.left + 2 && box.x2 <= WIDTH - PAD.right && box.y1 >= PAD.top && box.y2 <= HEIGHT - PAD.bottom
  // Primero los temas con nombre visible; los menores solo lo muestran al pasar el cursor.
  const byWeight = [...points].sort((a, b) => Number(b.major) - Number(a.major) || b.topic.stats.historyCount - a.topic.stats.historyCount)
  for (const p of byWeight) {
    const manual = LABEL_OFFSETS[p.topic.id]
    const options = manual ? [manual] : CANDIDATES
    // Número de choques de cada posición; se queda con la primera sin choques o, si no hay, con la que menos tenga.
    const clashes = (offset: LabelOffset) => {
      const box = labelBox(p.cx, p.cy, offset, p.topic.shortName)
      return (
        (inside(box) ? 0 : 10) +
        placed.filter((other) => overlaps(box, other)).length * 3 +
        pointBoxes.filter((pb) => pb.id !== p.topic.id && overlaps(box, pb.box)).length * 2 +
        fixedBoxes.filter((other) => overlaps(box, other)).length
      )
    }
    const chosen = manual ?? options.reduce((best, option) => (clashes(option) < clashes(best) ? option : best))
    labels.set(p.topic.id, chosen)
    placed.push(labelBox(p.cx, p.cy, chosen, p.topic.shortName))
    if (p.major) visibleLabels.push(labelBox(p.cx, p.cy, chosen, p.topic.shortName))
  }

  // Aviso de temas menores: en su sitio de siempre o, si pisa algo, desplazado a la derecha hasta quedar libre.
  const minorText = `← ${minorCount} ${minorCount === 1 ? 'tema menor' : 'temas menores'}`
  const minorY = y(2 * ratio) + 4
  let minorX = x(6.8 * ratio)
  for (let dx = 0; dx < WIDTH; dx += 4) {
    const box = textBox(x(6.8 * ratio) + dx, minorY, minorText, 'start', 11)
    const free = !pointBoxes.some((pb) => overlaps(box, pb.box)) && !visibleLabels.some((other) => overlaps(box, other)) && !fixedBoxes.some((other) => overlaps(box, other))
    if (free && box.x2 <= WIDTH - PAD.right) {
      minorX = box.x1
      break
    }
  }

  return (
    <GuideReveal className="flex flex-col gap-3">
      <div className="-mx-1 overflow-x-auto px-1">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full min-w-[480px]"
          role="img"
          aria-label="Esfuerzo (páginas) frente a recompensa (preguntas MIR) de cada tema"
        >
          <rect x={PAD.left} y={PAD.top} width={splitX - PAD.left} height={splitY - PAD.top} fill="#8BA888" fillOpacity={0.08} rx={10} />
          <rect x={splitX} y={PAD.top} width={WIDTH - PAD.right - splitX} height={splitY - PAD.top} fill="#E8A598" fillOpacity={0.07} rx={10} />

          <text x={PAD.left + 10} y={PAD.top + 18} className="fill-[#5E7D5B] text-[12px] font-bold">
            Máxima rentabilidad
          </text>
          <text x={PAD.left + 10} y={PAD.top + 33} className="fill-[#7D8A96] text-[10.5px]">
            poco temario, muchas preguntas
          </text>
          <text x={WIDTH - PAD.right - 10} y={PAD.top + 18} textAnchor="end" className="fill-[#B5655A] text-[12px] font-bold">
            Pilares
          </text>
          <text x={WIDTH - PAD.right - 10} y={PAD.top + 33} textAnchor="end" className="fill-[#7D8A96] text-[10.5px]">
            mucho temario, pero cae siempre
          </text>
          <text x={WIDTH - PAD.right - 10} y={pocoRentableY} textAnchor="end" className="fill-[#7D8A96] text-[12px] font-bold">
            Poco rentable
          </text>
          <text x={splitX - 10} y={pasadaRapidaY} textAnchor="end" className="fill-[#7D8A96] text-[12px] font-bold">
            Pasada rápida
          </text>

          <line x1={PAD.left} y1={HEIGHT - PAD.bottom} x2={WIDTH - PAD.right} y2={HEIGHT - PAD.bottom} stroke="#2C3E50" strokeOpacity={0.25} />
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={HEIGHT - PAD.bottom} stroke="#2C3E50" strokeOpacity={0.25} />

          {xTicks.map((tick) => (
            <text key={`x-${tick}`} x={x(tick)} y={HEIGHT - PAD.bottom + 16} textAnchor="middle" className="fill-[#7D8A96] text-[10.5px]">
              {tick}
            </text>
          ))}
          {yTicks.map((tick) => (
            <text key={`y-${tick}`} x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" className="fill-[#7D8A96] text-[10.5px]">
              {tick}
            </text>
          ))}
          <text x={(PAD.left + WIDTH - PAD.right) / 2} y={HEIGHT - 8} textAnchor="middle" className="fill-[#2C3E50] text-[11.5px] font-semibold">
            Esfuerzo → páginas de temario
          </text>
          <text
            x={14}
            y={(PAD.top + HEIGHT - PAD.bottom) / 2}
            textAnchor="middle"
            transform={`rotate(-90 14 ${(PAD.top + HEIGHT - PAD.bottom) / 2})`}
            className="fill-[#2C3E50] text-[11.5px] font-semibold"
          >
            Recompensa → preguntas 2015–2025
          </text>

          {points.map(({ topic, cx, cy, r }, index) => (
            <a
              key={topic.id}
              href={`#tema-${topic.id}`}
              onMouseEnter={() => setActiveId(topic.id)}
              onMouseLeave={() => setActiveId((current) => (current === topic.id ? null : current))}
              onFocus={() => setActiveId(topic.id)}
              onBlur={() => setActiveId((current) => (current === topic.id ? null : current))}
            >
              <title>{`${topic.name}: ${topic.stats.historyCount} preguntas, ~${topic.pages} páginas`}</title>
              <circle className="guia-pop cursor-pointer hover:[r:11]" style={cssVars({ '--i': index * 5 })} cx={cx} cy={cy} r={r} fill={TIER_STYLES[topic.tier].color} stroke="#fff" strokeWidth={2} />
            </a>
          ))}

          {/* Nombres semitransparentes en reposo; el del tema activo se pinta al final, opaco y con halo. */}
          <g className="pointer-events-none">
            {points.map(({ topic, cx, cy, major }) => {
              const offset = labels.get(topic.id)
              if (!offset || !major || topic.id === activeId) return null
              return (
                <text
                  key={topic.id}
                  x={cx + offset.dx}
                  y={cy + offset.dy}
                  textAnchor={offset.anchor}
                  opacity={activeId ? 0.2 : 0.5}
                  className="fill-[#2C3E50] text-[12px] font-semibold transition-opacity duration-200"
                >
                  {topic.shortName}
                </text>
              )
            })}
            {points
              .filter(({ topic }) => topic.id === activeId)
              .map(({ topic, cx, cy }) => {
                const offset = labels.get(topic.id)
                if (!offset) return null
                return (
                  <text
                    key={topic.id}
                    x={cx + offset.dx}
                    y={cy + offset.dy}
                    textAnchor={offset.anchor}
                    stroke="#fff"
                    strokeWidth={4}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    className="fill-[#2C3E50] text-[12.5px] font-bold"
                  >
                    {topic.shortName}
                  </text>
                )
              })}
          </g>

          {minorCount > 0 ? (
            <text x={minorX} y={minorY} className="fill-[#7D8A96] text-[11px]">
              {minorText}
            </text>
          ) : null}
        </svg>
      </div>
      <p className="text-xs text-[#7D8A96]">
        Cada punto es un tema. Cuanto más arriba y a la izquierda, más preguntas da por cada página que estudias.
      </p>
    </GuideReveal>
  )
}

import type { GuideTopicWithStats } from '@/lib/studyGuides/stats'
import { TIER_STYLES, cssVars } from '@/components/library/guide/guideStyles'
import GuideReveal from '@/components/library/guide/GuideReveal'

type GuideEffortMatrixProps = {
  topics: GuideTopicWithStats[]
}

const WIDTH = 640
const HEIGHT = 400
const PAD = { top: 20, right: 24, bottom: 48, left: 52 }
const MAX_PAGES = 28
const MAX_QUESTIONS = 40
// Por debajo de este número de preguntas los temas se agrupan en una sola etiqueta.
const LABEL_MIN_QUESTIONS = 8

// Ajustes de posición de etiqueta para que no se pisen los temas cercanos.
const LABEL_OFFSETS: Record<string, { dx: number; dy: number; anchor: 'start' | 'end' | 'middle' }> = {
  neurocirugia: { dx: -12, dy: 4, anchor: 'end' },
  ictus: { dx: 12, dy: 4, anchor: 'start' },
  semiologia: { dx: 0, dy: 24, anchor: 'middle' },
  movimiento: { dx: -12, dy: -6, anchor: 'end' },
  epilepsia: { dx: 12, dy: 4, anchor: 'start' },
  'autoinmunes-snc': { dx: -12, dy: 4, anchor: 'end' },
  demencias: { dx: 12, dy: 12, anchor: 'start' },
  cefalea: { dx: -12, dy: 4, anchor: 'end' },
}

// Separa ligeramente puntos con coordenadas idénticas.
const POINT_NUDGE: Record<string, number> = {
  'autoinmunes-snc': -0.35,
  demencias: 0.35,
  nutricionales: -0.3,
  coma: 0.3,
}

function x(pages: number) {
  return PAD.left + (pages / MAX_PAGES) * (WIDTH - PAD.left - PAD.right)
}

function y(questions: number) {
  return HEIGHT - PAD.bottom - (questions / MAX_QUESTIONS) * (HEIGHT - PAD.top - PAD.bottom)
}

export default function GuideEffortMatrix({ topics }: GuideEffortMatrixProps) {
  const splitX = x(12)
  const splitY = y(10)
  const minorCount = topics.filter((topic) => topic.stats.historyCount < LABEL_MIN_QUESTIONS).length

  return (
    <GuideReveal className="flex flex-col gap-3">
      <div className="-mx-1 overflow-x-auto px-1">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full min-w-[520px]"
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
          <text x={WIDTH - PAD.right - 10} y={splitY + 22} textAnchor="end" className="fill-[#7D8A96] text-[12px] font-bold">
            Poco rentable
          </text>
          <text x={splitX - 10} y={splitY + 22} textAnchor="end" className="fill-[#7D8A96] text-[12px] font-bold">
            Pasada rápida
          </text>

          <line x1={PAD.left} y1={HEIGHT - PAD.bottom} x2={WIDTH - PAD.right} y2={HEIGHT - PAD.bottom} stroke="#2C3E50" strokeOpacity={0.25} />
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={HEIGHT - PAD.bottom} stroke="#2C3E50" strokeOpacity={0.25} />

          {[0, 7, 14, 21, 28].map((tick) => (
            <text key={`x-${tick}`} x={x(tick)} y={HEIGHT - PAD.bottom + 16} textAnchor="middle" className="fill-[#7D8A96] text-[10.5px]">
              {tick}
            </text>
          ))}
          {[0, 10, 20, 30, 40].map((tick) => (
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

          {topics.map((topic, index) => {
            const cx = x(topic.pages + (POINT_NUDGE[topic.id] ?? 0))
            const cy = y(topic.stats.historyCount)
            const offset = LABEL_OFFSETS[topic.id]
            const showLabel = topic.stats.historyCount >= LABEL_MIN_QUESTIONS && offset
            return (
              <g key={topic.id}>
                <a href={`#tema-${topic.id}`}>
                  <title>{`${topic.name}: ${topic.stats.historyCount} preguntas, ~${topic.pages} páginas`}</title>
                  <circle className="guia-pop cursor-pointer hover:[r:11]" style={cssVars({ '--i': index * 5 })} cx={cx} cy={cy} r={topic.stats.historyCount >= LABEL_MIN_QUESTIONS ? 8 : 5.5} fill={TIER_STYLES[topic.tier].color} stroke="#fff" strokeWidth={2} />
                </a>
                {showLabel ? (
                  <text x={cx + offset.dx} y={cy + offset.dy} textAnchor={offset.anchor} className="fill-[#2C3E50] text-[12px] font-semibold">
                    {topic.shortName}
                  </text>
                ) : null}
              </g>
            )
          })}

          <text x={x(6.8)} y={y(2) + 4} className="fill-[#7D8A96] text-[11px]">
            {`← ${minorCount} temas menores`}
          </text>
        </svg>
      </div>
      <p className="text-xs text-[#7D8A96]">
        Cada punto es un tema. Cuanto más arriba y a la izquierda, más preguntas da por cada página que estudias.
      </p>
    </GuideReveal>
  )
}

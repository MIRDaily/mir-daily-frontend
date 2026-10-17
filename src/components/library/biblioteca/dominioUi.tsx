'use client'

/* ════════════════════════════════════════════════════════════════════════
   Señal de dominio del material propio en la Biblioteca (fase 3, §7.2).
   Va SIEMPRE dentro de «Tu material» y con su propio color (azul cielo, verde
   si el tema está bien llevado): nunca al lado de una cifra de preguntas MIR
   ni con su escala de colores, para que no se lean como lo mismo (D2).
═══════════════════════════════════════════════════════════════════════════ */
import { INK } from '@/components/ui/sticker'
import {
  estadoDominio,
  haceCuanto,
  porcentaje,
  textoRecordarias,
  UMBRAL_BIEN_LLEVADO,
  type DominioCarpeta,
  type DominioGrupo,
} from '@/lib/carpetas/dominio'

const CIELO = '#4E7C9B'
const CIELO_SUAVE = '#E7F0F6'
const VERDE = '#5C7A59'
const VERDE_SUAVE = '#EAF1E9'

const colorDe = (bien: boolean) => (bien ? VERDE : CIELO)

/** Barra fina 0-100 %. */
function Barra({ valor, color, etiqueta }: { valor: number; color: string; etiqueta: string }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-[#EAE4E2]" role="meter" aria-label={etiqueta} aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentaje(valor)}>
      <span className="block h-full rounded-full" style={{ width: `${porcentaje(valor)}%`, backgroundColor: color }} />
    </span>
  )
}

/**
 * Indicador pequeño de una carpeta (tarjetas de tema en la asignatura): «72 %» con su barra y la marca
 * de «bien llevado». Sin grupos de flashcards ni de resúmenes no hay señal: lo dice en vez de un 0.
 */
export function IndicadorDominio({ d, cargando = false }: { d: DominioCarpeta | undefined; cargando?: boolean }) {
  if (cargando) return <span className="text-[11px] font-bold text-[#7D8A96]/60">…</span>
  const estado = estadoDominio(d)
  if (!d || estado === 'vacio') return <span className="text-[11px] font-semibold text-[#7D8A96]/70" title="Los mapas no registran estudio">sin señal</span>
  if (estado === 'sin-estudiar') return <span className="text-[11px] font-bold text-[#7D8A96]">sin estudiar aún</span>
  const bien = estado === 'bien'
  return (
    <span className="flex min-w-0 flex-col gap-1" title={`${textoRecordarias(d.dominio!)} · estudiado el ${porcentaje(d.cobertura!)} %`}>
      <span className="flex items-center gap-1.5 text-xs font-black tabular-nums" style={{ color: colorDe(bien) }}>
        <span className="material-symbols-outlined text-[15px]">{bien ? 'verified' : 'psychology'}</span>
        recordarías ~{porcentaje(d.dominio!)} %
        <span className="font-semibold text-[#7D8A96]">· {porcentaje(d.cobertura!)} % visto</span>
      </span>
      <Barra valor={d.dominio!} color={colorDe(bien)} etiqueta="Dominio del material" />
    </span>
  )
}

/** Una línea por grupo, bajo su título: «recordarías ~64 % · 12 de 20 estudiadas». */
export function LineaDominioGrupo({ g }: { g: DominioGrupo | undefined }) {
  if (!g || g.elementos === 0 || g.dominio === null) return null
  const unidad = g.tipo === 'flashcards' ? 'estudiadas' : 'estudiados'
  if (g.estudiados === 0) return <p className="mt-0.5 text-[11px] font-semibold text-[#7D8A96]/80">Sin estudiar aún</p>
  const bien = estadoDominio(g) === 'bien'
  return (
    <p className="mt-0.5 text-[11px] font-bold tabular-nums" style={{ color: colorDe(bien) }}>
      {textoRecordarias(g.dominio)} <span className="font-semibold text-[#7D8A96]">· {g.estudiados} de {g.elementos} {unidad}</span>
    </p>
  )
}

/**
 * La señal de una carpeta, arriba de su lista de material: cuánto recordarías hoy, cuánto has visto,
 * cuándo fue el último repaso, si está «bien llevado» y los huecos de resúmenes que más se te resisten.
 */
export function SenalDominio({ d, soloMapas }: { d: DominioCarpeta | undefined; soloMapas: boolean }) {
  const estado = estadoDominio(d)
  if (!d || estado === 'vacio') {
    return (
      <div className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-[#D9CFC9] bg-[#FAF7F4] px-4 py-3 text-xs text-[#7D8A96]">
        <span className="material-symbols-outlined text-[18px]">psychology_alt</span>
        <span>
          <b className="font-black text-[#2C3E50]">Dominio del material:</b>{' '}
          {soloMapas ? 'los mapas no registran estudio. Añade flashcards o resúmenes para medirlo.' : 'sin tarjetas ni párrafos que medir todavía.'}
        </span>
      </div>
    )
  }
  const bien = estado === 'bien'
  const color = colorDe(bien)
  const cuando = haceCuanto(d.ultimoRepaso)
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-[#2c3e50] p-4" style={{ backgroundColor: bien ? VERDE_SUAVE : CIELO_SUAVE, boxShadow: `3px 3px 0 0 ${INK}` }} data-f3="dominio">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
        <div>
          <p className="text-[11px] font-black tracking-wide uppercase" style={{ color }}>
            Dominio del material
          </p>
          {estado === 'sin-estudiar' ? (
            <p className="text-lg font-black text-[#2C3E50]">Aún no has estudiado nada de aquí</p>
          ) : (
            <p className="text-[clamp(1.6rem,1.2rem+1vw,2.1rem)] leading-tight font-black tabular-nums" style={{ color }}>
              ~{porcentaje(d.dominio!)} %
              <span className="ml-2 text-sm font-bold text-[#2C3E50]">recordarías hoy</span>
            </p>
          )}
        </div>
        {bien ? (
          <span className="mb-1 inline-flex items-center gap-1 rounded-full border-2 border-[#2c3e50] bg-white px-2.5 py-0.5 text-xs font-black text-[#3F5E3C]" style={{ boxShadow: `2px 2px 0 0 ${INK}` }}>
            <span className="material-symbols-outlined text-[16px]">verified</span>
            Bien llevado
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs font-bold text-[#2C3E50]">
            Estudiado al menos una vez
            <span className="whitespace-nowrap tabular-nums">
              {d.estudiados} de {d.elementos} · {porcentaje(d.cobertura!)} %
            </span>
          </span>
          <Barra valor={d.cobertura!} color={color} etiqueta="Cobertura" />
        </div>
        <div className="flex flex-col gap-1 text-xs font-bold text-[#2C3E50]">
          <span>Último repaso</span>
          <span className="font-black" style={{ color }}>
            {cuando ?? 'nunca'}
          </span>
        </div>
      </div>
      {!bien ? (
        <p className="text-[11px] text-[#7D8A96]">
          «Bien llevado» = recordarías hoy al menos el {porcentaje(UMBRAL_BIEN_LLEVADO.dominio)} % y has visto el {porcentaje(UMBRAL_BIEN_LLEVADO.cobertura)} % o más. Lo que no has estudiado cuenta como olvidado.
        </p>
      ) : null}
      {d.huecosDebiles.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[11px] font-black tracking-wide text-[#7D8A96] uppercase">Huecos que más se te resisten</p>
          <ul className="flex flex-wrap gap-1.5">
            {d.huecosDebiles.map((h) => (
              <li
                key={`${h.itemId}-${h.hueco}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#EAE4E2] bg-white px-2.5 py-1 text-xs font-bold text-[#2C3E50]"
                title={`${h.fallos} de ${h.intentos} veces «No lo sabía»${h.falladoAhora ? ' · fallado la última vez' : ''}`}
              >
                <span className="truncate">{h.texto}</span>
                <span className="shrink-0 text-[11px] font-black tabular-nums text-[#B5675A]">
                  {h.fallos}/{h.intentos}
                </span>
                {h.falladoAhora ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#B5675A]" aria-label="fallado la última vez" /> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

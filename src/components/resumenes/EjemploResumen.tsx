'use client'

// Un resumen activo de ejemplo para probar SIN guardar nada (estado vacío de /resumenes y de un grupo):
// «Estudia» destapa los huecos uno a uno y responde «Lo sabía» / «No lo sabía» (o desliza en el móvil,
// como en el estudio de verdad); «Crea huecos» deja tocar palabras para taparlas (y mantener y arrastrar
// para un trozo), con el mismo editor que los párrafos reales. Todo vive en el estado del componente.

import { useMemo, useState } from 'react'
import { LEVEL_INFO } from '@/lib/studioFlashcards'
import { segmentos, type Hueco, type Nivel } from '@/lib/resumenes/huecos'
import { etiquetaHueco, GRIS_AA, NIVEL_CORTO, ROJO_KO, TINTA_NIVEL, VERDE_OK } from '@/lib/resumenes/accesible'
import { NivelNuevo, ParrafoHuecos } from './ParrafoHuecos'
import { hojaApuntes, INK } from './ui'

const TEXTO =
  'La causa más frecuente de hipotiroidismo en nuestro medio es la tiroiditis de Hashimoto, con anticuerpos antiTPO positivos. Se trata con levotiroxina en ayunas.'

/** Los huecos del ejemplo, por su texto (así no hay posiciones escritas a mano que se descuadren). */
function huecosDe(datos: [string, Nivel][]): Hueco[] {
  return datos
    .map(([t, n]) => {
      const i = TEXTO.indexOf(t)
      return { i, f: i + t.length, n }
    })
    .filter((h) => h.i >= 0)
    .sort((a, b) => a.i - b.i)
}

const HUECOS_ESTUDIO = huecosDe([
  ['tiroiditis de Hashimoto', 1],
  ['antiTPO', 2],
  ['levotiroxina', 1],
  ['en ayunas', 3],
])

export function EjemploResumen({ className = '' }: { className?: string }) {
  const [modo, setModo] = useState<'estudiar' | 'crear'>('estudiar')
  const [respuestas, setRespuestas] = useState<Record<number, 'sabia' | 'no'>>({})
  const [destapado, setDestapado] = useState<number | null>(null)
  const [huecosCrear, setHuecosCrear] = useState<Hueco[]>(() => huecosDe([['hipotiroidismo', 2]]))
  const [nivel, setNivel] = useState<Nivel>(2)
  const [aviso, setAviso] = useState<string | null>(null)
  const segs = useMemo(() => segmentos(TEXTO, HUECOS_ESTUDIO), [])
  const siguiente = HUECOS_ESTUDIO.findIndex((_, k) => !(k in respuestas))
  const hecho = siguiente === -1
  const sabidos = Object.values(respuestas).filter((r) => r === 'sabia').length

  const responder = (r: 'sabia' | 'no') => {
    if (destapado === null) return
    setRespuestas((x) => ({ ...x, [destapado]: r }))
    setDestapado(null)
  }

  return (
    <div className={`rounded-3xl bg-white p-4 ${className}`} style={{ border: `2px solid ${INK}`, boxShadow: `4px 4px 0 0 ${INK}` }} data-ejemplo-resumen>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg bg-[#FBEDEA] px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-[#2C3E50]" style={{ border: `1.5px solid ${INK}` }}>
          Ejemplo
        </span>
        <div className="ml-auto flex rounded-xl p-0.5" style={{ border: `2px solid ${INK}` }} role="tablist" aria-label="Qué probar">
          {(
            [
              ['estudiar', 'Estudia'],
              ['crear', 'Crea huecos'],
            ] as const
          ).map(([k, t]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={modo === k}
              onClick={() => setModo(k)}
              className="min-h-[40px] rounded-[10px] px-3 text-sm font-extrabold [@media(pointer:coarse)]:min-h-[44px]"
              style={{ background: modo === k ? INK : 'transparent', color: modo === k ? '#fff' : INK }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {modo === 'estudiar' ? (
        <>
          <div className="mt-3 rounded-2xl py-3 pl-9 pr-3" style={{ ...hojaApuntes(2.1), border: '2px solid rgba(44,62,80,0.15)' }}>
            <p className="text-[1rem] text-[#2C3E50]" style={{ lineHeight: 2.1 }}>
              {segs.map((s, j) => {
                if (s.k === undefined) return <span key={j}>{s.t}</span>
                const k = s.k
                const h = HUECOS_ESTUDIO[k]
                const info = LEVEL_INFO[h.n]
                const r = respuestas[k]
                if (r || destapado === k) {
                  const color = r === 'sabia' ? VERDE_OK : r === 'no' ? ROJO_KO : TINTA_NIVEL[h.n]
                  return (
                    <span
                      key={j}
                      className="rounded-md px-1 font-bold [box-decoration-break:clone] motion-safe:animate-[ra-ej-destapar_0.4s_ease-out]"
                      style={{ color, background: r ? `${color}14` : info.soft, boxShadow: `inset 0 -2px 0 ${r ? color : info.color}` }}
                      aria-label={etiquetaHueco(r ?? 'destapado', h.n, s.t)}
                    >
                      {s.t}
                      {r && (
                        <span className="material-symbols-outlined ml-0.5 align-[-3px] text-[15px]" aria-hidden>
                          {r === 'sabia' ? 'check' : 'close'}
                        </span>
                      )}
                    </span>
                  )
                }
                return (
                  <button
                    key={j}
                    type="button"
                    onClick={() => destapado === null && setDestapado(k)}
                    aria-label={etiquetaHueco('tapado', h.n, s.t)}
                    className="mx-[1px] inline-flex items-center justify-center rounded-md align-[-3px]"
                    style={{
                      width: `${Math.min(10, Math.max(2.5, s.t.length * 0.55))}em`,
                      height: '1.3em',
                      background: `repeating-linear-gradient(135deg, ${info.soft} 0 6px, #fff 6px 9px)`,
                      border: `2px solid ${k === siguiente && destapado === null ? INK : info.color}`,
                      boxShadow: k === siguiente && destapado === null ? `2px 2px 0 0 ${INK}` : 'none',
                    }}
                  >
                    <span className="text-[0.55rem] font-black uppercase leading-none" style={{ color: TINTA_NIVEL[h.n] }} aria-hidden>
                      {NIVEL_CORTO[h.n]}
                    </span>
                  </button>
                )
              })}
            </p>
          </div>
          <div className="mt-3 flex min-h-[48px] flex-wrap items-center justify-center gap-2" aria-live="polite">
            {destapado !== null ? (
              <>
                <button type="button" onClick={() => responder('no')} className="min-h-[44px] flex-1 rounded-xl bg-white px-4 text-sm font-extrabold sm:flex-none" style={{ color: ROJO_KO, border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}>
                  No lo sabía
                </button>
                <button type="button" onClick={() => responder('sabia')} className="min-h-[44px] flex-1 rounded-xl px-4 text-sm font-extrabold text-white sm:flex-none" style={{ background: VERDE_OK, border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}>
                  Lo sabía
                </button>
              </>
            ) : hecho ? (
              <p className="flex flex-wrap items-center justify-center gap-2 text-sm font-bold text-[#2C3E50]" data-ejemplo-hecho>
                {sabidos} de {HUECOS_ESTUDIO.length} sabidos: así se estudia. Al repasar de verdad, el párrafo vuelve justo cuando toca.
                <button type="button" onClick={() => setRespuestas({})} className="min-h-[44px] rounded-xl px-3 text-sm font-extrabold underline">
                  Otra vez
                </button>
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setDestapado(siguiente)}
                className="min-h-[44px] rounded-xl bg-[#E8A598] px-5 text-sm font-extrabold text-[#2C3E50]"
                style={{ border: `2px solid ${INK}`, boxShadow: `2px 2px 0 0 ${INK}` }}
                data-ejemplo-destapar
              >
                Toca un hueco o destápalo aquí
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold" style={{ color: GRIS_AA }}>
              Toca una palabra para taparla; toca un hueco para cambiar su nivel. Para un trozo, selecciónalo (o mantén el dedo y arrastra).
            </p>
            <NivelNuevo nivel={nivel} onChange={setNivel} />
          </div>
          <div className="mt-2 rounded-2xl bg-[#FAF7F4] px-3 py-2">
            <ParrafoHuecos texto={TEXTO} huecos={huecosCrear} onChange={(h) => {
                setHuecosCrear(h)
                setAviso(null)
              }} nivel={nivel} editable onAviso={setAviso} />
          </div>
          <p className="mt-2 text-xs" style={{ color: aviso ? ROJO_KO : GRIS_AA }} aria-live="polite">
            {aviso ?? `${huecosCrear.length} ${huecosCrear.length === 1 ? 'hueco' : 'huecos'} · nada de esto se guarda.`}
          </p>
        </>
      )}
      <style>{'@keyframes ra-ej-destapar{0%{opacity:0;filter:blur(5px) brightness(1.3)}55%{opacity:1;filter:none}100%{opacity:1;filter:none}}'}</style>
    </div>
  )
}

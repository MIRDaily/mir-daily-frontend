'use client'

import type { PreviewModo } from '@/lib/tutorials/types'

/* ════════════════════════════════════════════════════════════════════════
   La "muestra" de un modo: una miniatura de la pantalla REAL que hay
   dentro, con un ratón que ejecuta la acción importante, en bucle.

   Se dibuja SIEMPRE a este tamaño y el overlay la escala para llenar el
   hueco que deja el foco. Así las coordenadas del ratón son fijas y la
   miniatura se ve todo lo grande que la pantalla permita, en vez de quedar
   diminuta en una esquina.

   Lo que importa es que se reconozca la pantalla al entrar, así que se
   copia lo característico de cada una:

   - Simulacro: los pasos numerados, la parrilla de asignaturas, el contador
     de preguntas con sus atajos y su barra, y el panel "Tu simulacro". El
     botón nace APAGADO porque en la pantalla real lo está hasta que eliges
     una asignatura, y el número del resumen CAMBIA al tocar un atajo: sin
     esas dos cosas la maqueta se siente muerta.
   - Mazos: dos escenas, porque la acción importante no está en la primera
     pantalla. La galería y, tras abrir un mazo, el mazo por dentro.

   Todo CSS —ver `.mir-prev-*` en globals.css—: sin estado, sin timers y sin
   repintar React. `pointer-events-none` en la raíz: un toque en cualquier
   sitio tiene que seguir avanzando el tutorial.
═══════════════════════════════════════════════════════════════════════════ */

/** Tamaño de dibujo. El overlay escala desde aquí. */
export const ANCHO_PREVIEW = 560
export const ALTO_PREVIEW = 450

const TINTA = '#2c3e50'

function Cursor({ modo }: { modo: PreviewModo }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 18"
      className={`mir-prev-raton mir-prev-raton-${modo} absolute left-0 top-0 z-20 h-7 w-[19px] drop-shadow-md`}
    >
      <path
        d="M1 1 L11 11 L6.5 11.5 L9 16.5 L7 17.5 L4.5 12.5 L1 15.5 Z"
        fill={TINTA}
        stroke="#fff"
        strokeWidth="1.2"
      />
    </svg>
  )
}

/** Tarjeta con borde de tinta y su paso numerado, como en la pantalla. */
function Paso({
  n,
  titulo,
  extra,
  children,
  className = '',
}: {
  n: number
  titulo: string
  extra?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-xl border-2 border-[#2c3e50] bg-white p-2.5 ${className}`}>
      <div className="flex items-center gap-1.5">
        <span className="flex size-4 items-center justify-center rounded-full border-2 border-[#2c3e50] text-[8px] font-black text-[#2c3e50]">
          {n}
        </span>
        <span className="text-[12px] font-black text-[#2c3e50]">{titulo}</span>
        {extra ? <span className="ml-auto flex gap-1">{extra}</span> : null}
      </div>
      {children}
    </div>
  )
}

/* ── Crear simulacro ─────────────────────────────────────────────────── */

const ASIGNATURAS = [
  'Cardiología y Cirugía Cardiovascular', 'Dermatología', 'Digestivo y Cirugía General',
  'Endocrinología y Nutrición', 'Estadística', 'Hematología', 'Infecciosas y Microbiología',
  'Miscelánea y Ciencias Básicas', 'Nefrología', 'Neumología y Cirugía Torácica',
  'Neurología', 'Otorrinolaringología', 'Pediatría', 'Psiquiatría', 'Traumatología', 'Urología',
]

const ATAJOS = ['10', '25', '50', '100', '210']

/** Los temas de Estadistica, tal cual estan en la base de datos. */
const TEMAS_ESTADISTICA = [
  'Contraste de hipótesis',
  'Estadística descriptiva',
  'Estadística inferencial',
  'Tipos de estudios epidemiológicos',
  'Errores en los estudios epidemiológicos',
]

function Simulacros() {
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <p className="text-[8px] font-bold uppercase tracking-wider text-[#7D8A96]">
        ← Estudio / Crear Simulacro
      </p>

      <div className="rounded-xl border-2 border-[#2c3e50] bg-white px-3 py-2">
        <p className="text-[17px] font-black leading-none text-[#2c3e50]">Diseña tu simulacro</p>
        <p className="mt-1 text-[9px] leading-none text-[#7D8A96]">
          Elige asignaturas y temas, cuántas preguntas quieres y cómo corregirlo.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Paso
            n={1}
            titulo="Asignaturas"
            className="flex min-h-0 flex-1 flex-col"
            extra={
              <>
                {['TODAS', 'ALEATORIAS', 'MIR'].map((b) => (
                  <span
                    key={b}
                    className="rounded-full border border-gray-200 px-1.5 py-[1px] text-[7px] font-bold text-gray-400"
                  >
                    {b}
                  </span>
                ))}
              </>
            }
          >
            <div className="mt-1.5 flex flex-wrap content-start gap-1">
              {ASIGNATURAS.map((a, i) => (
                <span
                  key={a}
                  className={
                    i === 4
                      ? 'mir-prev-elige-simulacros rounded-full px-1.5 py-[2px] text-[8px] font-semibold leading-[11px]'
                      : 'rounded-full border border-gray-200 px-1.5 py-[2px] text-[8px] font-semibold leading-[11px] text-[#7D8A96]'
                  }
                >
                  {a}
                </span>
              ))}
            </div>
          </Paso>

          {/* Los temas NO se pueden tocar hasta elegir una asignatura: el
              recuadro empieza con el mismo aviso que la pantalla real y se
              llena con los temas de Estadística en cuanto el ratón la elige.
              Enseñarlo importa porque es lo que casi nadie descubre solo. */}
          <Paso n={2} titulo="Temas">
            <div className="relative mt-1.5 h-[46px]">
              <div className="mir-prev-fase1-a absolute inset-0 flex items-center rounded-lg border border-gray-200 bg-gray-50 px-2">
                <span className="text-[8px] italic text-gray-400">
                  Selecciona una asignatura para ver sus temas.
                </span>
              </div>
              <div className="mir-prev-fase1-b absolute inset-0 flex flex-wrap content-start gap-1">
                {TEMAS_ESTADISTICA.map((t, i) => (
                  <span
                    key={t}
                    className={
                      i === 1
                        ? 'mir-prev-tema-elegido rounded-full px-1.5 py-[2px] text-[8px] font-semibold leading-[11px]'
                        : 'rounded-full border border-gray-200 px-1.5 py-[2px] text-[8px] font-semibold leading-[11px] text-[#7D8A96]'
                    }
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </Paso>

          <Paso n={3} titulo="Nº de preguntas">
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1">
                <span className="text-[10px] font-black text-[#7D8A96]">−</span>
                <span className="grid w-7 justify-items-center">
                  <span className="col-start-1 row-start-1 mir-prev-fase3-a text-[14px] font-black text-[#2c3e50]">
                    10
                  </span>
                  <span className="col-start-1 row-start-1 mir-prev-fase3-b text-[14px] font-black text-[#2c3e50]">
                    50
                  </span>
                </span>
                <span className="text-[10px] font-black text-[#7D8A96]">+</span>
              </div>
              {ATAJOS.map((a) => (
                <span
                  key={a}
                  className={`rounded-md px-1.5 py-[2px] text-[9px] font-black ${
                    a === '10'
                      ? 'mir-prev-atajo mir-prev-atajo-off'
                      : a === '50'
                        ? 'mir-prev-atajo mir-prev-atajo-on'
                        : 'border border-gray-200 text-[#7D8A96]'
                  }`}
                >
                  {a}
                </span>
              ))}
            </div>
            <div className="mt-2 h-[5px] w-full rounded-full bg-gray-100">
              <div className="mir-prev-barra h-full rounded-full bg-[#E8A598]" />
            </div>
          </Paso>
        </div>

        {/* El resumen pegajoso de la derecha, que se va actualizando. */}
        <div className="flex w-[150px] shrink-0 flex-col rounded-xl border-2 border-[#2c3e50] bg-white p-2.5">
          <span className="text-[8px] font-black uppercase tracking-wider text-[#7D8A96]">
            Tu simulacro
          </span>
          <p className="relative mt-1 h-[34px] text-center">
            <span className="mir-prev-fase3-a absolute inset-0 text-[34px] font-black leading-none text-[#2c3e50]">
              10
            </span>
            <span className="mir-prev-fase3-b absolute inset-0 text-[34px] font-black leading-none text-[#2c3e50]">
              50
            </span>
          </p>
          <p className="text-center text-[8px] font-bold uppercase tracking-wider text-[#7D8A96]">
            Preguntas
          </p>
          <div className="mt-2 flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <span className="text-[9px] text-[#7D8A96]">Asignaturas</span>
              <span className="grid justify-items-end">
                <span className="col-start-1 row-start-1 mir-prev-fase1-a text-[9px] font-black text-[#E8A598]">
                  —
                </span>
                <span className="col-start-1 row-start-1 mir-prev-fase1-b text-[9px] font-black text-[#2c3e50]">
                  1
                </span>
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[9px] text-[#7D8A96]">Temas</span>
              <span className="grid justify-items-end">
                <span className="col-start-1 row-start-1 mir-prev-fase2-a text-[9px] font-black text-[#2c3e50]">
                  Todos
                </span>
                <span className="col-start-1 row-start-1 mir-prev-fase2-b text-[9px] font-black text-[#2c3e50]">
                  1
                </span>
              </span>
            </div>
            {[['Reparto', 'Equilibrado'], ['Corrección', 'Al final']].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between">
                <span className="text-[9px] text-[#7D8A96]">{k}</span>
                <span className="text-[9px] font-black text-[#2c3e50]">{v}</span>
              </div>
            ))}
          </div>
          <div className="mir-prev-cta mir-prev-cta-simulacros mt-auto flex h-8 items-center justify-center rounded-lg">
            <span className="text-[10px] font-black text-white">▶ Generar simulacro</span>
          </div>
          <p className="mir-prev-fase1-a mt-1 text-center text-[7px] leading-tight text-[#7D8A96]">
            Elige al menos una asignatura para empezar.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Mazos: la galería y, dentro, el mazo ────────────────────────────── */

const MAZOS = [
  { t: 'Perf 01 · Casos límite', d: 'Las 8 preguntas raras: enunciado kilométrico.', c: '8', p: 45, g: 'linear-gradient(120deg,#F6A97C,#C4655A)' },
  { t: 'Perf 02 · Cardio que se me atraganta', d: 'Lo que voy fallando en las simulaciones largas.', c: '35', p: 72, g: 'linear-gradient(120deg,#5B6472,#1F242B)' },
  { t: 'Perf 03 · Farmacología', d: 'Dosis y efectos que no hay manera.', c: '22', p: 30, g: 'linear-gradient(120deg,#8E7CC3,#4A3B8C)' },
]

function MazosGaleria() {
  return (
    <div className="mir-prev-escena mir-prev-escena-a absolute inset-0 flex flex-col gap-2 p-3">
      <p className="text-[8px] font-bold uppercase tracking-wider text-[#7D8A96]">← Estudio</p>
      <div className="flex items-end">
        <div>
          <p className="text-[8px] font-black uppercase tracking-wider text-[#7D8A96]">Studio</p>
          <p className="text-[19px] font-black leading-none text-[#2c3e50]">Tus mazos</p>
        </div>
        <span className="ml-auto rounded-lg bg-[#E8A598] px-2.5 py-1 text-[10px] font-black text-white">
          Crear mazo
        </span>
      </div>

      <div className="relative rounded-lg border-2 border-dashed border-[#E8A598] bg-[#E8A598]/10 px-3 py-2">
        <p className="text-[12px] font-black text-[#C4655A]">Mis preguntas falladas</p>
        <p className="text-[8px] text-[#C4655A]/70">Tus fallos recientes, listos para repasar.</p>
        <span className="absolute right-2 top-2 rounded-full bg-white/80 px-1.5 py-[1px] text-[8px] font-black text-[#C4655A]">
          50 cards
        </span>
      </div>

      <p className="text-[8px] font-black uppercase tracking-wider text-[#7D8A96]">Mazos personales</p>

      {MAZOS.map((m, i) => (
        <div
          key={m.t}
          className={`relative flex-1 overflow-hidden rounded-lg px-3 py-2 ${
            i === 1 ? 'mir-prev-elige-mazos' : ''
          }`}
          style={{ background: m.g }}
        >
          <p className="text-[12px] font-black leading-none text-white">{m.t}</p>
          <p className="mt-0.5 text-[8px] text-white/70">{m.d}</p>
          <span className="absolute right-2 top-2 rounded-full bg-white/25 px-1.5 py-[1px] text-[8px] font-black text-white">
            {m.c} cards
          </span>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[8px] font-black text-white/90">Dominio</span>
            <div className="h-[4px] flex-1 rounded-full bg-white/30">
              <div className="h-full rounded-full bg-white" style={{ width: `${m.p}%` }} />
            </div>
            <span className="text-[8px] font-black text-white">{m.p}%</span>
          </div>
        </div>
      ))}
    </div>
  )
}

const CONTADORES = [
  { n: '0', t: 'Nuevas', c: 'bg-blue-50 text-blue-500' },
  { n: '9', t: 'Falladas', c: 'bg-[#E8A598]/15 text-[#C4655A]' },
  { n: '26', t: 'En aprendizaje', c: 'bg-amber-50 text-amber-500' },
  { n: '0', t: 'Dominadas', c: 'bg-emerald-50 text-emerald-500' },
]

function MazoDentro() {
  return (
    <div className="mir-prev-escena mir-prev-escena-b absolute inset-0 flex flex-col gap-2 p-3">
      <p className="text-[8px] font-bold uppercase tracking-wider text-[#7D8A96]">
        ← Mis mazos / Perf 02 · Cardio que se me atraganta
      </p>

      <div
        className="relative overflow-hidden rounded-xl p-3"
        style={{ background: 'linear-gradient(120deg,#5B6472,#1F242B)' }}
      >
        <p className="pr-20 text-[17px] font-black leading-none text-white">
          Perf 02 · Cardio que se me atraganta
        </p>
        <p className="mt-1 text-[8px] text-white/70">Lo que voy fallando en las simulaciones largas.</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {['Infecciosas · 17%', 'Nefrología · 14%', 'Estadística · 11%', 'Hematología · 11%'].map(
            (c) => (
              <span
                key={c}
                className="rounded-full border border-white/40 px-1.5 py-[2px] text-[8px] font-semibold text-white/90"
              >
                {c}
              </span>
            ),
          )}
        </div>
        <div className="mir-prev-cta mir-prev-cta-mazos mt-3 flex h-8 w-[104px] items-center justify-center rounded-full">
          <span className="text-[11px] font-black text-white">▶ Estudiar</span>
        </div>
        <div className="absolute right-3 top-3 flex size-[62px] flex-col items-center justify-center rounded-lg bg-white">
          <span className="text-[20px] font-black leading-none text-[#2c3e50]">72%</span>
          <span className="text-[6px] font-black uppercase tracking-wider text-[#7D8A96]">Dominio</span>
        </div>
      </div>

      <div className="flex gap-2">
        {CONTADORES.map((c) => (
          <div key={c.t} className={`flex flex-1 flex-col items-center rounded-lg py-1.5 ${c.c}`}>
            <span className="text-[18px] font-black leading-none">{c.n}</span>
            <span className="text-[7px] font-black uppercase tracking-wider">{c.t}</span>
          </div>
        ))}
      </div>

      <div className="flex shrink-0 flex-col gap-1 rounded-lg border border-gray-100 bg-white p-2.5">
        <span className="text-[8px] font-black uppercase tracking-wider text-[#7D8A96]">
          Acierto por asignatura
        </span>
        {[['Traumatología', 67], ['Estadística', 100], ['Cardiología', 75]].map(([t, p]) => (
          <div key={String(t)} className="flex items-center gap-2">
            <span className="w-[86px] shrink-0 truncate text-[8px] text-[#2c3e50]">{t}</span>
            <div className="h-[4px] flex-1 rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-[#E8A598]" style={{ width: `${p}%` }} />
            </div>
            <span className="w-6 text-right text-[8px] font-black text-[#7D8A96]">{p}%</span>
          </div>
        ))}
      </div>

      {/* La lista de preguntas del mazo, que es lo que va debajo en la
          pantalla real. Solo el esqueleto: rayas en vez de enunciado, porque
          aquí lo que importa es que se vea QUE hay preguntas, no cuáles. Se
          recorta por abajo a propósito — en la pantalla real la lista sigue
          y hay que seguir bajando. */}
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden rounded-lg border border-gray-100 bg-white p-2.5">
        <div className="flex items-center gap-1">
          <span className="rounded-md bg-[#2c3e50] px-1.5 py-[2px] text-[7px] font-black text-white">
            Preguntas 35
          </span>
          {['Respuestas', 'Desplegar'].map((b) => (
            <span
              key={b}
              className="rounded-md border border-gray-200 px-1.5 py-[2px] text-[7px] font-bold text-[#7D8A96]"
            >
              {b}
            </span>
          ))}
          <span className="rounded-md bg-[#E8A598] px-1.5 py-[2px] text-[7px] font-black text-white">
            Etiquetas
          </span>
          <span className="ml-auto h-[15px] w-[92px] rounded-md border border-gray-200" />
        </div>

        {[0, 1, 2].map((i) => (
          <div key={i} className="shrink-0 rounded-md border border-gray-200 p-1.5">
            <div className="flex items-center gap-1">
              <span className="text-[7px] font-black leading-none text-[#7D8A96]">&rsaquo;</span>
              <span className="h-[6px] w-9 rounded-full bg-[#2c3e50]/25" />
              <span className="h-[9px] w-12 rounded-full border border-gray-200" />
              <span className="h-[9px] w-6 rounded-full border border-gray-200" />
              <span className="ml-auto h-[7px] w-[5px] rounded-[1px] bg-[#E8A598]/40" />
            </div>
            <div className="mt-1.5 flex flex-col gap-[3px]">
              <span className="block h-[3px] w-full rounded-full bg-gray-200" />
              <span
                className="block h-[3px] rounded-full bg-gray-200"
                style={{ width: ['72%', '56%', '84%'][i] }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PreviewModo({ modo }: { modo: PreviewModo }) {
  return (
    <div
      aria-hidden
      className="mir-prev pointer-events-none relative overflow-hidden rounded-2xl border-2 border-[#2c3e50] bg-[#FAF7F4] shadow-[0_28px_70px_rgba(44,62,80,0.4)]"
      style={{ width: ANCHO_PREVIEW, height: ALTO_PREVIEW }}
    >
      {modo === 'simulacros' ? (
        <Simulacros />
      ) : (
        <>
          <MazosGaleria />
          <MazoDentro />
        </>
      )}
      <Cursor modo={modo} />
    </div>
  )
}

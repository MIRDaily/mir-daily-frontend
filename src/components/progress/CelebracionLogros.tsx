'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useProgressContext } from '@/providers/ProgressProvider'
import { ordenarPorPeso, type Logro } from '@/lib/logros'
import StreakFlame from '@/components/progress/StreakFlame'
import AvisosDesafio from '@/components/progress/AvisosDesafio'
import SubidaDeNivel from '@/components/progress/SubidaDeNivel'
import { rankForLevel } from '@/lib/levels'

/* ════════════════════════════════════════════════════════════════════════
   La celebración de metas cumplidas.

   Dos reglas gobiernan este componente:

   1. NUNCA aparece por su cuenta. Solo se pinta cuando alguien ha dado
      permiso explícito (`permitirCelebracion`), y el permiso solo se da al
      terminar una actividad. Interrumpir a alguien en mitad de una pregunta
      para decirle que ha subido de nivel es peor que no decírselo.

   2. UNA tarjeta, no una cadena de modales. Si se han cumplido cuatro cosas a
      la vez, manda la más importante y las demás van resumidas debajo.
      Encadenar cuatro ventanas sería su propia forma de interrumpir.

   3. No todo pesa lo mismo. Un desafío completado no merece tapar la pantalla:
      sale como aviso deslizante en la esquina y se va solo (AvisosDesafio).
      Solo las metas gordas —rango, nivel, hito de racha— se quedan esperando
      un gesto.

   4. Cuando coinciden, se separan EN EL TIEMPO, no en la pantalla. La tarjeta
      sale sola y limpia; los desafíos esperan a que se cierre y entonces se
      anuncian como avisos. Subir de nivel es lo más importante que le pasa al
      usuario ese día y no debe diluirse en una lista; y un aviso flotando
      sobre un modal atenuado se lee como un error de montaje. Turnándose se
      evitan las dos cosas.
═══════════════════════════════════════════════════════════════════════════ */

const numberFormat = new Intl.NumberFormat('es-ES')

function titularDe(l: Logro): { kicker: string; titulo: string; sub: string; color: string } {
  switch (l.tipo) {
    case 'rango':
      return {
        kicker: 'Nuevo rango',
        titulo: l.rango,
        sub: `Has llegado al nivel ${l.nivel}.`,
        color: l.color,
      }
    case 'nivel':
      return {
        kicker: 'Has subido',
        titulo: `Nivel ${l.nivel}`,
        sub: 'Un peldaño más.',
        color: l.color,
      }
    case 'racha':
      return {
        kicker: 'Racha',
        titulo: `${l.dias} días seguidos`,
        sub: 'Sin fallar un solo día.',
        color: '#EA8600',
      }
    case 'desafio':
      return {
        kicker: l.scope === 'weekly' ? 'Desafío semanal' : 'Desafío del día',
        titulo: l.titulo,
        sub: `+${numberFormat.format(l.xp)} XP`,
        color: '#8BA888',
      }
  }
}

function resumenDe(l: Logro): string {
  switch (l.tipo) {
    case 'rango':
      return `Nuevo rango: ${l.rango}`
    case 'nivel':
      return `Nivel ${l.nivel}`
    case 'racha':
      return `${l.dias} días de racha`
    case 'desafio':
      return `${l.titulo} · +${numberFormat.format(l.xp)} XP`
  }
}

/** Un puñado de papelitos. Se calla entero si el usuario pidió menos motion. */
function Confeti({ color }: { color: string }) {
  const piezas = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        izq: 4 + (i * 92) / 13,
        retraso: (i % 7) * 0.09,
        giro: i % 2 === 0 ? 220 : -200,
        tono: [color, '#EDB53F', '#8BA888', '#7BA7C4'][i % 4],
      })),
    [color],
  )

  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden">
      {piezas.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-0 block h-2.5 w-1.5 rounded-[1px]"
          style={{ left: `${p.izq}%`, backgroundColor: p.tono }}
          initial={{ y: -20, opacity: 0, rotate: 0 }}
          animate={{ y: 170, opacity: [0, 1, 1, 0], rotate: p.giro }}
          transition={{ duration: 1.9, delay: 0.15 + p.retraso, ease: 'easeIn' }}
        />
      ))}
    </div>
  )
}

type Titular = { kicker: string; titulo: string; sub: string; color: string }

/* El interior de la tarjeta.

   Va aparte para poder llevar `key={logro.id}`: así su estado —cuántos
   peldaños se han cruzado, si el titular ya se ha descubierto— se reinicia
   solo cuando cambia la meta que se celebra. Si viviera en el padre, la
   segunda tarjeta de una tanda saldría con el titular ya destapado. */
function ContenidoMeta({
  logro,
  t,
  resto,
  pie,
  onCerrar,
}: {
  logro: Logro
  t: Titular
  resto: Logro[]
  /** Estado en el que queda el usuario, ya formateado. */
  pie: string | null
  onCerrar: () => void
}) {
  const reduceMotion = useReducedMotion()
  const esSalto = logro.tipo === 'nivel' || logro.tipo === 'rango'

  /* El titular se guarda hasta que la barra cruza de verdad. Enseñar "Nivel
     12" mientras la barra todavía va por el 11 destripa el momento: el número
     tiene que llegar DESPUÉS del esfuerzo, no antes. */
  const [revelado, setRevelado] = useState(!esSalto || !!reduceMotion)

  const alSubir = useCallback(() => {
    setRevelado(true)
  }, [])

  // Red de seguridad: si por lo que sea no llegara a cruzarse ningún peldaño
  // (un tramo raro, una referencia vieja), el titular no se queda escondido.
  useEffect(() => {
    if (revelado) return
    const t = setTimeout(() => setRevelado(true), 3600)
    return () => clearTimeout(t)
  }, [revelado])

  return (
    <>
      {/* El confeti que cae desde arriba se queda para la racha, que no tiene
          barra con la que interactuar. En un salto de nivel manda otra cosa:
          las chispas salen de la propia barra al llenarse y rebotan en ella
          (ChispasDeNivel, dentro de SubidaDeNivel). Papelitos cayendo por
          delante de eso solo restarían. */}
      {!reduceMotion && !esSalto ? <Confeti color={t.color} /> : null}

      <div className="relative px-6 pb-6 pt-8 text-center">
        {esSalto ? (
          <div className="mx-auto mb-5 w-full max-w-[16rem]">
            <SubidaDeNivel
              xpAntes={logro.xpAntes}
              xpDespues={logro.xpDespues}
              onNivelNuevo={alSubir}
            />
          </div>
        ) : (
          <motion.div
            className="mx-auto mb-4 flex h-20 w-20 items-center justify-center"
            initial={reduceMotion ? false : { scale: 0.4, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.08 }}
          >
            {/* Aquí ya no puede llegar un desafío: esos salen por
                AvisosDesafio. Lo confirma el propio TypeScript, que marcaba la
                rama del desafío como comparación imposible. */}
            {logro.tipo === 'racha' ? <StreakFlame streak={logro.dias} size={76} /> : null}
          </motion.div>
        )}

        <motion.div
          initial={false}
          animate={revelado ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        >
          <p
            className="text-[11px] font-black uppercase tracking-[0.16em]"
            style={{ color: t.color }}
          >
            {t.kicker}
          </p>
          <h2 className="mt-1 text-2xl font-black leading-tight text-[#2c3e50]">{t.titulo}</h2>
          <p className="mt-1 text-sm text-[#7D8A96]">{t.sub}</p>
        </motion.div>

        {resto.length > 0 ? (
          <div className="mt-5 space-y-1.5 rounded-2xl bg-[#FBF9F8] px-4 py-3 text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7D8A96]/80">
              Y además
            </p>
            {resto.map((l) => (
              <p key={l.id} className="flex items-center gap-1.5 text-sm text-[#2c3e50]">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  <span className="material-symbols-outlined text-[15px] text-[#8BA888]">
                    check_circle
                  </span>
                </span>
                <span className="truncate">{resumenDe(l)}</span>
              </p>
            ))}
          </div>
        ) : null}

        {/* El estado en el que queda, para que la celebración informe y no solo
            aplauda. En un salto llega con el titular: hasta entonces contaría
            el final de la historia por su cuenta. */}
        {pie ? (
          <motion.p
            className="mt-5 text-xs text-[#7D8A96]"
            initial={false}
            animate={{ opacity: revelado ? 1 : 0 }}
            transition={{ duration: 0.25 }}
          >
            {pie}
          </motion.p>
        ) : null}

        <button
          type="button"
          onClick={onCerrar}
          className="mt-4 w-full rounded-xl border-2 border-[#2c3e50] bg-[#E8A598] py-2.5 text-sm font-black text-white transition-transform active:scale-[0.98]"
          style={{ boxShadow: '3px 3px 0 0 #2c3e50' }}
        >
          Seguir
        </button>
      </div>
    </>
  )
}

export default function CelebracionLogros() {
  const { logros, celebracionLista, cerrarCelebracion, descartarLogro, descartarLogros, data } =
    useProgressContext()
  const reduceMotion = useReducedMotion()

  const ordenados = useMemo(() => ordenarPorPeso(logros), [logros])

  // Las metas que merecen detener al usuario, y las que no.
  const mayores = useMemo(() => ordenados.filter((l) => l.tipo !== 'desafio'), [ordenados])
  const desafios = useMemo(
    () => ordenados.filter((l): l is Extract<Logro, { tipo: 'desafio' }> => l.tipo === 'desafio'),
    [ordenados],
  )

  const principal = mayores[0]
  // Solo se resumen OTRAS metas gordas (lo normal: un hito de racha el mismo
  // día que se sube de nivel). Los desafíos ya no entran aquí: tienen su propio
  // turno cuando esta tarjeta se cierre.
  const resto = mayores.slice(1)

  // Cerrar la tarjeta se lleva las metas gordas y SOLO esas. Si quedaban
  // desafíos en la cola, el permiso sigue vivo y salen a continuación como
  // avisos: ese es el relevo.
  const cerrarTarjeta = useCallback(() => {
    if (mayores.length > 0) descartarLogros(mayores.map((m) => m.id))
    else cerrarCelebracion()
  }, [mayores, descartarLogros, cerrarCelebracion])

  // Escape cierra, como cualquier diálogo.
  useEffect(() => {
    if (!celebracionLista) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrarTarjeta()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [celebracionLista, cerrarTarjeta])

  // Las dos capas se montan SIEMPRE, y lo que se enciende y apaga es su
  // CONTENIDO. Antes se devolvía null y eso se llevaba por delante el
  // AnimatePresence: un contenedor desmontado no puede animar la salida de
  // nadie, así que la última pieza en irse desaparecía de golpe. Pasaba con el
  // último aviso y también con el modal, cuya salida no se veía nunca.
  const avisos = celebracionLista && !principal ? desafios : []
  const t = principal ? titularDe(principal) : null
  const pie = data?.progress
    ? `${rankForLevel(data.progress.level).name} · ${numberFormat.format(data.progress.xpTotal)} XP en total`
    : null

  return (
    <>
      <AvisosDesafio desafios={avisos} onDescartar={descartarLogro} />

      <AnimatePresence>
        {celebracionLista && principal && t ? (
      <motion.div
        key="celebracion"
        className="fixed inset-0 z-[100] flex items-center justify-center p-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <button
          type="button"
          aria-label="Cerrar"
          onClick={cerrarTarjeta}
          className="absolute inset-0 cursor-default bg-[#2c3e50]/35 backdrop-blur-[2px]"
        />

        <motion.div
          role="dialog"
          aria-live="polite"
          aria-label={`${t.kicker}: ${t.titulo}`}
          className="relative w-full max-w-sm overflow-hidden rounded-3xl border-2 border-[#2c3e50] bg-white"
          style={{ boxShadow: '6px 6px 0 0 #2c3e50' }}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        >
          <ContenidoMeta
            key={principal.id}
            logro={principal}
            t={t}
            resto={resto}
            pie={pie}
            onCerrar={cerrarTarjeta}
          />
        </motion.div>
      </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}

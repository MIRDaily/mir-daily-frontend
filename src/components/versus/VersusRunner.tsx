'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ZoomableImage } from '@/components/simulacro/QuestionImage'
import VersusRematch from '@/components/versus/VersusRematch'
import VersusScoreChart from '@/components/versus/VersusScoreChart'
import { getAvatarUrl, getSafeAvatarId } from '@/lib/avatar'
import { advanceRoom, submitAnswer, voteContinue } from '@/lib/versus/queries'
import {
  VersusElimination,
  VersusIntro,
  VersusLifeLost,
  VersusRelay,
} from '@/components/versus/VersusCinematics'
import VersusGuardiaHud from '@/components/versus/VersusGuardiaHud'
import VersusGuardiaTimeline from '@/components/versus/VersusGuardiaTimeline'
import type {
  VersusMode,
  VersusPhase,
  VersusPlayer,
  VersusQuestionEvent,
  VersusRestoredAnswer,
  VersusRoundContent,
} from '@/lib/versus/types'

type VersusRunnerProps = {
  pin: string
  phase: VersusPhase
  players: VersusPlayer[]
  playerId: string | null
  progress: { answered: number; total: number } | null
  restored: VersusRestoredAnswer | null
  clockOffset: number
  mode: VersusMode
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const

export default function VersusRunner({
  pin,
  phase,
  players,
  playerId,
  progress,
  restored,
  clockOffset,
  mode,
}: VersusRunnerProps) {
  // Todo se mide contra el reloj del SERVIDOR, no contra el del navegador.
  const serverNow = () => Date.now() + clockOffset

  const [now, setNow] = useState(serverNow)

  // Al recargar a mitad de pregunta, el servidor dice si ya se había respondido
  // y qué. Sin esto la pantalla invitaría a contestar otra vez y el servidor
  // rechazaría el duplicado. `answered` va aparte de `selected` porque se puede
  // haber respondido en blanco.
  // 'ended' es la única fase sin pregunta detrás, así que no tiene índice.
  const phaseIdx = phase.event === 'ended' ? -1 : phase.idx
  const restoredHere = restored && restored.idx === phaseIdx ? restored : null
  const [selected, setSelected] = useState<number | null>(restoredHere?.selected ?? null)
  const [answered, setAnswered] = useState(Boolean(restoredHere))
  const [sending, setSending] = useState(false)
  const [continuing, setContinuing] = useState(false)

  // Última pregunta recibida por el canal. Hoy el enunciado y las opciones
  // viajan también en 'picks' y 'reveal' (ver `contenido` más abajo), así que
  // esto es solo la red de seguridad para un evento que llegara sin ellas.
  const [current, setCurrent] = useState<VersusQuestionEvent | null>(
    phase.event === 'question' ? phase : null,
  )

  const playersById = new Map(players.map((p) => [p.id, p]))

  // Solo al CAMBIAR de pregunta se limpia la selección. Si se resincronizara
  // con cada evento, un refresco a mitad de ronda borraría lo ya pulsado.
  const seededIdx = useRef<number | null>(restoredHere ? phaseIdx : null)
  useEffect(() => {
    if (phase.event !== 'question') return
    setCurrent(phase)
    setSending(false)
    if (seededIdx.current === phase.idx) return
    seededIdx.current = phase.idx
    setSelected(null)
    setAnswered(false)
  }, [phase])

  // La restauración puede llegar DESPUÉS de la pregunta (el refresco por HTTP
  // tarda más que el broadcast), así que se aplica cuando llega, y nunca por
  // encima de una respuesta ya dada en esta pantalla.
  useEffect(() => {
    if (phase.event !== 'question' || answered) return
    if (!restored || restored.idx !== phase.idx) return
    setSelected(restored.selected)
    setAnswered(true)
  }, [phase, restored, answered])

  // Un único temporizador para todas las cuentas atrás de la pantalla.
  useEffect(() => {
    const id = window.setInterval(() => setNow(serverNow()), 100)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockOffset])

  // Cuando vence el plazo de la fase, este cliente pide avanzar UNA vez. El
  // servidor decide si de verdad toca, así que si varios lo piden a la vez solo
  // uno provoca el cambio. El jitter evita que lleguen todos en el mismo ms.
  const nudgedFor = useRef<string | null>(null)
  useEffect(() => {
    if (phase.event === 'ended') return

    const key = `${phase.event}:${phase.idx}`
    if (nudgedFor.current === key) return

    const delay = phase.endsAt - serverNow() + Math.random() * 400
    const id = window.setTimeout(() => {
      nudgedFor.current = key
      void advanceRoom(pin).catch(() => {
        // Que falle no rompe nada: queda el barrido del servidor como respaldo.
      })
    }, Math.max(delay, 0))

    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pin, clockOffset])

  async function handleContinue() {
    if (phase.event !== 'reveal' || continuing) return
    setContinuing(true)
    try {
      await voteContinue(pin)
    } catch {
      // Que falle no rompe nada: el minuto de lectura sigue corriendo.
    } finally {
      setContinuing(false)
    }
  }

  async function handleSelect(index: number) {
    if (phase.event !== 'question' || answered || sending) return
    // Los eliminados de Guardia miran; el servidor también lo rechaza, pero
    // así no se les enciende la opción como si hubieran respondido.
    if (mode === 'survival' && playerId && playersById.get(playerId)?.eliminatedAtIdx != null) return
    // Bloqueo al pulsar, estilo Kahoot: sin cambios de última milésima, y así
    // el tiempo de respuesta significa algo.
    setSelected(index)
    setAnswered(true)
    setSending(true)
    try {
      await submitAnswer(pin, phase.idx, index)
    } catch {
      // Si el servidor la rechaza (fuera de tiempo, ronda ya cerrada) se
      // devuelve el control en vez de dejar la pantalla bloqueada en falso.
      setSelected(null)
      setAnswered(false)
    } finally {
      setSending(false)
    }
  }

  // ==========================
  // Final de partida
  // ==========================
  if (phase.event === 'ended') {
    // En Guardia no gana quien más puntúa sino quien aguanta: primero los que
    // siguen en pie, y a los caídos se les ordena por lo tarde que cayeron.
    const ranking =
      mode === 'survival'
        ? [...phase.scores].sort((a, b) => {
            const pa = playersById.get(a.playerId)
            const pb = playersById.get(b.playerId)
            const ca = pa?.eliminatedAtIdx ?? Infinity
            const cb = pb?.eliminatedAtIdx ?? Infinity
            return cb - ca || b.score - a.score
          })
        : [...phase.scores].sort((a, b) => b.score - a.score)
    return (
      <div className="mx-auto w-full max-w-2xl text-center">
        <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E8A598] to-[#d18d80] text-white shadow-lg shadow-[#E8A598]/25">
          <span className="material-symbols-outlined text-3xl">emoji_events</span>
        </div>
        <h1 className="mb-8 text-3xl font-black tracking-tight text-[#2c3e50]">
          Se acabó
        </h1>
        <ol className="space-y-2 text-left">
          {ranking.map((row, position) => {
            const player = playersById.get(row.playerId)
            return (
              <li
                key={row.playerId}
                className={`flex items-center gap-3 rounded-xl border-2 bg-white p-4 ${
                  row.playerId === playerId ? 'border-[#E8A598]' : 'border-[#EAE4E2]'
                }`}
              >
                <span className="w-6 text-lg font-black text-[#7D8A96]">{position + 1}</span>
                {player ? (
                  <Image
                    src={getAvatarUrl(getSafeAvatarId(player.avatarId))}
                    alt=""
                    width={36}
                    height={36}
                    className="size-9 rounded-full object-cover"
                  />
                ) : null}
                <span className="min-w-0 flex-1 truncate font-semibold text-[#2c3e50]">
                  {player?.nickname ?? 'Jugador'}
                  {player?.left ? (
                    <span className="ml-2 text-xs font-medium text-[#7D8A96]">se fue</span>
                  ) : null}
                </span>
                <span className="text-sm text-[#7D8A96]">
                  {mode === 'survival'
                    ? player?.eliminatedAtIdx == null
                      ? 'En pie'
                      : `Cayó en la ${player.eliminatedAtIdx + 1}`
                    : `${row.correct} aciertos`}
                </span>
                <span className="w-16 text-right font-black text-[#2c3e50]">{row.score}</span>
              </li>
            )
          })}
        </ol>

        {/* En Guardia lo que hay que leer es quién aguantó hasta dónde, no
            quién puntuó más: cronología en vez de marcador. */}
        {mode === 'survival' ? (
          <VersusGuardiaTimeline
            series={phase.series}
            players={players}
            playerId={playerId}
          />
        ) : (
          <VersusScoreChart series={phase.series} players={players} playerId={playerId} />
        )}

        <VersusRematch
          pin={pin}
          players={players}
          playerId={playerId}
          votes={phase.votes}
          rematchUntil={phase.rematchUntil}
          rematchPin={phase.rematchPin}
          clockOffset={clockOffset}
        />
      </div>
    )
  }

  // ==========================
  // Cuenta atrás previa
  // ==========================
  // Los 3 segundos antes de cada pregunta no son adorno: absorben la latencia
  // dispar de cada cliente para que el enunciado aparezca a la vez en todas las
  // pantallas. El plazo de respuesta se mide desde el final de esta cuenta.
  if (phase.event === 'question' && now < phase.startsAt) {
    const remaining = Math.ceil((phase.startsAt - now) / 1000)

    // En Guardia, entre pregunta y pregunta la cuenta atrás se convierte en el
    // recuento de supervivientes: es el hilo del modo y el momento natural
    // para verlo, sin robarle tiempo a nada.
    if (mode === 'survival' && phase.idx > 0) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center">
          <VersusRelay
            standing={players.filter((p) => p.eliminatedAtIdx == null)}
            fallen={players.filter((p) => p.eliminatedAtIdx != null)}
            remaining={remaining}
          />
        </div>
      )
    }

    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center">
        {/* Solo antes de la primera: en las siguientes rondas manda el relevo. */}
        {phase.idx === 0 ? (
          <VersusIntro
            players={players}
            mode={mode}
            lives={players[0]?.lives ?? null}
            runKey={`${pin}-intro`}
          />
        ) : null}
        <p className="mb-4 text-sm font-bold uppercase tracking-wider text-[#7D8A96]/70">
          Pregunta {phase.idx + 1} de {phase.total}
        </p>
        <AnimatePresence mode="popLayout">
          <motion.div
            key={remaining}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="text-8xl font-black text-[#E8A598]"
          >
            {remaining}
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

  const idx = phase.idx

  // El contenido de la ronda sale de la fase que hay en pantalla, sea cual sea:
  // el servidor lo manda en 'question', en 'picks' y en 'reveal'. Esto es lo
  // que hace que reconectar a mitad de ronda (recargar, volver de segundo
  // plano, resuscribirse al canal) enseñe la pregunta en vez de un hueco.
  // `current` solo entra si la fase llegara sin contenido.
  // (aquí la fase ya no puede ser 'ended': esa rama sale arriba con el podio)
  const contenido: VersusRoundContent | null = phase.options
    ? (phase as VersusRoundContent)
    : current

  const total = contenido?.total ?? null
  const question = contenido
  const answering = phase.event === 'question'

  // Los plazos SIEMPRE salen de la fase, nunca del contenido guardado: mezclar
  // el reloj de una pregunta con el enunciado de otra es como se cuelan las
  // cuentas atrás fantasma.
  const asking = phase.event === 'question' ? phase : null

  const picksByOption = new Map<number, VersusPlayer[]>()
  if (phase.event === 'picks' || phase.event === 'reveal') {
    const entries =
      phase.event === 'picks'
        ? phase.picks
        : phase.results.map((r) => ({ playerId: r.playerId, selected: r.selected }))

    for (const entry of entries) {
      if (entry.selected === null) continue
      const player = playersById.get(entry.playerId)
      if (!player) continue
      picksByOption.set(entry.selected, [...(picksByOption.get(entry.selected) ?? []), player])
    }
  }

  const correctIndex = phase.event === 'reveal' ? phase.correctIndex : null
  const myResult =
    phase.event === 'reveal' ? phase.results.find((r) => r.playerId === playerId) : null

  const secondsLeft =
    asking && now >= asking.startsAt
      ? Math.max(0, Math.ceil((asking.endsAt - now) / 1000))
      : null

  const timeRatio =
    asking && asking.endsAt > asking.startsAt
      ? Math.max(0, Math.min(1, (asking.endsAt - now) / (asking.endsAt - asking.startsAt)))
      : 0

  const survival = mode === 'survival'
  const me = playerId ? playersById.get(playerId) : undefined
  const outOfPlay = survival && me?.eliminatedAtIdx != null

  // Estado del minuto de lectura del revelado.
  const yaContinuo =
    phase.event === 'reveal' && playerId !== null && phase.continueVotes.includes(playerId)
  const puedeSaltar = phase.event === 'reveal' && now >= phase.skipFrom
  const segundosLectura =
    phase.event === 'reveal' ? Math.max(0, Math.ceil((phase.endsAt - now) / 1000)) : 0
  const ratioLectura =
    phase.event === 'reveal' ? Math.max(0, Math.min(1, segundosLectura / 60)) : 0
  // Las vidas de partida no viajan aparte: el que más conserva marca el total,
  // que es exactamente lo que hace falta para dibujar los huecos.
  const maxLives = Math.max(1, ...players.map((p) => p.lives ?? 0))
  const fallenNow =
    phase.event === 'reveal'
      ? phase.eliminated.map((id) => playersById.get(id)).filter((p): p is VersusPlayer => !!p)
      : []
  const woundedNow =
    phase.event === 'reveal'
      ? phase.wounded.map((id) => playersById.get(id)).filter((p): p is VersusPlayer => !!p)
      : []

  return (
    <div className="mx-auto w-full max-w-3xl">

      {/* En secuencia, no a la vez: primero se rompen los corazones (abajo, sin
          tapar), y a los 2,6 s la caída se lleva la pantalla. Por eso la ronda
          con muerte dura 11 s en vez de 6. */}
      {survival && woundedNow.length > 0 ? (
        <VersusLifeLost
          wounded={woundedNow}
          runKey={`${pin}-vida-${idx}`}
          playerId={playerId}
        />
      ) : null}
      {survival && fallenNow.length > 0 ? (
        <VersusElimination
          fallen={fallenNow}
          runKey={`${pin}-caida-${idx}`}
          playerId={playerId}
        />
      ) : null}

      {/* HUD permanente: las vidas de TODOS, en todas las fases. Sin esto se
          perdían vidas y se moría sin que nada lo contara. */}
      {survival ? (
        <VersusGuardiaHud
          players={players}
          playerId={playerId}
          wounded={phase.event === 'reveal' ? phase.wounded : []}
          eliminated={phase.event === 'reveal' ? phase.eliminated : []}
          maxLives={maxLives}
        />
      ) : null}

      {outOfPlay ? (
        <div className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-[#2c3e50] px-4 py-2 text-sm font-bold text-white">
          <span className="material-symbols-outlined text-[18px]">visibility</span>
          Estás de espectador
        </div>
      ) : null}

      {/* Cabecera: progreso y reloj */}
      <div className="mb-4 flex items-center justify-between text-sm font-semibold text-[#7D8A96]">
        <span>{total ? `Pregunta ${idx + 1} de ${total}` : `Pregunta ${idx + 1}`}</span>
        {secondsLeft !== null ? (
          <span className={secondsLeft <= 5 ? 'text-[#C4655A]' : undefined}>{secondsLeft}s</span>
        ) : (
          <span className="text-[#7D8A96]/60">
            {phase.event === 'picks' ? 'Respuestas bloqueadas' : 'Solución'}
          </span>
        )}
      </div>

      {answering ? (
        <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-[#EAE4E2]">
          <motion.div
            className={`h-full ${timeRatio < 0.2 ? 'bg-[#C4655A]' : 'bg-[#E8A598]'}`}
            style={{ width: `${timeRatio * 100}%` }}
          />
        </div>
      ) : null}

      {/* Enunciado */}
      {question ? (
        <article className="mb-6 rounded-2xl border-2 border-[#EAE4E2] bg-white p-6">
          {question.subject ? (
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#E8A598]">
              {question.subject}
            </p>
          ) : null}
          <p className="text-base leading-relaxed text-[#2c3e50]">{question.statement}</p>
          {/* Sin el "revelar con espacio" del simulacro: aquí el reloj corre y
              esconder la imagen solo penalizaría. Se muestra y se puede ampliar. */}
          {question.hasImage && question.imageUrl ? (
            <div className="mt-4">
              <ZoomableImage
                url={question.imageUrl}
                className="max-h-64 w-full rounded-xl object-contain"
              />
            </div>
          ) : null}
        </article>
      ) : null}

      {/* Opciones */}
      <div className="mb-6 space-y-3">
        {(question?.options ?? []).map((text, index) => {
          const here = picksByOption.get(index) ?? []
          const isCorrect = correctIndex === index
          const isMine = selected === index

          let tone = 'border-[#EAE4E2] bg-white hover:border-[#E8A598]/60'
          if (phase.event === 'reveal') {
            tone = isCorrect
              ? 'border-[#8BA888] bg-[#8BA888]/10'
              : isMine
                ? 'border-[#C4655A] bg-[#C4655A]/8'
                : 'border-[#EAE4E2] bg-white opacity-60'
          } else if (isMine) {
            tone = 'border-[#E8A598] bg-[#E8A598]/10'
          }

          return (
            <button
              key={index}
              type="button"
              onClick={() => handleSelect(index)}
              disabled={phase.event !== 'question' || answered || outOfPlay}
              className={`flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors disabled:cursor-default ${tone}`}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#F2EFED] text-sm font-black text-[#2c3e50]">
                {OPTION_LETTERS[index] ?? index + 1}
              </span>
              <span className="min-w-0 flex-1 text-sm leading-relaxed text-[#2c3e50]">{text}</span>

              {/* Los avatares solo aparecen en 'picks' y 'reveal'. Verlos
                  durante la pregunta sería copiar. */}
              <span className="flex shrink-0 -space-x-2">
                <AnimatePresence>
                  {here.map((player) => (
                    <motion.span
                      key={player.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                      title={player.nickname}
                    >
                      <Image
                        src={getAvatarUrl(getSafeAvatarId(player.avatarId))}
                        alt={player.nickname}
                        width={28}
                        height={28}
                        className="size-7 rounded-full border-2 border-white object-cover"
                      />
                    </motion.span>
                  ))}
                </AnimatePresence>
              </span>

              {/* Sin tick: la opción correcta ya va en verde y el resto
                  apagadas. Un icono encima solo repite lo que el color ya dice. */}
            </button>
          )
        })}
      </div>

      {/* Pie: contador anónimo, o resultado propio */}
      {phase.event === 'question' ? (
        <p className="text-center text-sm font-medium text-[#7D8A96]">
          {outOfPlay
            ? 'Tu guardia acabó. Ahora solo miras.'
            : answered
              ? 'Respuesta enviada. Esperando al resto…'
              : progress
                ? `${progress.answered} de ${progress.total} han respondido`
                : 'Elige una opción'}
        </p>
      ) : null}

      {phase.event === 'picks' ? (
        <p className="text-center text-sm font-medium text-[#7D8A96]">
          Esto ha elegido cada uno… ¿quién tiene razón?
        </p>
      ) : null}

      {phase.event === 'reveal' ? (
        <>
          <div className="mb-4 rounded-2xl border-2 border-[#EAE4E2] bg-white p-5">
            {/* En Guardia no se juega por puntos sino por vidas, así que un
                "+1" ahí no dice nada: lo que importa es si sigues entero. */}
            <p className="mb-2 font-bold text-[#2c3e50]">
              {survival
                ? myResult?.isCorrect
                  ? '¡Correcto! Sigues en pie'
                  : outOfPlay
                    ? 'Se acabó tu guardia'
                    : myResult?.selected === null || myResult === undefined
                      ? 'Sin respuesta. Pierdes una vida'
                      : 'Fallaste. Pierdes una vida'
                : myResult?.isCorrect
                  ? `¡Correcto! +${myResult.points}`
                  : myResult?.selected === null || myResult === undefined
                    ? 'Sin respuesta'
                    : 'Fallaste'}
            </p>
            {phase.explanation ? (
              <p className="text-sm leading-relaxed text-[#7D8A96]">{phase.explanation}</p>
            ) : null}
          </div>

          {/* Un minuto para leer, saltable por mayoría. El contador va a la
              vista para que se entienda por qué avanza (o por qué no). */}
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border-2 border-[#EAE4E2] bg-white p-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="text-sm font-bold text-[#2c3e50]">
                {yaContinuo
                  ? 'Esperando al resto…'
                  : outOfPlay
                    ? 'Los que siguen jugando deciden cuándo pasar'
                    : '¿Ya lo has leído?'}
              </p>
              <p className="text-xs text-[#7D8A96]">
                {phase.continueTotal > 0
                  ? `${phase.continueVotes.length} de ${phase.continueTotal} quieren pasar · hacen falta ${
                      Math.floor(phase.continueTotal / 2) + 1
                    }`
                  : 'Sin nadie jugando, pasa sola'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`tabular-nums text-sm font-bold ${
                  segundosLectura <= 10 ? 'text-[#C4655A]' : 'text-[#7D8A96]'
                }`}
              >
                {segundosLectura}s
              </span>
              <button
                type="button"
                onClick={handleContinue}
                disabled={outOfPlay || yaContinuo || !puedeSaltar || continuing}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#E8A598] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#E8A598]/20 transition-colors hover:bg-[#d18d80] disabled:cursor-default disabled:bg-[#F2EFED] disabled:text-[#7D8A96]/60 disabled:shadow-none"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {yaContinuo ? 'check' : 'arrow_forward'}
                </span>
                {yaContinuo ? 'Listo' : 'Continuar'}
              </button>
            </div>
          </div>

          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[#EAE4E2]">
            <div
              className={`h-full ${segundosLectura <= 10 ? 'bg-[#C4655A]' : 'bg-[#E8A598]'}`}
              style={{ width: `${ratioLectura * 100}%` }}
            />
          </div>

          {/* Marcador acumulado: sin esto no hay forma de saber si vas ganando
              hasta el podio final, que es la mitad de la gracia.
              En Guardia no se pinta: los puntos no deciden nada ahí y el HUD de
              arriba ya lleva la cuenta que importa, que son las vidas. */}
          <ol className={`space-y-2 ${survival ? 'hidden' : ''}`}>
            {[...phase.scores]
              .sort((a, b) => b.score - a.score)
              .map((row, position) => {
                const player = playersById.get(row.playerId)
                const isMe = row.playerId === playerId
                return (
                  <li
                    key={row.playerId}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${
                      isMe ? 'border-[#E8A598] bg-[#E8A598]/8' : 'border-[#EAE4E2] bg-white'
                    } ${player && (player.left || !player.connected) ? 'opacity-50' : ''}`}
                  >
                    <span className="w-5 text-sm font-black text-[#7D8A96]">{position + 1}</span>
                    {player ? (
                      <Image
                        src={getAvatarUrl(getSafeAvatarId(player.avatarId))}
                        alt=""
                        width={28}
                        height={28}
                        className="size-7 rounded-full object-cover"
                      />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#2c3e50]">
                      {player?.nickname ?? 'Jugador'}
                      {player && (player.left || !player.connected) ? (
                        <span className="ml-2 text-xs font-medium text-[#7D8A96]">
                          {player.left ? 'se ha ido' : 'desconectado'}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-sm font-black text-[#2c3e50]">{row.score}</span>
                  </li>
                )
              })}
          </ol>
        </>
      ) : null}
    </div>
  )
}

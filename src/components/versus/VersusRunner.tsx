'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ZoomableImage } from '@/components/simulacro/QuestionImage'
import { getAvatarUrl, getSafeAvatarId } from '@/lib/avatar'
import { advanceRoom, submitAnswer } from '@/lib/versus/queries'
import type {
  VersusPhase,
  VersusPlayer,
  VersusQuestionEvent,
  VersusRestoredAnswer,
} from '@/lib/versus/types'

type VersusRunnerProps = {
  pin: string
  phase: VersusPhase
  players: VersusPlayer[]
  playerId: string | null
  progress: { answered: number; total: number } | null
  restored: VersusRestoredAnswer | null
  clockOffset: number
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

  // 'picks' y 'reveal' no reenvían el enunciado ni las opciones (serían los
  // mismos bytes en cada fase), así que se conserva la última pregunta que
  // llegó. También es lo que se muestra tras reconectar a mitad de ronda.
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

  async function handleSelect(index: number) {
    if (phase.event !== 'question' || answered || sending) return
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
    const ranking = [...phase.scores].sort((a, b) => b.score - a.score)
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
                <span className="text-sm text-[#7D8A96]">{row.correct} aciertos</span>
                <span className="w-16 text-right font-black text-[#2c3e50]">{row.score}</span>
              </li>
            )
          })}
        </ol>
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
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center">
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
  const total = current?.total ?? null
  const question = current
  const answering = phase.event === 'question'

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
    answering && question && now >= question.startsAt
      ? Math.max(0, Math.ceil((question.endsAt - now) / 1000))
      : null

  const timeRatio =
    answering && question && question.endsAt > question.startsAt
      ? Math.max(0, Math.min(1, (question.endsAt - now) / (question.endsAt - question.startsAt)))
      : 0

  return (
    <div className="mx-auto w-full max-w-3xl">

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
              disabled={phase.event !== 'question' || answered}
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

              {phase.event === 'reveal' && isCorrect ? (
                <span className="material-symbols-outlined shrink-0 text-[#8BA888]">check_circle</span>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* Pie: contador anónimo, o resultado propio */}
      {phase.event === 'question' ? (
        <p className="text-center text-sm font-medium text-[#7D8A96]">
          {answered
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
            <p className="mb-2 font-bold text-[#2c3e50]">
              {myResult?.isCorrect
                ? `¡Correcto! +${myResult.points}`
                : myResult?.selected === null || myResult === undefined
                  ? 'Sin respuesta'
                  : 'Fallaste'}
            </p>
            {phase.explanation ? (
              <p className="text-sm leading-relaxed text-[#7D8A96]">{phase.explanation}</p>
            ) : null}
          </div>

          {/* Marcador acumulado: sin esto no hay forma de saber si vas ganando
              hasta el podio final, que es la mitad de la gracia. */}
          <ol className="space-y-2">
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

'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getAvatarUrl, getSafeAvatarId } from '@/lib/avatar'
import { useVersusRoom } from '@/hooks/useVersusRoom'
import { leaveRoom } from '@/lib/versus/queries'
import type { VersusMode } from '@/lib/versus/types'
import VersusPresenceToasts from '@/components/versus/VersusPresenceToasts'
import VersusRunner from '@/components/versus/VersusRunner'
import VersusStartPanel from '@/components/versus/VersusStartPanel'

type VersusRoomProps = {
  pin: string
}

export default function VersusRoom({ pin }: VersusRoomProps) {
  const router = useRouter()
  const {
    room,
    players,
    playerId,
    isHost,
    phase,
    progress,
    restored,
    clockOffset,
    connected,
    closed,
    loading,
    error,
    joinError,
  } = useVersusRoom(pin)
  const [copied, setCopied] = useState(false)
  const [leaving, setLeaving] = useState(false)

  // Sin nombre de usuario no se puede jugar: se manda al onboarding igual que
  // hace el formulario de /versus, porque llegar con la URL puesta se salta ese
  // camino.
  useEffect(() => {
    if (joinError?.code === 'USERNAME_REQUIRED') router.push('/onboarding')
  }, [joinError, router])

  const maxPlayers = room?.config?.maxPlayers ?? 8

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(pin)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // El portapapeles falla en contextos no seguros; el PIN se ve en pantalla
      // igualmente, así que no merece un error visible.
    }
  }

  async function handleLeave() {
    setLeaving(true)
    try {
      await leaveRoom(pin)
    } catch {
      // Salir nunca debe dejar al usuario atrapado en la pantalla.
    }
    router.push('/versus')
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#EAE4E2] border-t-[#E8A598]" />
      </div>
    )
  }

  if (closed || error || !room) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F2EFED] text-[#7D8A96]">
          <span className="material-symbols-outlined text-3xl">door_front</span>
        </div>
        <h1 className="mb-2 text-2xl font-black tracking-tight text-[#2c3e50]">
          {closed ? 'La sala se ha cerrado' : 'No se pudo abrir la sala'}
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-[#7D8A96]">
          {closed
            ? 'El anfitrión ha salido, así que la partida ha terminado.'
            : (error ?? 'Puede que el código haya caducado o que la partida ya haya terminado.')}
        </p>
        <button
          type="button"
          onClick={() => router.push('/versus')}
          className="rounded-xl bg-[#E8A598] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#d18d80]"
        >
          Volver a Versus
        </button>
      </div>
    )
  }

  // El modo se fija en /start y no viaja en los eventos de fase, así que
  // `room.mode` puede llegar desfasado si el refresco de arranque tarda o falla.
  // Como red, se deduce de los propios datos: si alguien tiene vidas, es
  // Guardia. Dos vías para lo mismo, porque de esto cuelga que a un eliminado
  // se le bloqueen las opciones.
  const mode: VersusMode =
    room.mode !== 'survival' && players.some((p) => p.lives != null)
      ? 'survival'
      : room.mode

  // Con la partida en marcha manda el runner: el lobby ya no pinta nada.
  if (room.status !== 'lobby' && phase) {
    return (
      <>
        <VersusRunner
          pin={pin}
          phase={phase}
          players={players}
          playerId={playerId}
          progress={progress}
          restored={restored}
          clockOffset={clockOffset}
          mode={mode}
          lives={room.config?.lives ?? null}
        />
        <VersusPresenceToasts players={players} playerId={playerId} />
      </>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl">

      {/* Se llegó a la sala pero no se pudo entrar (empezada, llena…). Decirlo
          es lo único que evita quedarse esperando a una partida en la que no
          se está. */}
      {playerId === null && joinError ? (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-2xl border-2 border-[#C4655A]/25 bg-[#C4655A]/8 px-5 py-4"
        >
          <span className="material-symbols-outlined text-[20px] text-[#C4655A]">
            visibility
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#C4655A]">
              Estás mirando, no jugando
            </p>
            <p className="mt-0.5 text-sm leading-relaxed text-[#7D8A96]">
              {joinError.message}
            </p>
          </div>
        </div>
      ) : null}

      {/* Código de la sala */}
      <section className="mb-8 flex flex-col items-center text-center">
        <span className="mb-3 text-xs font-bold uppercase tracking-wider text-[#7D8A96]/70">
          Código de la sala
        </span>
        <button
          type="button"
          onClick={handleCopy}
          title="Copiar código"
          className="group mb-3 flex items-center gap-3 rounded-2xl border-2 border-[#E8A598]/30 bg-white px-7 py-4 transition-colors hover:border-[#E8A598]/60"
        >
          <span className="font-mono text-4xl font-black tracking-[0.25em] text-[#2c3e50]">
            {room.pin}
          </span>
          <span className="material-symbols-outlined text-[20px] text-[#7D8A96] transition-colors group-hover:text-[#E8A598]">
            {copied ? 'check' : 'content_copy'}
          </span>
        </button>
        <p className="text-sm text-[#7D8A96]">
          {copied ? '¡Copiado! Pásaselo a quien quieras retar.' : 'Compártelo para que entren.'}
        </p>

        <span
          className={`mt-4 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
            connected
              ? 'bg-[#8BA888]/12 text-[#6a8a67]'
              : 'bg-[#7D8A96]/10 text-[#7D8A96]'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              connected ? 'animate-pulse bg-[#8BA888]' : 'bg-[#7D8A96]/50'
            }`}
          />
          {connected ? 'En directo' : 'Reconectando…'}
        </span>
      </section>

      {/* Jugadores */}
      <section className="mb-8">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#7D8A96]/70">
            En la sala
          </h2>
          <span className="text-sm font-semibold text-[#7D8A96]">
            {players.length} / {maxPlayers}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <AnimatePresence initial={false} mode="popLayout">
            {players.map((player) => (
              <motion.div
                key={player.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className={`flex items-center gap-3 rounded-xl border-2 bg-white p-3 ${
                  player.id === playerId ? 'border-[#E8A598]' : 'border-[#EAE4E2]'
                }`}
              >
                <Image
                  src={getAvatarUrl(getSafeAvatarId(player.avatarId))}
                  alt=""
                  width={36}
                  height={36}
                  className="size-9 shrink-0 rounded-full object-cover"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#2c3e50]">
                  {player.nickname}
                </span>
                {player.id === playerId ? (
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[#E8A598]">
                    Tú
                  </span>
                ) : null}
              </motion.div>
            ))}
          </AnimatePresence>

          {players.length < 2 ? (
            <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-[#EAE4E2] p-3 text-[#7D8A96]/60">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F2EFED]">
                <span className="material-symbols-outlined text-[18px]">hourglass_empty</span>
              </div>
              <span className="text-sm font-medium">Esperando…</span>
            </div>
          ) : null}
        </div>
      </section>

      {/* Configuración y arranque: solo el anfitrión */}
      {isHost ? (
        <VersusStartPanel
          pin={pin}
          canStart={players.length >= 2}
          preset={{ mode: room.mode, ...(room.config ?? {}) }}
        />
      ) : (
        <div className="mb-8 flex items-center justify-center gap-2 rounded-xl bg-[#F2EFED] px-5 py-4 text-sm font-semibold text-[#7D8A96]">
          <span className="material-symbols-outlined text-[18px]">schedule</span>
          Esperando a que el anfitrión empiece
        </div>
      )}

      {/* Acciones */}
      <section className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleLeave}
          disabled={leaving}
          className="flex-1 rounded-xl border-2 border-[#EAE4E2] px-5 py-3 text-sm font-semibold text-[#7D8A96] transition-colors hover:border-[#C4655A]/40 hover:text-[#C4655A] disabled:opacity-60"
        >
          {isHost ? 'Cerrar sala' : 'Salir'}
        </button>
      </section>

      {isHost ? (
        <p className="mt-4 text-center text-xs leading-relaxed text-[#7D8A96]/70">
          Eres el anfitrión: si sales, la sala se cierra para todos.
        </p>
      ) : null}

      <VersusPresenceToasts players={players} playerId={playerId} />
    </div>
  )
}

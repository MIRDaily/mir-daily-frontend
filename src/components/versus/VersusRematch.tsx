'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAvatarUrl, getSafeAvatarId } from '@/lib/avatar'
import { voteRematch } from '@/lib/versus/queries'
import type { VersusPlayer } from '@/lib/versus/types'

type VersusRematchProps = {
  pin: string
  players: VersusPlayer[]
  playerId: string | null
  votes: string[]
  /** Fin del plazo, en el reloj del servidor. */
  rematchUntil: number | null
  /** Código de la sala nueva, si ya se creó. */
  rematchPin: string | null
  clockOffset: number
}

export default function VersusRematch({
  pin,
  players,
  playerId,
  votes,
  rematchUntil,
  rematchPin,
  clockOffset,
}: VersusRematchProps) {
  const router = useRouter()
  const [voting, setVoting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now() + clockOffset)

  const iVoted = playerId !== null && votes.includes(playerId)
  const remaining = rematchUntil ? Math.max(0, Math.ceil((rematchUntil - now) / 1000)) : 0
  const expired = rematchUntil !== null && remaining === 0

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() + clockOffset), 500)
    return () => window.clearInterval(id)
  }, [clockOffset])

  // En cuanto existe la sala nueva, los que VOTARON entran solos: la gracia de
  // esto es no tener que pasarse el código otra vez.
  //
  // Solo los que votaron: `rematch_ready` va al canal entero, y arrastrar
  // también a quien no quiso repetir lo dejaba en una sala en la que el
  // servidor no le había metido —no aparecía en la lista y nadie le contaba—.
  // A ese se le ofrece el enlace y que decida él.
  useEffect(() => {
    if (rematchPin && iVoted) router.push(`/versus/${rematchPin}`)
  }, [rematchPin, iVoted, router])

  async function handleVote() {
    if (iVoted || voting) return
    setVoting(true)
    setError(null)
    try {
      const result = await voteRematch(pin)
      if (result.pin) router.push(`/versus/${result.pin}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo votar la revancha.')
    } finally {
      setVoting(false)
    }
  }

  const voters = players.filter((p) => votes.includes(p.id))

  // La revancha ya existe y este jugador no votó: se le enseña la puerta en vez
  // de meterle dentro. Si entra, la sala le admite como uno más.
  if (rematchPin && !iVoted) {
    return (
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/versus/${rematchPin}`}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#E8A598] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#E8A598]/20 transition-colors hover:bg-[#d18d80]"
        >
          <span className="material-symbols-outlined text-[18px]">swords</span>
          Se juega otra: entrar
        </Link>
        <Link
          href="/studio"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#EAE4E2] px-5 py-3 text-sm font-semibold text-[#7D8A96] transition-colors hover:border-[#E8A598]/50 hover:text-[#d18d80]"
        >
          <span className="material-symbols-outlined text-[18px]">home</span>
          Salir del Versus
        </Link>
      </div>
    )
  }

  // Vencido el plazo sin suficientes votos, no se deja el botón engañando: se
  // ofrece el camino normal.
  if (expired && !rematchPin) {
    return (
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/versus"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#E8A598] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#E8A598]/20 transition-colors hover:bg-[#d18d80]"
        >
          <span className="material-symbols-outlined text-[18px]">swords</span>
          Nueva sala
        </Link>
        <Link
          href="/studio"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#EAE4E2] px-5 py-3 text-sm font-semibold text-[#7D8A96] transition-colors hover:border-[#E8A598]/50 hover:text-[#d18d80]"
        >
          <span className="material-symbols-outlined text-[18px]">home</span>
          Salir del Versus
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-8">
      <div className="rounded-2xl border-2 border-[#EAE4E2] bg-white p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-[#2c3e50]">
            {iVoted ? 'Esperando al resto…' : '¿Otra partida?'}
          </p>
          <span
            className={`tabular-nums text-sm font-bold ${
              remaining <= 5 ? 'text-[#C4655A]' : 'text-[#7D8A96]'
            }`}
          >
            {remaining}s
          </span>
        </div>

        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[#EAE4E2]">
          <div
            className={`h-full transition-[width] duration-500 ease-linear ${
              remaining <= 5 ? 'bg-[#C4655A]' : 'bg-[#E8A598]'
            }`}
            style={{ width: `${rematchUntil ? (remaining / 30) * 100 : 0}%` }}
          />
        </div>

        <p className="mb-3 text-xs text-[#7D8A96]">
          {voters.length} de {players.length} quieren repetir. Se crea la sala en
          cuanto estéis todos, sin pasaros el código.
        </p>

        {voters.length > 0 ? (
          <ul className="mb-4 flex flex-wrap gap-2">
            {voters.map((player) => (
              <li
                key={player.id}
                className="flex items-center gap-1.5 rounded-full border border-[#8BA888]/30 bg-[#8BA888]/10 py-1 pl-1 pr-3"
              >
                <Image
                  src={getAvatarUrl(getSafeAvatarId(player.avatarId))}
                  alt=""
                  width={20}
                  height={20}
                  className="size-5 rounded-full object-cover"
                />
                <span className="text-xs font-semibold text-[#2c3e50]">{player.nickname}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleVote}
            disabled={iVoted || voting}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#E8A598] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#E8A598]/20 transition-colors hover:bg-[#d18d80] disabled:cursor-default disabled:bg-[#8BA888] disabled:shadow-none"
          >
            <span className="material-symbols-outlined text-[18px]">
              {iVoted ? 'check' : 'swords'}
            </span>
            {iVoted ? 'Apuntado' : voting ? 'Un momento…' : 'Otra partida'}
          </button>
          <Link
            href="/studio"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#EAE4E2] px-5 py-3 text-sm font-semibold text-[#7D8A96] transition-colors hover:border-[#E8A598]/50 hover:text-[#d18d80]"
          >
            <span className="material-symbols-outlined text-[18px]">home</span>
            Salir del Versus
          </Link>
        </div>

        {error ? (
          <p role="alert" className="mt-3 text-sm font-medium text-[#C4655A]">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}

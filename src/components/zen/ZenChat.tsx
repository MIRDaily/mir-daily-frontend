'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { CHAT_MAX_LENGTH, type ZenChatMessage, type ZenPeer, type ZenPinned } from '@/hooks/useZenRoom'

type ZenChatProps = {
  open: boolean
  onToggle: () => void
  connected: boolean
  messages: ReadonlyArray<ZenChatMessage>
  peers: ReadonlyArray<ZenPeer>
  myId: string
  mutedIds: ReadonlyArray<string>
  onSend: (text: string) => boolean
  onToggleMute: (peerId: string) => void
  pinned: ZenPinned
  onPin: (text: string) => void
  onUnpin: () => void
}

function timeLabel(at: number): string {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function ZenChat({
  open,
  onToggle,
  connected,
  messages,
  peers,
  myId,
  mutedIds,
  onSend,
  onToggleMute,
  pinned,
  onPin,
  onUnpin,
}: ZenChatProps) {
  const [draft, setDraft] = useState('')
  const [rejected, setRejected] = useState(false)
  const [showPeople, setShowPeople] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // Cuántos mensajes había la última vez que el panel estuvo abierto. Se sella
  // al abrir y al cerrar, que son gestos del usuario, así que no hace falta
  // ningún efecto para llevar la cuenta.
  const [seenCount, setSeenCount] = useState(0)
  const unread = open ? 0 : Math.max(0, messages.length - seenCount)

  function toggle() {
    setSeenCount(messages.length)
    onToggle()
  }

  // Autoscroll al último mensaje mientras el panel está abierto.
  useEffect(() => {
    if (!open) return
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [open, messages])

  const remaining = CHAT_MAX_LENGTH - draft.length

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!draft.trim()) return
    const ok = onSend(draft)
    if (ok) {
      setDraft('')
      setRejected(false)
    } else {
      // El único motivo de rechazo es escribir demasiado rápido.
      setRejected(true)
      window.setTimeout(() => setRejected(false), 1400)
    }
  }

  const roster = useMemo(
    () => peers.filter((p) => p.id !== myId),
    [peers, myId],
  )

  if (!open) {
    return (
      <button
        type="button"
        onClick={toggle}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-[#EAE4E2] bg-white/95 px-4 py-3 text-sm font-semibold text-[#2c3e50] shadow-lg backdrop-blur transition-colors hover:border-[#8BA888]/50"
      >
        <span className="material-symbols-outlined text-[20px] text-[#8BA888]">forum</span>
        Chat
        {unread > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E8A598] px-1.5 text-[11px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <aside className="fixed bottom-5 right-5 z-40 flex h-[26rem] w-[19rem] flex-col overflow-hidden rounded-2xl border border-[#EAE4E2] bg-white/95 shadow-xl backdrop-blur">
      <header className="flex items-center justify-between border-b border-[#EAE4E2] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[19px] text-[#8BA888]">forum</span>
          <span className="text-sm font-bold text-[#2c3e50]">Chat de la sala</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowPeople((v) => !v)}
            aria-pressed={showPeople}
            title="Quién está dentro"
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
              showPeople ? 'bg-[#8BA888]/15 text-[#6a8a67]' : 'text-[#7D8A96] hover:bg-[#F2EFED]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">group</span>
            {roster.length + 1}
          </button>
          <button
            type="button"
            onClick={toggle}
            title="Cerrar chat"
            className="rounded-lg p-1 text-[#7D8A96] transition-colors hover:bg-[#F2EFED]"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </header>

      {pinned ? (
        <div className="flex items-start gap-2 border-b border-[#E8A598]/30 bg-[#E8A598]/10 px-3 py-2">
          <span className="material-symbols-outlined mt-px text-[15px] text-[#d18d80]">push_pin</span>
          <span className="min-w-0 flex-1">
            <span className="block break-words text-xs font-semibold leading-snug text-[#2c3e50]">
              {pinned.text}
            </span>
            <span className="block text-[10px] text-[#7D8A96]">Fijado por {pinned.byName}</span>
          </span>
          <button
            type="button"
            onClick={onUnpin}
            title="Quitar el mensaje fijado"
            className="rounded p-0.5 text-[#7D8A96] transition-colors hover:bg-[#E8A598]/20"
          >
            <span className="material-symbols-outlined text-[15px]">close</span>
          </button>
        </div>
      ) : null}

      {showPeople ? (
        <div className="max-h-32 shrink-0 overflow-y-auto border-b border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#7D8A96]/70">
            En la sala
          </p>
          <ul className="flex flex-col gap-1">
            <li className="flex items-center gap-2 px-1 py-0.5 text-xs text-[#2c3e50]">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#8BA888]" />
              <span className="font-semibold">Tú</span>
            </li>
            {roster.map((p) => {
              const muted = mutedIds.includes(p.id)
              return (
                <li key={p.id} className="flex items-center gap-2 px-1 py-0.5 text-xs">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: p.color }}
                  />
                  <span className={`flex-1 truncate ${muted ? 'text-[#7D8A96]/50 line-through' : 'text-[#2c3e50]'}`}>
                    {p.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleMute(p.id)}
                    title={muted ? 'Volver a leerle' : 'Silenciar en local'}
                    className="rounded p-0.5 text-[#7D8A96] transition-colors hover:bg-[#EAE4E2]"
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {muted ? 'volume_off' : 'volume_up'}
                    </span>
                  </button>
                </li>
              )
            })}
            {roster.length === 0 ? (
              <li className="px-1 py-0.5 text-xs italic text-[#7D8A96]/70">
                Aún no ha llegado nadie más
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3">
        {!connected ? (
          <p className="mt-6 text-center text-xs italic leading-relaxed text-[#7D8A96]/80">
            Conectando con la sala…
          </p>
        ) : messages.length === 0 ? (
          <p className="mt-6 text-center text-xs italic leading-relaxed text-[#7D8A96]/80">
            Aquí no queda nada guardado.
            <br />
            Lo que escribáis desaparece al cerrar la sala.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {messages.map((m) => {
              const mine = m.authorId === myId
              return (
                <li key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  <span className="mb-0.5 flex items-center gap-1.5 text-[10px] text-[#7D8A96]/70">
                    <span className="font-semibold">{mine ? 'Tú' : m.name}</span>
                    <span>{timeLabel(m.at)}</span>
                  </span>
                  <span className={`flex max-w-[92%] items-center gap-1 ${mine ? 'flex-row' : 'flex-row-reverse'}`}>
                    <button
                      type="button"
                      onClick={() => onPin(m.text)}
                      title="Fijar este mensaje para toda la sala"
                      className="shrink-0 rounded p-0.5 text-[#7D8A96]/50 transition-colors hover:bg-[#F2EFED] hover:text-[#d18d80]"
                    >
                      <span className="material-symbols-outlined text-[14px]">push_pin</span>
                    </button>
                    <span
                      className={`min-w-0 break-words rounded-2xl px-3 py-1.5 text-xs leading-relaxed ${
                        mine
                          ? 'bg-[#E8A598] text-white'
                          : 'bg-[#F2EFED] text-[#2c3e50]'
                      }`}
                    >
                      {m.text}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-[#EAE4E2] p-2.5">
        <div className="flex items-end gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, CHAT_MAX_LENGTH))}
            disabled={!connected}
            maxLength={CHAT_MAX_LENGTH}
            placeholder={connected ? 'Escribe algo…' : 'Sin conexión'}
            aria-label="Mensaje para la sala"
            className="min-w-0 flex-1 rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2 text-xs text-[#2c3e50] outline-none transition-colors focus:border-[#8BA888] focus:ring-2 focus:ring-[#8BA888]/15 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!connected || !draft.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#8BA888] text-white transition-colors enabled:hover:bg-[#739970] disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </div>
        <p className="mt-1 h-4 px-1 text-[10px]">
          {rejected ? (
            <span className="font-semibold text-[#C4655A]">Espera un segundo entre mensajes</span>
          ) : remaining <= 30 ? (
            <span className="text-[#7D8A96]/70">Te quedan {remaining} caracteres</span>
          ) : null}
        </p>
      </form>
    </aside>
  )
}

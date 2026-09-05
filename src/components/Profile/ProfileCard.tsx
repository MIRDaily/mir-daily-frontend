'use client'

/* ════════════════════════════════════════════════════════════════════════
   Perfil de usuario.

   Rediseñado con el lenguaje compartido de la web (borde de tinta, sombra
   dura, textura temática): la portada es el carné —ver `ProfileHero`— y
   debajo quedan las dos cosas que se editan en línea, nombre visible y
   username, más la galería de avatares. El resto del carné (bio, objetivo,
   curso, especialidad, universidad y visibilidad) se edita en el modal de
   `AcademicEditor`, contra `PATCH /api/profile/academic`.

   Cambio de uso, no solo de estilo: el username se comprueba mientras se
   escribe (mismo endpoint que el onboarding), así el usuario sabe si está
   libre ANTES de gastar el cambio, que queda bloqueado una temporada.
═══════════════════════════════════════════════════════════════════════════ */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import AcademicEditor from '@/components/Profile/AcademicEditor'
import AvatarSelector from '@/components/Profile/AvatarSelector'
import ProfileHero from '@/components/Profile/ProfileHero'
import {
  DocChip,
  GhostButton,
  INK,
  InkInput,
  InkSwitch,
  SectionLabel,
  StickerButton,
  StickerCard,
} from '@/components/Profile/ui'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import { useProfile } from '@/hooks/useProfile'
import { DISPLAY_NAME_REGEX, USERNAME_REGEX, normalizeUsernameInput } from '@/lib/profile'
import {
  checkUsernameAvailability,
  type AcademicPayload,
} from '@/services/profileOnboardingService'

type ToastState = {
  type: 'success' | 'error'
  message: string
} | null

/** Estado de la comprobación de username mientras se escribe. */
type UsernameCheck = 'idle' | 'current' | 'invalid' | 'checking' | 'available' | 'taken' | 'error'

const MAIN_GOAL_LABEL: Record<'prepare_mir' | 'reinforce_degree' | 'explore', string> = {
  prepare_mir: 'Preparar el MIR',
  reinforce_degree: 'Reforzar la carrera',
  explore: 'Explorar',
}
const COZY_CURSOR_STORAGE_KEY = 'mirdaily.cozyCursorEnabled'
const COZY_CURSOR_EVENT = 'mirdaily:cozy-cursor'
const USERNAME_CHECK_DELAY_MS = 450

/* ─── Preferencia del cursor de marca ────────────────────────────────────
   Vive en localStorage, así que se lee como una fuente externa en vez de
   copiarla a estado desde un efecto: así no hay render en cascada al montar
   ni desajuste con el HTML que sirve el servidor. */

// Si localStorage no está disponible (modo privado) la preferencia vive solo
// en memoria: el interruptor sigue respondiendo, pero no sobrevive a la
// recarga.
let cozyCursorFallback = true

function readCozyCursor() {
  try {
    return localStorage.getItem(COZY_CURSOR_STORAGE_KEY) !== 'false'
  } catch {
    return cozyCursorFallback
  }
}

function subscribeCozyCursor(onChange: () => void) {
  window.addEventListener(COZY_CURSOR_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(COZY_CURSOR_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function formatMedicalYear(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Sin definir'
  if (value === 0) return 'Médico graduado'
  return `${value}º de Medicina`
}

/** Fecha corta y en castellano, igual en todo el perfil. */
function formatDate(date: Date) {
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Días desde el alta, para el chip del carné. */
function daysSince(iso: string | null | undefined) {
  if (!iso) return 0
  const from = new Date(iso).getTime()
  if (!Number.isFinite(from)) return 0
  return Math.max(0, Math.floor((Date.now() - from) / 86400000))
}

export default function ProfileCard() {
  const {
    profile,
    loading,
    error,
    updatingAvatar,
    updatingDisplayName,
    updatingUsername,
    updatingAcademic,
    usernameLockedUntil,
    updateAcademic,
    updateAvatar,
    updateDisplayName,
    updateUsername,
  } = useProfile()
  const authenticatedFetch = useAuthenticatedFetch()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''

  const [isEditingName, setIsEditingName] = useState(false)
  const [displayNameDraft, setDisplayNameDraft] = useState('')
  const [usernameDraft, setUsernameDraft] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [nameValidationError, setNameValidationError] = useState<string | null>(null)
  // Resultado de la última comprobación remota, atada al username que se
  // comprobó: si el usuario sigue escribiendo, deja de aplicar sola.
  const [remoteCheck, setRemoteCheck] = useState<{
    username: string
    status: 'available' | 'taken' | 'error'
  } | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const cozyCursorEnabled = useSyncExternalStore(
    subscribeCozyCursor,
    readCozyCursor,
    () => true,
  )
  const avatarSectionRef = useRef<HTMLDivElement | null>(null)
  const usernameRequestSeq = useRef(0)

  useEffect(() => {
    if (!toast) return
    const timeout = setTimeout(() => {
      setToast(null)
    }, 3200)
    return () => clearTimeout(timeout)
  }, [toast])

  // La cuenta atrás del bloqueo se refresca cada minuto, pero solo mientras
  // hay bloqueo: si no, era un render por minuto de toda la pantalla para no
  // cambiar nada.
  useEffect(() => {
    if (!usernameLockedUntil) return
    const interval = setInterval(() => {
      setNowMs(Date.now())
    }, 60000)
    return () => clearInterval(interval)
  }, [usernameLockedUntil])

  // El <html> se sirve siempre con el cursor activo: aquí se aplica lo que el
  // usuario tenga guardado.
  useEffect(() => {
    document.documentElement.setAttribute('data-cozy-cursor', cozyCursorEnabled ? 'on' : 'off')
  }, [cozyCursorEnabled])

  const toggleCozyCursor = () => {
    const next = !cozyCursorEnabled
    cozyCursorFallback = next
    try {
      localStorage.setItem(COZY_CURSOR_STORAGE_KEY, String(next))
    } catch {
      /* Preferencia no persistida (modo privado): se aplica solo en esta sesión. */
    }
    document.documentElement.setAttribute('data-cozy-cursor', next ? 'on' : 'off')
    window.dispatchEvent(new Event(COZY_CURSOR_EVENT))
  }

  /* ─── Nombre visible ─────────────────────────────────────────────────── */

  const trimmedDraft = displayNameDraft.trim()
  const isNameUnchanged = trimmedDraft === (profile?.display_name ?? '').trim()
  const isNameValid = DISPLAY_NAME_REGEX.test(trimmedDraft)

  /* ─── Username ───────────────────────────────────────────────────────── */

  const currentUsername = profile?.username ?? ''
  const usernameValue = usernameDraft ?? currentUsername
  const normalizedUsername = normalizeUsernameInput(usernameValue)
  const isUsernameUnchanged = normalizedUsername === currentUsername
  const isUsernameLocked = !!usernameLockedUntil && new Date(usernameLockedUntil).getTime() > nowMs
  const usernameLockDate = usernameLockedUntil ? new Date(usernameLockedUntil) : null
  // `round` y no `ceil`: recién cambiado quedan 30 días justos y unos
  // milisegundos, y `ceil` los presentaba como 31 sobre un bloqueo de 30.
  const usernameRemainingDays =
    usernameLockDate && isUsernameLocked
      ? Math.max(1, Math.round((usernameLockDate.getTime() - nowMs) / 86400000))
      : 0

  // Lo que se puede saber sin preguntar al servidor se decide al pintar; el
  // estado guarda solo la respuesta remota, así no hay renders en cascada.
  const usernameCheck: UsernameCheck = useMemo(() => {
    if (usernameDraft === null || !normalizedUsername) return 'idle'
    if (normalizedUsername === currentUsername) return 'current'
    if (!USERNAME_REGEX.test(normalizedUsername)) return 'invalid'
    if (remoteCheck && remoteCheck.username === normalizedUsername) return remoteCheck.status
    return 'checking'
  }, [currentUsername, normalizedUsername, remoteCheck, usernameDraft])

  // Comprobación en vivo contra el mismo endpoint que usa el onboarding. Con
  // retardo (no una petición por tecla) y con guarda de secuencia: escribir
  // rápido no debe dejar que una respuesta vieja pise a la buena.
  useEffect(() => {
    if (usernameDraft === null || isUsernameLocked) return
    if (!normalizedUsername || normalizedUsername === currentUsername) return
    if (!USERNAME_REGEX.test(normalizedUsername)) return

    const seq = ++usernameRequestSeq.current
    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailability(
          apiUrl,
          authenticatedFetch,
          normalizedUsername,
          controller.signal,
        )
        if (seq !== usernameRequestSeq.current) return
        setRemoteCheck({
          username: normalizedUsername,
          status: available ? 'available' : 'taken',
        })
      } catch {
        if (seq !== usernameRequestSeq.current || controller.signal.aborted) return
        setRemoteCheck({ username: normalizedUsername, status: 'error' })
      }
    }, USERNAME_CHECK_DELAY_MS)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [
    apiUrl,
    authenticatedFetch,
    currentUsername,
    isUsernameLocked,
    normalizedUsername,
    usernameDraft,
  ])

  const usernameFeedback: { tone: 'ok' | 'bad' | 'muted'; icon: string; text: string } | null =
    useMemo(() => {
      if (isUsernameLocked) return null
      switch (usernameCheck) {
        case 'checking':
          return { tone: 'muted', icon: 'hourglass_top', text: 'Comprobando…' }
        case 'available':
          return { tone: 'ok', icon: 'check_circle', text: 'Disponible' }
        case 'taken':
          return { tone: 'bad', icon: 'cancel', text: 'Ya está en uso' }
        case 'invalid':
          return {
            tone: 'bad',
            icon: 'error',
            text: 'De 3 a 20 caracteres: minúsculas, números, punto y guion bajo',
          }
        case 'error':
          return { tone: 'muted', icon: 'wifi_off', text: 'No se pudo comprobar ahora mismo' }
        default:
          return null
      }
    }, [isUsernameLocked, usernameCheck])

  /* ─── Etiquetas del carné ────────────────────────────────────────────── */

  const createdAtText = profile?.created_at ? formatDate(new Date(profile.created_at)) : '—'
  const goalLabel = profile?.main_goal ? MAIN_GOAL_LABEL[profile.main_goal] : 'Sin definir'
  const universityLabel = profile?.university?.name ?? 'Sin universidad'
  const specialtyLabel = profile?.mir_specialty?.name ?? 'Sin definir'

  /* ─── Acciones ───────────────────────────────────────────────────────── */

  const openNameEditor = () => {
    if (!profile) return
    setDisplayNameDraft(profile.display_name)
    setNameValidationError(null)
    setIsEditingName(true)
  }

  const cancelNameEditor = () => {
    setDisplayNameDraft(profile?.display_name ?? '')
    setNameValidationError(null)
    setIsEditingName(false)
  }

  const saveDisplayName = async () => {
    if (!isNameValid) {
      setNameValidationError('Entre 2 y 16 caracteres: letras, números y espacios.')
      return
    }
    if (isNameUnchanged) {
      setIsEditingName(false)
      return
    }

    setNameValidationError(null)
    const result = await updateDisplayName(trimmedDraft)
    if (result.ok) {
      setToast({ type: 'success', message: 'Nombre actualizado.' })
      setIsEditingName(false)
      return
    }
    setToast({ type: 'error', message: result.error ?? 'No se pudo actualizar el nombre.' })
  }

  const selectAvatar = async (avatarId: number) => {
    if (profile?.avatar_id === avatarId) return
    const result = await updateAvatar(avatarId)
    if (result.ok) {
      setToast({ type: 'success', message: 'Avatar actualizado.' })
      return
    }
    setToast({ type: 'error', message: result.error ?? 'No se pudo actualizar el avatar.' })
  }

  const handleUsernameChange = async () => {
    if (!USERNAME_REGEX.test(normalizedUsername)) return
    if (isUsernameUnchanged || isUsernameLocked) return

    const result = await updateUsername(normalizedUsername)
    if (result.ok) {
      setToast({ type: 'success', message: 'Username actualizado.' })
      setUsernameDraft(null)
      setRemoteCheck(null)
      return
    }

    if (result.nextAvailableAt) {
      const nextDate = new Date(result.nextAvailableAt)
      setUsernameDraft(null)
      setRemoteCheck(null)
      setToast({
        type: 'error',
        message: `Podrás cambiarlo otra vez el ${formatDate(nextDate)}.`,
      })
      return
    }

    setToast({ type: 'error', message: result.error ?? 'No se pudo actualizar el username.' })
  }

  const saveAcademic = async (payload: AcademicPayload) => {
    const result = await updateAcademic(payload)
    if (result.ok) {
      setToast({ type: 'success', message: 'Datos actualizados.' })
      setIsEditingDetails(false)
      return
    }
    setToast({ type: 'error', message: result.error ?? 'No se pudieron guardar los datos.' })
  }

  // La foto del carné es un atajo al selector: se baja hasta la galería y se
  // marca un instante para que se vea a dónde ha ido la página.
  const scrollToAvatars = useCallback(() => {
    const node = avatarSectionRef.current
    if (!node) return
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    node.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
  }, [])

  /* ─── Estados de carga y error ───────────────────────────────────────── */

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-64 rounded-3xl border-2 border-[#EAE4E2] bg-white" />
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            <div className="h-32 rounded-3xl border-2 border-[#EAE4E2] bg-white" />
            <div className="h-32 rounded-3xl border-2 border-[#EAE4E2] bg-white" />
            <div className="h-72 rounded-3xl border-2 border-[#EAE4E2] bg-white" />
          </div>
          <div className="space-y-6">
            <div className="h-40 rounded-3xl border-2 border-[#EAE4E2] bg-white" />
            <div className="h-40 rounded-3xl border-2 border-[#EAE4E2] bg-white" />
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <StickerCard className="p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-[#2c3e50] bg-[#FBEAE4] text-[#C4655A]">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }} aria-hidden>
              person_off
            </span>
          </span>
          <div>
            <p className="text-base font-black text-[#2C3E50]">No se pudo cargar el perfil</p>
            <p className="mt-1 text-sm text-[#7D8A96]">
              {error ?? 'Vuelve a intentarlo en unos segundos.'}
            </p>
          </div>
        </div>
      </StickerCard>
    )
  }

  return (
    <div className="space-y-7">
      <ProfileHero
        profile={profile}
        onEditAvatar={scrollToAvatars}
        avatarBusy={updatingAvatar}
        onEditDetails={() => setIsEditingDetails(true)}
        sheenPaused={isEditingDetails}
        goalLabel={goalLabel}
        yearLabel={formatMedicalYear(profile.medical_year)}
        specialtyLabel={specialtyLabel}
        universityLabel={universityLabel}
        createdAtText={createdAtText}
        daysWithUs={daysSince(profile.created_at)}
      />

      <div className="grid gap-7 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        {/* ─── Columna principal: lo que se edita ───────────────────────── */}
        <div className="min-w-0 space-y-7">
          <section>
            <SectionLabel>Identidad</SectionLabel>

            <div className="space-y-4">
              {/* Nombre visible */}
              <StickerCard className="p-5" depth={4}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-[#2C3E50]">Nombre visible</h2>
                    <p className="mt-1 text-sm text-[#7D8A96]">
                      Es el nombre con el que apareces en rankings, salas y partidas.
                    </p>
                  </div>
                  {!isEditingName ? (
                    <GhostButton icon="edit" onClick={openNameEditor}>
                      Editar
                    </GhostButton>
                  ) : null}
                </div>

                {!isEditingName ? (
                  <p className="mt-4 text-2xl font-black tracking-tight text-[#2C3E50]">
                    {profile.display_name}
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <InkInput
                        value={displayNameDraft}
                        onChange={(value) => {
                          setDisplayNameDraft(value)
                          if (nameValidationError) setNameValidationError(null)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') saveDisplayName()
                          if (event.key === 'Escape') cancelNameEditor()
                        }}
                        disabled={updatingDisplayName}
                        maxLength={16}
                        ariaLabel="Nombre visible"
                        autoFocus
                        invalid={!!nameValidationError}
                      />
                      <div className="flex gap-2">
                        <StickerButton
                          icon="check"
                          onClick={saveDisplayName}
                          disabled={updatingDisplayName || !isNameValid || isNameUnchanged}
                        >
                          {updatingDisplayName ? 'Guardando…' : 'Guardar'}
                        </StickerButton>
                        <GhostButton onClick={cancelNameEditor} disabled={updatingDisplayName}>
                          Cancelar
                        </GhostButton>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p
                        className={`text-xs font-bold ${
                          nameValidationError ? 'text-[#C4655A]' : 'text-[#7D8A96]'
                        }`}
                      >
                        {nameValidationError ?? 'Letras, números y espacios. Enter guarda, Esc cancela.'}
                      </p>
                      <span className="text-xs font-black tabular-nums text-[#B9B2AD]">
                        {trimmedDraft.length}/16
                      </span>
                    </div>
                  </div>
                )}
              </StickerCard>

              {/* Username */}
              <StickerCard className="p-5" depth={4}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-[#2C3E50]">Username</h2>
                    <p className="mt-1 text-sm text-[#7D8A96]">
                      Tu identificador único. Al cambiarlo se bloquea una temporada, así que
                      compruébalo antes de gastarlo.
                    </p>
                  </div>
                  <DocChip icon="alternate_email" tone="ink">
                    {profile.username}
                  </DocChip>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <InkInput
                    value={usernameValue}
                    onChange={(value) => setUsernameDraft(value.toLowerCase())}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && usernameCheck === 'available') {
                        handleUsernameChange()
                      }
                    }}
                    disabled={updatingUsername || isUsernameLocked}
                    maxLength={20}
                    prefix="@"
                    ariaLabel="Username"
                    invalid={usernameCheck === 'invalid' || usernameCheck === 'taken'}
                  />
                  <StickerButton
                    icon="badge"
                    onClick={handleUsernameChange}
                    disabled={
                      updatingUsername ||
                      isUsernameUnchanged ||
                      isUsernameLocked ||
                      usernameCheck !== 'available'
                    }
                    className="sm:shrink-0"
                  >
                    {updatingUsername ? 'Cambiando…' : 'Cambiar'}
                  </StickerButton>
                </div>

                {isUsernameLocked && usernameLockDate ? (
                  <div className="mt-3 flex items-start gap-2 rounded-2xl border-2 border-[#F1D3C9] bg-[#FFF4EF] px-3 py-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#B9705F]">
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden>
                        lock_clock
                      </span>
                    </span>
                    <p className="text-xs font-bold leading-relaxed text-[#B9705F]">
                      Bloqueado hasta el {formatDate(usernameLockDate)} — quedan{' '}
                      {usernameRemainingDays} {usernameRemainingDays === 1 ? 'día' : 'días'}.
                    </p>
                  </div>
                ) : usernameFeedback ? (
                  <p
                    className={`mt-3 flex items-center gap-1.5 text-xs font-bold ${
                      usernameFeedback.tone === 'ok'
                        ? 'text-[#5F7E5C]'
                        : usernameFeedback.tone === 'bad'
                          ? 'text-[#C4655A]'
                          : 'text-[#7D8A96]'
                    }`}
                  >
                    <span className="flex h-4 w-4 items-center justify-center">
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }} aria-hidden>
                        {usernameFeedback.icon}
                      </span>
                    </span>
                    {usernameFeedback.text}
                  </p>
                ) : null}
              </StickerCard>
            </div>
          </section>

          {/* Avatares */}
          <section ref={avatarSectionRef}>
            <SectionLabel
              right={
                updatingAvatar ? (
                  <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-[#7D8A96]">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#E8A598] border-t-transparent" />
                    Guardando
                  </span>
                ) : null
              }
            >
              Tu foto de carné
            </SectionLabel>
            <StickerCard className="p-5" depth={4}>
              <AvatarSelector
                selectedAvatarId={profile.avatar_id}
                disabled={updatingAvatar}
                onSelect={selectAvatar}
                variant="sticker"
              />
              <p className="mt-4 text-xs font-bold text-[#7D8A96]">
                El cambio se ve al momento, sin recargar la página.
              </p>
            </StickerCard>
          </section>
        </div>

        {/* ─── Columna lateral: lo que solo se consulta ─────────────────── */}
        <aside className="min-w-0 space-y-6 lg:sticky lg:top-24">
          <section>
            <SectionLabel>Cuenta</SectionLabel>
            <StickerCard className="p-5" depth={4}>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7D8A96]/80">
                    Correo
                  </p>
                  <p className="mt-0.5 break-all text-sm font-bold text-[#2C3E50]">{profile.email}</p>
                </div>
                <div className="h-px bg-[#EFE9E6]" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7D8A96]/80">
                    Datos del carné
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[#7D8A96]">
                    Bio, objetivo, curso, especialidad, universidad y visibilidad.
                  </p>
                  <GhostButton
                    icon="edit_note"
                    onClick={() => setIsEditingDetails(true)}
                    className="mt-3 w-full"
                  >
                    Editar datos
                  </GhostButton>
                </div>
              </div>
            </StickerCard>
          </section>

          <section>
            <SectionLabel>Preferencias</SectionLabel>
            <StickerCard className="p-5" depth={4}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-black text-[#2C3E50]">Cursor Cozy Pebble</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#7D8A96]">
                    Sustituye el puntero del sistema por el guijarro de marca. Solo en pantallas con
                    ratón.
                  </p>
                </div>
                <InkSwitch
                  checked={cozyCursorEnabled}
                  onChange={toggleCozyCursor}
                  label="Activar o desactivar el cursor de marca"
                />
              </div>
              <p className="mt-3 text-[11px] font-black uppercase tracking-wide text-[#B9B2AD]">
                {cozyCursorEnabled ? 'Activado' : 'Desactivado'}
              </p>
            </StickerCard>
          </section>

          <section>
            <SectionLabel>Atajos</SectionLabel>
            <StickerCard className="divide-y-2 divide-[#F1ECE9]" depth={4}>
              {[
                { href: '/panel', icon: 'insights', label: 'Panel de rendimiento' },
                { href: '/notifications', icon: 'notifications', label: 'Notificaciones' },
                { href: '/studio', icon: 'auto_stories', label: 'Estudio' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center gap-3 px-5 py-3.5 first:rounded-t-3xl last:rounded-b-3xl hover:bg-[#FFF8F6]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 border-[#EAE4E2] bg-white text-[#7D8A96] transition-colors group-hover:border-[#2c3e50] group-hover:text-[#2C3E50]">
                    <span className="material-symbols-outlined" style={{ fontSize: 17 }} aria-hidden>
                      {item.icon}
                    </span>
                  </span>
                  <span className="flex-1 text-sm font-bold text-[#2C3E50]">{item.label}</span>
                  <span className="flex h-5 w-5 items-center justify-center text-[#B9B2AD] transition-transform group-hover:translate-x-0.5">
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden>
                      chevron_right
                    </span>
                  </span>
                </Link>
              ))}
            </StickerCard>
          </section>

          {error ? (
            <p className="rounded-2xl border-2 border-[#F1D3C9] bg-[#FFF4EF] px-4 py-3 text-sm font-bold text-[#C4655A]">
              {error}
            </p>
          ) : null}
        </aside>
      </div>

      <AnimatePresence>
        {isEditingDetails ? (
          <AcademicEditor
            profile={profile}
            saving={updatingAcademic}
            onCancel={() => setIsEditingDetails(false)}
            onSave={saveAcademic}
          />
        ) : null}
      </AnimatePresence>

      {/* Aviso flotante */}
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={`${toast.type}-${toast.message}`}
            className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-2xl border-2 border-[#2c3e50] px-4 py-3 text-sm font-black"
            style={{
              backgroundColor: toast.type === 'success' ? '#EAF2E8' : '#FBEAE4',
              color: toast.type === 'success' ? '#5F7E5C' : '#C4655A',
              boxShadow: `4px 4px 0 0 ${INK}`,
            }}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            role="status"
          >
            <span className="flex h-5 w-5 items-center justify-center">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden>
                {toast.type === 'success' ? 'check_circle' : 'error'}
              </span>
            </span>
            {toast.message}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

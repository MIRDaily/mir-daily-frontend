'use client'

import { useEffect, useState } from 'react'
import AvatarSelector from '@/components/Profile/AvatarSelector'
import AvatarBadge from '@/components/Profile/AvatarBadge'
import { useProfile } from '@/hooks/useProfile'
import { USERNAME_REGEX } from '@/lib/profile'

type ToastState = {
  type: 'success' | 'error'
  message: string
} | null

const MAIN_GOAL_LABEL: Record<'prepare_mir' | 'reinforce_degree' | 'explore', string> = {
  prepare_mir: 'Preparar MIR',
  reinforce_degree: 'Reforzar carrera',
  explore: 'Explorar',
}

function formatMedicalYear(value: number | null | undefined) {
  if (value === null || value === undefined) return 'No definido'
  if (value === 0) return 'Medico graduado'
  return `${value}o de medicina`
}

export default function ProfileCard() {
  const {
    profile,
    loading,
    error,
    updatingAvatar,
    updatingDisplayName,
    updatingUsername,
    usernameLockedUntil,
    updateAvatar,
    updateDisplayName,
    updateUsername,
  } = useProfile()

  const [isEditingName, setIsEditingName] = useState(false)
  const [displayNameDraft, setDisplayNameDraft] = useState('')
  const [usernameDraft, setUsernameDraft] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [nameValidationError, setNameValidationError] = useState<string | null>(null)
  const [usernameValidationError, setUsernameValidationError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState>(null)

  useEffect(() => {
    if (!toast) return
    const timeout = setTimeout(() => {
      setToast(null)
    }, 2500)
    return () => clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const trimmedDraft = displayNameDraft.trim()
  const isNameUnchanged = trimmedDraft === (profile?.display_name ?? '').trim()
  const isNameValid = trimmedDraft.length >= 2 && trimmedDraft.length <= 16
  const usernameValue = usernameDraft ?? profile?.username ?? ''
  const normalizedUsername = usernameValue.trim().toLowerCase()
  const isUsernameValid = USERNAME_REGEX.test(normalizedUsername)
  const isUsernameUnchanged = normalizedUsername === (profile?.username ?? '')
  const isUsernameLocked =
    !!usernameLockedUntil && new Date(usernameLockedUntil).getTime() > nowMs
  const usernameLockDate = usernameLockedUntil
    ? new Date(usernameLockedUntil)
    : null
  const usernameRemainingDays =
    usernameLockDate && isUsernameLocked
      ? Math.max(1, Math.ceil((usernameLockDate.getTime() - nowMs) / 86400000))
      : 0

  const createdAtText = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('es-ES')
    : '--'
  const profileTitle = profile?.display_name || 'Usuario MIRDaily'
  const mainGoalLabel =
    profile?.main_goal ? MAIN_GOAL_LABEL[profile.main_goal] : 'Sin objetivo'
  const universityLabel = profile?.university
    ? `${profile.university.name} (${profile.university.country})`
    : 'Sin universidad'
  const mirSpecialtyLabel = profile?.mir_specialty?.name ?? 'Sin especialidad'
  const profileVisibilityLabel = profile?.profile_public ? 'Perfil publico' : 'Perfil privado'

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
      setNameValidationError('El nombre visible debe tener entre 2 y 16 caracteres.')
      return
    }
    if (isNameUnchanged) return

    setNameValidationError(null)
    const result = await updateDisplayName(trimmedDraft)
    if (result.ok) {
      setToast({ type: 'success', message: 'Nombre actualizado.' })
      setIsEditingName(false)
      return
    }
    setToast({
      type: 'error',
      message: result.error ?? 'No se pudo actualizar el nombre.',
    })
  }

  const selectAvatar = async (avatarId: number) => {
    if (profile?.avatar_id === avatarId) return
    const result = await updateAvatar(avatarId)
    if (result.ok) {
      setToast({ type: 'success', message: 'Avatar actualizado.' })
      return
    }
    setToast({
      type: 'error',
      message: result.error ?? 'No se pudo actualizar el avatar.',
    })
  }

  const handleUsernameChange = async () => {
    if (!isUsernameValid) {
      setUsernameValidationError('El username debe tener entre 3 y 20 caracteres.')
      return
    }
    if (isUsernameUnchanged || isUsernameLocked) return

    setUsernameValidationError(null)
    const result = await updateUsername(normalizedUsername)
    if (result.ok) {
      setToast({ type: 'success', message: 'Username actualizado.' })
      setUsernameDraft(null)
      return
    }

    if (result.nextAvailableAt) {
      const nextDate = new Date(result.nextAvailableAt)
      setUsernameDraft(null)
      setUsernameValidationError(null)
      setToast({
        type: 'error',
        message: `Puedes cambiar tu username otra vez el ${nextDate.toLocaleDateString('es-ES')}.`,
      })
      return
    }

    setToast({
      type: 'error',
      message: result.error ?? 'No se pudo actualizar el username.',
    })
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-[#E9E4E1] bg-white p-6 md:p-8 shadow-[0_18px_50px_rgba(45,55,72,0.07)] animate-pulse">
        <div className="h-24 rounded-2xl bg-[#F3EFEC]" />
        <div className="mt-6 h-10 w-72 rounded-xl bg-[#F3EFEC]" />
        <div className="mt-4 h-10 w-72 rounded-xl bg-[#F3EFEC]" />
        <div className="mt-8 grid grid-cols-3 sm:grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="h-24 rounded-2xl bg-[#F3EFEC]" />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-[#E9E4E1] bg-white shadow-[0_18px_50px_rgba(45,55,72,0.07)]">
      <div className="relative border-b border-[#E9E4E1] bg-[linear-gradient(120deg,#fffdfb_0%,#fff5ef_55%,#fde8df_100%)] p-6 md:p-8">
        <div className="absolute -top-16 -right-16 h-44 w-44 rounded-full bg-[#E8A598]/15 blur-2xl" />
        <div className="relative flex flex-col gap-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-full border border-[#E8A598]/30 bg-white p-1 shadow-sm">
                <AvatarBadge
                  avatarId={profile?.avatar_id ?? 1}
                  size={84}
                  alt={`Avatar de ${profileTitle}`}
                  textSizeClassName="text-2xl"
                />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-[#2D3748]">{profileTitle}</h2>
                <p className="text-sm text-[#7D8A96]">@{profile?.username ?? '--'}</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-[#E9E4E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#7D8A96]">
              <span className="material-symbols-outlined text-[15px]">event</span>
              Miembro desde {createdAtText}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E9E4E1] bg-white px-3 py-1 text-xs font-semibold text-[#7D8A96]">
              <span className="material-symbols-outlined text-[15px]">flag</span>
              {mainGoalLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E9E4E1] bg-white px-3 py-1 text-xs font-semibold text-[#7D8A96]">
              <span className="material-symbols-outlined text-[15px]">school</span>
              {formatMedicalYear(profile?.medical_year)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E9E4E1] bg-white px-3 py-1 text-xs font-semibold text-[#7D8A96]">
              <span className="material-symbols-outlined text-[15px]">stethoscope</span>
              {mirSpecialtyLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E9E4E1] bg-white px-3 py-1 text-xs font-semibold text-[#7D8A96]">
              <span className="material-symbols-outlined text-[15px]">visibility</span>
              {profileVisibilityLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-7 p-6 md:p-8">
          {!profile ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error ?? 'No se pudo cargar el perfil.'}
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-[#E9E4E1] bg-[#FAF7F4] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#7D8A96]">
                  Cuenta
                </p>
                <p className="mt-3 text-sm text-[#2D3748]">
                  <span className="font-semibold">Email:</span> {profile.email}
                </p>
                <p className="mt-1 text-sm text-[#2D3748]">
                  <span className="font-semibold">Username actual:</span> {profile.username}
                </p>
              </div>

              <div className="rounded-2xl border border-[#E9E4E1] bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#7D8A96]">
                  Perfil academico
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#E9E4E1] bg-[#FAF7F4] px-4 py-3">
                    <p className="text-xs text-[#7D8A96]">Objetivo principal</p>
                    <p className="mt-1 text-sm font-semibold text-[#2D3748]">{mainGoalLabel}</p>
                  </div>
                  <div className="rounded-xl border border-[#E9E4E1] bg-[#FAF7F4] px-4 py-3">
                    <p className="text-xs text-[#7D8A96]">Curso actual</p>
                    <p className="mt-1 text-sm font-semibold text-[#2D3748]">
                      {formatMedicalYear(profile.medical_year)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#E9E4E1] bg-[#FAF7F4] px-4 py-3">
                    <p className="text-xs text-[#7D8A96]">Especialidad MIR</p>
                    <p className="mt-1 text-sm font-semibold text-[#2D3748]">{mirSpecialtyLabel}</p>
                  </div>
                  <div className="rounded-xl border border-[#E9E4E1] bg-[#FAF7F4] px-4 py-3">
                    <p className="text-xs text-[#7D8A96]">Universidad</p>
                    <p className="mt-1 text-sm font-semibold text-[#2D3748]">{universityLabel}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#7D8A96]">
                  Username
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    value={usernameValue}
                    onChange={(event) => {
                      setUsernameDraft(event.target.value.toLowerCase())
                      if (usernameValidationError) setUsernameValidationError(null)
                    }}
                    className="w-full rounded-xl border border-[#E9E4E1] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A598]/30"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={20}
                    disabled={updatingUsername || isUsernameLocked}
                  />
                  <button
                    type="button"
                    onClick={handleUsernameChange}
                    disabled={
                      updatingUsername ||
                      !normalizedUsername ||
                      !isUsernameValid ||
                      isUsernameUnchanged ||
                      isUsernameLocked
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E8A598] px-4 py-3 text-sm font-semibold text-white hover:bg-[#E08E7D] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[18px]">badge</span>
                    {updatingUsername ? 'Actualizando...' : 'Cambiar username'}
                  </button>
                </div>
                {isUsernameLocked && usernameLockDate ? (
                  <p className="mt-2 text-sm text-[#7D8A96]">
                    Puedes cambiar tu username otra vez el{' '}
                    {usernameLockDate.toLocaleDateString('es-ES')} ({usernameRemainingDays}{' '}
                    dias restantes).
                  </p>
                ) : null}
                {usernameValidationError ? (
                  <p className="mt-2 text-sm text-red-600">{usernameValidationError}</p>
                ) : null}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#7D8A96]">
                  Display name
                </p>
                {!isEditingName ? (
                  <div className="flex items-center gap-3">
                    <p className="text-xl font-bold text-[#2D3748]">{profile.display_name}</p>
                    <button
                      type="button"
                      onClick={openNameEditor}
                      className="inline-flex items-center justify-center rounded-lg border border-[#E9E4E1] px-2.5 py-1.5 text-sm font-semibold text-[#7D8A96] hover:border-[#E8A598]/50 hover:text-[#E8A598]"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      value={displayNameDraft}
                      onChange={(event) => setDisplayNameDraft(event.target.value)}
                      className="w-full rounded-xl border border-[#E9E4E1] bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A598]/30"
                      maxLength={16}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={saveDisplayName}
                        disabled={updatingDisplayName || !isNameValid || isNameUnchanged}
                        className="rounded-xl bg-[#E8A598] px-4 py-3 text-sm font-semibold text-white hover:bg-[#E08E7D] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updatingDisplayName ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelNameEditor}
                        disabled={updatingDisplayName}
                        className="rounded-xl border border-[#E9E4E1] px-4 py-3 text-sm font-semibold text-[#7D8A96] hover:border-[#E8A598]/40 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
                {(nameValidationError || error) && isEditingName ? (
                  <p className="mt-2 text-sm text-red-600">{nameValidationError ?? error}</p>
                ) : null}
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#7D8A96]">
                  Selecciona tu avatar
                </p>
                <AvatarSelector
                  selectedAvatarId={profile.avatar_id}
                  disabled={updatingAvatar}
                  onSelect={selectAvatar}
                />
              </div>
            </>
          )}
        </div>

        <aside className="border-t border-[#E9E4E1] bg-[#FFFCFA] p-6 xl:border-l xl:border-t-0">
          <div className="rounded-2xl border border-[#E9E4E1] bg-white p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#7D8A96]">Guia rapida</h3>
            <ul className="mt-3 space-y-2 text-sm text-[#4B5563]">
              <li>Actualiza username solo cuando sea necesario.</li>
              <li>Usa display name para mostrar tu identidad en ranking.</li>
              <li>El avatar se refleja sin recargar la pagina.</li>
            </ul>
          </div>
          <div className="mt-4 rounded-2xl border border-[#E9E4E1] bg-white p-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#7D8A96]">
              Preferencias actuales
            </h3>
            <div className="mt-3 space-y-2 text-sm text-[#4B5563]">
              <p>
                <span className="font-semibold">Objetivo:</span> {mainGoalLabel}
              </p>
              <p>
                <span className="font-semibold">Visibilidad:</span> {profileVisibilityLabel}
              </p>
              <p>
                <span className="font-semibold">Facultad:</span> {universityLabel}
              </p>
            </div>
          </div>
          {error ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </aside>
      </div>

      {toast ? (
        <div
          className={`fixed bottom-5 right-5 z-50 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </section>
  )
}

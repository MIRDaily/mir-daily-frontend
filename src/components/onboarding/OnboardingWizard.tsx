'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useRouter } from 'next/navigation'
import AvatarBadge from '@/components/Profile/AvatarBadge'
import AvatarSelector from '@/components/Profile/AvatarSelector'
import { useAuth } from '@/hooks/useAuth'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import {
  CUSTOM_UNIVERSITY_MAX_LENGTH,
  DISPLAY_NAME_REGEX,
  USERNAME_REGEX,
  normalizeDisplayNameInput,
  normalizeUsernameInput,
} from '@/lib/profile'
import { setOnboardingDeferredFlag } from '@/lib/onboarding'
import {
  fetchUniversities,
  submitOnboarding,
  updateAvatarRealtime,
  type MainGoal,
  type OnboardingPayload,
  type University,
} from '@/services/profileOnboardingService'

type OnboardingState = {
  displayName: string
  username: string
  avatarId: number
  mainGoal: MainGoal | null
  universityId: number | null
  customUniversity: string
  useCustomUniversity: boolean
  medicalYear: number | null
  mirSpecialty: string
  profilePublic: boolean
}

type OnboardingContextValue = {
  state: OnboardingState
  setState: Dispatch<SetStateAction<OnboardingState>>
  mustUpdateDisplayName: boolean
  originalDisplayName: string
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

function useOnboardingState() {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboardingState debe usarse dentro de OnboardingContext')
  }
  return context
}

function toPayload(state: OnboardingState, useCurrentDisplayAndUser = false): OnboardingPayload {
  const displayName = normalizeDisplayNameInput(state.displayName)
  const username = normalizeUsernameInput(state.username)
  const customUniversity = state.customUniversity.trim()

  return {
    displayName,
    username,
    medicalYear: useCurrentDisplayAndUser ? null : state.medicalYear,
    mirSpecialty: useCurrentDisplayAndUser ? null : state.mirSpecialty.trim() || null,
    mainGoal: useCurrentDisplayAndUser ? null : state.mainGoal,
    universityId: useCurrentDisplayAndUser ? null : state.useCustomUniversity ? null : state.universityId,
    customUniversity:
      useCurrentDisplayAndUser || !state.useCustomUniversity ? null : customUniversity || null,
    profilePublic: useCurrentDisplayAndUser ? false : state.profilePublic,
  }
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {[1, 2, 3, 4].map((value) => (
        <div
          key={value}
          className={`h-2 w-14 rounded-full ${
            value <= step ? 'bg-[#E8A598]' : 'bg-[#E9E4E1]'
          }`}
        />
      ))}
    </div>
  )
}

function StepOne({
  disabledSkip,
  onStart,
  onSkip,
  loading,
  error,
}: {
  disabledSkip: boolean
  onStart: () => void
  onSkip: () => void
  loading: boolean
  error: string | null
}) {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#FAF7F4] pt-20 text-[#7D8A96]">
      <header className="fixed inset-x-0 top-0 z-10 border-b border-transparent bg-[#FAF7F4]/80 px-6 py-4 backdrop-blur-sm md:px-10">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 text-[#E8A598]">
              <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M42.4379 44C42.4379 44 36.0744 33.9038 41.1692 24C46.8624 12.9336 42.2078 4 42.2078 4L7.01134 4C7.01134 4 11.6577 12.932 5.96912 23.9969C0.876273 33.9029 7.27094 44 7.27094 44L42.4379 44Z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold tracking-[-0.015em] text-[#7D8A96]">MIRDaily</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm font-medium text-[#7D8A96]/60 sm:inline-block">
              Paso 1 de 4
            </span>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full w-1/4 rounded-full bg-[#E8A598]" />
            </div>
          </div>
        </div>
      </header>

      <div className="absolute left-10 top-20 -z-10 h-64 w-64 animate-pulse rounded-full bg-[#E8A598]/10 blur-3xl [animation-duration:4s]" />
      <div className="absolute bottom-10 right-10 -z-10 h-96 w-96 rounded-full bg-[#8BA888]/10 blur-3xl" />

      <div className="flex flex-1 items-center justify-center p-4">
        <section className="flex w-full max-w-[640px] flex-col items-center rounded-2xl border border-[#E3DEDD]/50 bg-white p-8 text-center shadow-[0_4px_20px_-2px_rgba(125,138,150,0.05)] md:p-14">
          <div className="mb-8 flex items-center justify-center rounded-full bg-[#E8A598]/10 p-5 ring-4 ring-[#E8A598]/5">
            <span className="material-symbols-outlined text-[#E8A598]" style={{ fontSize: 48 }}>
              auto_awesome
            </span>
          </div>
          <h1 className="mb-6 text-3xl font-bold leading-tight tracking-tight text-[#2C3E50] md:text-4xl">
            Bienvenido a MIRDaily
          </h1>
          <p className="mx-auto mb-10 max-w-lg text-lg leading-relaxed text-[#7D8A96]">
            Tu camino MIR, diseñado desde el primer día. Nuestra IA predictiva adaptará el
            estudio a tu ritmo para maximizar tus resultados.
          </p>

          {disabledSkip ? (
            <p className="mb-4 w-full max-w-xs rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Debes actualizar tu nombre de perfil antes de entrar.
            </p>
          ) : null}
          {error ? (
            <p className="mb-4 w-full max-w-xs rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex w-full max-w-xs flex-col gap-4">
            <button
              type="button"
              onClick={onStart}
              className="h-12 w-full rounded-xl bg-[#E8A598] px-6 text-base font-bold text-white shadow-lg shadow-[#E8A598]/20 transition-all duration-200 hover:scale-[1.02] hover:bg-[#D68C7F] active:scale-[0.98]"
            >
              Configurar mi perfil
            </button>
            <button
              type="button"
              onClick={onSkip}
              disabled={loading || disabledSkip}
              className="py-2 text-center text-sm font-medium text-[#7D8A96] transition-colors hover:text-[#2C3E50] disabled:opacity-60"
            >
              {loading ? 'Guardando...' : 'Omitir por ahora'}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}

function StepTwo({
  universities,
  loadingUniversities,
  avatarSaving,
  onAvatarChange,
  onNext,
  onBack,
}: {
  universities: University[]
  loadingUniversities: boolean
  avatarSaving: boolean
  onAvatarChange: (avatarId: number) => void
  onNext: () => void
  onBack: () => void
}) {
  const { state, setState } = useOnboardingState()
  const groupedUniversities = useMemo(() => {
    return universities.reduce<Record<string, University[]>>((acc, university) => {
      if (!acc[university.country]) {
        acc[university.country] = []
      }
      acc[university.country].push(university)
      return acc
    }, {})
  }, [universities])

  const goalOptions: Array<{
    value: MainGoal
    label: string
    icon: string
  }> = [
    { value: 'prepare_mir', label: 'Preparar MIR', icon: 'school' },
    { value: 'reinforce_degree', label: 'Reforzar Carrera', icon: 'trending_up' },
    { value: 'explore', label: 'Explorar', icon: 'explore' },
  ]

  return (
    <section className="space-y-8">
      <div className="text-center">
        <h2 className="px-4 pb-3 text-3xl font-bold tracking-tight text-[#2C3E50] md:text-4xl">
          Personaliza tu Perfil
        </h2>
        <p className="mx-auto max-w-xl text-lg font-normal text-[#7D8A96]">
          Configura tu identidad para obtener simulacros más personalizados y conectar con tu
          comunidad.
        </p>
      </div>

      <div className="w-full rounded-2xl border border-[#E3DEDD] bg-[#FAF7F4] p-6 shadow-[0_4px_20px_-2px_rgba(125,138,150,0.05)] md:p-8">
        <div className="mb-8">
          <label className="mb-4 block text-sm font-bold text-[#2C3E50]">Tu Objetivo Principal</label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {goalOptions.map((goal) => {
              const selected = state.mainGoal === goal.value
              return (
                <button
                  key={goal.value}
                  type="button"
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      mainGoal: goal.value,
                    }))
                  }
                  className={`group relative flex flex-col items-center justify-center rounded-xl p-4 transition-all duration-200 ${
                    selected
                      ? 'border-2 border-[#E8A598] bg-[#FFF5F2] text-[#E8A598] shadow-sm'
                      : 'border border-gray-200 bg-white text-[#7D8A96] hover:border-[#E8A598]/50 hover:bg-white/80'
                  }`}
                >
                  <div
                    className={`mb-2 rounded-full p-2 shadow-sm ${
                      selected
                        ? 'bg-white text-[#E8A598]'
                        : 'bg-gray-50 text-[#7D8A96]/60 transition-colors group-hover:text-[#E8A598]'
                    }`}
                  >
                    <span className="material-symbols-outlined">{goal.icon}</span>
                  </div>
                  <span className={`text-sm ${selected ? 'font-bold' : 'font-medium'}`}>{goal.label}</span>
                  {selected ? (
                    <div className="absolute right-2 top-2 text-[#E8A598]">
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mb-8">
          <label className="mb-4 block text-sm font-bold text-[#2C3E50]">
            Seleccionar Foto de Perfil
          </label>
          <div className="flex flex-col items-center gap-6 sm:flex-row md:gap-8">
            <div className="relative shrink-0">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#E0F2F1] shadow-md">
                <AvatarBadge
                  avatarId={state.avatarId}
                  size={88}
                  alt="Avatar seleccionado"
                  textSizeClassName="text-2xl"
                />
              </div>
              <div className="absolute bottom-0 right-0 rounded-full border-2 border-white bg-[#E8A598] p-1.5 text-white shadow-sm">
                <span className="material-symbols-outlined text-[16px]">edit</span>
              </div>
            </div>
            <div className="hidden h-16 w-px bg-gray-200 sm:block" />
            <div className="flex-1">
              <AvatarSelector
                selectedAvatarId={state.avatarId}
                disabled={avatarSaving}
                onSelect={onAvatarChange}
              />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-bold text-[#2C3E50]">Nombre de Perfil</label>
            <input
              value={state.displayName}
              onChange={(event) =>
                setState((prev) => ({
                  ...prev,
                  displayName: normalizeDisplayNameInput(event.target.value),
                }))
              }
              maxLength={16}
              placeholder="Ej. Maria Garcia"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#2C3E50] outline-none transition-all placeholder:text-[#7D8A96]/40 focus:border-[#E8A598] focus:ring-[#E8A598]"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-[#2C3E50]">@Usuario</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-medium text-[#7D8A96]/40">
                  @
                </span>
                <input
                  value={state.username}
                  onChange={(event) =>
                    setState((prev) => ({
                      ...prev,
                      username: normalizeUsernameInput(event.target.value),
                    }))
                  }
                  placeholder="usuario_mir"
                  className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-4 text-[#2C3E50] outline-none transition-all placeholder:text-[#7D8A96]/40 focus:border-[#E8A598] focus:ring-[#E8A598]"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-[#2C3E50]">
                Facultad <span className="ml-1 font-normal text-[#7D8A96]/50">(Opcional)</span>
              </label>
              <div className="relative">
                <select
                  value={state.useCustomUniversity ? 'other' : state.universityId ?? ''}
                  onChange={(event) => {
                    const value = event.target.value
                    if (value === 'other') {
                      setState((prev) => ({
                        ...prev,
                        useCustomUniversity: true,
                        universityId: null,
                      }))
                      return
                    }
                    const nextId = value ? Number(value) : null
                    setState((prev) => ({
                      ...prev,
                      useCustomUniversity: false,
                      universityId: Number.isFinite(nextId) ? nextId : null,
                      customUniversity: '',
                    }))
                  }}
                  className="w-full cursor-pointer appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#2C3E50] outline-none transition-all focus:border-[#E8A598] focus:ring-[#E8A598]"
                  disabled={loadingUniversities}
                >
                  <option value="">
                    {loadingUniversities ? 'Cargando...' : 'Selecciona tu universidad'}
                  </option>
                  {Object.entries(groupedUniversities).map(([country, entries]) => (
                    <optgroup key={country} label={country}>
                      {entries.map((university) => (
                        <option key={university.id} value={university.id}>
                          {university.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  <option value="other">Otra universidad</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#7D8A96]/50">
                  <span className="material-symbols-outlined">expand_more</span>
                </div>
              </div>
            </div>
          </div>

          {state.useCustomUniversity ? (
            <div>
              <label className="mb-2 block text-sm font-bold text-[#2C3E50]">Otra universidad</label>
              <input
                value={state.customUniversity}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    customUniversity: event.target.value.slice(0, CUSTOM_UNIVERSITY_MAX_LENGTH),
                  }))
                }
                maxLength={CUSTOM_UNIVERSITY_MAX_LENGTH}
                placeholder="Escribe tu universidad"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-[#2C3E50] outline-none transition-all placeholder:text-[#7D8A96]/40 focus:border-[#E8A598] focus:ring-[#E8A598]"
              />
            </div>
          ) : null}
        </div>

        <div className="mt-8 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={onNext}
            className="h-12 w-full rounded-xl bg-[#E8A598] px-6 text-base font-bold text-white shadow-lg shadow-[#E8A598]/20 transition-all duration-200 hover:scale-[1.01] hover:bg-[#D68C7F]"
          >
            Continuar
          </button>
        </div>
      </div>

      <div className="mb-4 mt-8 flex flex-col items-center justify-center gap-6 px-4 sm:flex-row">
        <button
          type="button"
          onClick={onBack}
          className="group flex items-center gap-2 text-sm font-semibold text-[#7D8A96] transition-colors hover:text-[#2C3E50]"
        >
          <span className="material-symbols-outlined text-[18px] transition-transform group-hover:-translate-x-0.5">
            arrow_back
          </span>
          Atrás
        </button>
      </div>

      <p className="text-center text-xs text-[#7D8A96]">
        Todos estos datos son opcionales. Solo nos ayudan a personalizar tu experiencia.
      </p>
    </section>
  )
}

function StepThree({
  onBack,
  onNext,
  onSkip,
}: {
  onBack: () => void
  onNext: () => void
  onSkip: () => void
}) {
  const { state, setState } = useOnboardingState()
  const yearOptions: Array<{ value: number; label: string }> = [
    { value: 1, label: '1o' },
    { value: 2, label: '2o' },
    { value: 3, label: '3o' },
    { value: 4, label: '4o' },
    { value: 5, label: '5o' },
    { value: 6, label: '6o' },
    { value: 0, label: 'Medico 😎 (ya he terminado / repetidor)' },
  ]

  return (
    <section className="space-y-6">
      <div className="text-center">
        <h2 className="px-4 pb-3 text-3xl font-bold tracking-tight text-[#2C3E50] md:text-4xl">
          Configura tu Ruta de Estudio
        </h2>
        <p className="mx-auto max-w-2xl px-4 text-lg font-normal leading-normal text-[#7D8A96]">
          Ayudanos a conocerte mejor. Tus respuestas permiten personalizar calendario, temas y
          recomendaciones.
        </p>
      </div>

      <div className="relative w-full overflow-hidden rounded-2xl border border-[#E3DEDD] bg-[#FFFBF5] p-6 shadow-[0_4px_20px_-2px_rgba(125,138,150,0.05)] md:p-10">
        <div className="mb-8">
          <label className="mb-4 block text-lg font-bold text-[#2C3E50]">
            En que curso de Medicina te encuentras?
          </label>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {yearOptions.map((option) => {
              const selected = state.medicalYear === option.value
              const isWide = option.value === 0
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      medicalYear: option.value,
                    }))
                  }
                  className={`h-12 rounded-xl bg-white transition-all duration-200 ${
                    isWide ? 'col-span-2 md:col-span-4' : ''
                  } ${
                    selected
                      ? 'border-2 border-[#E8A598] bg-[#E8A598]/10 font-bold text-[#E8A598] shadow-sm'
                      : 'border border-gray-200 font-medium text-[#7D8A96] hover:border-[#E8A598] hover:bg-[#E8A598]/5 hover:text-[#E8A598]'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mb-8">
          <label className="mb-4 block text-lg font-bold text-[#2C3E50]">
            Cual es tu especialidad MIR deseada?
          </label>
          <div className="group relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <span className="material-symbols-outlined text-[#E8A598] transition-transform duration-200 group-focus-within:scale-110">
                favorite
              </span>
            </div>
            <input
              value={state.mirSpecialty}
              onChange={(event) =>
                setState((prev) => ({
                  ...prev,
                  mirSpecialty: event.target.value,
                }))
              }
              placeholder="Ej. Cardiologia, Pediatria, Aun no lo se..."
              className="block w-full rounded-xl border border-gray-200 bg-white py-3.5 pl-12 pr-4 text-base font-medium text-[#2C3E50] shadow-sm transition-colors placeholder:text-[#7D8A96]/55 focus:border-[#E8A598] focus:ring-2 focus:ring-[#E8A598]/20"
            />
          </div>
        </div>

        <label className="mb-8 flex items-center justify-between rounded-xl border border-[#E9E4E1] bg-white px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[#4B5563]">Perfil publico</p>
            <p className="text-xs text-[#7D8A96]">Tu perfil solo sera visible si activas esta opcion.</p>
          </div>
          <button
            type="button"
            onClick={() =>
              setState((prev) => ({
                ...prev,
                profilePublic: !prev.profilePublic,
              }))
            }
            className={`h-7 w-12 rounded-full p-1 transition ${state.profilePublic ? 'bg-[#E8A598]' : 'bg-[#E9E4E1]'}`}
            aria-label="Cambiar visibilidad del perfil"
          >
            <span
              className={`block h-5 w-5 rounded-full bg-white transition ${
                state.profilePublic ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </label>

        <button
          type="button"
          onClick={onNext}
          className="group flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#E8A598] text-lg font-bold text-white shadow-lg shadow-[#E8A598]/20 transition-all duration-200 hover:scale-[1.01] hover:bg-[#D68C7F]"
        >
          Ver resumen
          <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">
            arrow_forward
          </span>
        </button>
      </div>

      <div className="flex w-full items-center justify-between px-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 py-2 text-sm font-semibold text-[#7D8A96] transition-colors hover:text-[#2C3E50]"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Atras
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="py-2 text-sm font-medium text-[#7D8A96]/60 transition-colors hover:text-[#7D8A96]"
        >
          Omitir configuracion
        </button>
      </div>
    </section>
  )
}

function StepFour({
  universities,
  onBack,
  onSubmit,
  saving,
}: {
  universities: University[]
  onBack: () => void
  onSubmit: () => void
  saving: boolean
}) {
  const { state } = useOnboardingState()
  const universityName = state.universityId
    ? universities.find((item) => item.id === state.universityId)?.name ?? 'No definida'
    : state.useCustomUniversity
      ? state.customUniversity || 'No definida'
      : 'No definida'

  const yearLabel =
    state.medicalYear == null
      ? 'Omitido'
      : state.medicalYear === 0
        ? 'Médico 😎'
        : `${state.medicalYear}º`

  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-bold text-[#2D3748]">Todo listo</h2>
      <div className="rounded-2xl border border-[#E9E4E1] bg-[#FAF7F4] p-4 text-sm text-[#4B5563]">
        <p><span className="font-semibold">Display name:</span> {state.displayName || '-'}</p>
        <p><span className="font-semibold">Username:</span> @{state.username || '-'}</p>
        <p><span className="font-semibold">Universidad:</span> {universityName}</p>
        <p><span className="font-semibold">Curso:</span> {yearLabel}</p>
        <p><span className="font-semibold">Especialidad:</span> {state.mirSpecialty || 'No definida'}</p>
        <p>
          <span className="font-semibold">Objetivo:</span>{' '}
          {state.mainGoal === 'prepare_mir'
            ? 'Preparar MIR'
            : state.mainGoal === 'reinforce_degree'
              ? 'Reforzar carrera'
              : state.mainGoal === 'explore'
                ? 'Explorar'
                : 'No definido'}
        </p>
        <p>
          <span className="font-semibold">Visibilidad pública:</span>{' '}
          {state.profilePublic ? 'Activada' : 'Desactivada'}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-[#E9E4E1] px-4 py-2.5 text-sm font-semibold text-[#7D8A96]"
        >
          Atrás
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          className="rounded-xl bg-[#E8A598] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#E08E7D] disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar y entrar'}
        </button>
      </div>
    </section>
  )
}

function getInitialUsername(username: string, email: string) {
  if (username) return normalizeUsernameInput(username)
  const emailPrefix = email.split('@')[0] ?? ''
  return normalizeUsernameInput(emailPrefix)
}

export default function OnboardingWizard() {
  const router = useRouter()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
  const authenticatedFetch = useAuthenticatedFetch()
  const { user, setUser, refreshUser } = useAuth()

  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [savingSkip, setSavingSkip] = useState(false)
  const [savingFinal, setSavingFinal] = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [universities, setUniversities] = useState<University[]>([])
  const [loadingUniversities, setLoadingUniversities] = useState(false)
  const universitiesRequestedRef = useRef(false)
  const [state, setState] = useState<OnboardingState>({
    displayName: '',
    username: '',
    avatarId: 1,
    mainGoal: null,
    universityId: null,
    customUniversity: '',
    useCustomUniversity: false,
    medicalYear: null,
    mirSpecialty: '',
    profilePublic: false,
  })

  useEffect(() => {
    if (!user) return
    setState({
      displayName: normalizeDisplayNameInput(user.display_name || ''),
      username: getInitialUsername(user.username, user.email),
      avatarId: user.avatar_id ?? 1,
      mainGoal: user.main_goal ?? null,
      universityId: user.university?.id ?? null,
      customUniversity: '',
      useCustomUniversity: false,
      medicalYear: user.medical_year ?? null,
      mirSpecialty: user.mir_specialty ?? '',
      profilePublic: user.profile_public ?? false,
    })
  }, [user])

  useEffect(() => {
    if (!apiUrl || !user || universitiesRequestedRef.current) return

    let mounted = true
    universitiesRequestedRef.current = true
    setLoadingUniversities(true)
    void fetchUniversities(apiUrl, authenticatedFetch)
      .then((items) => {
        if (!mounted) return
        setUniversities(items)
      })
      .catch((err) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'No se pudieron cargar universidades.')
      })
      .finally(() => {
        if (mounted) setLoadingUniversities(false)
      })

    return () => {
      mounted = false
    }
  }, [apiUrl, authenticatedFetch, user])

  useEffect(() => {
    if (!user) return
    if (user.onboarding_completed) {
      router.replace('/dashboard')
    }
  }, [router, user])

  const validateStepTwo = useCallback(() => {
    const normalizedDisplayName = normalizeDisplayNameInput(state.displayName)
    const normalizedUsername = normalizeUsernameInput(state.username)

    if (!DISPLAY_NAME_REGEX.test(normalizedDisplayName)) {
      return 'El display name debe tener 2-16 caracteres, solo letras, números y espacios.'
    }
    if (!USERNAME_REGEX.test(normalizedUsername)) {
      return 'El username debe cumplir: ^[a-z0-9._]{3,30}$.'
    }
    if (user?.mustUpdateDisplayName && normalizedDisplayName === normalizeDisplayNameInput(user.display_name)) {
      return 'Debes corregir tu display name para continuar.'
    }
    return null
  }, [state.displayName, state.username, user?.display_name, user?.mustUpdateDisplayName])

  const handleAvatarChange = useCallback(
    async (avatarId: number) => {
      if (!apiUrl || !user) return
      const previousAvatarId = state.avatarId
      if (previousAvatarId === avatarId) return

      setState((prev) => ({ ...prev, avatarId }))
      setSavingAvatar(true)
      setError(null)
      try {
        await updateAvatarRealtime(apiUrl, authenticatedFetch, avatarId)
        setUser((prev) => (prev ? { ...prev, avatar_id: avatarId } : prev))
      } catch (err) {
        setState((prev) => ({ ...prev, avatarId: previousAvatarId }))
        setError(err instanceof Error ? err.message : 'No se pudo guardar el avatar.')
      } finally {
        setSavingAvatar(false)
      }
    },
    [apiUrl, authenticatedFetch, setUser, state.avatarId, user],
  )

  const handleSkip = useCallback(async () => {
    if (!apiUrl || !user || user.mustUpdateDisplayName) return
    const payload = toPayload(state, true)
    setSavingSkip(true)
    setError(null)
    try {
      await submitOnboarding(apiUrl, authenticatedFetch, payload)
      setOnboardingDeferredFlag(true)
      await refreshUser()
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo omitir el onboarding.')
    } finally {
      setSavingSkip(false)
    }
  }, [apiUrl, authenticatedFetch, refreshUser, router, state, user])

  const handleFinalSubmit = useCallback(async () => {
    if (!apiUrl) return
    const validationError = validateStepTwo()
    if (validationError) {
      setError(validationError)
      setStep(2)
      return
    }

    setSavingFinal(true)
    setError(null)
    try {
      await submitOnboarding(apiUrl, authenticatedFetch, toPayload(state))
      setOnboardingDeferredFlag(false)
      await refreshUser()
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el onboarding.')
    } finally {
      setSavingFinal(false)
    }
  }, [apiUrl, authenticatedFetch, refreshUser, router, state, validateStepTwo])

  if (!user) {
    return (
      <main className="min-h-screen bg-[#FAF7F4] px-4 py-10 text-center text-[#7D8A96]">
        Cargando perfil...
      </main>
    )
  }

  const contextValue: OnboardingContextValue = {
    state,
    setState,
    mustUpdateDisplayName: user.mustUpdateDisplayName,
    originalDisplayName: user.display_name,
  }

  return (
    <OnboardingContext.Provider value={contextValue}>
      {step === 1 ? (
        <StepOne
          disabledSkip={user.mustUpdateDisplayName}
          onStart={() => setStep(2)}
          onSkip={handleSkip}
          loading={savingSkip}
          error={error}
        />
      ) : (
        <main className="min-h-screen bg-[#FAF7F4] px-4 py-10">
          <section className="mx-auto w-full max-w-3xl rounded-3xl border border-[#E9E4E1] bg-white p-6 shadow-[0_12px_40px_rgba(45,55,72,0.08)] md:p-8">
            <Stepper step={step} />

            {error ? (
              <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            {step === 2 ? (
            <StepTwo
              universities={universities}
              loadingUniversities={loadingUniversities}
              avatarSaving={savingAvatar}
              onAvatarChange={handleAvatarChange}
              onBack={() => setStep(1)}
              onNext={() => {
                const validationError = validateStepTwo()
                if (validationError) {
                  setError(validationError)
                  return
                }
                setError(null)
                setStep(3)
              }}
            />
          ) : null}

            {step === 3 ? (
              <StepThree
                onBack={() => setStep(2)}
                onNext={() => setStep(4)}
                onSkip={() =>
                  {
                    setState((prev) => ({
                      ...prev,
                      medicalYear: null,
                      mirSpecialty: '',
                      profilePublic: false,
                    }))
                    setStep(4)
                  }
                }
              />
            ) : null}

            {step === 4 ? (
              <StepFour
                universities={universities}
                onBack={() => setStep(3)}
                onSubmit={handleFinalSubmit}
                saving={savingFinal}
              />
            ) : null}
          </section>
        </main>
      )}
    </OnboardingContext.Provider>
  )
}

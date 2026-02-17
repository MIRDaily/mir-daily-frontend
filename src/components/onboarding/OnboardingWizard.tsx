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
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
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
import { getOnboardingDeferredFlag, setOnboardingDeferredFlag } from '@/lib/onboarding'
import {
  checkUsernameAvailability,
  fetchMirSpecialties,
  fetchUniversities,
  type MirSpecialty,
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
  mirSpecialtyId: number | null
  profilePublic: boolean
}

type OnboardingContextValue = {
  state: OnboardingState
  setState: Dispatch<SetStateAction<OnboardingState>>
  mustUpdateDisplayName: boolean
  originalDisplayName: string
}

type UsernameCheckStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'unavailable' | 'error'

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
    mirSpecialtyId: useCurrentDisplayAndUser ? null : state.mirSpecialtyId,
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

function RequiredIndicator() {
  return (
    <span
      className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#E8A598]/12 px-2 py-0.5 align-middle text-[11px] font-semibold text-[#D68C7F]"
      title="Campo obligatorio"
      aria-label="Campo obligatorio"
    >
      <span className="material-symbols-outlined text-[14px] leading-none">warning</span>
      Obligatorio
    </span>
  )
}

function StepOne({
  disabledSkip,
  onStart,
  onSkip,
  error,
}: {
  disabledSkip: boolean
  onStart: () => void
  onSkip: () => void
  error: string | null
}) {
  return (
    <section className="flex flex-col items-center text-center">
      <div className="mb-8 flex items-center justify-center rounded-full bg-[#E8A598]/10 p-5 ring-4 ring-[#E8A598]/5">
        <span className="material-symbols-outlined text-[#E8A598]" style={{ fontSize: 48 }}>
          auto_awesome
        </span>
      </div>
      <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight text-[#2C3E50] md:text-5xl">
        Bienvenid@ a MIR
        <span className="text-[#E8A598]">Daily</span>
      </h1>
      <p className="mx-auto mb-10 max-w-lg text-lg leading-relaxed text-[#7D8A96]">
        Sabemos lo que es preparar el MIR.
        <br />
        <span className="font-semibold text-[#E8A598]">Por médicos, para médicos.</span>
        <br />
        <br />
        Constancia diaria. Progreso real.
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
          disabled={disabledSkip}
          className="py-2 text-center text-sm font-medium text-[#7D8A96] transition-colors hover:text-[#2C3E50] disabled:opacity-60"
        >
          Omitir por ahora
        </button>
      </div>
    </section>
  )
}

function StepTwo({
  universities,
  loadingUniversities,
  universitiesError,
  avatarSaving,
  onAvatarChange,
  onRetryUniversities,
  usernameCheckStatus,
  usernameCheckMessage,
  canContinue,
  onNext,
  onBack,
}: {
  universities: University[]
  loadingUniversities: boolean
  universitiesError: string | null
  avatarSaving: boolean
  onAvatarChange: (avatarId: number) => void
  onRetryUniversities: () => void
  usernameCheckStatus: UsernameCheckStatus
  usernameCheckMessage: string | null
  canContinue: boolean
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
          <label className="mb-4 block text-sm font-bold text-[#2C3E50]">
            Tu Objetivo Principal
            <RequiredIndicator />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {goalOptions.map((goal, index) => {
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
                  className={`group relative flex flex-col items-center justify-center rounded-xl border-2 p-4 transition-all duration-200 ${
                    selected
                      ? 'border-[#E8A598] bg-[#FFF5F2] text-[#E8A598] shadow-sm'
                      : 'border-transparent bg-white text-[#7D8A96] hover:border-[#E8A598]/50 hover:bg-white/80'
                  }`}
                >
                  <motion.div
                    className={`mb-2 flex size-11 items-center justify-center rounded-full shadow-sm ${
                      selected
                        ? 'bg-white text-[#E8A598]'
                        : 'bg-gray-50 text-[#7D8A96]/60 transition-colors group-hover:text-[#E8A598]'
                    }`}
                    animate={{ y: [0, -4, 0] }}
                    transition={{
                      duration: 0.38,
                      ease: 'easeInOut',
                      repeat: Infinity,
                      repeatDelay: 2.8 + index * 0.35,
                    }}
                  >
                    <span className="material-symbols-outlined">{goal.icon}</span>
                  </motion.div>
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
          <div>
            <AvatarSelector
              selectedAvatarId={state.avatarId}
              disabled={avatarSaving}
              onSelect={onAvatarChange}
              columnsClassName="grid-cols-4 sm:grid-cols-6"
              avatarSize={72}
            />
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-bold text-[#2C3E50]">
              Nombre de Perfil
              <RequiredIndicator />
            </label>
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
            <div className="min-w-0">
              <label className="mb-2 flex min-h-8 items-center text-sm font-bold text-[#2C3E50]">
                @Usuario
                <RequiredIndicator />
              </label>
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
                  className="block h-12 w-full rounded-xl border border-gray-200 bg-white py-0 pl-9 pr-4 leading-[48px] text-[#2C3E50] outline-none transition-all placeholder:text-[#7D8A96]/40 focus:border-[#E8A598] focus:ring-[#E8A598]"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={20}
                />
              </div>
              {usernameCheckStatus !== 'idle' ? (
                <p
                  className={`mt-2 text-xs ${
                    usernameCheckStatus === 'available'
                      ? 'text-emerald-700'
                      : usernameCheckStatus === 'checking'
                        ? 'text-[#7D8A96]'
                        : usernameCheckStatus === 'invalid' || usernameCheckStatus === 'unavailable'
                          ? 'text-amber-700'
                          : 'text-red-700'
                  }`}
                >
                  {usernameCheckMessage}
                </p>
              ) : null}
            </div>

            <div className="min-w-0">
              <label className="mb-2 flex min-h-8 items-center text-sm font-bold text-[#2C3E50]">
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
                  className="block h-12 w-full cursor-pointer appearance-none rounded-xl border border-gray-200 bg-white px-4 pr-10 text-[#2C3E50] outline-none transition-all focus:border-[#E8A598] focus:ring-[#E8A598]"
                >
                  <option value="">
                    {loadingUniversities ? 'Cargando...' : 'Selecciona tu universidad'}
                  </option>
                  {Object.entries(groupedUniversities).map(([country, entries]) => (
                    <optgroup key={country} label={country}>
                      {entries.map((university) => (
                        <option key={university.id} value={university.id}>
                          {university.name} ({university.country})
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

              {loadingUniversities ? (
                <p className="mt-2 text-xs text-[#7D8A96]">Cargando universidades...</p>
              ) : null}
              {universitiesError ? (
                <div className="mt-2 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-xs text-red-700">{universitiesError}</p>
                  <button
                    type="button"
                    onClick={onRetryUniversities}
                    className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700"
                  >
                    Reintentar
                  </button>
                </div>
              ) : null}
              {!loadingUniversities && !universitiesError && universities.length === 0 ? (
                <p className="mt-2 text-xs text-[#7D8A96]">
                  Sin resultados por ahora. Puedes seleccionar &quot;Otra universidad&quot;.
                </p>
              ) : null}
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
            disabled={!canContinue}
            className="h-12 w-full rounded-xl bg-[#E8A598] px-6 text-base font-bold text-white shadow-lg shadow-[#E8A598]/20 transition-all duration-200 hover:scale-[1.01] hover:bg-[#D68C7F] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 disabled:hover:bg-[#E8A598]"
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
  specialties,
  loadingSpecialties,
  specialtiesError,
  onRetrySpecialties,
  onBack,
  onNext,
  onSkip,
}: {
  specialties: MirSpecialty[]
  loadingSpecialties: boolean
  specialtiesError: string | null
  onRetrySpecialties: () => void
  onBack: () => void
  onNext: () => void
  onSkip: () => void
}) {
  const { state, setState } = useOnboardingState()
  const yearOptions: Array<{ value: number; label: string }> = [
    { value: 1, label: '1º' },
    { value: 2, label: '2º' },
    { value: 3, label: '3º' },
    { value: 4, label: '4º' },
    { value: 5, label: '5º' },
    { value: 6, label: '6º' },
    { value: 0, label: 'Médico 😎' },
  ]

  return (
    <section className="space-y-6">
      <div className="text-center">
        <h2 className="px-4 pb-3 text-3xl font-bold tracking-tight text-[#2C3E50] md:text-4xl">
          Configura tu Ruta de Estudio
        </h2>
        <p className="mx-auto max-w-2xl px-4 text-lg font-normal leading-normal text-[#7D8A96]">
          Ayudanos a conocerte mejor. Tus respuestas permitiran personalizar calendario, priorizar
          temas y recomendarte el material mas relevante.
        </p>
      </div>

      <div className="relative w-full overflow-hidden rounded-2xl border border-[#E3DEDD] bg-[#FFFBF5] p-6 shadow-[0_4px_20px_-2px_rgba(125,138,150,0.05)] md:p-10">
        <div className="mb-8">
          <label className="mb-4 block text-lg font-bold text-[#2C3E50]">
            En que curso de Medicina te encuentras?
            <span className="ml-2 text-sm font-normal text-[#7D8A96]/70">(Opcional)</span>
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
                    isWide ? 'col-span-2 md:col-span-2' : ''
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
            <span className="ml-2 text-sm font-normal text-[#7D8A96]/70">(Opcional)</span>
          </label>
          <div className="group relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <span className="material-symbols-outlined text-[#E8A598] transition-transform duration-200 group-focus-within:scale-110">
                favorite
              </span>
            </div>
            <select
              value={state.mirSpecialtyId ?? ''}
              onChange={(event) =>
                setState((prev) => ({
                  ...prev,
                  mirSpecialtyId: event.target.value ? Number(event.target.value) : null,
                }))
              }
              className="block w-full cursor-pointer appearance-none rounded-xl border border-gray-200 bg-white py-3.5 pl-12 pr-10 text-base font-medium text-[#2C3E50] shadow-sm transition-colors hover:border-[#E8A598]/50 focus:border-[#E8A598] focus:ring-2 focus:ring-[#E8A598]/20"
            >
              <option value="">Sin decidir todavía</option>
              {specialties.map((specialty) => (
                <option key={specialty.id} value={specialty.id}>
                  {specialty.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-[#7D8A96]">
              <span className="material-symbols-outlined">expand_more</span>
            </div>
          </div>
          {loadingSpecialties ? (
            <p className="mt-2 text-xs text-[#7D8A96]">Cargando especialidades...</p>
          ) : null}
          {specialtiesError ? (
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-xs text-red-700">{specialtiesError}</p>
              <button
                type="button"
                onClick={onRetrySpecialties}
                className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-700"
              >
                Reintentar
              </button>
            </div>
          ) : null}
        </div>

        <label className="mb-8 flex items-center justify-between rounded-xl border border-[#E9E4E1] bg-white px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[#4B5563]">Perfil publico</p>
            <p className="text-xs text-[#7D8A96]">
              Tu perfil solo sera visible si activas esta opcion (puedes cambiarlo mas adelante).
            </p>
          </div>
          <div className="group/lock relative">
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="h-7 w-12 cursor-not-allowed rounded-full bg-[#E9E4E1] p-1 transition opacity-70"
              aria-label="Cambiar visibilidad del perfil"
            >
              <span className="block h-5 w-5 rounded-full bg-white transition" />
            </button>
            <p className="pointer-events-none absolute right-0 top-9 hidden w-64 rounded-lg border border-[#E9E4E1] bg-white px-3 py-2 text-xs text-[#7D8A96] shadow-sm group-hover/lock:block">
              Todos los perfiles serán privados por el momento.
            </p>
          </div>
        </label>

        <button
          type="button"
          onClick={onNext}
          className="group flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#E8A598] text-lg font-bold text-white shadow-lg shadow-[#E8A598]/20 transition-all duration-200 hover:scale-[1.01] hover:bg-[#D68C7F]"
        >
          Continuar
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
  onBack,
  onSubmit,
  saving,
}: {
  onBack: () => void
  onSubmit: () => void
  saving: boolean
}) {
  const [activeSpot, setActiveSpot] = useState<1 | 2 | 3 | null>(null)
  const wiggleMotion = { x: [0, -2.5, 2.5, -2, 2, 0], rotate: [0, -0.8, 0.8, -0.5, 0.5, 0] }
  const wiggleTransition = { duration: 0.48, repeat: Infinity, ease: 'easeInOut' as const }

  const getSectionTone = (sectionId: 1 | 2 | 3) => {
    const baseTone = 'opacity-100'
    if (activeSpot == null) return baseTone
    if (activeSpot === sectionId) {
      return 'opacity-100 scale-[1.015] ring-2 ring-[#E8A598]/70 shadow-[0_0_0_1px_rgba(232,165,152,0.3),0_16px_40px_-22px_rgba(232,165,152,0.95)]'
    }
    return baseTone
  }

  return (
    <motion.section
      className="space-y-8"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.35 }}
      >
        <motion.h2
          className="px-4 pb-3 text-3xl font-bold tracking-tight text-[#2C3E50] md:text-4xl"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
        >
          Explora tu Dashboard
        </motion.h2>
        <motion.p
          className="mx-auto max-w-2xl text-lg font-normal leading-normal text-[#7D8A96]"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.35 }}
        >
          Conoce las herramientas clave que acelerarán tu preparación MIR.
        </motion.p>
      </motion.div>

      <motion.div
        className="relative mx-auto w-full overflow-hidden rounded-3xl border border-[#E3DEDD] bg-white p-4 shadow-[0_4px_20px_-2px_rgba(125,138,150,0.05)] md:p-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.45 }}
        whileHover={{ scale: 1.008 }}
      >
        <motion.div
          className="space-y-8 select-none"
          animate={{ opacity: [0.92, 1, 0.92] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div
            className={`flex flex-col items-center rounded-2xl py-6 text-center transition-all duration-300 ${getSectionTone(1)}`}
            onMouseEnter={() => setActiveSpot(1)}
            onMouseLeave={() => setActiveSpot(null)}
          >
            <div className="mb-4 h-4 w-16 rounded-full bg-gray-100" />
            <div className="relative flex h-64 w-48 items-center justify-center rounded-xl border-2 border-[#E8A598]/30 bg-[#E8A598]/20">
              <div className="h-12 w-12 rounded-full bg-[#E8A598]/40" />
            </div>
            <div className="mt-4 h-8 w-32 rounded-lg bg-[#E8A598]/20" />
          </div>

          <div
            className={`rounded-2xl border border-gray-100 bg-[#FAF7F4] p-6 transition-all duration-300 ${getSectionTone(2)}`}
            onMouseEnter={() => setActiveSpot(2)}
            onMouseLeave={() => setActiveSpot(null)}
          >
            <div className="mb-4 flex justify-between">
              <div className="space-y-2">
                <div className="h-3 w-32 rounded-full bg-[#C4655A]/20" />
                <div className="h-5 w-64 rounded-full bg-gray-200" />
              </div>
              <div className="h-12 w-24 rounded-xl border border-gray-100 bg-white" />
            </div>
            <div className="space-y-3">
              <div className="h-10 w-full rounded-lg border border-gray-100 bg-white" />
              <div className="h-10 w-full rounded-lg border border-gray-100 bg-white" />
            </div>
          </div>

          <div
            className={`grid grid-cols-2 items-center gap-8 rounded-2xl border border-gray-50 bg-white p-8 transition-all duration-300 ${getSectionTone(3)}`}
            onMouseEnter={() => setActiveSpot(3)}
            onMouseLeave={() => setActiveSpot(null)}
          >
            <div className="flex justify-center gap-4">
              <div className="h-32 w-16 rounded-xl border border-[#7D8A96]/20 bg-[#7D8A96]/10" />
              <div className="h-40 w-20 rounded-2xl border-2 border-[#7D8A96]/30 bg-[#7D8A96]/20" />
            </div>
            <div className="space-y-4">
              <div className="h-6 w-48 rounded-full bg-gray-200" />
              <div className="h-4 w-full rounded-full bg-gray-100" />
              <div className="flex gap-2">
                <div className="h-10 w-28 rounded-lg bg-[#E8A598]/30" />
                <div className="h-10 w-28 rounded-lg bg-[#E8A598]/30" />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="absolute left-1/2 top-[160px] z-10 flex -translate-x-1/2 flex-col items-center"
          onMouseEnter={() => setActiveSpot(1)}
          onMouseLeave={() => setActiveSpot(null)}
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.div
            className="mb-2 flex items-center gap-2 rounded-xl bg-[#7D8A96] px-4 py-2 text-sm font-medium text-white shadow-lg shadow-[#7D8A96]/20"
            animate={activeSpot === 1 ? wiggleMotion : { x: 0, rotate: 0 }}
            transition={activeSpot === 1 ? wiggleTransition : { duration: 0.2 }}
          >
            <span className="rounded bg-white/20 px-1.5 text-xs">1</span>
            <span>Tus 5 preguntas diarias y otros sobres especiales</span>
          </motion.div>
          <motion.div
            className="h-4 w-4 rounded-full bg-[#7D8A96] ring-4 ring-[#7D8A96]/20"
            animate={{ scale: [1, 1.16, 1], opacity: [1, 0.84, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>

        <motion.div
          className="absolute left-[30%] top-[440px] z-10 hidden flex-col items-center md:flex"
          onMouseEnter={() => setActiveSpot(2)}
          onMouseLeave={() => setActiveSpot(null)}
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 2.6, delay: 0.25, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.div
            className="mb-2 flex items-center gap-2 rounded-xl bg-[#E8A598] px-4 py-2 text-sm font-medium text-white shadow-lg shadow-[#E8A598]/20"
            animate={activeSpot === 2 ? wiggleMotion : { x: 0, rotate: 0 }}
            transition={activeSpot === 2 ? wiggleTransition : { duration: 0.2 }}
          >
            <span className="rounded bg-white/20 px-1.5 text-xs">2</span>
            <span>Aprende de los errores más comunes con la pregunta más fallada de la semana</span>
          </motion.div>
          <motion.div
            className="h-4 w-4 rounded-full bg-[#E8A598] ring-4 ring-[#E8A598]/20"
            animate={{ scale: [1, 1.16, 1], opacity: [1, 0.84, 1] }}
            transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>

        <motion.div
          className="absolute bottom-[88px] right-[18%] z-10 hidden flex-col items-center md:flex"
          onMouseEnter={() => setActiveSpot(3)}
          onMouseLeave={() => setActiveSpot(null)}
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 2.5, delay: 0.45, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.div
            className="mb-2 flex items-center gap-2 rounded-xl bg-[#7D8A96] px-4 py-2 text-sm font-medium text-white shadow-lg shadow-[#7D8A96]/20"
            animate={activeSpot === 3 ? wiggleMotion : { x: 0, rotate: 0 }}
            transition={activeSpot === 3 ? wiggleTransition : { duration: 0.2 }}
          >
            <span className="rounded bg-white/20 px-1.5 text-xs">3</span>
            <span>Lleva tu estudio en el móvil con la APP</span>
          </motion.div>
          <motion.div
            className="h-4 w-4 rounded-full bg-[#7D8A96] ring-4 ring-[#7D8A96]/20"
            animate={{ scale: [1, 1.16, 1], opacity: [1, 0.84, 1] }}
            transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      </motion.div>

      <motion.div
        className="mx-auto flex w-full max-w-lg flex-col-reverse items-center justify-center gap-4 sm:flex-row"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.35 }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-xl px-6 py-3 text-base font-semibold text-[#7D8A96] transition-colors hover:bg-gray-100/50 hover:text-[#2C3E50]"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          Atrás
        </button>
        <motion.button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          whileHover={saving ? undefined : { scale: 1.03 }}
          whileTap={saving ? undefined : { scale: 0.985 }}
          className="flex h-14 w-full flex-grow items-center justify-center rounded-2xl bg-[#E8A598] px-10 text-lg font-bold text-white shadow-lg shadow-[#E8A598]/20 transition-all duration-300 hover:scale-[1.03] hover:bg-[#D68C7F] sm:w-auto sm:flex-grow-0 disabled:opacity-60"
        >
          {saving ? 'Guardando...' : '¡Empezar a Estudiar!'}
          {!saving ? (
            <motion.span
              className="material-symbols-outlined ml-2 text-[24px]"
              animate={{ x: [0, 3, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            >
              arrow_forward
            </motion.span>
          ) : null}
        </motion.button>
      </motion.div>
    </motion.section>
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
  const [savingFinal, setSavingFinal] = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [universities, setUniversities] = useState<University[]>([])
  const [specialties, setSpecialties] = useState<MirSpecialty[]>([])
  const [loadingUniversities, setLoadingUniversities] = useState(false)
  const [loadingSpecialties, setLoadingSpecialties] = useState(false)
  const [universitiesError, setUniversitiesError] = useState<string | null>(null)
  const [specialtiesError, setSpecialtiesError] = useState<string | null>(null)
  const [usernameCheckStatus, setUsernameCheckStatus] = useState<UsernameCheckStatus>('idle')
  const [usernameCheckMessage, setUsernameCheckMessage] = useState<string | null>(null)
  const universitiesRequestedRef = useRef(false)
  const specialtiesRequestedRef = useRef(false)
  const initializedUserIdRef = useRef<string | null>(null)
  const usernameRequestSeqRef = useRef(0)
  const [state, setState] = useState<OnboardingState>({
    displayName: '',
    username: '',
    avatarId: 1,
    mainGoal: null,
    universityId: null,
    customUniversity: '',
    useCustomUniversity: false,
    medicalYear: null,
    mirSpecialtyId: null,
    profilePublic: false,
  })
  const currentUserId = user?.id ?? null
  const currentUserUsername = user?.username ?? ''

  useEffect(() => {
    if (!user) return
    if (initializedUserIdRef.current === user.id) return
    initializedUserIdRef.current = user.id
    setState({
      displayName: normalizeDisplayNameInput(user.display_name || ''),
      username: getInitialUsername(user.username, user.email),
      avatarId: user.avatar_id ?? 1,
      mainGoal: user.main_goal ?? null,
      universityId: user.university?.id ?? null,
      customUniversity: '',
      useCustomUniversity: false,
      medicalYear: user.medical_year ?? null,
      mirSpecialtyId: user.mir_specialty?.id ?? null,
      profilePublic: false,
    })
  }, [user])

  useEffect(() => {
    if (!apiUrl || !currentUserId || step !== 2) return

    const normalizedUsername = normalizeUsernameInput(state.username)
    const currentUsername = normalizeUsernameInput(currentUserUsername)

    if (!normalizedUsername) {
      setUsernameCheckStatus('idle')
      setUsernameCheckMessage(null)
      return
    }

    if (!USERNAME_REGEX.test(normalizedUsername)) {
      setUsernameCheckStatus('invalid')
      setUsernameCheckMessage('El username debe tener entre 3 y 20 caracteres.')
      return
    }

    if (normalizedUsername === currentUsername) {
      setUsernameCheckStatus('available')
      setUsernameCheckMessage('Disponible ✔')
      return
    }

    const requestSeq = ++usernameRequestSeqRef.current
    const controller = new AbortController()
    setUsernameCheckStatus('checking')
    setUsernameCheckMessage('Comprobando...')
    const timeoutId = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailability(
          apiUrl,
          authenticatedFetch,
          normalizedUsername,
          controller.signal,
        )
        if (requestSeq !== usernameRequestSeqRef.current) return

        if (available) {
          setUsernameCheckStatus('available')
          setUsernameCheckMessage('Disponible ✔')
          return
        }

        setUsernameCheckStatus('unavailable')
        setUsernameCheckMessage('Este nombre de usuario ya está en uso.')
      } catch (err) {
        if (requestSeq !== usernameRequestSeqRef.current) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setUsernameCheckStatus('error')
        setUsernameCheckMessage(
          err instanceof Error ? err.message : 'No se pudo comprobar el username.',
        )
      }
    }, 350)

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [apiUrl, authenticatedFetch, currentUserId, currentUserUsername, state.username, step])

  const loadUniversities = useCallback(async () => {
    if (!apiUrl || !user) return

    setLoadingUniversities(true)
    setUniversitiesError(null)
    try {
      const items = await fetchUniversities(apiUrl, authenticatedFetch)
      setUniversities(items)
    } catch (err) {
      setUniversities([])
      setUniversitiesError(
        err instanceof Error ? err.message : 'No se pudieron cargar universidades.',
      )
    } finally {
      setLoadingUniversities(false)
    }
  }, [apiUrl, authenticatedFetch, user])

  const loadSpecialties = useCallback(async () => {
    if (!apiUrl || !user) return

    setLoadingSpecialties(true)
    setSpecialtiesError(null)
    try {
      const items = await fetchMirSpecialties(apiUrl, authenticatedFetch)
      setSpecialties(items)
    } catch (err) {
      setSpecialties([])
      setSpecialtiesError(
        err instanceof Error ? err.message : 'No se pudieron cargar especialidades.',
      )
    } finally {
      setLoadingSpecialties(false)
    }
  }, [apiUrl, authenticatedFetch, user])

  useEffect(() => {
    if (!apiUrl || !user || universitiesRequestedRef.current) return
    universitiesRequestedRef.current = true
    void loadUniversities()
  }, [apiUrl, loadUniversities, user])

  useEffect(() => {
    if (!apiUrl || !user || specialtiesRequestedRef.current) return
    specialtiesRequestedRef.current = true
    void loadSpecialties()
  }, [apiUrl, loadSpecialties, user])

  useEffect(() => {
    if (!user) return
    if (user.onboarding_completed && !getOnboardingDeferredFlag()) {
      router.replace('/dashboard')
    }
  }, [router, user])

  const validateStepTwo = useCallback(() => {
    const normalizedDisplayName = normalizeDisplayNameInput(state.displayName)
    const normalizedUsername = normalizeUsernameInput(state.username)

    if (!state.mainGoal) {
      return 'Debes seleccionar tu objetivo principal para continuar.'
    }
    if (!DISPLAY_NAME_REGEX.test(normalizedDisplayName)) {
      return 'El nombre visible debe tener entre 2 y 16 caracteres.'
    }
    if (!USERNAME_REGEX.test(normalizedUsername)) {
      return 'El username debe tener entre 3 y 20 caracteres.'
    }
    if (user?.mustUpdateDisplayName && normalizedDisplayName === normalizeDisplayNameInput(user.display_name)) {
      return 'Debes corregir tu display name para continuar.'
    }
    if (usernameCheckStatus !== 'available') {
      if (usernameCheckStatus === 'checking') {
        return 'Comprobando disponibilidad del username...'
      }
      if (usernameCheckStatus === 'unavailable') {
        return 'Este nombre de usuario ya está en uso.'
      }
      if (usernameCheckStatus === 'invalid') {
        return 'El username debe tener entre 3 y 20 caracteres.'
      }
      if (usernameCheckStatus === 'error') {
        return usernameCheckMessage ?? 'No se pudo validar el username.'
      }
      return 'Debes validar un username disponible para continuar.'
    }
    return null
  }, [
    state.mainGoal,
    state.displayName,
    state.username,
    user?.display_name,
    user?.mustUpdateDisplayName,
    usernameCheckMessage,
    usernameCheckStatus,
  ])

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

  const handleSkip = useCallback(() => {
    if (!user || user.mustUpdateDisplayName) return
    setOnboardingDeferredFlag(true)
    router.replace('/dashboard')
  }, [router, user])

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
      <LayoutGroup id="onboarding-morph">
        <motion.main
          className={`relative min-h-screen bg-[#FAF7F4] px-4 py-10 ${
            step === 1 ? 'grid place-items-center' : ''
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="pointer-events-none absolute left-10 top-20 -z-10 h-64 w-64 animate-pulse rounded-full bg-[#E8A598]/10 blur-3xl [animation-duration:4s]" />
          <div className="pointer-events-none absolute bottom-10 right-10 -z-10 h-96 w-96 rounded-full bg-[#8BA888]/10 blur-3xl" />

          <div
            className={`w-full max-w-3xl ${
              step === 1
                ? 'pointer-events-none absolute left-1/2 top-8 z-10 -translate-x-1/2 px-4'
                : 'mx-auto mb-4'
            }`}
          >
            <Stepper step={step} />
          </div>

          <motion.section
            layout
            layoutId="onboarding-shell"
            transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            className={`mx-auto w-full rounded-3xl border border-[#E9E4E1] bg-white shadow-[0_12px_40px_rgba(45,55,72,0.08)] ${
              step === 1 ? 'max-w-[680px] p-8 md:p-12' : 'max-w-3xl p-6 md:p-8'
            }`}
          >
            {error ? (
              <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`step-content-${step}`}
                initial={{ opacity: 0, y: 18, scale: 0.992 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -14, scale: 0.992 }}
                transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              >
                {step === 1 ? (
                  <div className="mx-auto grid min-h-[420px] w-full max-w-2xl place-items-center">
                    <StepOne
                      disabledSkip={user.mustUpdateDisplayName}
                      onStart={() => setStep(2)}
                      onSkip={handleSkip}
                      error={error}
                    />
                  </div>
                ) : null}

                {step === 2 ? (
                  <div className="mx-auto w-full max-w-2xl">
                    <StepTwo
                      universities={universities}
                      loadingUniversities={loadingUniversities}
                      universitiesError={universitiesError}
                      avatarSaving={savingAvatar}
                      onAvatarChange={handleAvatarChange}
                      onRetryUniversities={loadUniversities}
                      usernameCheckStatus={usernameCheckStatus}
                      usernameCheckMessage={usernameCheckMessage}
                      canContinue={usernameCheckStatus === 'available' && state.mainGoal !== null}
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
                  </div>
                ) : null}

                {step === 3 ? (
                  <div className="mx-auto w-full max-w-2xl">
                    <StepThree
                      specialties={specialties}
                      loadingSpecialties={loadingSpecialties}
                      specialtiesError={specialtiesError}
                      onRetrySpecialties={loadSpecialties}
                      onBack={() => setStep(2)}
                      onNext={() => setStep(4)}
                      onSkip={() => {
                        setState((prev) => ({
                          ...prev,
                          medicalYear: null,
                          mirSpecialtyId: null,
                          profilePublic: false,
                        }))
                        setStep(4)
                      }}
                    />
                  </div>
                ) : null}

                {step === 4 ? (
                  <div className="mx-auto w-full max-w-2xl">
                    <StepFour
                      onBack={() => setStep(3)}
                      onSubmit={handleFinalSubmit}
                      saving={savingFinal}
                    />
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </motion.section>
        </motion.main>
      </LayoutGroup>
    </OnboardingContext.Provider>
  )
}



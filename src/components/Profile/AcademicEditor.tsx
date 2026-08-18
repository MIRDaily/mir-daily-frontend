'use client'

/* ════════════════════════════════════════════════════════════════════════
   Editor de los datos del carné.

   Lo que el alta preguntaba una vez —objetivo, curso, especialidad,
   universidad, visibilidad— más la bio corta. Va contra
   `PATCH /api/profile/academic`, que solo escribe las claves enviadas; el
   endpoint del onboarding queda para el alta porque sella el bloqueo del
   username.
═══════════════════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  GhostButton,
  INK,
  InkSwitch,
  StickerButton,
} from '@/components/Profile/ui'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import type { UserProfile } from '@/hooks/useProfile'
import {
  fetchMirSpecialties,
  fetchUniversities,
  type AcademicPayload,
  type MainGoal,
  type MirSpecialty,
  type University,
} from '@/services/profileOnboardingService'

export const BIO_MAX_LENGTH = 160

const GOALS: { value: MainGoal; label: string; icon: string; hint: string }[] = [
  { value: 'prepare_mir', label: 'Preparar el MIR', icon: 'flag', hint: 'Vas al examen' },
  { value: 'reinforce_degree', label: 'Reforzar la carrera', icon: 'school', hint: 'Aún estudias' },
  { value: 'explore', label: 'Explorar', icon: 'travel_explore', hint: 'De momento miro' },
]

const YEARS = [1, 2, 3, 4, 5, 6, 0]

function yearLabel(year: number) {
  return year === 0 ? 'Graduado' : `${year}º`
}

type AcademicEditorProps = {
  profile: UserProfile
  saving: boolean
  onCancel: () => void
  onSave: (payload: AcademicPayload) => void
}

export default function AcademicEditor({
  profile,
  saving,
  onCancel,
  onSave,
}: AcademicEditorProps) {
  const authenticatedFetch = useAuthenticatedFetch()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''

  const [goal, setGoal] = useState<MainGoal | null>(profile.main_goal)
  const [year, setYear] = useState<number | null>(profile.medical_year)
  const [specialtyId, setSpecialtyId] = useState<number | null>(profile.mir_specialty?.id ?? null)
  // La universidad escrita a mano llega sin id: eso distingue los dos modos.
  const [useCustomUniversity, setUseCustomUniversity] = useState(
    !!profile.university && profile.university.id === null,
  )
  const [universityId, setUniversityId] = useState<number | null>(profile.university?.id ?? null)
  const [customUniversity, setCustomUniversity] = useState(
    profile.university && profile.university.id === null ? profile.university.name : '',
  )
  const [isPublic, setIsPublic] = useState(profile.profile_public)
  const [bio, setBio] = useState(profile.bio ?? '')

  const [universities, setUniversities] = useState<University[]>([])
  const [specialties, setSpecialties] = useState<MirSpecialty[]>([])
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  // Catálogos: los mismos endpoints que usa el alta.
  useEffect(() => {
    let alive = true
    Promise.all([
      fetchUniversities(apiUrl, authenticatedFetch),
      fetchMirSpecialties(apiUrl, authenticatedFetch),
    ])
      .then(([unis, specs]) => {
        if (!alive) return
        setUniversities(unis)
        setSpecialties(specs)
      })
      .catch((err: unknown) => {
        if (!alive) return
        setCatalogError(
          err instanceof Error ? err.message : 'No se pudieron cargar los catálogos.',
        )
      })
    return () => {
      alive = false
    }
  }, [apiUrl, authenticatedFetch])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)

    // Sin esto se desplaza la página de debajo mientras el diálogo está
    // abierto, que es lo que hacía que pareciera "descolocado" al cerrarlo.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onCancel])

  const universitiesByCountry = useMemo(() => {
    return universities.reduce<Record<string, University[]>>((acc, uni) => {
      ;(acc[uni.country] ??= []).push(uni)
      return acc
    }, {})
  }, [universities])

  const trimmedCustom = customUniversity.trim()
  const customUniversityInvalid =
    useCustomUniversity && trimmedCustom.length > 0 && trimmedCustom.length < 2
  const bioTooLong = bio.length > BIO_MAX_LENGTH
  const canSave = !saving && !bioTooLong && !customUniversityInvalid

  const handleSave = () => {
    if (!canSave) return
    onSave({
      mainGoal: goal,
      medicalYear: year,
      mirSpecialtyId: specialtyId,
      universityId: useCustomUniversity ? null : universityId,
      customUniversity: useCustomUniversity ? trimmedCustom || null : null,
      profilePublic: isPublic,
      bio: bio.trim() || null,
    })
  }

  // Se monta en el <body>: dentro de la página caería en el contexto de
  // apilamiento del <main> (que lleva z-10), así que el diálogo quedaba por
  // debajo de la cabecera pese a su propio z-index.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2c3e50]/45 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Editar datos del carné"
        tabIndex={-1}
        // El alto lo limita la ventana y el scroll va por dentro: así el
        // diálogo queda siempre centrado y nunca se sale por arriba.
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border-2 border-[#2c3e50] bg-white"
        style={{ boxShadow: `7px 7px 0 0 ${INK}` }}
        onClick={(event) => event.stopPropagation()}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-dashed border-[#2c3e50]/25 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-[#2c3e50] bg-[#E8A598]">
              <span className="material-symbols-outlined text-white" style={{ fontSize: 16 }} aria-hidden>
                edit_note
              </span>
            </span>
            <h2 className="text-base font-black text-[#2C3E50]">Editar datos del carné</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#EAE4E2] text-[#7D8A96] transition-colors hover:border-[#2c3e50] hover:text-[#2C3E50]"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden>
              close
            </span>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {catalogError ? (
            <p className="rounded-2xl border-2 border-[#F1D3C9] bg-[#FFF4EF] px-4 py-3 text-sm font-bold text-[#C4655A]">
              {catalogError}
            </p>
          ) : null}

          {/* Bio */}
          <div>
            <label htmlFor="profile-bio" className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7D8A96]/80">
              Bio
            </label>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={3}
              maxLength={BIO_MAX_LENGTH + 40}
              placeholder="R1 de Familia · me pierden las arritmias · Sevilla"
              className={`mt-1.5 w-full resize-none rounded-2xl border-2 bg-white px-4 py-3 text-sm font-medium text-[#2C3E50] outline-none transition-colors focus:border-[#2c3e50] placeholder:text-[#B9B2AD] ${
                bioTooLong ? 'border-[#E6B0A6]' : 'border-[#EAE4E2]'
              }`}
            />
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-[#7D8A96]">
                Texto plano: los enlaces no se convierten en enlaces.
              </p>
              <span
                className={`text-xs font-black tabular-nums ${
                  bioTooLong ? 'text-[#C4655A]' : 'text-[#B9B2AD]'
                }`}
              >
                {bio.length}/{BIO_MAX_LENGTH}
              </span>
            </div>
          </div>

          {/* Objetivo */}
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7D8A96]/80">
              Objetivo principal
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {GOALS.map((option) => {
                const active = goal === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setGoal(active ? null : option.value)}
                    aria-pressed={active}
                    className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2.5 text-left transition-all ${
                      active
                        ? 'border-[#2c3e50] bg-[#FFF4EF]'
                        : 'border-[#EAE4E2] bg-white hover:-translate-y-0.5 hover:border-[#2c3e50]'
                    }`}
                    style={active ? { boxShadow: `3px 3px 0 0 ${INK}` } : undefined}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-[#2c3e50]"
                      style={{ backgroundColor: active ? '#E8A598' : '#fff' }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 15, color: active ? '#fff' : INK }}
                        aria-hidden
                      >
                        {option.icon}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-black text-[#2C3E50]">
                        {option.label}
                      </span>
                      <span className="block truncate text-[11px] font-bold text-[#7D8A96]">
                        {option.hint}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Curso */}
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7D8A96]/80">
              Curso
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {YEARS.map((value) => {
                const active = year === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setYear(active ? null : value)}
                    aria-pressed={active}
                    className={`rounded-full border-2 px-4 py-2 text-xs font-black transition-all ${
                      active
                        ? 'border-[#2c3e50] bg-[#2c3e50] text-white'
                        : 'border-[#EAE4E2] bg-white text-[#7D8A96] hover:border-[#2c3e50] hover:text-[#2C3E50]'
                    }`}
                  >
                    {yearLabel(value)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Especialidad */}
          <div>
            <label
              htmlFor="profile-specialty"
              className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7D8A96]/80"
            >
              Especialidad soñada
            </label>
            <select
              id="profile-specialty"
              value={specialtyId ?? ''}
              onChange={(event) =>
                setSpecialtyId(event.target.value ? Number(event.target.value) : null)
              }
              className="mt-1.5 w-full rounded-2xl border-2 border-[#EAE4E2] bg-white px-4 py-3 text-sm font-bold text-[#2C3E50] outline-none transition-colors focus:border-[#2c3e50]"
            >
              <option value="">Sin definir</option>
              {specialties.map((specialty) => (
                <option key={specialty.id} value={specialty.id}>
                  {specialty.name}
                </option>
              ))}
            </select>
          </div>

          {/* Universidad */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7D8A96]/80">
                Universidad
              </p>
              <button
                type="button"
                onClick={() => setUseCustomUniversity((current) => !current)}
                className="text-[11px] font-black uppercase tracking-wide text-[#B9705F] underline-offset-2 hover:underline"
              >
                {useCustomUniversity ? 'Elegir de la lista' : 'No está en la lista'}
              </button>
            </div>
            {useCustomUniversity ? (
              <>
                <input
                  value={customUniversity}
                  onChange={(event) => setCustomUniversity(event.target.value)}
                  maxLength={100}
                  aria-label="Universidad"
                  placeholder="Escribe el nombre de tu facultad"
                  className={`mt-1.5 w-full rounded-2xl border-2 bg-white px-4 py-3 text-sm font-bold text-[#2C3E50] outline-none transition-colors focus:border-[#2c3e50] placeholder:font-medium placeholder:text-[#B9B2AD] ${
                    customUniversityInvalid ? 'border-[#E6B0A6]' : 'border-[#EAE4E2]'
                  }`}
                />
                {customUniversityInvalid ? (
                  <p className="mt-1.5 text-xs font-bold text-[#C4655A]">
                    Escribe al menos 2 caracteres o vacíalo.
                  </p>
                ) : null}
              </>
            ) : (
              <select
                value={universityId ?? ''}
                onChange={(event) =>
                  setUniversityId(event.target.value ? Number(event.target.value) : null)
                }
                aria-label="Universidad"
                className="mt-1.5 w-full rounded-2xl border-2 border-[#EAE4E2] bg-white px-4 py-3 text-sm font-bold text-[#2C3E50] outline-none transition-colors focus:border-[#2c3e50]"
              >
                <option value="">Sin universidad</option>
                {Object.entries(universitiesByCountry).map(([country, list]) => (
                  <optgroup key={country} label={country}>
                    {list.map((uni) => (
                      <option key={uni.id} value={uni.id}>
                        {uni.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </div>

          {/* Visibilidad */}
          <div className="flex items-start justify-between gap-4 rounded-2xl border-2 border-[#EAE4E2] bg-[#FFFCFB] px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-black text-[#2C3E50]">Perfil público</p>
              <p className="mt-1 text-xs leading-relaxed text-[#7D8A96]">
                Con el perfil público, tu bio y tus datos del carné los pueden ver otros
                usuarios de MIRDaily.
              </p>
            </div>
            <InkSwitch
              checked={isPublic}
              onChange={() => setIsPublic((current) => !current)}
              label="Perfil público"
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t-2 border-dashed border-[#2c3e50]/25 bg-white px-6 py-4">
          <GhostButton onClick={onCancel} disabled={saving}>
            Cancelar
          </GhostButton>
          <StickerButton icon="check" onClick={handleSave} disabled={!canSave}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </StickerButton>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}

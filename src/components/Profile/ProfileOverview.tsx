'use client'

/* ════════════════════════════════════════════════════════════════════════
   Perfil: "quién soy y cómo voy".

   Antes esta pantalla hacía dos trabajos a la vez —era el carné Y el panel de
   ajustes—, y el progreso vivía suelto en el Studio. Ahora el carné manda, el
   nivel y los desafíos van justo debajo, y todo lo que se toca se fue a
   /configuracion.

   Los botones del carné no editan aquí: llevan a /configuracion con un ancla,
   porque el sitio donde se cambian las cosas es uno solo.
═══════════════════════════════════════════════════════════════════════════ */
import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ProfileHero from '@/components/Profile/ProfileHero'
import { SectionLabel, StickerCard } from '@/components/Profile/ui'
import LevelCard from '@/components/progress/LevelCard'
import ChallengesSection from '@/components/progress/ChallengesSection'
import { useProfile } from '@/hooks/useProfile'
import { useProgressContext } from '@/providers/ProgressProvider'

const MAIN_GOAL_LABEL: Record<'prepare_mir' | 'reinforce_degree' | 'explore', string> = {
  prepare_mir: 'Preparar el MIR',
  reinforce_degree: 'Reforzar la carrera',
  explore: 'Explorar',
}

function formatMedicalYear(value: number | null | undefined) {
  if (value === null || value === undefined) return 'Sin definir'
  if (value === 0) return 'Médico graduado'
  return `${value}º de Medicina`
}

function formatDate(date: Date) {
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysSince(iso: string | null | undefined) {
  if (!iso) return 0
  const from = new Date(iso).getTime()
  if (!Number.isFinite(from)) return 0
  return Math.max(0, Math.floor((Date.now() - from) / 86400000))
}

export default function ProfileOverview() {
  const { profile, loading, error, updatingAvatar } = useProfile()
  const { data: progressData, loading: progressLoading, permitirCelebracion } =
    useProgressContext()
  const router = useRouter()

  // El perfil es una pantalla de reposo: si quedaba algo por celebrar de una
  // sesión anterior, este es un sitio seguro para soltarlo.
  useEffect(() => {
    permitirCelebracion()
  }, [permitirCelebracion])

  if (loading) {
    return (
      <div className="animate-pulse space-y-7">
        <div className="h-64 rounded-3xl border-2 border-[#EAE4E2] bg-white" />
        <div className="h-40 rounded-3xl border-2 border-[#EAE4E2] bg-white" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-72 rounded-3xl border-2 border-[#EAE4E2] bg-white" />
          <div className="h-72 rounded-3xl border-2 border-[#EAE4E2] bg-white" />
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <StickerCard className="flex items-start gap-4 p-6" depth={5}>
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
      </StickerCard>
    )
  }

  const goalLabel = profile.main_goal ? MAIN_GOAL_LABEL[profile.main_goal] : 'Sin definir'

  return (
    <div className="space-y-7">
      <ProfileHero
        profile={profile}
        // Los dos botones del carné llevan al mismo sitio con anclas distintas:
        // editar es siempre en /configuracion, no aquí.
        onEditAvatar={() => router.push('/configuracion#avatares')}
        avatarBusy={updatingAvatar}
        onEditDetails={() => router.push('/configuracion#datos')}
        goalLabel={goalLabel}
        yearLabel={formatMedicalYear(profile.medical_year)}
        specialtyLabel={profile.mir_specialty?.name ?? 'Sin definir'}
        universityLabel={profile.university?.name ?? 'Sin universidad'}
        createdAtText={profile.created_at ? formatDate(new Date(profile.created_at)) : '—'}
        daysWithUs={daysSince(profile.created_at)}
      />

      <section>
        <SectionLabel>Tu progreso</SectionLabel>
        <LevelCard progress={progressData?.progress ?? null} loading={progressLoading} />
      </section>

      <section>
        <SectionLabel>Desafíos</SectionLabel>
        <ChallengesSection
          daily={progressData?.daily ?? []}
          weekly={progressData?.weekly ?? []}
          loading={progressLoading}
        />
      </section>

      <section>
        <SectionLabel>Atajos</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { href: '/configuracion', icon: 'settings', label: 'Configuración' },
            { href: '/panel', icon: 'insights', label: 'Panel de rendimiento' },
            { href: '/studio', icon: 'auto_stories', label: 'Estudio' },
            { href: '/notifications', icon: 'notifications', label: 'Notificaciones' },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <StickerCard
                className="flex items-center gap-3 p-4 transition-transform hover:-translate-y-0.5"
                depth={3}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 border-[#2c3e50] bg-[#FBEAE4] text-[#C4655A]">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden>
                    {item.icon}
                  </span>
                </span>
                <span className="flex-1 text-sm font-bold text-[#2C3E50]">{item.label}</span>
                <span className="flex h-5 w-5 items-center justify-center text-[#7D8A96]">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden>
                    chevron_right
                  </span>
                </span>
              </StickerCard>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

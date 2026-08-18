'use client'

/* ════════════════════════════════════════════════════════════════════════
   Portada del perfil: el carné.

   El resto de la web abre con la portada genérica (`Hero` del kit sticker).
   Aquí no: la pantalla trata de quién eres, así que la portada ES el
   documento —foto, campos rotulados, serie y código de barras— con el mismo
   borde de tinta y la misma sombra dura que las demás secciones.
═══════════════════════════════════════════════════════════════════════════ */
import { motion } from 'framer-motion'
import AvatarBadge from '@/components/Profile/AvatarBadge'
import {
  DocChip,
  Field,
  INK,
  LaminateSheen,
  SerialBarcode,
  laminatedPaper,
  serialOf,
} from '@/components/Profile/ui'
import type { UserProfile } from '@/hooks/useProfile'

type ProfileHeroProps = {
  profile: UserProfile
  /** Lleva al selector de avatares (la foto del carné se toca para cambiarla). */
  onEditAvatar: () => void
  avatarBusy: boolean
  /** Abre el editor de datos académicos y bio. */
  onEditDetails: () => void
  /** Con el editor abierto, el destello del laminado se para. */
  sheenPaused?: boolean
  goalLabel: string
  yearLabel: string
  specialtyLabel: string
  universityLabel: string
  createdAtText: string
  daysWithUs: number
}

export default function ProfileHero({
  profile,
  onEditAvatar,
  avatarBusy,
  onEditDetails,
  sheenPaused = false,
  goalLabel,
  yearLabel,
  specialtyLabel,
  universityLabel,
  createdAtText,
  daysWithUs,
}: ProfileHeroProps) {
  const displayName = profile.display_name || 'Usuario MIRDaily'

  return (
    <motion.header
      className="relative overflow-hidden rounded-3xl border-2 border-[#2c3e50]"
      style={{ ...laminatedPaper(), boxShadow: `7px 7px 0 0 ${INK}` }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <LaminateSheen paused={sheenPaused} />

      {/* Cabecera del documento */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b-2 border-dashed border-[#2c3e50]/25 px-5 py-3 sm:px-7">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border-2 border-[#2c3e50] bg-[#E8A598]">
            <span className="material-symbols-outlined text-white" style={{ fontSize: 14 }} aria-hidden>
              badge
            </span>
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#2C3E50]/75">
            MIRDaily · Carné de estudiante
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#7D8A96]">
            Nº {serialOf(profile.id)}
          </span>
          <button
            type="button"
            onClick={onEditDetails}
            className="flex items-center gap-1.5 rounded-full border-2 border-[#EAE4E2] bg-white px-3 py-1 text-[11px] font-black text-[#7D8A96] transition-all hover:-translate-y-0.5 hover:border-[#2c3e50] hover:text-[#2C3E50]"
          >
            <span className="flex h-4 w-4 items-center justify-center">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }} aria-hidden>
                edit_note
              </span>
            </span>
            Editar datos
          </button>
        </div>
      </div>

      {/* Cuerpo: foto + identidad + campos */}
      <div className="relative z-10 grid gap-6 px-5 py-6 sm:px-7 sm:py-7 md:grid-cols-[auto_1fr]">
        <div className="flex justify-center md:block">
          <button
            type="button"
            onClick={onEditAvatar}
            className="group relative flex h-[124px] w-[124px] items-center justify-center rounded-2xl border-2 border-[#2c3e50] bg-white transition-transform hover:-translate-y-0.5"
            style={{ boxShadow: `4px 4px 0 0 ${INK}` }}
            title="Cambiar avatar"
          >
            <span
              aria-hidden
              className="absolute inset-1 rounded-xl"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, rgba(232,165,152,0.16) 0 1px, transparent 1px 7px)',
              }}
            />
            <span className="relative">
              <AvatarBadge
                avatarId={profile.avatar_id ?? 1}
                size={100}
                alt={`Avatar de ${displayName}`}
                textSizeClassName="text-3xl"
              />
            </span>
            <span className="absolute inset-x-1 bottom-1 rounded-b-xl rounded-t-sm bg-[#2c3e50]/85 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              Cambiar
            </span>
            {avatarBusy ? (
              <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#E8A598] border-t-transparent" />
              </span>
            ) : null}
          </button>
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-3xl font-black leading-[1.05] tracking-tight text-[#2C3E50] sm:text-4xl">
            {displayName}
          </h1>
          <p className="mt-1 text-base font-bold text-[#7D8A96]">@{profile.username || '—'}</p>

          {profile.bio ? (
            // Texto plano a propósito: nada de enlaces ni HTML en un campo
            // libre que pueden ver otros usuarios.
            <p className="mt-3 max-w-xl whitespace-pre-line text-sm font-medium leading-relaxed text-[#3A3632]">
              {profile.bio}
            </p>
          ) : (
            <button
              type="button"
              onClick={onEditDetails}
              className="mt-3 flex items-center gap-1.5 text-sm font-bold text-[#B9705F] underline-offset-2 hover:underline"
            >
              <span className="flex h-4 w-4 items-center justify-center">
                <span className="material-symbols-outlined" style={{ fontSize: 15 }} aria-hidden>
                  add
                </span>
              </span>
              Añade una bio
            </button>
          )}

          <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 lg:grid-cols-4">
            <Field icon="flag" label="Objetivo" value={goalLabel} />
            <Field icon="school" label="Curso" value={yearLabel} accent="#7BA7C4" />
            <Field icon="stethoscope" label="Especialidad" value={specialtyLabel} accent="#8BA888" />
            <Field icon="account_balance" label="Universidad" value={universityLabel} accent="#C9A227" />
          </div>
        </div>
      </div>

      {/* Pie del documento */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-[#2c3e50]/25 px-5 py-3 sm:px-7">
        <SerialBarcode seed={profile.id} />
        <div className="flex flex-wrap items-center gap-2">
          <DocChip icon="event" tone="neutral">
            Emitido el {createdAtText}
          </DocChip>
          <DocChip icon="local_fire_department" tone="accent">
            {daysWithUs} {daysWithUs === 1 ? 'día' : 'días'} en MIRDaily
          </DocChip>
          <DocChip icon={profile.profile_public ? 'visibility' : 'lock'} tone={profile.profile_public ? 'success' : 'neutral'}>
            {profile.profile_public ? 'Perfil público' : 'Perfil privado'}
          </DocChip>
        </div>
      </div>

    </motion.header>
  )
}

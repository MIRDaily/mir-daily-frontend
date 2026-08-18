'use client'

import AvatarBadge from '@/components/Profile/AvatarBadge'
import { AVATAR_CATALOG, getSafeAvatarId } from '@/lib/avatar'

// El selector lo comparten el onboarding y el perfil. El onboarding mantiene el
// acabado suave original (`soft`); el perfil, rediseñado con el lenguaje de
// tinta del resto de la web, pide `sticker`.
type AvatarVariant = 'soft' | 'sticker'

type AvatarOptionProps = {
  id: number
  size: number
  selected: boolean
  disabled: boolean
  variant: AvatarVariant
  onSelect: (avatarId: number) => void
}

type AvatarSelectorProps = {
  selectedAvatarId: number
  disabled: boolean
  onSelect: (avatarId: number) => void
  columnsClassName?: string
  avatarSize?: number
  variant?: AvatarVariant
}

const INK = '#2c3e50'

function AvatarOption({ id, size, selected, disabled, variant, onSelect }: AvatarOptionProps) {
  const isSticker = variant === 'sticker'

  const className = isSticker
    ? `relative aspect-square overflow-hidden rounded-2xl border-2 p-2 transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
        selected
          ? 'border-[#2c3e50] bg-[#FFF4EF]'
          : 'border-[#EAE4E2] bg-white hover:-translate-y-0.5 hover:border-[#2c3e50]'
      }`
    : `relative aspect-square overflow-hidden rounded-2xl border p-2 transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
        selected
          ? 'border-[#E8A598] ring-2 ring-[#E8A598]/30 bg-[#FFF8F6] shadow-[0_6px_18px_rgba(232,165,152,0.18)]'
          : 'border-[#E9E4E1] hover:border-[#E8A598]/50 bg-white hover:bg-[#FFFCFA]'
      }`

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      disabled={disabled}
      aria-pressed={selected}
      className={className}
      style={isSticker && selected ? { boxShadow: `3px 3px 0 0 ${INK}` } : undefined}
    >
      <div className="flex h-full w-full items-center justify-center">
        <AvatarBadge avatarId={id} size={size} alt={`Avatar ${id}`} textSizeClassName="text-xl" />
      </div>
      {selected ? (
        isSticker ? (
          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#2c3e50] bg-[#8BA888] text-white">
            <span className="material-symbols-outlined" style={{ fontSize: 12 }} aria-hidden>
              check
            </span>
          </span>
        ) : (
          <span className="absolute top-2 right-2 text-[#E8A598]">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
          </span>
        )
      ) : null}
    </button>
  )
}

export default function AvatarSelector({
  selectedAvatarId,
  disabled,
  onSelect,
  columnsClassName = 'grid-cols-3 sm:grid-cols-4',
  avatarSize = 88,
  variant = 'soft',
}: AvatarSelectorProps) {
  const safeSelectedAvatarId = getSafeAvatarId(selectedAvatarId)

  return (
    <div className={`grid gap-3 ${columnsClassName}`}>
      {AVATAR_CATALOG.map((id) => (
        <AvatarOption
          key={id}
          id={id}
          size={avatarSize}
          selected={safeSelectedAvatarId === id}
          disabled={disabled}
          variant={variant}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

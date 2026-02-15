'use client'

import AvatarBadge from '@/components/Profile/AvatarBadge'
import { AVATAR_CATALOG, getSafeAvatarId } from '@/lib/avatar'

type AvatarOptionProps = {
  id: number
  selected: boolean
  disabled: boolean
  onSelect: (avatarId: number) => void
}

type AvatarSelectorProps = {
  selectedAvatarId: number
  disabled: boolean
  onSelect: (avatarId: number) => void
}

function AvatarOption({ id, selected, disabled, onSelect }: AvatarOptionProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      disabled={disabled}
      className={`relative rounded-2xl border p-2.5 transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
        selected
          ? 'border-[#E8A598] ring-2 ring-[#E8A598]/30 bg-[#FFF8F6] shadow-[0_6px_18px_rgba(232,165,152,0.18)]'
          : 'border-[#E9E4E1] hover:border-[#E8A598]/50 bg-white hover:bg-[#FFFCFA]'
      }`}
    >
      <div className="mx-auto">
        <AvatarBadge avatarId={id} size={88} alt={`Avatar ${id}`} textSizeClassName="text-xl" />
      </div>
      {selected ? (
        <span className="absolute top-2 right-2 text-[#E8A598]">
          <span className="material-symbols-outlined text-[14px]">check_circle</span>
        </span>
      ) : null}
    </button>
  )
}

export default function AvatarSelector({
  selectedAvatarId,
  disabled,
  onSelect,
}: AvatarSelectorProps) {
  const safeSelectedAvatarId = getSafeAvatarId(selectedAvatarId)

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {AVATAR_CATALOG.map((id) => (
        <AvatarOption
          key={id}
          id={id}
          selected={safeSelectedAvatarId === id}
          disabled={disabled}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

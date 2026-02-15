'use client'

import Image from 'next/image'
import { useState } from 'react'
import { getAvatarUrl, getSafeAvatarId } from '@/lib/avatar'

const avatarStyles: Record<number, string> = {
  1: 'bg-[#FDE68A] text-[#7C5B00]',
  2: 'bg-[#FCA5A5] text-[#7F1D1D]',
  3: 'bg-[#93C5FD] text-[#1E3A8A]',
  4: 'bg-[#A7F3D0] text-[#064E3B]',
  5: 'bg-[#C4B5FD] text-[#4C1D95]',
  6: 'bg-[#FDBA74] text-[#7C2D12]',
  7: 'bg-[#FBCFE8] text-[#831843]',
  8: 'bg-[#BFDBFE] text-[#1E40AF]',
  9: 'bg-[#DDD6FE] text-[#5B21B6]',
  10: 'bg-[#BBF7D0] text-[#14532D]',
  11: 'bg-[#FEF08A] text-[#713F12]',
  12: 'bg-[#FED7AA] text-[#7C2D12]',
}

type AvatarBadgeProps = {
  avatarId: number
  size: number
  alt: string
  textSizeClassName: string
}

export default function AvatarBadge({
  avatarId,
  size,
  alt,
  textSizeClassName,
}: AvatarBadgeProps) {
  const safeAvatarId = getSafeAvatarId(avatarId)
  const [failedIds, setFailedIds] = useState<Record<number, true>>({})
  const safeFailed = !!failedIds[safeAvatarId]
  const fallbackFailed = !!failedIds[1]

  if (!safeFailed) {
    return (
      <div
        className="relative overflow-hidden rounded-full"
        style={{ width: size, height: size }}
      >
        <Image
          src={getAvatarUrl(safeAvatarId)}
          alt={alt}
          fill
          sizes={`${size}px`}
          className="object-cover"
          onError={() =>
            setFailedIds((prev) => (prev[safeAvatarId] ? prev : { ...prev, [safeAvatarId]: true }))
          }
        />
      </div>
    )
  }

  if (safeAvatarId !== 1 && !fallbackFailed) {
    return (
      <div
        className="relative overflow-hidden rounded-full"
        style={{ width: size, height: size }}
      >
        <Image
          src={getAvatarUrl(1)}
          alt={alt}
          fill
          sizes={`${size}px`}
          className="object-cover"
          onError={() =>
            setFailedIds((prev) => (prev[1] ? prev : { ...prev, 1: true }))
          }
        />
      </div>
    )
  }

  return (
    <div
      className={`rounded-full font-bold flex items-center justify-center ${textSizeClassName} ${
        avatarStyles[safeAvatarId] ?? 'bg-[#E5E7EB] text-[#374151]'
      }`}
      style={{ width: size, height: size }}
    >
      {safeAvatarId}
    </div>
  )
}

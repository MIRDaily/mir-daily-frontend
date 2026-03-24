'use client'

import type { Resource } from '@/types/library'

type ResourceItemProps = {
  resource: Resource
  onClick?: (resourceId: string) => void
}

function resourceIcon(type: Resource['type']) {
  if (type === 'lectura') return 'description'
  if (type === 'video') return 'play_circle'
  return 'quiz'
}

function resourceMeta(resource: Resource) {
  const label = resource.type === 'lectura' ? 'Lectura' : resource.type === 'video' ? 'Video' : 'Práctica'
  return resource.duration ? `${label} ${resource.duration}` : label
}

export default function ResourceItem({ resource, onClick }: ResourceItemProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(resource.id)}
      className="flex w-full items-center justify-between rounded-xl bg-[#F9F8F7] px-4 py-3 text-left transition-colors hover:bg-[#F3EFEC]"
    >
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined mt-0.5 text-[18px] text-[#7D8A96]">{resourceIcon(resource.type)}</span>
        <div>
          <p className="text-sm font-medium text-[#2C3E50]">{resource.title}</p>
          <p className="text-xs text-gray-400">{resourceMeta(resource)}</p>
        </div>
      </div>
      <span
        className={`material-symbols-outlined text-xl ${
          resource.completed ? 'text-[#8BA888]' : 'text-gray-300'
        }`}
      >
        {resource.completed ? 'check_circle' : 'radio_button_unchecked'}
      </span>
    </button>
  )
}


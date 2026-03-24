import ResourceItem from '@/components/library/ResourceItem'
import type { Topic } from '@/types/library'

type TopicCardProps = {
  topic: Topic
  onResourceClick?: (resourceId: string) => void
}

export default function TopicCard({ topic, onResourceClick }: TopicCardProps) {
  const videoCount = topic.resources.filter((resource) => resource.type === 'video').length

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-[#EAE4E2] bg-white p-5">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-[#2C3E50]">{topic.name}</h3>
          <p className="mt-1 text-xs text-[#7D8A96]">
            {topic.resources.length} recursos · {videoCount} vídeos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-[#8BA888]">{topic.progress}%</span>
          <div className="h-2 w-20 rounded-full bg-[#F2EFED]">
            <div className="h-2 rounded-full bg-[#8BA888]" style={{ width: `${topic.progress}%` }} />
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {topic.resources.map((resource) => (
          <ResourceItem key={resource.id} resource={resource} onClick={onResourceClick} />
        ))}
      </div>
    </article>
  )
}


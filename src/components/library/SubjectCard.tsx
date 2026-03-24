import Link from 'next/link'
import type { SubjectOverview } from '@/types/library'

type SubjectCardProps = {
  subject: SubjectOverview
}

function typeBadgeLabel(type: SubjectOverview['type']) {
  return type
}

export default function SubjectCard({ subject }: SubjectCardProps) {
  const progress = Math.max(0, Math.min(100, subject.progress))
  const progressLabelClass = progress > 0 ? 'text-[#8BA888]' : 'text-[#7D8A96]/60'
  const isSpecial = subject.highlight === 'pastel-special'

  return (
    <Link
      href={`/library/${subject.id}`}
      className={`group relative flex h-56 cursor-pointer flex-col justify-between overflow-hidden rounded-2xl p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] ${
        isSpecial
          ? 'border-[#E6D7F3] bg-[linear-gradient(155deg,#FFF8FF_0%,#F8F3FF_45%,#FDF7F6_100%)]'
          : 'border border-[#EAE4E2] bg-white'
      }`}
    >
      <div className={`pointer-events-none absolute top-0 right-0 p-4 transition-opacity group-hover:opacity-10 ${isSpecial ? 'opacity-10' : 'opacity-5'}`}>
        <span className="material-symbols-outlined text-8xl text-[#2C3E50]">{subject.icon}</span>
      </div>

      <div>
        <div className="relative z-10 mb-3 flex items-start justify-between">
          <div
            className={`rounded-xl p-2.5 transition-colors duration-300 ${
              isSpecial
                ? 'bg-[#F4ECFF] text-[#A278CF] group-hover:bg-[#A278CF] group-hover:text-white'
                : 'bg-[#FFF5F3] text-[#E8A598] group-hover:bg-[#E8A598] group-hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">{subject.icon}</span>
          </div>
          <span className={`rounded border px-2 py-1 text-[10px] font-bold uppercase ${
            isSpecial
              ? 'border-[#E6D7F3] bg-[#F4ECFF] text-[#8A6AAE]'
              : 'border-[#EAE4E2] bg-[#F2EFED] text-[#7D8A96]'
          }`}>
            {typeBadgeLabel(subject.type)}
          </span>
        </div>
        <h3 className={`relative z-10 mb-1 line-clamp-2 text-lg leading-tight font-bold text-[#2C3E50] transition-colors ${
          isSpecial ? 'group-hover:text-[#9D6FD2]' : 'group-hover:text-[#E8A598]'
        }`}>
          {subject.name}
        </h3>
        <p className="mb-3 truncate text-xs text-[#7D8A96]/80">{subject.description}</p>
      </div>

      <div className="relative z-10">
        <div className="mb-1.5 flex items-end justify-between">
          <span className="text-xs font-semibold text-[#7D8A96]">
            {subject.topicsDone}/{subject.totalTopics} temas
          </span>
          <span className={`text-xs font-bold ${progressLabelClass}`}>{progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#F2EFED]">
          <div className="h-2 rounded-full bg-[#8BA888]" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </Link>
  )
}

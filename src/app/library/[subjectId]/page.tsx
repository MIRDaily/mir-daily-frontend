import Link from 'next/link'
import { notFound } from 'next/navigation'
import SubjectHeader from '@/components/library/SubjectHeader'
import TopicCard from '@/components/library/TopicCard'
import {
  LIBRARY_SUBJECT_OVERVIEW_BY_ID,
  LIBRARY_SUBJECTS_BY_ID,
} from '@/components/library/libraryMockData'

type LibrarySubjectDetailPageProps = {
  params: Promise<{ subjectId: string }>
}

export default async function LibrarySubjectDetailPage({ params }: LibrarySubjectDetailPageProps) {
  const { subjectId } = await params
  const subject = LIBRARY_SUBJECTS_BY_ID[subjectId]
  const overview = LIBRARY_SUBJECT_OVERVIEW_BY_ID[subjectId]

  if (!subject || !overview) {
    notFound()
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#E8A598]">
        <span className="material-symbols-outlined text-base">arrow_back</span>
        <Link href="/library" className="hover:text-[#d18d80]">
          Volver a Biblioteca
        </Link>
      </div>

      <SubjectHeader
        name={subject.name}
        progress={subject.progress}
        topicsDone={overview.topicsDone}
        totalTopics={overview.totalTopics}
        subtitle={`${overview.description} · ${overview.totalTopics} temas`}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-6 text-xl font-bold text-[#2C3E50]">Temario</h2>
          <div className="flex flex-col gap-6">
            {subject.topics.map((topic) => (
              <TopicCard key={topic.id} topic={topic} />
            ))}
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <section className="rounded-2xl border border-[#EAE4E2] bg-white p-5">
            <h3 className="mb-3 font-semibold text-[#2C3E50]">Recursos clave</h3>
            <div className="flex flex-col gap-3 text-sm">
              <div className="rounded-xl bg-[#F9F8F7] p-3">Guía de alto rendimiento</div>
              <div className="rounded-xl bg-[#F9F8F7] p-3">Mapa mental</div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#EAE4E2] bg-white p-5">
            <h3 className="mb-2 font-semibold text-[#2C3E50]">Simulacro</h3>
            <button
              type="button"
              className="w-full rounded-xl bg-[#E8A598] py-2 text-white transition-colors hover:bg-[#d18d80]"
            >
              Empezar
            </button>
          </section>
        </aside>
      </div>
    </main>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import SubjectHeader from '@/components/library/SubjectHeader'
import TopicCard from '@/components/library/TopicCard'
import type { Resource, Subject, Topic } from '@/types/library'
import { LIBRARY_SUBJECT_OVERVIEW_BY_ID, LIBRARY_SUBJECTS_BY_ID } from '@/mocks/library'
import { getUserAndToken } from '@/lib/supabase/server'

type LibrarySubjectDetailPageProps = {
  params: Promise<{ subjectId: string }>
}

type ApiTopicResponse = {
  topic?: {
    id: string | number
    name?: string
    title?: string
    progress?: number
    resources?: Array<{
      id: string | number
      title?: string
      name?: string
      type?: string
      estimatedMinutes?: number
      completed?: boolean
    }>
  }
  id?: string | number
  name?: string
  title?: string
  progress?: number
  resources?: Array<{
    id: string | number
    title?: string
    name?: string
    type?: string
    estimatedMinutes?: number
    completed?: boolean
  }>
}

function normalizeResourceType(value: string | undefined): Resource['type'] {
  const type = (value ?? '').toLowerCase()
  if (type.includes('video')) return 'video'
  if (type.includes('pract')) return 'practica'
  return 'lectura'
}

function mapTopicFromApi(apiPayload: ApiTopicResponse, fallbackTopic: Topic): Topic {
  const topic = apiPayload.topic ?? apiPayload
  const resources = Array.isArray(topic.resources)
    ? topic.resources.map((resource) => ({
        id: String(resource.id),
        title: resource.title ?? resource.name ?? 'Recurso',
        type: normalizeResourceType(resource.type),
        duration:
          typeof resource.estimatedMinutes === 'number' ? `${resource.estimatedMinutes} min` : undefined,
        completed: Boolean(resource.completed),
      }))
    : fallbackTopic.resources

  const progressFromApi = typeof topic.progress === 'number' ? topic.progress : null
  const completedCount = resources.filter((resource) => resource.completed).length
  const progressFromResources =
    resources.length > 0 ? Math.round((completedCount / resources.length) * 100) : fallbackTopic.progress

  return {
    id: String(topic.id ?? fallbackTopic.id),
    name: topic.name ?? topic.title ?? fallbackTopic.name,
    progress: progressFromApi ?? progressFromResources,
    resources,
  }
}

async function fetchTopic(topicId: string, accessToken: string): Promise<ApiTopicResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_API_URL no definida.')
  }

  const response = await fetch(`${apiUrl}/api/library/topics/${topicId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Error al cargar topic ${topicId}: ${response.status}`)
  }

  return (await response.json()) as ApiTopicResponse
}

export default async function LibrarySubjectDetailPage({ params }: LibrarySubjectDetailPageProps) {
  const { subjectId } = await params
  const isDevelopment = process.env.NODE_ENV !== 'production'
  const mockSubject = LIBRARY_SUBJECTS_BY_ID[subjectId]
  const mockOverview = LIBRARY_SUBJECT_OVERVIEW_BY_ID[subjectId]

  if (!mockSubject || !mockOverview) {
    notFound()
  }

  let topics: Topic[] = []
  let usingFallback = false
  let hasLoadError = false

  if (isDevelopment) {
    topics = mockSubject.topics
    try {
      const { accessToken } = await getUserAndToken()
      const topicResults = await Promise.all(
        mockSubject.topics.map(async (topic) => {
          try {
            const apiTopic = await fetchTopic(topic.id, accessToken)
            return { topic: mapTopicFromApi(apiTopic, topic), usedFallback: false }
          } catch {
            return { topic, usedFallback: true }
          }
        }),
      )
      topics = topicResults.map((result) => result.topic)
      usingFallback = topicResults.some((result) => result.usedFallback)
    } catch {
      usingFallback = true
    }
  } else {
    try {
      const { accessToken } = await getUserAndToken()
      topics = await Promise.all(
        mockSubject.topics.map(async (topic) => {
          const apiTopic = await fetchTopic(topic.id, accessToken)
          return mapTopicFromApi(apiTopic, topic)
        }),
      )
    } catch {
      hasLoadError = true
    }
  }

  const progress = topics.length > 0
    ? Math.round(topics.reduce((acc, topic) => acc + topic.progress, 0) / topics.length)
    : 0
  const topicsDone = topics.filter((topic) => topic.progress >= 100).length

  const subject: Subject = {
    ...mockSubject,
    progress,
    topics,
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[#E8A598]">
        <span className="material-symbols-outlined text-base">arrow_back</span>
        <Link href="/library" className="hover:text-[#d18d80]">
          Volver a Biblioteca
        </Link>
      </div>

      {usingFallback ? (
        <p className="text-sm text-[#7D8A96]">No se pudo cargar todo desde API. Mostrando datos de respaldo.</p>
      ) : null}
      {hasLoadError ? <p className="text-sm text-[#7D8A96]">Error cargando contenido</p> : null}

      <SubjectHeader
        name={subject.name}
        progress={subject.progress}
        topicsDone={topicsDone}
        totalTopics={topics.length}
        subtitle={`${mockOverview.description} · ${topics.length} temas`}
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
              <div className="rounded-xl bg-[#F9F8F7] p-3">Guia de alto rendimiento</div>
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

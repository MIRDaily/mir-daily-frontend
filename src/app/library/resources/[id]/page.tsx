import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { getUserAndToken } from '@/lib/supabase/server'
import { findMockResourceById } from '@/mocks/library'

type LibraryResourcePageProps = {
  params: Promise<{ id: string }>
}

type LibraryResourceResponse = {
  resource: {
    id: string
    title: string
    type: string
    estimatedMinutes: number
    contentMarkdown: string
    topic: { id: number; name: string }
    subject: { id: number; name: string }
    completed: boolean
  }
  navigation: {
    prevResourceId: string | null
    nextResourceId: string | null
  }
}

function parseDurationToMinutes(duration?: string): number {
  if (!duration) return 10
  const match = duration.match(/\d+/)
  return match ? Number(match[0]) : 10
}

function buildMockResourceResponse(resourceId: string): LibraryResourceResponse | null {
  const mock = findMockResourceById(resourceId)
  if (!mock) return null

  const topicResources = mock.topic.resources
  const currentIndex = topicResources.findIndex((resource) => resource.id === resourceId)

  return {
    resource: {
      id: mock.resource.id,
      title: mock.resource.title,
      type: mock.resource.type,
      estimatedMinutes: parseDurationToMinutes(mock.resource.duration),
      contentMarkdown: `# ${mock.resource.title}\n\nContenido temporal de respaldo para este recurso.`,
      topic: { id: 0, name: mock.topic.name },
      subject: { id: 0, name: mock.subject.name },
      completed: mock.resource.completed,
    },
    navigation: {
      prevResourceId: currentIndex > 0 ? topicResources[currentIndex - 1].id : null,
      nextResourceId:
        currentIndex >= 0 && currentIndex < topicResources.length - 1
          ? topicResources[currentIndex + 1].id
          : null,
    },
  }
}

async function getResource(resourceId: string, accessToken: string): Promise<LibraryResourceResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_API_URL no definida.')
  }

  const response = await fetch(`${apiUrl}/api/library/resources/${resourceId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  })

  if (response.status === 404) {
    notFound()
  }

  if (!response.ok) {
    throw new Error(`Error al cargar recurso ${resourceId}: ${response.status}`)
  }

  return (await response.json()) as LibraryResourceResponse
}

export default async function LibraryResourcePage({ params }: LibraryResourcePageProps) {
  const { id } = await params
  const isDevelopment = process.env.NODE_ENV !== 'production'
  let usingFallback = false
  let hasLoadError = false
  let data: LibraryResourceResponse | null = null

  try {
    const { accessToken } = await getUserAndToken()
    data = await getResource(id, accessToken)
  } catch {
    if (isDevelopment) {
      usingFallback = true
      data = buildMockResourceResponse(id)
    } else {
      hasLoadError = true
    }
  }

  if (hasLoadError) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <p className="text-sm text-[#7D8A96]">Error cargando contenido</p>
      </main>
    )
  }

  if (!data) {
    notFound()
  }

  const { resource, navigation } = data

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      {usingFallback ? (
        <p className="mb-4 text-sm text-[#7D8A96]">API no disponible. Mostrando contenido de respaldo.</p>
      ) : null}

      <header className="mb-8 space-y-3">
        <p className="text-sm font-medium text-[#7D8A96]">
          {resource.subject.name} - {resource.topic.name}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-[#2C3E50]">{resource.title}</h1>
        <p className="text-sm text-[#7D8A96]">{resource.estimatedMinutes} min de lectura</p>
      </header>

      <article className="prose prose-neutral max-w-none text-[#2C3E50] prose-headings:text-[#2C3E50] prose-strong:text-[#2C3E50]">
        <ReactMarkdown>{resource.contentMarkdown}</ReactMarkdown>
      </article>

      <nav className="mt-10 flex items-center justify-between border-t border-[#EAE4E2] pt-6">
        {navigation.prevResourceId ? (
          <Link
            href={`/library/resources/${navigation.prevResourceId}`}
            className="text-sm font-medium text-[#2C3E50] hover:text-[#1f2d3a]"
          >
            {'<'} Recurso anterior
          </Link>
        ) : (
          <span />
        )}

        {navigation.nextResourceId ? (
          <Link
            href={`/library/resources/${navigation.nextResourceId}`}
            className="text-sm font-medium text-[#2C3E50] hover:text-[#1f2d3a]"
          >
            Siguiente recurso {'>'}
          </Link>
        ) : null}
      </nav>
    </main>
  )
}

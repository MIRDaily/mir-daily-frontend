import SummaryClient from './SummaryClient'

type PageProps = {
  params: Promise<{
    sessionId: string
  }>
  searchParams?: Promise<{
    deckId?: string
    filterExhausted?: string
  }>
}

export default async function Page({ params, searchParams }: PageProps) {
  const { sessionId } = await params
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const deckId = resolvedSearchParams?.deckId ?? ''
  const filterExhausted = resolvedSearchParams?.filterExhausted === '1'

  return (
    <SummaryClient
      deckId={deckId}
      sessionId={sessionId}
      filterExhausted={filterExhausted}
    />
  )
}

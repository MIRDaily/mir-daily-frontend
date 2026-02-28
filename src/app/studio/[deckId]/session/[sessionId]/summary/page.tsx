import SummaryClient from './SummaryClient'

type PageProps = {
  params: Promise<{
    deckId: string
    sessionId: string
  }>
}

export default async function Page({ params }: PageProps) {
  const { deckId, sessionId } = await params

  return (
    <SummaryClient
      deckId={deckId}
      sessionId={sessionId}
    />
  )
}
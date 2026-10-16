import { notFound, redirect } from 'next/navigation'
import BibliotecaAsignatura from '@/components/library/biblioteca/BibliotecaAsignatura'
import { ASIGNATURA_DE_SLUG, idDeSegmento } from '@/lib/carpetas/biblioteca'

type LibrarySubjectPageProps = {
  params: Promise<{ subjectId: string }>
}

// /library/207: la asignatura del catálogo. Las URL de la maqueta (/library/cardiologia) se redirigen a
// la asignatura en la que quedaron; lo demás, 404. Si el id no existe o es una asignatura oculta, lo dice
// la propia página (el servidor responde 404 a /api/carpetas/asignatura/:id).
export default async function LibrarySubjectPage({ params }: LibrarySubjectPageProps) {
  const { subjectId } = await params
  const id = idDeSegmento(subjectId)
  if (id !== null) return <BibliotecaAsignatura subjectId={id} />
  if (Object.hasOwn(ASIGNATURA_DE_SLUG, subjectId)) {
    const destino = ASIGNATURA_DE_SLUG[subjectId]
    redirect(destino === null ? '/library' : `/library/${destino}`)
  }
  notFound()
}

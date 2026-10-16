import { notFound } from 'next/navigation'
import BibliotecaCarpeta from '@/components/library/biblioteca/BibliotecaCarpeta'
import { idDeSegmento } from '@/lib/carpetas/biblioteca'

type LibraryFolderPageProps = {
  params: Promise<{ subjectId: string; carpeta: string }>
}

// /library/3080/3421 (un tema) o /library/3080/general. Que el tema sea de esa asignatura lo comprueba la
// página con el catálogo; aquí solo se descarta lo que no puede ser una carpeta.
export default async function LibraryFolderPage({ params }: LibraryFolderPageProps) {
  const { subjectId, carpeta } = await params
  const id = idDeSegmento(subjectId)
  if (id === null || (carpeta !== 'general' && idDeSegmento(carpeta) === null)) notFound()
  return <BibliotecaCarpeta subjectId={id} segmento={carpeta} />
}

import type { StudyGuide } from '@/types/studyGuide'
import { CIRUGIA_GENERAL_GUIDE } from '@/lib/studyGuides/cirugia-general'
import { INMUNOLOGIA_GUIDE } from '@/lib/studyGuides/inmunologia'
import { NEUROLOGIA_GUIDE } from '@/lib/studyGuides/neurologia'
import { OFTALMOLOGIA_GUIDE } from '@/lib/studyGuides/oftalmologia'
import { REUMATOLOGIA_GUIDE } from '@/lib/studyGuides/reumatologia'

// Las guías se escribieron sobre la maqueta de la Biblioteca y su clave es un id de texto
// (`guide.subjectId`). Esa clave se conserva: los reportes de contenido la guardan en `guide_ref`
// («reumatologia/q12») y los temas de la guía son bloques propios, no los del catálogo. Lo que cambia es
// de qué asignatura del catálogo cuelgan, con esta tabla de equivalencias (ids de producción, §3.1).
const STUDY_GUIDES_BY_SUBJECT: Record<string, StudyGuide> = {
  neurologia: NEUROLOGIA_GUIDE,
  'cirugia-general': CIRUGIA_GENERAL_GUIDE,
  reumatologia: REUMATOLOGIA_GUIDE,
  inmunologia: INMUNOLOGIA_GUIDE,
  oftalmologia: OFTALMOLOGIA_GUIDE,
}

/** Clave de la guía → id de la asignatura del catálogo en la que se enseña. */
export const ASIGNATURA_DE_GUIA: Readonly<Record<string, number>> = {
  neurologia: 1478, // Neurología y Neurocirugía
  'cirugia-general': 3, // Digestivo y Cirugía General
  reumatologia: 3080, // Reumatología
  inmunologia: 4344, // Inmunología
  oftalmologia: 4343, // Oftalmología
}

/** La guía por su clave de texto (la de los reportes). */
export function getStudyGuide(guideId: string): StudyGuide | null {
  return Object.hasOwn(STUDY_GUIDES_BY_SUBJECT, guideId) ? STUDY_GUIDES_BY_SUBJECT[guideId] : null
}

/** La guía de una asignatura del catálogo, si la tiene. */
export function guiaDeAsignatura(subjectId: number): StudyGuide | null {
  const clave = Object.keys(ASIGNATURA_DE_GUIA).find((k) => ASIGNATURA_DE_GUIA[k] === subjectId)
  return clave ? getStudyGuide(clave) : null
}

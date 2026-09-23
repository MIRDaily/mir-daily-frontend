import type { StudyGuide } from '@/types/studyGuide'
import { CIRUGIA_GENERAL_GUIDE } from '@/lib/studyGuides/cirugia-general'
import { NEUROLOGIA_GUIDE } from '@/lib/studyGuides/neurologia'

const STUDY_GUIDES_BY_SUBJECT: Record<string, StudyGuide> = {
  neurologia: NEUROLOGIA_GUIDE,
  'cirugia-general': CIRUGIA_GENERAL_GUIDE,
}

export function getStudyGuide(subjectId: string): StudyGuide | null {
  return STUDY_GUIDES_BY_SUBJECT[subjectId] ?? null
}

import type { Subject, SubjectOverview, Topic } from '@/types/library'

export const LIBRARY_SUBJECT_OVERVIEWS: ReadonlyArray<SubjectOverview> = [
  {
    id: 'repasos-mir',
    name: 'Repasos MIR',
    description: 'Síntesis anual y estrategia final',
    progress: 48,
    topicsDone: 1,
    totalTopics: 3,
    type: 'BÁSICA',
    icon: 'school',
    highlight: 'pastel-special',
  },
  { id: 'bioestadistica', name: 'Bioestadística', description: 'Metodología de investigación', progress: 100, topicsDone: 10, totalTopics: 10, type: 'BÁSICA', icon: 'analytics' },
  { id: 'bioetica', name: 'Bioética y legislación', description: 'Marco legal y ético', progress: 37, topicsDone: 3, totalTopics: 8, type: 'BÁSICA', icon: 'gavel' },
  { id: 'cardiologia', name: 'Cardiología', description: 'Alta rentabilidad MIR', progress: 72, topicsDone: 18, totalTopics: 25, type: 'MÉDICA', icon: 'cardiology' },
  { id: 'cirugia-general', name: 'Cirugía General y Digestivo', description: 'Patología quirúrgica digestiva', progress: 40, topicsDone: 12, totalTopics: 30, type: 'QUIRÚRGICA', icon: 'gastroenterology' },
  { id: 'trauma', name: 'Cirugía Ortopédica y Trauma', description: 'Huesos, articulaciones y fracturas', progress: 22, topicsDone: 5, totalTopics: 22, type: 'QUIRÚRGICA', icon: 'orthopedics' },
  { id: 'cirugia-plastica', name: 'Cirugía Plástica', description: 'Quemados y reconstructiva', progress: 0, topicsDone: 0, totalTopics: 5, type: 'QUIRÚRGICA', icon: 'face_retouching_natural' },
  { id: 'dermatologia', name: 'Dermatología', description: 'Piel y anexos cutáneos', progress: 65, topicsDone: 11, totalTopics: 17, type: 'MÉDICA', icon: 'dermatology' },
  { id: 'endocrino', name: 'Endocrinología', description: 'Hormonas y metabolismo', progress: 58, topicsDone: 7, totalTopics: 12, type: 'MÉDICA', icon: 'monitor_weight' },
  { id: 'farmacologia', name: 'Farmacología', description: 'Principios terapéuticos', progress: 45, topicsDone: 9, totalTopics: 20, type: 'BÁSICA', icon: 'pill' },
  { id: 'ginecologia', name: 'Ginecología y Obstetricia', description: 'Salud de la mujer', progress: 74, topicsDone: 17, totalTopics: 23, type: 'QUIRÚRGICA', icon: 'pregnant_woman' },
  { id: 'hematologia', name: 'Hematología', description: 'Sangre y hemostasia', progress: 62, topicsDone: 13, totalTopics: 21, type: 'MÉDICA', icon: 'bloodtype' },
  { id: 'inmunologia', name: 'Inmunología', description: 'Respuesta inmune y autoinmunidad', progress: 29, topicsDone: 5, totalTopics: 17, type: 'BÁSICA', icon: 'biotech' },
  { id: 'nefrologia', name: 'Nefrología', description: 'Riñón y vías urinarias', progress: 75, topicsDone: 15, totalTopics: 20, type: 'MÉDICA', icon: 'water_drop' },
  { id: 'neurologia', name: 'Neurología', description: 'Sistema nervioso y sentidos', progress: 54, topicsDone: 15, totalTopics: 28, type: 'MÉDICA', icon: 'neurology' },
  { id: 'pediatria', name: 'Pediatría', description: 'Desarrollo y neonatología', progress: 91, topicsDone: 20, totalTopics: 22, type: 'MÉDICA', icon: 'child_care' },
]

export const LIBRARY_SUBJECT_OVERVIEW_BY_ID: Record<string, SubjectOverview> = Object.fromEntries(
  LIBRARY_SUBJECT_OVERVIEWS.map((subject) => [subject.id, subject]),
)

function createDefaultTopics(subjectName: string, progress: number): Topic[] {
  const firstProgress = Math.max(20, Math.min(100, progress))
  const secondProgress = Math.max(10, Math.min(100, progress - 15))

  return [
    {
      id: 'fundamentos',
      name: `Fundamentos de ${subjectName}`,
      progress: firstProgress,
      resources: [
        { id: 'lectura-base', title: 'Lectura base MIR', type: 'lectura', duration: '20 min', completed: firstProgress >= 40 },
        { id: 'video-resumen', title: 'Video resumen', type: 'video', duration: '12 min', completed: firstProgress >= 65 },
        { id: 'preguntas-clave', title: 'Preguntas clave', type: 'practica', duration: '10 min', completed: firstProgress >= 85 },
      ],
    },
    {
      id: 'alto-rendimiento',
      name: `Alto rendimiento en ${subjectName}`,
      progress: secondProgress,
      resources: [
        { id: 'algoritmos', title: 'Algoritmos MIR', type: 'lectura', duration: '18 min', completed: secondProgress >= 40 },
        { id: 'perlas', title: 'Perlas de examen', type: 'video', duration: '9 min', completed: secondProgress >= 60 },
        { id: 'mini-simulacro', title: 'Mini simulacro', type: 'practica', completed: secondProgress >= 80 },
      ],
    },
  ]
}

function buildDefaultSubject(overview: SubjectOverview): Subject {
  return {
    id: overview.id,
    name: overview.name,
    progress: overview.progress,
    topics: createDefaultTopics(overview.name, overview.progress),
  }
}

export const LIBRARY_SUBJECTS_BY_ID: Record<string, Subject> = Object.fromEntries(
  LIBRARY_SUBJECT_OVERVIEWS.map((overview) => [overview.id, buildDefaultSubject(overview)]),
)

LIBRARY_SUBJECTS_BY_ID.cardiologia = {
  id: 'cardiologia',
  name: 'Cardiología',
  progress: 72,
  topics: [
    {
      id: 'insuficiencia-cardiaca',
      name: 'Insuficiencia Cardíaca',
      progress: 75,
      resources: [
        { id: 'fisiopatologia', title: 'Fisiopatología', type: 'lectura', duration: '12 min', completed: true },
        { id: 'diagnostico-tratamiento', title: 'Diagnóstico y Tratamiento', type: 'lectura', duration: '25 min', completed: true },
        { id: 'gpc', title: 'Guía de Práctica Clínica', type: 'lectura', duration: '40 min', completed: false },
        { id: 'casos-clinicos', title: 'Casos Clínicos', type: 'practica', completed: false },
      ],
    },
    {
      id: 'cardiopatia-isquemica',
      name: 'Cardiopatía Isquémica',
      progress: 50,
      resources: [
        { id: 'sindrome-coronario', title: 'Síndrome Coronario Agudo', type: 'video', duration: '18 min', completed: true },
        { id: 'algoritmo-dolor', title: 'Algoritmo de Dolor Torácico', type: 'lectura', duration: '14 min', completed: true },
        { id: 'ecg-urgencias', title: 'ECG en Urgencias', type: 'practica', completed: false },
        { id: 'mini-test-ica', title: 'Mini Test MIR', type: 'practica', duration: '10 min', completed: false },
      ],
    },
  ],
}

LIBRARY_SUBJECTS_BY_ID.neurologia = {
  id: 'neurologia',
  name: 'Neurología',
  progress: 54,
  topics: [
    {
      id: 'ictus',
      name: 'Ictus',
      progress: 60,
      resources: [
        { id: 'codigo-ictus', title: 'Código Ictus', type: 'video', duration: '11 min', completed: true },
        { id: 'manejo-agudo', title: 'Manejo Agudo', type: 'lectura', duration: '20 min', completed: true },
        { id: 'escala-nihss', title: 'Escala NIHSS', type: 'practica', completed: false },
      ],
    },
    {
      id: 'epilepsia',
      name: 'Epilepsia',
      progress: 33,
      resources: [
        { id: 'crisis-epilepticas', title: 'Tipos de crisis', type: 'lectura', duration: '16 min', completed: true },
        { id: 'farmacos-antiepilepticos', title: 'Fármacos antiepilépticos', type: 'video', duration: '9 min', completed: false },
        { id: 'casos-epilepsia', title: 'Casos clínicos', type: 'practica', completed: false },
      ],
    },
  ],
}

LIBRARY_SUBJECTS_BY_ID['repasos-mir'] = {
  id: 'repasos-mir',
  name: 'Repasos MIR',
  progress: 48,
  topics: [
    {
      id: 'mir-2023',
      name: 'MIR 2023',
      progress: 70,
      resources: [
        { id: 'mir-2023-puntos-clave', title: 'Puntos clave', type: 'lectura', duration: '14 min', completed: true },
        { id: 'mir-2023-preguntas-dificiles', title: 'Preguntas difíciles', type: 'practica', duration: '20 min', completed: true },
        { id: 'mir-2023-guia-examen', title: 'Guía del examen', type: 'video', duration: '10 min', completed: false },
      ],
    },
    {
      id: 'mir-2024',
      name: 'MIR 2024',
      progress: 48,
      resources: [
        { id: 'mir-2024-puntos-clave', title: 'Puntos clave', type: 'lectura', duration: '15 min', completed: true },
        { id: 'mir-2024-preguntas-dificiles', title: 'Preguntas difíciles', type: 'practica', duration: '22 min', completed: false },
        { id: 'mir-2024-guia-examen', title: 'Guía del examen', type: 'video', duration: '12 min', completed: false },
      ],
    },
    {
      id: 'mir-2025',
      name: 'MIR 2025',
      progress: 25,
      resources: [
        { id: 'mir-2025-puntos-clave', title: 'Puntos clave', type: 'lectura', duration: '16 min', completed: false },
        { id: 'mir-2025-preguntas-dificiles', title: 'Preguntas difíciles', type: 'practica', duration: '24 min', completed: false },
        { id: 'mir-2025-guia-examen', title: 'Guía del examen', type: 'video', duration: '13 min', completed: false },
      ],
    },
  ],
}

export function findMockTopicById(topicId: string): {
  topic: Topic
  subject: Subject
  overview: SubjectOverview | null
} | null {
  for (const subject of Object.values(LIBRARY_SUBJECTS_BY_ID)) {
    const topic = subject.topics.find((item) => item.id === topicId)
    if (topic) {
      return {
        topic,
        subject,
        overview: LIBRARY_SUBJECT_OVERVIEW_BY_ID[subject.id] ?? null,
      }
    }
  }

  return null
}

export function findMockResourceById(resourceId: string): {
  resource: Topic['resources'][number]
  topic: Topic
  subject: Subject
  overview: SubjectOverview | null
} | null {
  for (const subject of Object.values(LIBRARY_SUBJECTS_BY_ID)) {
    for (const topic of subject.topics) {
      const resource = topic.resources.find((item) => item.id === resourceId)
      if (resource) {
        return {
          resource,
          topic,
          subject,
          overview: LIBRARY_SUBJECT_OVERVIEW_BY_ID[subject.id] ?? null,
        }
      }
    }
  }

  return null
}

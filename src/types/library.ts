export type SubjectType = 'MÉDICA' | 'QUIRÚRGICA' | 'BÁSICA'

export type Resource = {
  id: string
  title: string
  type: 'lectura' | 'video' | 'practica'
  duration?: string
  completed: boolean
}

export type Topic = {
  id: string
  name: string
  progress: number
  resources: Resource[]
}

export type Subject = {
  id: string
  name: string
  progress: number
  topics: Topic[]
}

export type SubjectOverview = {
  id: string
  name: string
  description: string
  progress: number
  topicsDone: number
  totalTopics: number
  type: SubjectType
  icon: string
  highlight?: 'pastel-special'
}

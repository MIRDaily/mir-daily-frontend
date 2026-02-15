'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { motion, useInView, type Transition } from 'framer-motion'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseBrowser'
import { useRouter } from 'next/navigation'
import { useDailyResults } from '@/hooks/useDailyResults'
import type { RankingEntry } from '@/hooks/useDailyResults'
import { useScoreDistribution } from '@/hooks/useScoreDistribution'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import { getAvatarUrl } from '@/lib/avatar'
import { extractProfile, parseApiError } from '@/lib/profile'
import { getUserSummary } from '@/services/resultsService'
import { useNotificationsContext } from '@/providers/NotificationsProvider'
import AppHeader from '@/components/AppHeader'
import DailyReviewCarousel from '@/components/DailyReviewCarousel'
import ZScoreComparisonCard from '@/components/ZScoreComparisonCard'

type DailyQuestion = {
  id: string | number
  subject: string
  statement: string
  options: string[]
  correctAnswer?: string | number | null
  explanation?: string | null
}

type DailyReviewQuestion = {
  reviewId?: string | number | null
  questionId?: string | number | null
  id: string | number
  statement: string
  options: string[]
  correctAnswer?: string | number | null
  selectedAnswer?: string | number | null
  isCorrect?: boolean | null
  explanation?: string | null
  hasImage?: boolean
  imageUrl?: string | null
  subject?: string | null
  category?: string | null
}

type Question = {
  reviewId?: string | number | null
  questionId?: string | number | null
  id: string
  category: string
  question: string
  correctAnswer: string | number | null
  selectedAnswer?: string | number | null
  isCorrect?: boolean | null
  explanation: string
  hasImage?: boolean
  imageUrl?: string | null
  options: string[]
}

type MostFailedWeekStats = {
  weekStart: string
  questionId: number
  wrongPercentage: number
  totalResponses: number
  distribution: Record<string, number>
  statement: string
  options: string[]
  correctAnswer: number
  yourLastAnswer: number | null
  youWereCorrect: boolean | null
  answeredAt: string | null
  explanation?: string | null
}

type MostFailedWeekPayload =
  | MostFailedWeekStats
  | {
      message: string
    }

type QuestionOutcome = {
  questionId?: number | string
  isCorrect?: boolean
  correct?: boolean
  is_correct?: boolean
}

const CARD_ANIMATION_DELAY_MS = 0
const CONTENT_ANIMATION_DELAY_MS = 320
const REVIEW_FLOATING_CTA_DELAY_MS = 2000
const MOST_FAILED_FETCH_MAX_RETRIES = 2

function formatMadridDate(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  }).format(date)
}

function normalizeOptionIndex(
  value: number | null | undefined,
  optionsLength: number,
): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  if (value >= 1 && value <= optionsLength) return value - 1
  if (value >= 0 && value < optionsLength) return value
  return null
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--'
  return `${value.toFixed(1)}`
}

function LazyCard({
  className,
  children,
  onInViewChange,
}: {
  className: string
  children: ReactNode
  onInViewChange?: (inView: boolean) => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const inView = useInView(ref, {
    amount: 0.35,
    once: false,
    margin: '0px 0px -10% 0px',
  })
  useEffect(() => {
    onInViewChange?.(inView)
  }, [inView, onInViewChange])
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 20, scale: 0.98 }}
      transition={{
        duration: 0.48,
        ease: 'easeOut',
        delay: CARD_ANIMATION_DELAY_MS / 1000,
      }}
      style={{ willChange: 'opacity, transform' }}
    >
      {children}
    </motion.div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const authenticatedFetch = useAuthenticatedFetch()
  const { refreshUnreadCount } = useNotificationsContext()
  const [deckOrder, setDeckOrder] = useState([0, 1, 2])
  const [showQuiz, setShowQuiz] = useState(false)
  const fallbackQuestions: DailyQuestion[] = [
    {
      id: 1,
      subject: 'Gastroenterologia',
      statement:
        'Paciente de 45 años acude a urgencias con dolor abdominal agudo en epigastrio irradiado en cinturón hacia la espalda, acompañado de náuseas y vómitos. Refiere ingesta copiosa de alcohol el día anterior. ¿Cuál es el diagnóstico más probable?',
      options: [
        'Apendicitis aguda',
        'Colecistitis aguda',
        'Pancreatitis aguda',
        'Obstruccion intestinal',
      ],
    },
    {
      id: 2,
      subject: 'Cardiologia',
      statement:
        'Varón de 62 años con dolor torácico opresivo de 30 minutos y diaforesis. ¿Conducta inicial más adecuada?',
      options: [
        'Nitroglicerina sublingual y ECG',
        'Analgesia y observacion',
        'Alta con control ambulatorio',
        'Prueba de esfuerzo inmediata',
      ],
    },
    {
      id: 3,
      subject: 'Endocrino',
      statement:
        'Paciente con poliuria y polidipsia. Glucemia en ayunas 142 mg/dl. ¿Criterio diagnóstico?',
      options: [
        'Repetir glucemia en ayunas',
        'Insulina basal',
        'Prueba de tolerancia oral',
        'Dieta hipocalorica',
      ],
    },
  ]
  const [dailyQuestions, setDailyQuestions] = useState<DailyQuestion[]>([])
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>([])
  const [timeSpentSeconds, setTimeSpentSeconds] = useState<number[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [isCheckingProfile, setIsCheckingProfile] = useState(true)
  const [profileCheckError, setProfileCheckError] = useState<string | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [dailyCompleted, setDailyCompleted] = useState(false)
  const [dailyFlowLoading, setDailyFlowLoading] = useState(false)
  const [dailyData, setDailyData] = useState<{
    meToday?: unknown
    reviewQuestions?: DailyReviewQuestion[]
  } | null>(null)
  const [animatedAccuracy, setAnimatedAccuracy] = useState(0)
  const [isEnvelopeOpening, setIsEnvelopeOpening] = useState(false)
  const [openProgress, setOpenProgress] = useState(0)
  const [openDurationMs, setOpenDurationMs] = useState(0)
  const [openingDeckId, setOpeningDeckId] = useState<string | null>(null)
  const [showSubjectBurst, setShowSubjectBurst] = useState(false)
  const [burstSubjects, setBurstSubjects] = useState<string[]>([])
  const [showSubjects, setShowSubjects] = useState(false)
  const [quizEntering, setQuizEntering] = useState(false)
  const [hasOpenedEnvelope, setHasOpenedEnvelope] = useState(false)
  const [deckSwitchCounter, setDeckSwitchCounter] = useState(0)
  const [isExitingDaily, setIsExitingDaily] = useState(false)
  const idleStartRef = useRef(performance.now())
  const deckSectionRef = useRef<HTMLDivElement | null>(null)

  const openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openStartRef = useRef<number | null>(null)
  const openRafRef = useRef<number | null>(null)
  const questionStartRef = useRef<number | null>(null)
  const lastQuestionIndexRef = useRef<number | null>(null)
  const quizScrollContainerRef = useRef<HTMLDivElement | null>(null)
  const reviewSectionRef = useRef<HTMLDivElement | null>(null)
  const [isReviewSectionVisible, setIsReviewSectionVisible] = useState(false)
  const [isReviewFloatingDelayDone, setIsReviewFloatingDelayDone] =
    useState(false)
  const [mostFailedWeek, setMostFailedWeek] = useState<MostFailedWeekStats | null>(null)
  const [mostFailedWeekLoading, setMostFailedWeekLoading] = useState(true)
  const [mostFailedWeekError, setMostFailedWeekError] = useState<string | null>(null)
  const [mostFailedWeekMessage, setMostFailedWeekMessage] = useState<string | null>(null)
  const [mostFailedSimulatedAnswer, setMostFailedSimulatedAnswer] = useState<number | null>(null)
  const [isMostFailedRevealed, setIsMostFailedRevealed] = useState(false)
  const [mostFailedStatementExpanded, setMostFailedStatementExpanded] = useState(false)
  const [mostFailedExplanationExpanded, setMostFailedExplanationExpanded] = useState(false)
  const hasFetchedMostFailedRef = useRef(false)

  const [quizResult, setQuizResult] = useState<{
    correctCount: number
    totalQuestions: number
    percentage: number
    score: number
    totalTime: number
  } | null>(null)
  const [resultsRefreshKey, setResultsRefreshKey] = useState(0)
  const [scoreDistributionRefreshKey, setScoreDistributionRefreshKey] =
    useState(0)
  const [animatedPercentile, setAnimatedPercentile] = useState(0)
  const [percentileOpenKey, setPercentileOpenKey] = useState(0)
  const [summary, setSummary] = useState<{
    avgPercentage?: number
    totalQuestions?: number
    trend?: number
    trendType?: string
    basis?: { dailys30?: number; dailys7?: number }
    state?: string
  } | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [distributionHover, setDistributionHover] = useState<{
    x: number
    y: number
    score: number
  } | null>(null)
  const [summaryChartCycle, setSummaryChartCycle] = useState(0)
  const [distributionChartCycle, setDistributionChartCycle] = useState(0)
  const [percentileChartCycle, setPercentileChartCycle] = useState(0)
  const prevSummaryCardInViewRef = useRef(false)
  const prevDistributionCardInViewRef = useRef(false)
  const prevPercentileCardInViewRef = useRef(false)
  const summaryFetchedRef = useRef(false)
  const [sessionId] = useState(() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  })
  const questions = dailyQuestions.length ? dailyQuestions : fallbackQuestions
  const currentQuestion = questions[currentQuestionIndex]
  const currentSelection = selectedAnswers[currentQuestionIndex]
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''
  const reviewQuestionsFromDaily = dailyQuestions.map((item) => ({
    reviewId: String(item.id),
    questionId: String(item.id),
    id: String(item.id),
    category: item.subject,
    question: item.statement,
    correctAnswer: item.correctAnswer ?? null,
    selectedAnswer: null,
    isCorrect: null,
    explanation: item.explanation ?? '',
    hasImage: false,
    imageUrl: null,
    options: item.options,
  }))

  const scrollToReview = () => {
    reviewSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  if (!API_URL) {
    throw new Error('API_URL no definida: revisa variables de entorno')
  }
  const {
    data: resultsData,
    ranking: resultsRanking,
    loading: resultsLoading,
    error: resultsError,
  } = useDailyResults(showResults, resultsRefreshKey)
  const {
    data: scoreDistribution,
    loading: scoreDistributionLoading,
    error: scoreDistributionError,
  } = useScoreDistribution(scoreDistributionRefreshKey)
  const mostFailedWeekOptions = mostFailedWeek?.options ?? []
  const mostFailedWeekCorrectIndex = normalizeOptionIndex(
    mostFailedWeek?.correctAnswer,
    mostFailedWeekOptions.length,
  )
  const mostFailedWeekLastAnswerIndex = normalizeOptionIndex(
    mostFailedWeek?.yourLastAnswer ?? null,
    mostFailedWeekOptions.length,
  )
  const mostFailedWeekAnsweredAtLabel = formatMadridDate(mostFailedWeek?.answeredAt)
  const mostFailedWeekStartLabel = formatMadridDate(mostFailedWeek?.weekStart ?? null)
  const isMostFailedNeverAnswered = mostFailedWeekLastAnswerIndex === null
  const isMostFailedAnsweredAndCorrect =
    mostFailedWeekLastAnswerIndex !== null && Boolean(mostFailedWeek?.youWereCorrect)
  const isMostFailedAnsweredAndWrong =
    mostFailedWeekLastAnswerIndex !== null && mostFailedWeek?.youWereCorrect === false
  const shouldShowMostFailedDetails = isMostFailedRevealed
  const shouldClampMostFailedStatement =
    !mostFailedStatementExpanded &&
    (mostFailedWeek?.statement?.length ?? 0) > 220
  const shouldClampMostFailedExplanation =
    !mostFailedExplanationExpanded &&
    (mostFailedWeek?.explanation?.length ?? 0) > 320
  const fetchMostFailedWeek = useCallback(async () => {
    setMostFailedWeekLoading(true)
    setMostFailedWeekError(null)

    let lastError: string | null = null
    for (let attempt = 0; attempt <= MOST_FAILED_FETCH_MAX_RETRIES; attempt += 1) {
      try {
        const response = await authenticatedFetch(
          `${API_URL}/api/stats/most-failed-week`,
        )
        if (!response.ok) {
          const message = await parseApiError(response)
          lastError = message
          if (response.status >= 500 && attempt < MOST_FAILED_FETCH_MAX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, 240 * (attempt + 1)))
            continue
          }
          throw new Error(message)
        }

        const payload = (await response.json().catch(() => null)) as MostFailedWeekPayload | null
        if (!payload || typeof payload !== 'object') {
          throw new Error('No se pudo cargar la pregunta más fallada.')
        }

        if ('message' in payload) {
          setMostFailedWeek(null)
          setMostFailedWeekMessage(payload.message)
          setMostFailedSimulatedAnswer(null)
          setIsMostFailedRevealed(false)
          setMostFailedStatementExpanded(false)
          setMostFailedExplanationExpanded(false)
          setMostFailedWeekLoading(false)
          return
        }

        setMostFailedWeek(payload)
        setMostFailedWeekMessage(null)
        setMostFailedSimulatedAnswer(null)
        setIsMostFailedRevealed(false)
        setMostFailedStatementExpanded(false)
        setMostFailedExplanationExpanded(false)
        setMostFailedWeekLoading(false)
        return
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'No se pudo cargar la pregunta más fallada.'
        lastError = message
        if (attempt < MOST_FAILED_FETCH_MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, 240 * (attempt + 1)))
          continue
        }
      }
    }

    setMostFailedWeek(null)
    setMostFailedWeekMessage(null)
    setMostFailedWeekError(lastError ?? 'No se pudo cargar la pregunta más fallada.')
    setMostFailedSimulatedAnswer(null)
    setIsMostFailedRevealed(false)
    setMostFailedStatementExpanded(false)
    setMostFailedExplanationExpanded(false)
    setMostFailedWeekLoading(false)
  }, [API_URL, authenticatedFetch])

  useEffect(() => {
    if (hasFetchedMostFailedRef.current) return
    hasFetchedMostFailedRef.current = true

    void fetchMostFailedWeek()
  }, [fetchMostFailedWeek])

  const revealMostFailed = () => {
    setIsMostFailedRevealed(true)
  }

  const rawPercentile = scoreDistribution?.percentile ?? null
  const percentile =
    typeof rawPercentile === 'number'
      ? rawPercentile
      : rawPercentile == null
        ? null
        : Number.parseFloat(String(rawPercentile).replace(',', '.'))
  const safePercentile =
    typeof percentile === 'number' && Number.isFinite(percentile)
      ? percentile
      : null
  useEffect(() => {
    if (!showResults) return
    setPercentileOpenKey((prev) => prev + 1)
  }, [safePercentile, showResults])

  useEffect(() => {
    if (!showResults) {
      setAnimatedPercentile(0)
      return
    }
    if (typeof safePercentile !== 'number') return
    setAnimatedPercentile(0)
    const timeout = setTimeout(() => {
      setAnimatedPercentile(Math.max(0, Math.min(100, safePercentile)))
    }, CONTENT_ANIMATION_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [
    safePercentile,
    showResults,
    percentileOpenKey,
    percentileChartCycle,
  ])

  const handleSummaryCardInViewChange = (visible: boolean) => {
    if (!showResults) {
      prevSummaryCardInViewRef.current = false
      return
    }
    if (visible && !prevSummaryCardInViewRef.current) {
      setSummaryChartCycle((prev) => prev + 1)
    }
    prevSummaryCardInViewRef.current = visible
  }

  const handleDistributionCardInViewChange = (visible: boolean) => {
    if (!showResults) {
      prevDistributionCardInViewRef.current = false
      return
    }
    if (visible && !prevDistributionCardInViewRef.current) {
      setDistributionChartCycle((prev) => prev + 1)
    }
    prevDistributionCardInViewRef.current = visible
  }

  const handlePercentileCardInViewChange = (visible: boolean) => {
    if (!showResults) {
      prevPercentileCardInViewRef.current = false
      return
    }
    if (visible && !prevPercentileCardInViewRef.current) {
      setPercentileChartCycle((prev) => prev + 1)
    }
    prevPercentileCardInViewRef.current = visible
  }

  const getPercentileStyle = (value: number) => {
    if (value <= 20) return { color: '#D64545', glow: 'none' }
    if (value <= 35) return { color: '#F4A261', glow: 'none' }
    if (value <= 60) return { color: '#4CAF50', glow: 'none' }
    if (value <= 90) return { color: '#3B82F6', glow: '0 0 18px rgba(59,130,246,0.6)' }
    return { color: '#8B5CF6', glow: '0 0 22px rgba(139,92,246,0.75)' }
  }
  const historicalQuotes = {
    veryLow: [
      'La dificultad fortalece la mente. — Séneca',
      'Lo que duele instruye. — Benjamin Franklin',
      'Ningún viento es favorable para quien no sabe a dónde va. — Séneca',
      'La experiencia es maestra severa pero eficaz. — Cicerón',
      'Quien se equivoca y no corrige, comete un segundo error. — Confucio',
      'La adversidad revela el carácter. — Séneca',
    ],
    low: [
      'La excelencia es fruto del hábito. — Aristóteles',
      'La disciplina pesa gramos; el arrepentimiento, toneladas. — Parafraseado de Jim Rohn (adaptado)',
      'La mejora constante vence al talento ocasional. — Inspirado en Aristóteles',
      'El progreso es acumulativo.',
      'Pequeños pasos sostenidos construyen grandes resultados.',
      'La constancia supera la inspiración.',
    ],
    mid: [
      'Lo que hacemos repetidamente nos define. — Aristóteles',
      'La calidad de tu mente determina tu vida. — Marco Aurelio',
      'El equilibrio es poder.',
      'La regularidad construye estructura.',
      'La estabilidad es la antesala del avance.',
      'La virtud está en el punto medio. — Aristóteles',
    ],
    high: [
      'La impedimenta es el camino. — Marco Aurelio',
      'El esfuerzo disciplinado genera ventaja.',
      'La práctica constante supera al talento aislado.',
      'La excelencia clínica se entrena.',
      'El dominio nace de la repetición consciente.',
      'La ventaja se construye día a día.',
    ],
    elite: [
      'La excelencia no es un acto, es un hábito. — Aristóteles',
      'La fortuna favorece a la mente preparada. — Parafraseado de Pasteur (dominio público)',
      'La grandeza exige consistencia.',
      'El éxito es disciplina acumulada.',
      'La diferencia está en la ejecución.',
      'Lo extraordinario es lo ordinario hecho mejor.',
    ],
  }

  const getPercentileCategory = (value: number) => {
    if (value <= 20) return 'veryLow'
    if (value <= 40) return 'low'
    if (value <= 60) return 'mid'
    if (value <= 80) return 'high'
    return 'elite'
  }

  const QUOTES_BY_PERCENTILE = {
    low: [
      { text: 'El éxito es ir de fracaso en fracaso sin perder el entusiasmo.', author: 'Winston Churchill' },
      { text: 'Nuestra mayor gloria no está en no caer nunca, sino en levantarnos cada vez que caemos.', author: 'Confucio' },
      { text: 'No es que sea muy inteligente, es que me quedo más tiempo con los problemas.', author: 'Albert Einstein' },
    ],
    midLow: [
      { text: 'Empieza donde estás. Usa lo que tienes. Haz lo que puedas.', author: 'Arthur Ashe' },
      { text: 'La energía y la persistencia conquistan todas las cosas.', author: 'Benjamin Franklin' },
      { text: 'El aprendizaje nunca agota la mente.', author: 'Leonardo da Vinci' },
    ],
    mid: [
      { text: 'Somos lo que hacemos repetidamente. La excelencia no es un acto, sino un hábito.', author: 'Aristóteles' },
      { text: 'La calidad nunca es un accidente; siempre es el resultado de un esfuerzo inteligente.', author: 'John Ruskin' },
      { text: 'El secreto de avanzar es comenzar.', author: 'Mark Twain' },
    ],
    high: [
      { text: 'La fortuna favorece a los audaces.', author: 'Virgilio' },
      { text: 'Actúa como si lo que haces marcara la diferencia. Porque la marca.', author: 'William James' },
      { text: 'La diferencia entre lo imposible y lo posible reside en la determinación.', author: 'Tommy Lasorda' },
    ],
    elite: [
      { text: 'Cuanto más duro trabajo, más suerte tengo.', author: 'Thomas Jefferson' },
      { text: 'No hay sustituto para el trabajo duro.', author: 'Thomas Edison' },
      { text: 'El precio de la grandeza es la responsabilidad.', author: 'Winston Churchill' },
    ],
  }

  function getPercentileTier(value: number) {
    if (value <= 20) return 'low'
    if (value <= 35) return 'midLow'
    if (value <= 60) return 'mid'
    if (value <= 90) return 'high'
    return 'elite'
  }

  function getQuoteForToday(percentileValue: number | null | undefined) {
    if (percentileValue === null || percentileValue === undefined) return null
    const tier = getPercentileTier(Number(percentileValue))
    const quotes = QUOTES_BY_PERCENTILE[tier]
    if (!quotes || quotes.length === 0) return null
    const daySeed = new Date().getDate()
    const index = daySeed % quotes.length
    return quotes[index] ?? null
  }

  const getStableQuote = (value: number, userIdValue: string) => {
    const category = getPercentileCategory(value)
    const quotes = historicalQuotes[category]
    if (!quotes || quotes.length === 0) return ''

    const today = new Date().toISOString().split('T')[0]
    const seedString = `${userIdValue}-${today}-${Math.floor(value)}`

    let hash = 0
    for (let i = 0; i < seedString.length; i += 1) {
      hash = seedString.charCodeAt(i) + ((hash << 5) - hash)
    }

    const index = Math.abs(hash) % quotes.length
    return quotes[index] ?? ''
  }

  const getPremiumParts = (
    value: number,
    trend: number | null,
    avgPercentage: number | null,
    userIdValue: string,
    zScoreValue: number | null,
  ) => {
    const quote = getStableQuote(value, userIdValue)
    const rounded = Math.round(value)

    let performanceLine = ''
    let contextLine = ''

    if (rounded <= 20) {
      performanceLine = `Percentil ${rounded} hoy. Rendimiento por debajo del grupo.`
      contextLine = 'Detecta el patrón de error antes del próximo daily.'
    } else if (rounded <= 40) {
      performanceLine = `Percentil ${rounded}. Zona media baja del grupo.`
      contextLine = 'Ajustar precisión y tiempo puede cambiar el resultado.'
    } else if (rounded <= 60) {
      performanceLine = `Percentil ${rounded}. Rendimiento alineado con la media.`
      contextLine = 'La consistencia empieza a marcar diferencia.'
    } else if (rounded <= 80) {
      performanceLine = `Percentil ${rounded}. Por encima de la mayoría hoy.`
      contextLine = 'Mantener este nivel genera ventaja estructural.'
    } else {
      performanceLine = `Percentil ${rounded}. Franja alta del grupo.`
      contextLine = 'Este rendimiento sostenido impacta directamente en tu posición global.'
    }

    const trendLine =
      typeof trend === 'number'
        ? trend > 0
          ? 'Tendencia semanal positiva.'
          : trend < 0
            ? 'Ligero descenso reciente, vigila consistencia.'
            : 'Tendencia estable.'
        : ''

    let zScoreLine = ''
    if (typeof zScoreValue === 'number' && Number.isFinite(zScoreValue)) {
      if (zScoreValue < -0.25) {
        zScoreLine = `Z-score ${zScoreValue.toFixed(2)}: por debajo de la media.`
      } else if (zScoreValue > 0.25) {
        zScoreLine = `Z-score ${zScoreValue.toFixed(2)}: por encima de la media.`
      } else {
        zScoreLine = `Z-score ${zScoreValue.toFixed(2)}: en la media.`
      }
    }

    const performanceExtras = [trendLine, zScoreLine].filter(Boolean).join(' ')
    const closingLine = contextLine

    return {
      lead: performanceExtras ? `${performanceLine} ${performanceExtras}` : performanceLine,
      quote,
      closing: closingLine,
    }
  }
  const style = getPercentileStyle(animatedPercentile)

  const meToday = resultsData?.meToday
  const breakdown = resultsData?.breakdown ?? meToday?.breakdown
  const byQuestion = resultsData?.byQuestion
  const mapToReviewQuestion = (
    item: Record<string, unknown>,
    index: number,
  ): Question | null => {
    const optionsFromArray = Array.isArray(item?.options)
      ? item.options.filter((opt): opt is string => typeof opt === 'string')
      : []
    const optionsFromColumns = [
      item?.option_1,
      item?.option_2,
      item?.option_3,
      item?.option_4,
    ].filter((opt): opt is string => typeof opt === 'string')
    const options =
      optionsFromArray.length > 0
        ? optionsFromArray
        : optionsFromColumns
    if (!options.length) return null
    const rawCorrectAnswer =
      item?.correctAnswer ??
      item?.correct_answer ??
      item?.correctOption ??
      item?.correct_option ??
      null
    const rawSelectedAnswer =
      item?.selectedAnswer ??
      item?.selected_answer ??
      item?.selectedOption ??
      item?.selected_option ??
      null

    return {
      reviewId: String(item?.reviewId ?? `${item?.questionId ?? item?.id ?? index}`),
      questionId: String(item?.questionId ?? item?.id ?? index),
      id: String(item?.reviewId ?? item?.questionId ?? item?.id ?? index),
      category: String(item?.subject ?? item?.category ?? 'Daily'),
      question: String(item?.statement ?? item?.question ?? ''),
      correctAnswer:
        typeof rawCorrectAnswer === 'string' || typeof rawCorrectAnswer === 'number'
          ? rawCorrectAnswer
          : null,
      selectedAnswer:
        typeof rawSelectedAnswer === 'string' || typeof rawSelectedAnswer === 'number'
          ? rawSelectedAnswer
          : null,
      isCorrect:
        typeof item?.isCorrect === 'boolean'
          ? item.isCorrect
          : typeof item?.is_correct === 'boolean'
            ? item.is_correct
            : null,
      explanation: String(item?.explanation ?? ''),
      hasImage: Boolean(item?.hasImage ?? item?.has_image),
      imageUrl:
        typeof item?.imageUrl === 'string' && item.imageUrl.trim()
          ? item.imageUrl
          : typeof item?.image_url === 'string' && item.image_url.trim()
            ? item.image_url
            : null,
      options,
    }
  }
  const reviewQuestionsFromResultsRaw: DailyReviewQuestion[] = Array.isArray(
    resultsData?.reviewQuestions,
  )
    ? (resultsData.reviewQuestions as DailyReviewQuestion[])
    : Array.isArray(dailyData?.reviewQuestions)
      ? dailyData.reviewQuestions
      : []
  const reviewQuestionsFromResults = reviewQuestionsFromResultsRaw
    .map((item, index: number) =>
      mapToReviewQuestion(item as Record<string, unknown>, index),
    )
    .filter((q): q is Question => q !== null)
  const reviewQuestionsFromByQuestion = Array.isArray(resultsData?.byQuestion)
    ? resultsData.byQuestion
        .map((item: unknown, index: number) =>
          mapToReviewQuestion(item as Record<string, unknown>, index),
        )
        .filter((q): q is Question => q !== null)
    : []
  const reviewQuestions = reviewQuestionsFromResults.length
    ? reviewQuestionsFromResults
    : reviewQuestionsFromByQuestion.length
      ? reviewQuestionsFromByQuestion
    : reviewQuestionsFromDaily
  const showReviewFloatingButton =
    showQuiz &&
    showResults &&
    reviewQuestions.length > 0
  const isResultsContentReady =
    showResults && !(resultsLoading && !resultsData && !quizResult)
  const isReviewFloatingButtonVisible =
    isReviewFloatingDelayDone && !isReviewSectionVisible
  useEffect(() => {
    if (!showReviewFloatingButton) {
      setIsReviewFloatingDelayDone(false)
      return
    }

    const timerId = setTimeout(() => {
      setIsReviewFloatingDelayDone(true)
    }, REVIEW_FLOATING_CTA_DELAY_MS)

    return () => clearTimeout(timerId)
  }, [showReviewFloatingButton])
  useEffect(() => {
    if (
      !showQuiz ||
      !showResults ||
      !reviewQuestions.length ||
      !isResultsContentReady
    ) {
      setIsReviewSectionVisible(false)
      return
    }
    const root = quizScrollContainerRef.current
    const target = reviewSectionRef.current
    if (!root || !target) {
      setIsReviewSectionVisible(false)
      return
    }

    const updateReviewVisibility = () => {
      const rootRect = root.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const viewportCenterY = rootRect.top + root.clientHeight * 0.5
      const reachedReview =
        targetRect.top <= viewportCenterY &&
        targetRect.bottom >= viewportCenterY
      setIsReviewSectionVisible((prev) =>
        prev === reachedReview ? prev : reachedReview,
      )
    }

    updateReviewVisibility()
    const rafId = requestAnimationFrame(updateReviewVisibility)
    const settleTimerA = setTimeout(updateReviewVisibility, 180)
    const settleTimerB = setTimeout(updateReviewVisibility, 800)
    root.addEventListener('scroll', updateReviewVisibility, { passive: true })
    window.addEventListener('resize', updateReviewVisibility)
    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateReviewVisibility()
      })
      resizeObserver.observe(root)
      resizeObserver.observe(target)
    }

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(settleTimerA)
      clearTimeout(settleTimerB)
      resizeObserver?.disconnect()
      root.removeEventListener('scroll', updateReviewVisibility)
      window.removeEventListener('resize', updateReviewVisibility)
    }
  }, [isResultsContentReady, reviewQuestions.length, showQuiz, showResults])
  const zScoreMean =
    typeof resultsData?.mean === 'number'
      ? resultsData.mean
      : typeof breakdown?.mean === 'number'
        ? breakdown.mean
        : null
  const zScoreStdDev =
    typeof resultsData?.stdDev === 'number'
      ? resultsData.stdDev
      : typeof resultsData?.std_dev === 'number'
        ? resultsData.std_dev
        : typeof breakdown?.stdDev === 'number'
          ? breakdown.stdDev
          : typeof breakdown?.std_dev === 'number'
            ? breakdown.std_dev
            : null
  const userZScore =
    typeof resultsData?.zScore === 'number'
      ? resultsData.zScore
      : typeof resultsData?.z_score === 'number'
        ? resultsData.z_score
        : typeof meToday?.zScore === 'number'
          ? meToday.zScore
          : typeof meToday?.z_score === 'number'
            ? meToday.z_score
            : null
  const resultsByQuestion: QuestionOutcome[] = Array.isArray(byQuestion)
    ? (byQuestion as QuestionOutcome[])
    : []
  const totalQuestionsCount =
    meToday?.totalQuestions ??
    (resultsByQuestion.length ? resultsByQuestion.length : undefined) ??
    quizResult?.totalQuestions ??
    questions.length
  const correctCount =
    meToday?.correctCount ??
    (resultsByQuestion.length
      ? resultsByQuestion.filter((item: QuestionOutcome) =>
          Boolean(item?.isCorrect ?? item?.correct ?? item?.is_correct),
        ).length
      : undefined) ??
    quizResult?.correctCount ??
    0
  const accuracyPct =
    meToday?.percentage ??
    quizResult?.percentage ??
    (totalQuestionsCount
      ? Math.round((correctCount / totalQuestionsCount) * 100)
      : 0)
  const safeAccuracy =
    typeof accuracyPct === 'number' && Number.isFinite(accuracyPct)
      ? Math.max(0, Math.min(100, accuracyPct))
      : 0
  const accuracyOffset = 100 - animatedAccuracy
  const accuracyBounceOffset = Math.max(0, accuracyOffset - 2)
  useEffect(() => {
    if (!showResults) return
    setAnimatedAccuracy(0)
    const timeout = setTimeout(() => {
      setAnimatedAccuracy(safeAccuracy)
    }, CONTENT_ANIMATION_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [safeAccuracy, showResults])
  const toFiniteNumber = (value: unknown, fallback = 0) => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : fallback
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : fallback
    }
    return fallback
  }
  const questionsPoints = toFiniteNumber(
    breakdown?.knowledgeScore,
    correctCount * 200,
  )

  const timeBonusPoints = toFiniteNumber(
    breakdown?.timeBonus,
    0,
  )
  const judgePenaltyPoints = 0

  const totalScorePoints = toFiniteNumber(
    breakdown?.total,
    questionsPoints + timeBonusPoints,
  )
  const summaryAvg = summary?.avgPercentage ?? null
  const summaryTrend = summary?.trend ?? null
  const sparkEndY =
    summaryAvg === null ? 30 : Math.max(18, 92 - summaryAvg * 0.7)
  const sparkMidY =
    summaryTrend === null
      ? 70
      : summaryTrend >= 0
        ? Math.max(30, sparkEndY + 10)
        : Math.min(85, sparkEndY - 10)
  const rankingList = Array.isArray(resultsRanking) ? resultsRanking : []
  const RANKING_VISIBLE_COUNT = 20
  const RANKING_MAX_COUNT = 25
  const topRanking = rankingList.slice(0, RANKING_MAX_COUNT)
  const userRankingEntry: RankingEntry | undefined = rankingList.find(
    (entry: RankingEntry) =>
      entry?.userId === userId || entry?.user_id === userId,
  )
  const userRank =
    meToday?.rank ??
    meToday?.position ??
    userRankingEntry?.rank ??
    userRankingEntry?.position ??
    null
  const userDisplayName =
    meToday?.displayName ??
    meToday?.name ??
    meToday?.username ??
    userRankingEntry?.displayName ??
    userRankingEntry?.name ??
    userRankingEntry?.username ??
    'Tu Nombre'
  const userScore = toFiniteNumber(
    meToday?.score,
    totalScorePoints,
  )
  const distributionScores = Array.isArray(scoreDistribution?.scores)
    ? scoreDistribution?.scores.filter(
        (value) => typeof value === 'number' && Number.isFinite(value),
      )
    : []
  const meanScore =
    typeof scoreDistribution?.mean === 'number' &&
    Number.isFinite(scoreDistribution.mean)
      ? scoreDistribution.mean
      : null
  const medianScore =
    typeof scoreDistribution?.median === 'number' &&
    Number.isFinite(scoreDistribution.median)
      ? scoreDistribution.median
      : null
  const sameScoreCount =
    typeof scoreDistribution?.sameScoreCount === 'number' &&
    Number.isFinite(scoreDistribution.sameScoreCount)
      ? scoreDistribution.sameScoreCount
      : null
  const minScore = distributionScores.length
    ? Math.min(...distributionScores)
    : null
  const maxScore = distributionScores.length
    ? Math.max(...distributionScores)
    : null
  const scorePadding =
    minScore !== null && maxScore !== null ? (maxScore - minScore) * 0.1 : 0
  const domainMin =
    minScore !== null ? minScore - scorePadding : null
  const domainMax =
    maxScore !== null ? maxScore + scorePadding : null
  const chartLeft = 20
  const chartRight = 380
  const chartTop = 10
  const chartBottom = 148
  const chartSpan = chartRight - chartLeft
  const chartHeight = chartBottom - chartTop
  const distributionVerticalScale = 1.35
  const chartPositionForScore = (value: number | null) => {
    if (value === null || domainMin === null || domainMax === null) return 200
    if (domainMax === domainMin) return 200
    const ratio = (value - domainMin) / (domainMax - domainMin)
    return chartLeft + Math.min(1, Math.max(0, ratio)) * chartSpan
  }
  const scoreForChartPosition = (x: number) => {
    if (domainMin === null || domainMax === null || chartSpan === 0) return null
    const clampedX = Math.max(chartLeft, Math.min(chartRight, x))
    const ratio = (clampedX - chartLeft) / chartSpan
    return domainMin + ratio * (domainMax - domainMin)
  }
  const buildKdePath = (scores: number[]) => {
    if (scores.length < 2 || domainMin === null || domainMax === null) {
      return { line: '', area: '', maxDensity: 0, bandwidth: 1 }
    }
    const n = scores.length
    const span = domainMax - domainMin
    const bandwidth = span > 0 ? Math.max(span / 10, 1) : 1
    const samples = 60
    const step = span / (samples - 1)
    const points = Array.from({ length: samples }, (_, idx) => {
      const xValue = domainMin + idx * step
      const density =
        scores.reduce((acc, value) => {
          const z = (xValue - value) / bandwidth
          return acc + Math.exp(-0.5 * z * z)
        }, 0) / n
      return { xValue, density }
    })
    const maxDensity =
      points.reduce((acc, point) => Math.max(acc, point.density), 0) || 1
    const line = points
      .map((point, index) => {
        const x = chartPositionForScore(point.xValue)
        const normalizedDensity = maxDensity > 0 ? point.density / maxDensity : 0
        const scaledDensity = Math.pow(normalizedDensity, distributionVerticalScale)
        const y = chartBottom - scaledDensity * chartHeight
        return `${index === 0 ? 'M' : 'L'}${x},${y}`
      })
      .join(' ')
    const area = `${line} L ${chartRight},${chartBottom} L ${chartLeft},${chartBottom} Z`
    return { line, area, maxDensity, bandwidth }
  }
  const distributionPaths = buildKdePath(distributionScores)
  const userScoreForChart =
    typeof userScore === 'number' && Number.isFinite(userScore)
      ? userScore
      : null
  const computeKdeDensity = (value: number) => {
    if (!distributionScores.length) return 0
    const n = distributionScores.length
    const bandwidth = distributionPaths.bandwidth || 1
    return (
      distributionScores.reduce((acc, score) => {
        const z = (value - score) / bandwidth
        return acc + Math.exp(-0.5 * z * z)
      }, 0) / n
    )
  }
  const userDensity =
    userScoreForChart !== null ? computeKdeDensity(userScoreForChart) : null
  const userScoreY =
    userDensity !== null && distributionPaths.maxDensity > 0
      ? chartBottom -
        Math.pow(
          userDensity / distributionPaths.maxDensity,
          distributionVerticalScale,
        ) *
          chartHeight
      : chartBottom
  const meanX = chartPositionForScore(meanScore)
  const medianX = chartPositionForScore(medianScore)
  const userScoreX = chartPositionForScore(userScoreForChart)
  const isInTopTen =
    (typeof userRank === 'number' && userRank <= 10) ||
    (userRankingEntry
        ? topRanking.some(
          (entry: RankingEntry) =>
            entry?.userId === userId || entry?.user_id === userId,
        )
      : false)

  const resetQuizState = (nextQuestions: DailyQuestion[]) => {
    setCurrentQuestionIndex(0)
    setSelectedAnswers(nextQuestions.map(() => null))
    setTimeSpentSeconds(nextQuestions.map(() => 0))
    if (!dailyCompleted) {
      setShowResults(false)
      setQuizResult(null)
    }
  }

  const getEffectiveTimeSpent = () => {
    const effective = [...timeSpentSeconds]
    if (
      questionStartRef.current !== null &&
      lastQuestionIndexRef.current !== null
    ) {
      const idx = lastQuestionIndexRef.current
      const delta = Math.max(
        0,
        Math.round((Date.now() - questionStartRef.current) / 1000),
      )
      effective[idx] = (effective[idx] ?? 0) + delta
    }
    return effective
  }

  const fetchDailyQuestions = async (): Promise<DailyQuestion[]> => {
    const response = await authenticatedFetch(`${API_URL}/api/daily-questions`)
    if (response.status === 401) {
      throw new Error('Sesión expirada. Inicia sesión de nuevo.')
    }
    if (!response.ok) {
      const contentType = response.headers.get('content-type') ?? ''
      const isJson = contentType.includes('application/json')
      const payload = isJson
        ? await response.json().catch(() => null)
        : await response.text().catch(() => '')
      const message =
        typeof payload === 'string'
          ? payload
          : typeof payload === 'object' &&
              payload !== null &&
              'error' in payload &&
              typeof (payload as { error?: string }).error === 'string'
            ? (payload as { error: string }).error
            : ''
      const alreadyCompleted =
        response.status === 403 &&
        typeof payload === 'object' &&
        payload !== null &&
        'alreadyCompleted' in payload &&
        Boolean((payload as { alreadyCompleted?: boolean }).alreadyCompleted)
      if (alreadyCompleted) {
        const err = new Error('Daily ya completado')
        ;(err as Error & { alreadyCompleted?: boolean }).alreadyCompleted = true
        throw err
      }
      if (response.status === 404 && message.includes('No hay preguntas para hoy')) {
        return []
      }
      throw new Error(message || 'No se pudieron cargar las preguntas del día.')
    }
    const payload = await response.json()
    const rawQuestions = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.questions)
        ? payload.questions
        : Array.isArray(payload?.data?.questions)
          ? payload.data.questions
          : Array.isArray(payload?.data)
            ? payload.data
          : Array.isArray(payload?.dailyQuestions)
            ? payload.dailyQuestions
            : Array.isArray(payload?.daily_questions)
              ? payload.daily_questions
              : Array.isArray(payload?.items)
                ? payload.items
            : []

    const mapped: DailyQuestion[] = rawQuestions
      .map((question: Record<string, unknown>) => {
        const optionsFromArray = Array.isArray(question.options)
          ? question.options.filter((opt): opt is string => typeof opt === 'string')
          : []
        const optionsFromColumns = [
          question.option_1,
          question.option_2,
          question.option_3,
          question.option_4,
        ].filter((opt): opt is string => typeof opt === 'string')
        const options =
          optionsFromArray.length >= 2
            ? optionsFromArray
            : optionsFromColumns

        const idValue =
          typeof question.id === 'string' || typeof question.id === 'number'
            ? question.id
            : typeof question.questionId === 'string' || typeof question.questionId === 'number'
              ? question.questionId
              : typeof question.question_id === 'string' || typeof question.question_id === 'number'
                ? question.question_id
                : ''

        return {
          id: idValue,
          subject:
            typeof question.subject === 'string'
              ? question.subject
              : 'General',
          statement:
            typeof question.statement === 'string'
              ? question.statement
              : typeof question.question === 'string'
                ? question.question
              : '',
          options,
          correctAnswer:
            typeof question.correct_answer === 'string' ||
            typeof question.correct_answer === 'number'
              ? question.correct_answer
              : null,
          explanation:
            typeof question.explanation === 'string'
              ? question.explanation
              : '',
        }
      })
      .filter((question: DailyQuestion) => String(question.id).trim().length > 0 && question.statement && question.options.length >= 2)

    if (!mapped.length) {
      throw new Error('No se pudieron interpretar las preguntas del backend.')
    }

    return mapped
  }

  const extractBurstSubjects = (list: DailyQuestion[]) =>
    list
      .map((question) => question.subject)
      .filter(Boolean)

  const handleSubmit = async () => {
    if (!userId) return
    if (isSubmitting) return
    if (selectedAnswers.some((answer) => answer === null)) return
    const effectiveTimeSpent = getEffectiveTimeSpent()
    setTimeSpentSeconds(effectiveTimeSpent)
    setIsSubmitting(true)
    try {
      const answers = questions.map((question, index) => ({
        questionId: question.id,
        selectedOption: (selectedAnswers[index] ?? 0) + 1,
        timeSpent: effectiveTimeSpent[index] ?? 0,
      }))
      if (answers.length !== questions.length) {
        return
      }
      if (new Set(answers.map((item) => item.questionId)).size !== answers.length) {
        return
      }
      console.log('ANSWERS ENVIADAS:', answers)
      const payload = {
        sessionId,
        answers,
      }
      const response = await authenticatedFetch(`${API_URL}/api/submit-answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (response.status === 401) {
        throw new Error('Sesión expirada. Inicia sesión de nuevo.')
      }
      const contentType = response.headers.get('content-type') ?? ''
      const isJson = contentType.includes('application/json')
      const payloadData = isJson
        ? await response.json().catch(() => null)
        : await response.text().catch(() => null)
      if (!response.ok) {
        const isAlreadyCompleted =
          response.status === 403 &&
          typeof payloadData === 'object' &&
          payloadData !== null &&
          'alreadyCompleted' in payloadData &&
          Boolean((payloadData as { alreadyCompleted?: boolean }).alreadyCompleted)
        if (isAlreadyCompleted) {
          setAuthMessage('Daily ya completado')
          setDailyCompleted(true)
          setShowResults(true)
          setResultsRefreshKey((prev) => prev + 1)
          setScoreDistributionRefreshKey((prev) => prev + 1)
          return
        }
        const backendMessage =
          typeof payloadData === 'object' &&
          payloadData !== null &&
          'error' in payloadData &&
          typeof (payloadData as { error?: string }).error === 'string'
            ? (payloadData as { error: string }).error
            : `Error enviando respuestas (${response.status})`
        throw new Error(backendMessage)
      }
      const data =
        typeof payloadData === 'object' && payloadData !== null ? payloadData : {}
      setQuizResult({
        correctCount: (data as { correctCount?: number }).correctCount ?? 0,
        totalQuestions:
          (data as { totalQuestions?: number }).totalQuestions ?? questions.length,
        percentage: (data as { percentage?: number }).percentage ?? 0,
        score: (data as { score?: number }).score ?? 0,
        totalTime: (data as { totalTime?: number }).totalTime ?? 0,
      })
      setResultsRefreshKey((prev) => prev + 1)
      setScoreDistributionRefreshKey((prev) => prev + 1)
      setDailyCompleted(true)
      setShowResults(true)
    } catch (error) {
      console.error('Error enviando respuestas', error)
      setAuthMessage(
        error instanceof Error
          ? error.message
          : 'No se pudieron enviar las respuestas.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1)
      return
    }
    void handleSubmit()
  }

  const handlePrevious = () => {
    setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))
  }

  const handleCloseQuiz = () => {
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current)
      openTimeoutRef.current = null
    }
    setShowSubjectBurst(false)
    setIsEnvelopeOpening(false)
    setOpeningDeckId(null)
    questionStartRef.current = null
    lastQuestionIndexRef.current = null
    setShowQuiz(false)
    setIsExitingDaily(false)
  }

  const handleExitDaily = () => {
    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current)
    }
    setIsExitingDaily(true)
    exitTimeoutRef.current = setTimeout(() => {
      handleCloseQuiz()
    }, 520)
  }

  const handleOpenQuiz = async () => {
    const deckEl = deckSectionRef.current
    if (deckEl) {
      const rect = deckEl.getBoundingClientRect()
      const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight
      if (!isVisible) {
        deckEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
    }
    const { data } = await supabase.auth.getUser()
    if (!data.user) {
      setAuthMessage('Necesitas iniciar sesión para abrir el cuestionario.')
      setTimeout(() => router.replace('/auth'), 900)
      return
    }
    const currentUserId = data.user.id
    setUserId(currentUserId)
    if (isEnvelopeOpening) return
    setDailyFlowLoading(true)
    setAuthMessage(null)
    setLoadError(null)
    try {
      const response = await authenticatedFetch(`${API_URL}/api/results/today`)
      if (response.status === 401) {
        return
      }
      const contentType = response.headers.get('content-type') ?? ''
      const isJson = contentType.includes('application/json')
      const payload = isJson
        ? await response.json().catch(() => null)
        : await response.text().catch(() => '')
      if (response.ok) {
        setDailyData(
          typeof payload === 'object' && payload !== null
            ? (payload as { reviewQuestions?: DailyReviewQuestion[] })
            : null,
        )
        setDailyCompleted(true)
        setShowResults(true)
        setShowQuiz(true)
        setResultsRefreshKey((prev) => prev + 1)
        setScoreDistributionRefreshKey((prev) => prev + 1)
        return
      }
      const alreadyCompleted =
        response.status === 403 &&
        typeof payload === 'object' &&
        payload !== null &&
        'alreadyCompleted' in payload &&
        Boolean((payload as { alreadyCompleted?: boolean }).alreadyCompleted)
      if (alreadyCompleted) {
        setDailyData(
          typeof payload === 'object' && payload !== null
            ? (payload as { reviewQuestions?: DailyReviewQuestion[] })
            : null,
        )
        setDailyCompleted(true)
        setShowResults(true)
        setShowQuiz(true)
        setResultsRefreshKey((prev) => prev + 1)
        setScoreDistributionRefreshKey((prev) => prev + 1)
        setAuthMessage('Daily ya completado')
        return
      }
      if (response.status !== 404) {
        const message =
          typeof payload === 'object' &&
          payload !== null &&
          'error' in payload &&
          typeof (payload as { error?: string }).error === 'string'
            ? (payload as { error: string }).error
            : `No se pudo comprobar estado del daily (${response.status})`
        throw new Error(message)
      }
      setDailyData(null)
      setDailyCompleted(false)
    } catch (error) {
      setAuthMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo comprobar estado del daily.',
      )
      return
    } finally {
      setDailyFlowLoading(false)
    }

    setHasOpenedEnvelope(true)
    setIsLoadingQuestions(true)
    setLoadError(null)
    let questionsForToday: DailyQuestion[] = []
    try {
      questionsForToday = await fetchDailyQuestions()
      setDailyQuestions(questionsForToday)
    } catch (error) {
      const alreadyCompleted =
        error instanceof Error &&
        Boolean((error as Error & { alreadyCompleted?: boolean }).alreadyCompleted)
      if (alreadyCompleted) {
        setDailyCompleted(true)
        setShowResults(true)
        setShowQuiz(true)
        setResultsRefreshKey((prev) => prev + 1)
        setScoreDistributionRefreshKey((prev) => prev + 1)
        setAuthMessage('Daily ya completado')
        return
      }
      console.warn('Error cargando preguntas, usando fallback:', error)
      setLoadError(
        error instanceof Error
          ? error.message
          : 'No se pudieron cargar las preguntas del día.',
      )
      return
    } finally {
      setIsLoadingQuestions(false)
    }
    if (!questionsForToday.length) {
      setLoadError('No hay preguntas disponibles para hoy.')
      return
    }
    setDailyQuestions(questionsForToday)
    resetQuizState(questionsForToday)
    const subjectsForBurst = extractBurstSubjects(questionsForToday)
    setBurstSubjects(subjectsForBurst)
    setShowSubjectBurst(true)
    const centerDeckId = decks[deckOrder[1]]?.id ?? null
    setOpeningDeckId(centerDeckId)
    setIsEnvelopeOpening(true)
    const lastCardIndex = Math.max(subjectsForBurst.length - 1, 0)
    const cardsAnimationMs = 940 + lastCardIndex * 85
    const readHoldMs = showSubjects ? 4400 : 1000
    const animationTotalMs = Math.max(820, cardsAnimationMs) + readHoldMs
    setOpenDurationMs(animationTotalMs)
    setOpenProgress(0)
    openTimeoutRef.current = setTimeout(() => {
      setIsEnvelopeOpening(false)
      setOpeningDeckId(null)
      setShowSubjectBurst(false)
      setQuizEntering(true)
      setShowQuiz(true)
    }, animationTotalMs)
  }

  useEffect(() => {
    if (!showQuiz) return
    const htmlEl = document.documentElement
    const originalHtmlOverflow = htmlEl.style.overflow
    const originalHtmlOverflowY = htmlEl.style.overflowY
    const originalOverflow = document.body.style.overflow
    const originalOverflowY = document.body.style.overflowY
    htmlEl.style.overflow = 'hidden'
    htmlEl.style.overflowY = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.overflowY = 'hidden'
    setQuizEntering(true)
    return () => {
      htmlEl.style.overflow = originalHtmlOverflow
      htmlEl.style.overflowY = originalHtmlOverflowY
      document.body.style.overflow = originalOverflow
      document.body.style.overflowY = originalOverflowY
      setQuizEntering(false)
    }
  }, [showQuiz])

  useEffect(() => {
    if (!showQuiz) return
    if (!selectedAnswers.length && questions.length) {
      setSelectedAnswers(questions.map(() => null))
    }
    if (!timeSpentSeconds.length && questions.length) {
      setTimeSpentSeconds(questions.map(() => 0))
    }
  }, [questions, selectedAnswers.length, showQuiz, timeSpentSeconds.length])

  useEffect(() => {
    if (!showQuiz || showResults) {
      questionStartRef.current = null
      lastQuestionIndexRef.current = null
      return
    }
    const now = Date.now()
    if (lastQuestionIndexRef.current === null) {
      lastQuestionIndexRef.current = currentQuestionIndex
      questionStartRef.current = now
      return
    }
    if (lastQuestionIndexRef.current !== currentQuestionIndex) {
      const prevIndex = lastQuestionIndexRef.current
      const start = questionStartRef.current ?? now
      const delta = Math.max(0, Math.round((now - start) / 1000))
      setTimeSpentSeconds((prev) => {
        const next = [...prev]
        next[prevIndex] = (next[prevIndex] ?? 0) + delta
        return next
      })
      lastQuestionIndexRef.current = currentQuestionIndex
      questionStartRef.current = now
    }
  }, [currentQuestionIndex, showQuiz, showResults])

  useEffect(() => {
    if (!authMessage) return
    const timer = setTimeout(() => {
      setAuthMessage(null)
    }, 2500)
    return () => clearTimeout(timer)
  }, [authMessage])

  useEffect(() => {
    refreshUnreadCount({ debounced: true })
  }, [refreshUnreadCount])

  useEffect(() => {
    let isMounted = true
    const checkProfileAccess = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!data.session) {
          router.replace('/auth')
          return
        }
        setUserId(data.session.user.id)
        const response = await authenticatedFetch(`${API_URL}/api/profile`)
        if (response.status === 401) return
        if (!response.ok) {
          throw new Error(await parseApiError(response))
        }
        const payload = await response.json().catch(() => ({}))
        const profile = extractProfile(payload)
        if (!profile.username) {
          router.replace('/complete-profile')
          return
        }
        if (!isMounted) return
        setProfileCheckError(null)
      } catch (err) {
        if (!isMounted) return
        setProfileCheckError(
          err instanceof Error ? err.message : 'No se pudo validar el perfil.',
        )
      } finally {
        if (isMounted) {
          setIsCheckingProfile(false)
        }
      }
    }
    void checkProfileAccess()
    return () => {
      isMounted = false
    }
  }, [API_URL, authenticatedFetch, router])

  useEffect(() => {
    if (!userId) return
    if (summaryFetchedRef.current) return
    summaryFetchedRef.current = true
    const controller = new AbortController()
    setSummaryLoading(true)
    getUserSummary(controller.signal)
      .then((data) => {
        setSummary(data)
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'No se pudo cargar el resumen'
        setSummaryError(message)
      })
      .finally(() => setSummaryLoading(false))
    return () => controller.abort()
  }, [userId])

  useEffect(() => {
    return () => {
      if (openTimeoutRef.current) {
        clearTimeout(openTimeoutRef.current)
      }
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current)
      }
      if (openRafRef.current) {
        cancelAnimationFrame(openRafRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isEnvelopeOpening || openDurationMs <= 0) {
      setOpenProgress(0)
      openStartRef.current = null
      if (openRafRef.current) {
        cancelAnimationFrame(openRafRef.current)
        openRafRef.current = null
      }
      return
    }
    openStartRef.current = performance.now()
    const tick = (now: number) => {
      const start = openStartRef.current ?? now
      const elapsed = now - start
      const next = Math.min(1, elapsed / openDurationMs)
      setOpenProgress(next)
      if (next < 1) {
        openRafRef.current = requestAnimationFrame(tick)
      }
    }
    openRafRef.current = requestAnimationFrame(tick)
    return () => {
      if (openRafRef.current) {
        cancelAnimationFrame(openRafRef.current)
        openRafRef.current = null
      }
    }
  }, [isEnvelopeOpening, openDurationMs])

  const decks = [
    {
      id: 'weekly',
      label: 'SEMANAL',
      icon: 'lock',
      heroTop: 'bg-slate-600',
      heroBottom: 'bg-slate-600',
      heroGradient: 'from-slate-400 to-slate-500',
      heroAccent: 'bg-slate-200',
      heroBorder: 'border-slate-600/30',
      compactTop: 'bg-slate-500',
      compactBody: 'bg-slate-400',
      compactBorder: 'border-slate-500/20',
    },
    {
      id: 'main',
      label: 'MIRDaily',
      icon: 'pulmonology',
      heroTop: 'bg-[#C45B4B]',
      heroBottom: 'bg-[#C45B4B]',
      heroGradient: 'from-[#F08D75] to-[#E87E65]',
      heroAccent: 'bg-[#FFAB91]',
      heroBorder: 'border-[#C45B4B]/30',
      compactTop: 'bg-[#C45B4B]',
      compactBody: 'bg-[#E87E65]',
      compactBorder: 'border-[#C45B4B]/30',
    },
    {
      id: 'reward',
      label: 'RECOMPENSA',
      icon: 'military_tech',
      heroTop: 'bg-emerald-600',
      heroBottom: 'bg-emerald-600',
      heroGradient: 'from-emerald-400 to-emerald-500',
      heroAccent: 'bg-emerald-200',
      heroBorder: 'border-emerald-600/30',
      compactTop: 'bg-emerald-600',
      compactBody: 'bg-emerald-500',
      compactBorder: 'border-emerald-600/20',
    },
  ]

  const rotateLeft = () => {
    if (isEnvelopeOpening) return
    setDeckOrder((order) => [order[2], order[0], order[1]])
    setDeckSwitchCounter((prev) => prev + 1)
  }

  const rotateRight = () => {
    if (isEnvelopeOpening) return
    setDeckOrder((order) => [order[1], order[2], order[0]])
    setDeckSwitchCounter((prev) => prev + 1)
  }

  if (isCheckingProfile) {
    return (
      <div className="min-h-screen bg-[#FAF7F4] text-[#7D8A96] flex items-center justify-center">
        Comprobando perfil...
      </div>
    )
  }

  if (profileCheckError) {
    return (
      <div className="min-h-screen bg-[#FAF7F4] text-[#2D3748] flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
          <p className="text-sm text-red-700">{profileCheckError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="text-[#2D3748] antialiased bg-[#FAF7F4] min-h-screen flex flex-col hub-enter">
      <AppHeader
        activeTab="daily"
        blurred={isEnvelopeOpening}
      />

      <main className="relative z-0 flex-grow flex flex-col items-center justify-start pt-8 pb-20 px-4 overflow-x-hidden">
        <div
          className={`fixed inset-0 z-20 bg-[#FAF7F4]/80 backdrop-blur-xl transition-opacity duration-700 ${
            isEnvelopeOpening ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        ></div>

        <div className="text-center max-w-2xl mx-auto mb-10 hub-anim hub-anim-delay-2">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4 tracking-tight">
            Tu Sobre de Hoy
          </h2>
          <p className="text-[#7D8A96] text-lg">
            Descubre tus preguntas diarias y pon a prueba tu conocimiento.
          </p>
        </div>

        <div
          ref={deckSectionRef}
          className="relative z-30 w-full max-w-5xl flex flex-col items-center justify-center mb-10 hub-anim hub-anim-delay-3"
        >
          <div className="absolute -top-36 -left-80 md:-left-[30rem] w-[520px] md:w-[700px] h-[520px] md:h-[700px] rounded-[88px] bg-gradient-to-br from-[#E8A598]/70 via-[#F08D75]/40 to-[#F8C7A6]/20 hub-blob pointer-events-none -z-10"></div>
          <div className="absolute -bottom-44 -right-80 md:-right-[32rem] w-[560px] md:w-[740px] h-[560px] md:h-[740px] rounded-[96px] bg-gradient-to-tr from-[#F6D87A]/60 via-[#F9E3A2]/40 to-[#FFF1C9]/20 hub-blob-alt pointer-events-none -z-10"></div>
          <div className="relative w-full flex justify-center items-center h-[420px] mb-8 group/deck z-40">
            <button
              type="button"
              onClick={rotateLeft}
              disabled={isEnvelopeOpening}
              aria-label="Rotar sobres a la izquierda"
              className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-30 size-11 rounded-full bg-white/90 border border-[#F0EAE6] text-[#7D8A96] shadow-soft opacity-0 scale-95 pointer-events-none transition-all duration-300 group-hover/deck:opacity-100 group-hover/deck:scale-100 group-hover/deck:pointer-events-auto hover:text-[#E8A598] hover:border-[#E8A598]/50 disabled:opacity-0 disabled:pointer-events-none"
            >
              <span className="material-symbols-outlined text-2xl">
                chevron_left
              </span>
            </button>

            <button
              type="button"
              onClick={rotateRight}
              disabled={isEnvelopeOpening}
              aria-label="Rotar sobres a la derecha"
              className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-30 size-11 rounded-full bg-white/90 border border-[#F0EAE6] text-[#7D8A96] shadow-soft opacity-0 scale-95 pointer-events-none transition-all duration-300 group-hover/deck:opacity-100 group-hover/deck:scale-100 group-hover/deck:pointer-events-auto hover:text-[#E8A598] hover:border-[#E8A598]/50 disabled:opacity-0 disabled:pointer-events-none"
            >
              <span className="material-symbols-outlined text-2xl">
                chevron_right
              </span>
            </button>

            {deckOrder.map((deckIndex, positionIndex) => {
              const deck = decks[deckIndex]
              const role =
                positionIndex === 1
                  ? 'center'
                  : positionIndex === 0
                    ? 'left'
                    : 'right'

              const baseClasses = 'absolute top-1/2 -translate-y-1/2'
              const positionClasses =
                role === 'center'
                  ? 'left-1/2 -translate-x-1/2'
                  : role === 'left'
                    ? 'left-0 md:left-10 lg:left-24'
                    : 'right-0 md:right-10 lg:right-24'
              const roleClasses =
                role === 'center'
                  ? 'z-20 opacity-100 scale-100'
                  : role === 'left'
                    ? 'z-0 opacity-40 scale-[0.95] blur-[3px] -rotate-6'
                    : 'z-0 opacity-40 scale-[0.95] blur-[3px] rotate-6'


              if (role === 'center') {
                return (
                  <div
                    key={deck.id}
                    className={`${baseClasses} ${positionClasses} ${roleClasses} w-72 md:w-80 aspect-[3/4] flex flex-col mx-auto cursor-pointer deck-idle`}
                    style={
                      {
                        '--deck-delay': `${(deckIndex * 0.25).toFixed(2)}s`,
                        '--sheen-delay': `${(deckIndex * 0.9 + 0.6).toFixed(2)}s`,
                      } as CSSProperties
                    }
                  >
                    <div className="deck-motion h-full w-full flex flex-col">
                      <div className={`h-5 w-full ${deck.heroTop} rounded-t-lg relative overflow-hidden shadow-sm border-b border-black/10`}>
                        <div className="absolute inset-0 crimp-pattern"></div>
                      </div>
                      <div
                        className={`flex-1 bg-gradient-to-br ${deck.heroGradient} relative flex flex-col items-center p-6 shadow-2xl border-x ${deck.heroBorder} deck-sheen`}
                      >
                        <div className="bg-white/70 border-2 border-dashed border-white/60 rounded-full px-8 py-2 mb-6 shadow-sm transform -rotate-1 w-full max-w-[95%] text-center">
                          <span className="text-[#E8A598] font-bold text-2xl tracking-tight">
                            {deck.label === 'MIRDaily' ? (
                              <>
                                MIR<span className="text-[#C45B4B]">Daily</span>
                              </>
                            ) : (
                              <span className="text-[#4B5563]">
                                {deck.label}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className={`w-36 h-36 rounded-full border-[6px] border-black/30 ${deck.heroAccent} flex items-center justify-center relative shadow-inner mb-4`}>
                          <span className="material-symbols-outlined text-black/70 text-[5.5rem]">
                            {deck.icon}
                          </span>
                        </div>
                        <span className="material-symbols-outlined absolute top-24 left-4 text-black/20 text-2xl animate-pulse">
                          star
                        </span>
                        <span className="material-symbols-outlined absolute bottom-16 right-5 text-black/20 text-xl animate-pulse delay-100">
                          star
                        </span>
                        <span className="material-symbols-outlined absolute top-32 right-3 text-black/20 text-lg">
                          star
                        </span>
                        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-white/10 to-transparent pointer-events-none"></div>
                      </div>
                      <div className={`h-5 w-full ${deck.heroBottom} rounded-b-lg relative overflow-hidden shadow-sm border-t border-black/10`}>
                        <div className="absolute inset-0 crimp-pattern"></div>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={deck.id}
                  className={`${baseClasses} ${positionClasses} ${roleClasses} w-56 aspect-[3/4] hidden sm:flex flex-col cursor-pointer deck-idle`}
                  style={
                    {
                      '--deck-delay': `${(deckIndex * 0.25).toFixed(2)}s`,
                      '--sheen-delay': `${(deckIndex * 0.9 + 0.6).toFixed(2)}s`,
                    } as CSSProperties
                  }
                >
                  <div className="deck-motion h-full w-full flex flex-col">
                    <div
                      className={`h-4 w-full ${deck.compactTop} rounded-t-lg relative overflow-hidden`}
                    >
                      <div className="absolute inset-0 crimp-pattern opacity-30"></div>
                    </div>
                    <div
                      className={`flex-1 ${deck.compactBody} flex flex-col items-center justify-center p-4 border-x ${deck.compactBorder} deck-sheen`}
                    >
                      <div className="bg-white/30 rounded-full p-4 mb-2">
                        <span className="material-symbols-outlined text-white text-4xl">
                          {deck.icon}
                        </span>
                      </div>
                      <p className="text-white font-bold tracking-wide">
                        {deck.label}
                      </p>
                    </div>
                    <div
                      className={`h-4 w-full ${deck.compactTop} rounded-b-lg relative overflow-hidden`}
                    >
                      <div className="absolute inset-0 crimp-pattern opacity-30"></div>
                    </div>
                  </div>
                </div>
              )
            })}

            {showSubjectBurst && (
              <div className="pointer-events-none absolute inset-0 z-50">
                {burstSubjects.map((subject, index) => {
                  const total = burstSubjects.length || 1
                  const topRowCount = Math.ceil(total / 2)
                  const isTopRow = index < topRowCount
                  const rowIndex = isTopRow ? 0 : 1
                  const indexInRow = isTopRow ? index : index - topRowCount
                  const rowTotal = isTopRow ? topRowCount : total - topRowCount
                  const rowMid = (rowTotal - 1) / 2
                  const rowSpread = Math.min(440, 80 * rowTotal)
                  const offset =
                    rowTotal <= 1
                      ? 0
                      : ((indexInRow - rowMid) / rowMid) * (rowSpread / 2)
                  const arc = rowTotal <= 1 ? 0 : 26 * (1 - Math.pow(offset / (rowSpread / 2), 2))
                  const baseY = rowIndex === 0 ? -210 : -40
                  const yOffset = baseY - arc
                  const tilt = (indexInRow - rowMid) * 3
                  const scale =
                    total > 10 ? 0.74 : total > 8 ? 0.8 : total > 6 ? 0.86 : 0.94
                  const cardStyle = {
                    '--burst-index': index,
                    '--burst-x': `${offset}px`,
                    '--burst-y': `${yOffset}px`,
                    '--burst-tilt': `${tilt}deg`,
                    '--burst-scale': `${scale}`,
                  } as CSSProperties
                  return (
                    <div
                      key={`${subject}-${index}`}
                      className="daily-burst-card"
                      style={cardStyle}
                    >
                        <div
                          className={`daily-burst-card-inner ${
                            showSubjects ? '' : 'daily-burst-no-flip'
                          }`}
                        >
                        <div className="daily-burst-face daily-burst-front">
                          <span className="material-symbols-outlined text-4xl text-[#C45B4B]/70">
                            drafts
                          </span>
                        </div>
                        <div className="daily-burst-face daily-burst-back">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7D8A96]/80">
                            Asignatura
                          </span>
                          <p className="mt-2 text-base font-bold text-[#2D3748] leading-tight">
                            {subject}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-6 z-30 hub-anim-soft hub-anim-delay-4 mb-12">
            <label
              className={`inline-flex items-center group select-none ${
                hasOpenedEnvelope ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              }`}
            >
              <input
                className="sr-only peer"
                type="checkbox"
                checked={showSubjects}
                disabled={hasOpenedEnvelope}
                onChange={(event) => setShowSubjects(event.target.checked)}
              />
              <div className="relative w-12 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#8BA888] shadow-inner transition-colors duration-300"></div>
              <span className="ms-3 text-sm font-medium text-[#7D8A96] group-hover:text-[#E8A598] transition-colors">
                Mostrar asignaturas (reduce XP en 20%)
              </span>
            </label>
            {authMessage && (
              <div className="w-full max-w-md bg-white/90 border border-[#E8A598]/30 text-[#C45B4B] text-sm font-medium px-4 py-3 rounded-2xl shadow-soft text-center flex flex-col sm:flex-row items-center justify-center gap-3">
                <span>{authMessage}</span>
                <button
                  type="button"
                  onClick={() => router.replace('/auth')}
                  className="px-3 py-1.5 rounded-full bg-[#E8A598] text-white text-xs font-semibold shadow"
                >
                  Iniciar sesión ahora
                </button>
              </div>
            )}
            <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
              <button
                className="relative bg-[#E8A598] hover:bg-[#d68c7f] text-white font-bold py-3.5 px-10 rounded-2xl shadow-[0_10px_20px_-5px_rgba(232,165,152,0.5)] transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_15px_25px_-5px_rgba(232,165,152,0.6)] flex items-center justify-center gap-2 group min-w-[200px]"
                onClick={handleOpenQuiz}
                disabled={isEnvelopeOpening || dailyFlowLoading}
              >
                <span className={`material-symbols-outlined text-2xl transition-transform duration-300 ${isEnvelopeOpening ? 'animate-spin' : 'group-hover:rotate-12'} nudge-wiggle`}>
                  drafts
                </span>
                <span className="text-lg tracking-wide">
                  {isEnvelopeOpening
                    ? 'Abriendo...'
                    : dailyFlowLoading
                      ? 'Comprobando...'
                    : dailyCompleted
                      ? 'Revisar tu Daily'
                      : 'Abrir Sobre'}
                </span>
              </button>
              <button
                className="relative bg-[#7D8A96]/70 text-white font-bold py-3.5 px-8 rounded-2xl shadow-[0_10px_20px_-5px_rgba(125,138,150,0.2)] transition-all duration-300 flex items-center justify-center gap-2 min-w-[200px] cursor-not-allowed"
                disabled
                aria-disabled="true"
              >
                <span className="material-symbols-outlined text-2xl opacity-70">
                  groups
                </span>
                <span className="text-lg tracking-wide opacity-80">
                  Multijugador
                </span>
                <span className="absolute -top-2 -right-2 rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#C4655A] shadow">
                  Proximamente
                </span>
              </button>
            </div>
            {isEnvelopeOpening && (
              <div className="w-full max-w-md h-1 rounded-full bg-[#F0EBE8] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#E8A598] via-[#F08D75] to-[#F6D87A] transition-[width] duration-150"
                  style={{ width: `${Math.round(openProgress * 100)}%` }}
                ></div>
              </div>
            )}
          </div>

          <div className="absolute top-10 left-1/4 size-4 bg-[#8BA888]/20 rounded-full blur-sm animate-pulse-slow -z-10"></div>
          <div className="absolute bottom-32 right-1/3 size-6 bg-[#E8A598]/20 rounded-full blur-sm animate-pulse-slow delay-700 -z-10"></div>

        <section className="relative z-10 w-full max-w-6xl mx-auto mb-20 mt-10 hub-anim hub-anim-delay-4">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-[#C45B4B] font-semibold">
                La más fallada
              </p>
              <h3 className="text-3xl md:text-4xl font-bold text-gray-800 mt-2">
                Pregunta más fallada de la semana
              </h3>
              <p className="text-[#7D8A96] text-lg mt-3 max-w-2xl">
                Aprendizaje compartido con la pregunta que más costó la semana pasada.
              </p>
            </div>
            <div className="bg-white border border-[#E8A598]/20 ring-1 ring-white/70 rounded-2xl px-5 py-4 shadow-[0_18px_40px_rgba(125,138,150,0.18)] flex items-center gap-4">
              <div className="text-sm text-[#7D8A96]">
                Semana
                <div className="mt-2 text-sm font-bold text-[#2D3748]">
                  {mostFailedWeekStartLabel ?? '--'}
                </div>
              </div>
              <div className="size-11 rounded-2xl bg-[#E8A598]/20 text-[#C45B4B] flex items-center justify-center">
                <span className="material-symbols-outlined">warning</span>
              </div>
            </div>
          </div>

          {mostFailedWeekLoading ? (
            <div className="bg-white rounded-3xl border border-white/60 ring-1 ring-white/70 p-6 shadow-[0_18px_40px_rgba(125,138,150,0.16)]">
              <div className="h-6 w-64 rounded-full bg-[#EFE9E6] animate-pulse" />
              <div className="mt-4 h-4 w-full rounded-full bg-[#F3EFEC] animate-pulse" />
              <div className="mt-2 h-4 w-5/6 rounded-full bg-[#F3EFEC] animate-pulse" />
              <div className="mt-8 space-y-3">
                <div className="h-12 rounded-2xl bg-[#F8F4F1] animate-pulse" />
                <div className="h-12 rounded-2xl bg-[#F8F4F1] animate-pulse" />
                <div className="h-12 rounded-2xl bg-[#F8F4F1] animate-pulse" />
                <div className="h-12 rounded-2xl bg-[#F8F4F1] animate-pulse" />
              </div>
            </div>
          ) : mostFailedWeekError ? (
            <div className="bg-white rounded-3xl border border-[#F4D8D4] p-6 text-[#C4655A] shadow-[0_18px_40px_rgba(125,138,150,0.16)]">
              <p>{mostFailedWeekError}</p>
              <button
                type="button"
                onClick={() => void fetchMostFailedWeek()}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#E8A598]/35 bg-[#FFF8F6] px-4 py-2 text-sm font-semibold text-[#C45B4B] hover:bg-[#FBEFEB]"
              >
                Reintentar
              </button>
            </div>
          ) : !mostFailedWeek ? (
            <div className="bg-white rounded-3xl border border-white/60 ring-1 ring-white/70 p-6 shadow-[0_18px_40px_rgba(125,138,150,0.16)] text-[#7D8A96]">
              {mostFailedWeekMessage ?? 'Aún no hay datos esta semana.'}
            </div>
          ) : (
            <div className="relative grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
              <motion.article
                layout
                initial={false}
                animate={{
                  x: isMostFailedRevealed ? -14 : 0,
                }}
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                className={`relative overflow-hidden rounded-3xl border border-white/60 ring-1 ring-white/70 bg-white p-6 shadow-[0_18px_40px_rgba(125,138,150,0.16)] z-20 ${
                  isMostFailedRevealed
                    ? 'lg:col-start-1 lg:col-end-2'
                    : 'lg:col-span-2 lg:max-w-[760px] lg:mx-auto'
                }`}
              >
                <header className="flex items-start justify-between gap-4">
                  <div>
                    <h4
                      className={`text-2xl font-semibold text-gray-800 leading-snug ${
                        shouldClampMostFailedStatement ? 'max-h-32 overflow-y-auto pr-2' : ''
                      }`}
                    >
                      {mostFailedWeek.statement}
                    </h4>
                    {(mostFailedWeek.statement?.length ?? 0) > 220 && (
                      <button
                        type="button"
                        onClick={() =>
                          setMostFailedStatementExpanded((prev) => !prev)
                        }
                        className="mt-2 text-xs font-semibold text-[#C45B4B] hover:text-[#A24C43]"
                      >
                        {mostFailedStatementExpanded ? 'Leer menos' : 'Leer más'}
                      </button>
                    )}
                    {!isMostFailedRevealed && (
                      <p className="text-[#7D8A96] text-sm mt-4">
                        ¿La volverías a acertar hoy?
                      </p>
                    )}
                    {isMostFailedRevealed && isMostFailedNeverAnswered && (
                      <p className="text-[#7D8A96] text-sm mt-4">
                        Ese día no hiciste el Daily. Pero no te preocupes... ¿la habrías acertado?
                      </p>
                    )}
                  </div>
                </header>

                <div className="mt-6 space-y-2">
                  {mostFailedWeekOptions.map((option, optionIndex) => {
                    const correctIndex = mostFailedWeekCorrectIndex
                    const isCorrect = correctIndex === optionIndex
                    const selectedIndex = mostFailedWeekLastAnswerIndex
                    const isSelected = selectedIndex === optionIndex
                    const simulatedSelected = mostFailedSimulatedAnswer === optionIndex
                    const selectable = !isMostFailedRevealed

                    let optionClass =
                      'border-[#F0EAE6] bg-white/70 text-[#7D8A96]'
                    let badge: ReactNode = null

                    if (!isMostFailedRevealed) {
                      if (simulatedSelected) {
                        optionClass = 'border-[#9CAFC4]/45 bg-[#EDF3F8] text-[#2D3748]'
                      }
                    } else if (isMostFailedAnsweredAndWrong) {
                      if (isSelected) {
                        optionClass = 'border-[#D78A82] bg-[#FBEDEC] text-[#7D2F2A]'
                        badge = (
                          <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-[#A24C43]">
                            Tu respuesta
                          </span>
                        )
                      }
                      if (isCorrect) {
                        optionClass = 'border-[#8BA888]/40 bg-[#8BA888]/10 text-[#2D3748]'
                        badge = (
                          <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-[#4C6A4D]">
                            Correcta
                          </span>
                        )
                      }
                    } else if (isMostFailedAnsweredAndCorrect) {
                      if (isSelected) {
                        optionClass = 'border-[#8BA888]/40 bg-[#8BA888]/10 text-[#2D3748]'
                        badge = (
                          <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-[#4C6A4D]">
                            Tu respuesta
                          </span>
                        )
                      }
                    }

                    return (
                      <button
                        key={`${option}-${optionIndex}`}
                        type="button"
                        disabled={!selectable}
                        onClick={() => {
                          if (!selectable) return
                          setMostFailedSimulatedAnswer(optionIndex)
                        }}
                        className={`w-full text-left px-4 py-2.5 rounded-2xl border text-sm flex items-center gap-3 transition-colors ${
                          selectable ? 'hover:border-[#E8A598]/60 cursor-pointer' : 'cursor-default'
                        } ${optionClass}`}
                      >
                        <span className="size-7 rounded-full border bg-[#FAF7F4] border-[#E8A598]/30 text-[#C45B4B] flex items-center justify-center text-xs font-bold">
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                        <span className="flex-1 whitespace-normal break-words max-h-24 overflow-y-auto pr-1">
                          {option}
                        </span>
                        {badge}
                      </button>
                    )
                  })}
                </div>

                {!isMostFailedRevealed && (
                  <div className="mt-6 flex flex-col gap-3">
                    <p className="text-xs text-[#7D8A96]">
                      Tu seleccion aqui no se guardara. Solo es para volver a reflexionar.
                    </p>
                    <button
                      type="button"
                      className="inline-flex w-fit mx-auto items-center gap-2 rounded-xl bg-[#E8A598] px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#E8A598]/25"
                      onClick={revealMostFailed}
                    >
                      Ver respuesta
                    </button>
                  </div>
                )}

                {isMostFailedRevealed && isMostFailedAnsweredAndWrong && (
                  <>
                    <p className="mt-5 text-sm text-[#7D8A96]">
                      La fallaste cuando la hiciste el {mostFailedWeekAnsweredAtLabel ?? '--'}. No fuiste el único: el {formatPercent(mostFailedWeek.wrongPercentage)}% también la falló.
                    </p>
                    <p className="mt-2 text-xs text-[#7D8A96]">
                      A veces las preguntas más falladas son las que más enseñan.
                    </p>
                  </>
                )}
                {isMostFailedRevealed && isMostFailedAnsweredAndCorrect && (
                  <>
                    <p className="mt-5 text-sm text-[#7D8A96]">
                      La acertaste cuando la hiciste el {mostFailedWeekAnsweredAtLabel ?? '--'}.{' '}
                      <span className="text-[#4C6A4D] font-semibold drop-shadow-[0_0_12px_rgba(139,168,136,0.35)]">
                        Estas por encima del {formatPercent(mostFailedWeek.wrongPercentage)}% de usuarios.
                      </span>
                    </p>
                    <p className="mt-2 text-xs text-[#7D8A96]">
                      Consolidar estos aciertos es lo que marca diferencia en el MIR.
                    </p>
                  </>
                )}
              </motion.article>

              <motion.aside
                layout
                initial={false}
                animate={{
                  opacity: isMostFailedRevealed ? 1 : 0,
                  x: isMostFailedRevealed ? 0 : 28,
                  scale: isMostFailedRevealed ? 1 : 0.985,
                }}
                transition={{ duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
                className={`bg-white rounded-3xl border border-white/60 ring-1 ring-white/70 p-6 shadow-[0_18px_40px_rgba(125,138,150,0.16)] ${
                  isMostFailedRevealed
                    ? 'lg:col-start-2 lg:col-end-3 relative z-10 pointer-events-auto'
                    : 'lg:absolute lg:top-0 lg:left-1/2 lg:-translate-x-1/2 lg:w-[760px] lg:max-w-full lg:z-0 pointer-events-none'
                }`}
              >
                {shouldShowMostFailedDetails ? (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="size-12 shrink-0 rounded-full bg-[#FFF8F6] text-[#C45B4B] shadow-sm border border-[#E8A598]/20 flex items-center justify-center">
                        <span className="material-symbols-outlined filled text-[20px] leading-none">
                          school
                        </span>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-[#7D8A96] font-semibold">
                          Explicación clínica
                        </p>
                        <h5 className="text-lg font-bold text-[#2D3748] mt-2">
                          Claves para no fallarla
                        </h5>
                      </div>
                    </div>
                    <p
                      className={`text-[#7D8A96] text-sm leading-relaxed mt-4 ${
                        shouldClampMostFailedExplanation ? 'max-h-48 overflow-y-auto pr-2' : ''
                      }`}
                    >
                      {mostFailedWeek.explanation ??
                        'No hay explicación disponible para esta pregunta.'}
                    </p>
                    {(mostFailedWeek.explanation?.length ?? 0) > 320 && (
                      <button
                        type="button"
                        onClick={() =>
                          setMostFailedExplanationExpanded((prev) => !prev)
                        }
                        className="mt-2 text-xs font-semibold text-[#C45B4B] hover:text-[#A24C43]"
                      >
                        {mostFailedExplanationExpanded ? 'Leer menos' : 'Leer más'}
                      </button>
                    )}

                    <div className="mt-6">
                      <p className="text-xs uppercase tracking-[0.25em] text-[#7D8A96] font-semibold mb-3">
                        Distribucion de respuestas
                      </p>
                      <div className="space-y-3">
                        {['A', 'B', 'C', 'D'].map((label, index) => {
                          const value = Number(mostFailedWeek.distribution?.[label] ?? 0)
                          const clampedValue = Math.max(0, Math.min(100, value))
                          return (
                            <div key={label} className="flex items-center gap-3">
                              <span className="w-4 text-xs font-bold text-[#7D8A96]">
                                {label}
                              </span>
                              <div className="h-2 flex-1 rounded-full bg-[#ECE7E4] overflow-hidden">
                                <motion.div
                                  initial={{ width: 0, opacity: 0 }}
                                  animate={{
                                    width: isMostFailedRevealed
                                      ? `${clampedValue}%`
                                      : '0%',
                                    opacity: isMostFailedRevealed ? 1 : 0,
                                  }}
                                  transition={{
                                    duration: 1.75,
                                    ease: [0.16, 1, 0.3, 1],
                                    delay: 0.22 * index,
                                  }}
                                  className={`h-full rounded-full ${
                                    index === mostFailedWeekCorrectIndex
                                      ? 'bg-[#8BA888]'
                                      : 'bg-[#E8A598]'
                                  }`}
                                />
                              </div>
                              <span className="text-xs font-semibold text-[#7D8A96] w-12 text-right">
                                {formatPercent(clampedValue)}%
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-[#E9E4E1] bg-white px-4 py-3 text-sm text-[#7D8A96]">
                    Pulsa en &quot;Ver respuesta&quot; para mostrar explicación clínica y distribución.
                  </div>
                )}
              </motion.aside>
            </div>
          )}
        </section>

        <div className="w-full max-w-6xl mx-auto mt-8 mb-12 hub-anim hub-anim-delay-5">
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 md:p-12 shadow-soft border border-white/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#E8A598]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#7D8A96]/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
              <div className="w-full lg:w-1/2 flex justify-center items-center relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#E8A598]/20 to-[#F08D75]/10 rounded-full blur-3xl transform scale-90"></div>
                <div className="relative flex gap-4 transform translate-y-4">
                  <div className="w-32 md:w-40 h-64 md:h-80 bg-slate-800 rounded-[2rem] border-4 border-slate-800 shadow-xl transform -rotate-6 translate-y-8 opacity-90 hidden sm:block">
                    <div className="w-full h-full bg-slate-700 rounded-[1.7rem] overflow-hidden flex flex-col relative">
                      <div className="h-full w-full bg-[#FAF7F4] opacity-10"></div>
                    </div>
                  </div>
                  <div className="w-40 md:w-48 h-80 md:h-96 bg-gray-900 rounded-[2.5rem] border-[6px] border-gray-900 shadow-2xl relative z-10">
                    <div className="absolute top-0 inset-x-0 h-4 bg-gray-900 rounded-b-lg w-20 mx-auto z-20"></div>
                    <div className="w-full h-full bg-[#FAF7F4] rounded-[2rem] overflow-hidden flex flex-col">
                      <div className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-4 pt-2">
                        <div className="w-4 h-4 rounded-full bg-[#E8A598]/20"></div>
                        <div className="w-16 h-2 rounded-full bg-gray-200"></div>
                      </div>
                      <div className="p-3 flex flex-col gap-3">
                        <div className="w-full aspect-[4/5] bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex flex-col gap-2 relative overflow-hidden">
                          <div className="flex gap-2">
                            <div className="w-12 h-3 rounded bg-blue-50"></div>
                            <div className="w-4 h-3 rounded-full bg-gray-100 ml-auto"></div>
                          </div>
                          <div className="w-full h-2 rounded bg-gray-100 mt-2"></div>
                          <div className="w-3/4 h-2 rounded bg-gray-100 mb-2"></div>
                          <div className="mt-auto flex flex-col gap-2">
                            <div className="w-full h-8 rounded-lg bg-gray-50 border border-gray-100"></div>
                            <div className="w-full h-8 rounded-lg bg-[#E8A598]/10 border border-[#E8A598]/20"></div>
                            <div className="w-full h-8 rounded-lg bg-gray-50 border border-gray-100"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-full lg:w-1/2 flex flex-col items-center lg:items-start text-center lg:text-left">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-6 leading-tight">
                  Tus 10 preguntas diarias te esperan en la App Móvil
                </h2>
                <p className="text-[#7D8A96] text-lg mb-10 max-w-md">
                  Accede a tu sobre diario, sigue tu racha y mejora tu preparación MIR con una experiencia diseñada para ti.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg">
                  <div className="flex flex-col items-center gap-4">
                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-[#7D8A96]/10">
                      <img
                        alt="Descargar en Google Play"
                        className="size-32 mix-blend-multiply"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuAXTrQEvoX6JXKgb7GXNZV6to0x7xfHaULww8jxVpO7mZNs_ZnghmpQLPfxrMRngEeDMJEFz7WcPCottHzvGZZoqlE9UAw6VNoHYpao7JhZHv43wzWYmwivvPi1uSBdEatDbNM868iwmsFaB_U5U-vYoeaRBGLTs-qhuuUAZsrrIgSKQ6vt5GJX7DzgStlewGi7Z3hp6fl7TL0ogGBHd5GLl5W_rVA5hzVuq2WCh5c-4H9Q8onOZPDbDEx5ygfU4Dt0Ek_2gdZkQbTV"
                      />
                    </div>
                    <span className="font-bold text-gray-700 text-sm uppercase tracking-wide">
                      Android
                    </span>
                    <button className="w-full bg-[#E8A598] hover:bg-[#d68c7f] text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-[#E8A598]/20 flex items-center justify-center gap-2 group transform hover:-translate-y-0.5">
                      <span className="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">
                        android
                      </span>
                      <span>Google Play</span>
                    </button>
                  </div>
                  <div className="flex flex-col items-center gap-4">
                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-[#7D8A96]/10">
                      <img
                        alt="Descargar en App Store"
                        className="size-32 mix-blend-multiply"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuCK_wL9Jzn9WhByJecOS4GkKfT8Q0eeYgVB5p9zCW6PizxSNDoUALLzBbOhlugJEWN0h0l9mium99e35zBUxD3WLpwCvVqav-f93a0IZnq0nFnENPxsNjT45KfngqlPDvNSyR5PX3crfT6Ce46gX5u-EceK_ajedXtssaOn2UU_adE9DITvr-uuZ92DConNlaEZaJdZSMDgJlezc5eq9HRZP4e-IBDrN8Z5twig2ACK7BGkQyVcx3emK3TK9jnWqbbIzxkl1XZNav9s"
                      />
                    </div>
                    <span className="font-bold text-gray-700 text-sm uppercase tracking-wide">
                      iOS
                    </span>
                    <button className="w-full bg-[#E8A598] hover:bg-[#d68c7f] text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-[#E8A598]/20 flex items-center justify-center gap-2 group transform hover:-translate-y-0.5">
                      <span className="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">
                        star
                      </span>
                      <span>App Store</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

        <footer className="w-full bg-[#FAF7F4] border-t border-[#7D8A96]/20 pt-16 pb-8 text-[#7D8A96] hub-anim-soft hub-anim-delay-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="size-6 bg-[#E8A598] rounded-md flex items-center justify-center text-white text-xs">
                  <span className="material-symbols-outlined text-[16px]">
                    medical_services
                  </span>
                </div>
                <span className="text-xl font-bold tracking-tight text-[#7D8A96]">
                  MIR<span className="text-[#E8A598]">Daily</span>
                </span>
              </div>
              <p className="text-[#7D8A96]/80 text-sm leading-relaxed mb-4">
                La plataforma inteligente para tu preparación MIR. Tecnología predictiva y comunidad.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-gray-800 mb-4">Soporte</h3>
              <ul className="space-y-3">
                <li>
                  <a className="text-[#7D8A96] hover:text-[#E8A598] text-sm transition-colors" href="#">
                    Ayuda y Preguntas Frecuentes
                  </a>
                </li>
                <li>
                  <a className="text-[#7D8A96] hover:text-[#E8A598] text-sm transition-colors" href="#">
                    Contacto
                  </a>
                </li>
                <li>
                  <a className="text-[#7D8A96] hover:text-[#E8A598] text-sm transition-colors" href="#">
                    Soporte Tecnico
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-gray-800 mb-4">Legal</h3>
              <ul className="space-y-3">
                <li>
                  <a className="text-[#7D8A96] hover:text-[#E8A598] text-sm transition-colors" href="#">
                    Política de Privacidad
                  </a>
                </li>
                <li>
                  <a className="text-[#7D8A96] hover:text-[#E8A598] text-sm transition-colors" href="#">
                    Términos de Servicio
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-gray-800 mb-4">Siguenos</h3>
              <div className="flex gap-3">
                <a className="size-10 rounded-full bg-white border border-[#7D8A96]/10 flex items-center justify-center text-[#7D8A96] hover:bg-[#E8A598] hover:text-white hover:border-[#E8A598] transition-all shadow-sm group" href="#">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"></path>
                  </svg>
                </a>
                <a className="size-10 rounded-full bg-white border border-[#7D8A96]/10 flex items-center justify-center text-[#7D8A96] hover:bg-[#E8A598] hover:text-white hover:border-[#E8A598] transition-all shadow-sm group" href="#">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"></path>
                  </svg>
                </a>
                <a className="size-10 rounded-full bg-white border border-[#7D8A96]/10 flex items-center justify-center text-[#7D8A96] hover:bg-[#E8A598] hover:text-white hover:border-[#E8A598] transition-all shadow-sm group" href="#">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"></path>
                  </svg>
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-[#7D8A96]/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-[#7D8A96]/60">
            <p>Â© 2024 MIRDaily. Todos los derechos reservados.</p>
            <div className="flex gap-4">
              <a className="hover:text-[#E8A598] transition-colors" href="#">
                Privacidad
              </a>
              <a className="hover:text-[#E8A598] transition-colors" href="#">
                Términos
              </a>
              <a className="hover:text-[#E8A598] transition-colors" href="#">
                Cookies
              </a>
            </div>
          </div>
        </div>
      </footer>

      {showQuiz && (
        <div
          ref={quizScrollContainerRef}
          className={`fixed inset-0 z-[60] text-[#2D3748] overflow-y-auto overscroll-contain transition-all duration-500 ${
            quizEntering && !isExitingDaily
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-3'
          }`}
        >
          <div className="absolute inset-0 bg-[#FAF7F4]/95 backdrop-blur-sm"></div>
          <div className="min-h-screen flex flex-col relative bg-[#FAF7F4]">
            <header className="w-full px-6 py-4 flex items-center justify-end sticky top-0 z-50 bg-[#FAF7F4]/95 backdrop-blur-sm border-b border-[#7D8A96]/10">
              <button
                onClick={handleExitDaily}
                className={`group flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  showResults
                    ? 'bg-[#E8A598] text-white shadow-lg shadow-[#E8A598]/30 hover:bg-[#d68c7f]'
                    : 'text-[#7D8A96] hover:text-[#2D3748] hover:bg-black/5'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">
                  logout
                </span>
                <span className="hidden sm:inline">Volver al Hub</span>
              </button>
            </header>

            <main className="flex-grow flex flex-col items-center justify-start px-4 pb-16 pt-6 sm:px-6 w-full relative">
              {showResults ? (
                resultsLoading && !resultsData && !quizResult ? (
                  <div className="w-full max-w-5xl mx-auto text-center text-[#7D8A96] relative z-10 animate-fade-in-up">
                    Cargando resultados...
                  </div>
                ) : resultsError && !resultsData ? (
                  <div className="w-full max-w-5xl mx-auto text-center text-[#C4655A] relative z-10 animate-fade-in-up">
                    {resultsError}
                  </div>
                ) : (
                <div className="w-full max-w-5xl mx-auto space-y-6 relative z-10 animate-fade-in-up">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#FFF8F6] mb-4 border border-[#E8A598]/20">
                      <span className="material-symbols-outlined text-[#E8A598]">
                        emoji_events
                      </span>
                    </div>
                    <h1 className="text-3xl font-extrabold text-[#374151]">
                      ¡Excelente trabajo!
                    </h1>
                    <p className="text-[#7D8A96] mt-2 font-medium">
                      Resultados de tu sesión diaria
                    </p>
                  </div>
                  

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-start">
                    <LazyCard className="bg-white rounded-3xl p-8 shadow-sm border border-[#F0EBE8] lg:col-span-2">
                      <div className="flex flex-col md:flex-row items-start justify-between gap-12">
                        <div className="relative w-64 h-64 flex items-center justify-center">
                          {accuracyPct === 100 && (
                            <div className="confetti-layer">
                              {Array.from({ length: 16 }).map((_, index) => (
                                <span
                                  key={`confetti-${index}`}
                                  className={`confetti-piece confetti-piece-${index + 1}`}
                                ></span>
                              ))}
                            </div>
                          )}
                          <svg className="w-full h-full" viewBox="0 0 36 36">
                            <defs>
                              <linearGradient id="goldStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#D4AF37" />
                                <stop offset="25%" stopColor="#FFD700" />
                                <stop offset="50%" stopColor="#FFF4B0" />
                                <stop offset="75%" stopColor="#FFD700" />
                                <stop offset="100%" stopColor="#D4AF37" />
                                <animate
                                  attributeName="x1"
                                  values="0%;100%;0%"
                                  dur="3s"
                                  repeatCount="indefinite"
                                />
                                <animate
                                  attributeName="x2"
                                  values="100%;200%;100%"
                                  dur="3s"
                                  repeatCount="indefinite"
                                />
                                <animateTransform
                                  attributeName="gradientTransform"
                                  type="rotate"
                                  from="0 18 18"
                                  to="360 18 18"
                                  dur="6s"
                                  repeatCount="indefinite"
                                />
                              </linearGradient>
                            </defs>
                            <g transform="rotate(-90 18 18)">
                              <circle
                                cx="18"
                                cy="18"
                                r="15.9155"
                                fill="none"
                                stroke={accuracyPct === 100 ? '#F0EBE8' : '#C4655A'}
                                strokeWidth="3.8"
                                strokeLinecap="round"
                              ></circle>
                              <circle
                                key={`accuracy-ring-${showResults ? 'open' : 'closed'}-${animatedAccuracy}`}
                                cx="18"
                                cy="18"
                                r="15.9155"
                                fill="none"
                                stroke={accuracyPct === 100 ? 'url(#goldStroke)' : '#8BA888'}
                                strokeWidth="3.8"
                                strokeLinecap="round"
                                strokeDasharray="100 100"
                                strokeDashoffset="100"
                              >
                                <animate
                                  attributeName="stroke-dashoffset"
                                  dur="1.35s"
                                  begin={`${CONTENT_ANIMATION_DELAY_MS}ms`}
                                  fill="freeze"
                                  calcMode="spline"
                                  keyTimes="0; 1"
                                  keySplines="0.22 1 0.36 1"
                                  values={`100; ${accuracyOffset}`}
                                />
                              </circle>
                            </g>
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-5xl font-extrabold text-[#374151] leading-none">
                              {accuracyPct}%
                            </span>
                            <span className="text-sm font-semibold text-[#7D8A96] uppercase tracking-wider mt-1">
                              Aciertos
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 w-full max-w-sm bg-[#FAF7F4] p-6 rounded-2xl border border-dashed border-[#E5DCD6]">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-[#7D8A96] mb-6 text-center">
                            Desglose de puntuación
                          </h3>
                          <div className="space-y-4 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-[#7D8A96]">PREGUNTAS</span>
                              <span className="text-[#8BA888] font-bold">+{questionsPoints} pts</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[#7D8A96]">BONUS TIEMPO</span>
                              <span className="text-[#8BA888] font-bold">
                                {typeof timeBonusPoints === 'number'
                                  ? `+${timeBonusPoints} pts`
                                  : '—'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[#7D8A96]">JUEZ MIRDAILY</span>
                              <span className="text-[#C4655A] font-bold">-{judgePenaltyPoints} pts</span>
                            </div>
                            <div className="border-t border-dashed border-[#E5DCD6] pt-4">
                              <div className="flex justify-between items-center">
                                <span className="font-extrabold text-lg text-[#374151] uppercase">Total</span>
                                <span className="font-extrabold text-2xl text-[#E8A598]">{totalScorePoints} pts</span>
                              </div>
                            </div>
                          </div>
                          <div className="mt-6 flex justify-center gap-2">
                            {Array.from({ length: totalQuestionsCount }).map((_, index) => {
                              const outcome: QuestionOutcome | undefined = resultsByQuestion[index]
                              const isCorrect = resultsByQuestion.length
                                ? Boolean(
                                    outcome?.isCorrect ??
                                      outcome?.correct ??
                                      outcome?.is_correct,
                                  )
                                : index < correctCount
                              return (
                                <span
                                  key={`result-icon-${index}`}
                                  className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold border ${isCorrect ? 'border-[#8BA888] text-[#8BA888] bg-white' : 'border-[#C4655A] text-[#C4655A] bg-white'}`}
                                >
                                  <span className="material-symbols-outlined text-[14px]">{isCorrect ? 'check' : 'close'}</span>
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </LazyCard>

                    <LazyCard
                      className="bg-white rounded-3xl p-8 shadow-sm border border-[#F0EBE8] min-h-[320px] lg:col-span-2 lg:row-start-2 flex flex-col"
                      onInViewChange={handleSummaryCardInViewChange}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xs font-bold text-[#7D8A96] uppercase tracking-widest">Tu Media Global de Aciertos (Últimos 30 dailys)</h3>
                          <div className="flex items-baseline gap-2 mt-2">
                            {summaryLoading ? (
                              <span className="text-sm font-semibold text-[#7D8A96]">
                                Cargando resumen...
                              </span>
                            ) : summaryError ? (
                              <span className="text-sm font-semibold text-[#C4655A]">
                                No se pudo cargar el resumen
                              </span>
                            ) : summary?.state === 'insufficient_data' ? (
                              <span className="text-sm font-semibold text-[#7D8A96]">
                                Aún no hay suficientes datos
                              </span>
                            ) : (
                              <>
                                <span className="text-5xl font-extrabold text-[#374151]">
                                  {summary?.avgPercentage?.toFixed(1) ?? '--'}%
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="p-2 bg-[#FFF8F6] rounded-xl">
                          <span className="material-symbols-outlined text-[#E8A598]">trending_up</span>
                        </div>
                      </div>
                      <div className="relative h-24 w-full flex items-end">
                        <svg
                          key={`summary-sparkline-${summaryChartCycle}`}
                          className="w-full h-full"
                          preserveAspectRatio="none"
                          viewBox="0 0 400 100"
                        >
                          <path
                            className="summary-sparkline"
                            d={`M0,85 Q80,80 160,${sparkMidY} T300,${sparkMidY - 8} T400,${sparkEndY}`}
                            fill="none"
                            stroke="#8BA888"
                            strokeLinecap="round"
                            strokeWidth="4"
                          ></path>
                          <circle className="summary-sparkline-head" cx="400" cy={sparkEndY} fill="#8BA888" r="5"></circle>
                          <path
                            className="summary-sparkline-fill"
                            d={`M0,85 Q80,80 160,${sparkMidY} T300,${sparkMidY - 8} T400,${sparkEndY} L400,100 L0,100 Z`}
                            fill="#8BA888"
                            opacity="0.1"
                          ></path>
                        </svg>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-[#F0EBE8]">
                        <div>
                          <p className="text-[10px] font-bold text-[#7D8A96] uppercase tracking-widest">Preguntas Totales</p>
                          <p className="text-xl font-bold text-[#374151]">
                            {summaryLoading || summaryError || summary?.state === 'insufficient_data'
                              ? '--'
                              : summary?.totalQuestions ?? '--'}{' '}
                            <span className="text-xs font-medium text-[#7D8A96] ml-1">usadas</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-[#7D8A96] uppercase tracking-widest">Tendencia Semanal</p>
                          {summary?.trendType === 'insufficient' ? (
                            <p className="text-xl font-bold text-[#7D8A96]">Construyendo historial</p>
                          ) : summary?.state === 'insufficient_data' || summary?.trend == null ? (
                            <p className="text-xl font-bold text-[#7D8A96]">—</p>
                          ) : summary.trend >= 0 ? (
                            <p className="text-xl font-bold text-[#8BA888]">
                              +{summary.trend.toFixed(1)}%
                              <span className="material-symbols-outlined text-sm align-middle ml-1">trending_up</span>
                            </p>
                          ) : (
                            <p className="text-xl font-bold text-[#C4655A]">
                              {summary.trend.toFixed(1)}%
                              <span className="material-symbols-outlined text-sm align-middle ml-1">trending_down</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </LazyCard>

                    <LazyCard
                      className="bg-gradient-to-b from-white to-[#FCFAF9] rounded-3xl p-6 shadow-sm border border-[#F0EBE8] lg:col-span-3 lg:row-start-3"
                      onInViewChange={handleDistributionCardInViewChange}
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                        <div className="space-y-3 md:min-w-[130px]">
                          <div className="rounded-xl border border-[#EAE4DF] bg-white px-4 py-3 shadow-[0_4px_14px_rgba(55,65,81,0.04)]">
                            <p className="text-xs font-bold text-[#7D8A96] uppercase tracking-widest">Media</p>
                            <p className="text-4xl font-extrabold text-[#374151] leading-none mt-1">
                              {meanScore === null ? (
                                '--'
                              ) : (
                                <>
                                  {meanScore.toFixed(1)}
                                  <span className="text-xs font-semibold text-[#7D8A96] ml-1">pts</span>
                                </>
                              )}
                            </p>
                          </div>
                          <div className="rounded-xl border border-[#EAE4DF] bg-white px-4 py-3 shadow-[0_4px_14px_rgba(55,65,81,0.04)]">
                            <p className="text-xs font-bold text-[#7D8A96] uppercase tracking-widest">Mediana</p>
                            <p className="text-4xl font-extrabold text-[#374151] leading-none mt-1">
                              {medianScore === null ? (
                                '--'
                              ) : (
                                <>
                                  {medianScore.toFixed(1)}
                                  <span className="text-xs font-semibold text-[#7D8A96] ml-1">pts</span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="relative w-full md:flex-1">
                          <div className="text-[10px] font-bold text-[#7D8A96] uppercase tracking-[0.18em] mb-3">
                            Tu posición en la distribución
                          </div>
                          {scoreDistributionLoading ? (
                            <div className="h-40 w-full rounded-2xl bg-[#FAF7F4] border border-[#F0EBE8] flex items-center justify-center text-xs text-[#7D8A96]">
                              Cargando distribución...
                            </div>
                          ) : scoreDistributionError ? (
                            <div className="h-40 w-full rounded-2xl bg-[#FFF8F6] border border-[#F0EBE8] flex items-center justify-center text-xs text-[#C4655A] text-center px-4">
                              No se pudo cargar la distribución
                            </div>
                          ) : distributionScores.length < 2 ? (
                            <div className="h-40 w-full rounded-2xl bg-[#FAF7F4] border border-[#F0EBE8] flex items-center justify-center text-xs text-[#7D8A96] text-center px-4">
                              Sin datos suficientes para mostrar la distribución
                            </div>
                          ) : (
                            <div className="distribution-dot-bg rounded-2xl border border-[#ECE5E0] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                              <svg
                                key={`distribution-chart-${distributionChartCycle}`}
                                className="relative z-10 w-full h-auto aspect-[5/2]"
                                viewBox="0 0 400 160"
                                preserveAspectRatio="none"
                                onMouseLeave={() => setDistributionHover(null)}
                                onMouseMove={(e) => {
                                  if (domainMin === null || domainMax === null) return
                                  const rect = (
                                    e.currentTarget as SVGSVGElement
                                  ).getBoundingClientRect()
                                  const x = ((e.clientX - rect.left) / rect.width) * 400
                                  const y = ((e.clientY - rect.top) / rect.height) * 160
                                  const score = scoreForChartPosition(x)
                                  if (score === null) return
                                  const clampedX = Math.max(chartLeft, Math.min(chartRight, x))
                                  const clampedY = Math.max(chartTop, Math.min(chartBottom, y))
                                  setDistributionHover({ x: clampedX, y: clampedY, score })
                                }}
                              >
                                <defs>
                                  <linearGradient id="distributionAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#8BA888" stopOpacity="0.28" />
                                    <stop offset="100%" stopColor="#8BA888" stopOpacity="0.06" />
                                  </linearGradient>
                                  <filter id="distributionLineGlow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feDropShadow dx="0" dy="1" stdDeviation="1.6" floodColor="#8BA888" floodOpacity="0.22" />
                                  </filter>
                                </defs>
                                <path
                                  d={distributionPaths.area}
                                  fill="url(#distributionAreaGradient)"
                                  className="score-kde-area"
                                />
                                <path
                                  d={distributionPaths.line}
                                  fill="none"
                                  stroke="#7FA17D"
                                  strokeWidth="2.4"
                                  filter="url(#distributionLineGlow)"
                                  className="score-kde-line"
                                />
                                <line
                                  x1={meanX}
                                  y1="12"
                                  x2={meanX}
                                  y2="160"
                                  stroke="#4F7BC0"
                                  strokeWidth="1.75"
                                  className="score-marker score-marker-mean"
                                >
                                  <title>Media: Valor medio de la distribución</title>
                                </line>
                                <line
                                  x1={medianX}
                                  y1="12"
                                  x2={medianX}
                                  y2="160"
                                  stroke="#E08B3D"
                                  strokeWidth="1.75"
                                  className="score-marker score-marker-median"
                                >
                                  <title>Mediana: Valor mediano de la distribución</title>
                                </line>
                                {userScoreForChart !== null && (
                                  <>
                                    <circle cx={userScoreX} cy={userScoreY} r="5.5" fill="#C4655A" stroke="#FFF" strokeWidth="1.5">
                                      <title>Tu puntuación: {userScoreForChart} pts</title>
                                    </circle>
                                    <line
                                      x1={userScoreX}
                                      y1="12"
                                      x2={userScoreX}
                                      y2="160"
                                      stroke="#C4655A"
                                      strokeWidth="1.25"
                                      strokeDasharray="4 4"
                                      className="score-marker score-marker-user"
                                    >
                                      <title>Tu puntuación: {userScoreForChart} pts</title>
                                    </line>
                                  </>
                                )}
                                {distributionHover && (
                                  <line
                                    x1={distributionHover.x}
                                    y1="12"
                                    x2={distributionHover.x}
                                    y2="160"
                                    stroke="#64748B"
                                    strokeWidth="1"
                                    strokeDasharray="3 3"
                                    opacity="0.9"
                                  />
                                )}
                              </svg>
                            </div>
                          )}
                          {distributionHover && (
                            <div
                              className="absolute rounded-lg border border-[#E9E4E1] bg-white/95 px-3 py-2 text-xs text-[#4B5563] shadow-sm pointer-events-none"
                              style={{
                                left: `${distributionHover.x + 12}px`,
                                top: `${distributionHover.y}px`,
                                transform: 'translate(0, -50%)',
                              }}
                            >
                              <div>{`score: ${distributionHover.score.toFixed(1)} pts`}</div>
                            </div>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-[#7D8A96]">
                            <div className="flex items-center gap-2 text-[#4F7BC0] rounded-full border border-[#DDE5F3] bg-[#F7FAFF] px-2.5 py-1">
                              <span className="inline-block w-3 h-0.5 bg-[#4F7BC0]"></span>
                              <span>Media</span>
                            </div>
                            <div className="flex items-center gap-2 text-[#E08B3D] rounded-full border border-[#F4E6D8] bg-[#FFFAF4] px-2.5 py-1">
                              <span className="inline-block w-3 h-0.5 bg-[#E08B3D]"></span>
                              <span>Mediana</span>
                            </div>
                            <div className="flex items-center gap-2 text-[#C4655A] rounded-full border border-[#F2DAD5] bg-[#FFF7F5] px-2.5 py-1">
                              <span className="inline-block w-2 h-2 rounded-full bg-[#C4655A]"></span>
                              <span>Tu puntuación</span>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-[#7D8A96] flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#8BA888] text-base">group</span>
                            <span>
                              {sameScoreCount === null ? '—' : sameScoreCount}{' '}
                              persona(s) con tu mismo resultado
                            </span>
                          </div>
                          <div className="mt-2 text-xs text-[#7D8A96] flex flex-wrap gap-3">
                            <span>
                              Media:{' '}
                              <span className="font-semibold text-[#4F7BC0]">
                                {meanScore === null ? '--' : meanScore.toFixed(1)} pts
                              </span>
                            </span>
                            <span>
                              Mediana:{' '}
                              <span className="font-semibold text-[#E08B3D]">
                                {medianScore === null ? '--' : medianScore.toFixed(1)} pts
                              </span>
                            </span>
                            <span>
                              Tu puntuación:{' '}
                              <span className="font-semibold text-[#C4655A]">
                                {userScoreForChart === null ? '--' : userScoreForChart} pts
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </LazyCard>

                    <LazyCard className="relative isolate overflow-hidden bg-[#F3F0EE] rounded-3xl p-4 shadow-sm border border-[#E7DFDA] min-h-[320px] flex flex-col lg:col-start-3 lg:row-start-1 lg:row-span-2 lg:self-start lg:max-h-[47rem]">
                      <motion.div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-3xl opacity-60"
                        style={{
                          background:
                            'linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.35) 18%, transparent 34%)',
                        }}
                        animate={{ x: ['-140%', '260%'] }}
                        transition={{ duration: 1.35, repeat: Infinity, ease: 'linear', repeatDelay: 0.2 }}
                      />
                      <motion.div
                        aria-hidden="true"
                        className="pointer-events-none absolute -top-24 -left-20 h-56 w-56 bg-[#E11D48] opacity-30 blur-3xl shadow-[0_20px_48px_rgba(225,29,72,0.14)]"
                        style={{ borderRadius: '58% 42% 63% 37% / 45% 55% 45% 55%' }}
                        animate={{
                          x: [0, 18, -14, 0],
                          y: [0, -20, 12, 0],
                          rotate: [0, 14, -12, 0],
                          scale: [0.88, 1.14, 0.92, 1.08, 0.88],
                          opacity: [0.34, 0.76, 0.38, 0.7, 0.34],
                          borderRadius: [
                            '58% 42% 63% 37% / 45% 55% 45% 55%',
                            '44% 56% 48% 52% / 58% 42% 58% 42%',
                            '52% 48% 61% 39% / 43% 57% 43% 57%',
                            '58% 42% 63% 37% / 45% 55% 45% 55%',
                          ],
                        }}
                        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <motion.div
                        aria-hidden="true"
                        className="pointer-events-none absolute top-32 -right-24 h-64 w-64 bg-[#E11D48] opacity-26 blur-3xl shadow-[0_20px_48px_rgba(225,29,72,0.12)]"
                        style={{ borderRadius: '42% 58% 36% 64% / 58% 42% 58% 42%' }}
                        animate={{
                          x: [0, -18, 14, 0],
                          y: [0, 18, -14, 0],
                          rotate: [0, -16, 12, 0],
                          scale: [0.88, 1.12, 0.92, 1.08, 0.88],
                          opacity: [0.34, 0.74, 0.38, 0.68, 0.34],
                          borderRadius: [
                            '42% 58% 36% 64% / 58% 42% 58% 42%',
                            '56% 44% 62% 38% / 47% 53% 47% 53%',
                            '48% 52% 41% 59% / 61% 39% 61% 39%',
                            '42% 58% 36% 64% / 58% 42% 58% 42%',
                          ],
                        }}
                        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <motion.div
                        aria-hidden="true"
                        className="pointer-events-none absolute -bottom-24 -left-16 h-52 w-52 bg-[#E11D48] opacity-24 blur-3xl shadow-[0_20px_48px_rgba(225,29,72,0.12)]"
                        style={{ borderRadius: '63% 37% 54% 46% / 41% 59% 41% 59%' }}
                        animate={{
                          x: [0, 16, -14, 0],
                          y: [0, 16, -16, 0],
                          rotate: [0, 12, -12, 0],
                          scale: [0.88, 1.14, 0.92, 1.08, 0.88],
                          opacity: [0.32, 0.72, 0.36, 0.66, 0.32],
                          borderRadius: [
                            '63% 37% 54% 46% / 41% 59% 41% 59%',
                            '46% 54% 39% 61% / 55% 45% 55% 45%',
                            '58% 42% 47% 53% / 44% 56% 44% 56%',
                            '63% 37% 54% 46% / 41% 59% 41% 59%',
                          ],
                        }}
                        transition={{ duration: 2.55, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <div className="relative z-10 flex items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[#4B5563]">military_tech</span>
                          <div className="leading-tight">
                            <h3 className="font-bold text-lg text-[#374151]">Ranking Global</h3>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7D8A96]">
                              Top 25
                            </p>
                          </div>
                        </div>
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-[#E8A598]/30 bg-[#FFF4EF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#C4655A] shadow-sm"
                        >
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#C4655A] animate-pulse" />
                          Live
                        </span>
                      </div>
                      <div className="relative z-10 flex flex-1 min-h-0 flex-col">
                        <div
                          className="relative flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                        >
                          <table className="w-full border-collapse text-xs">
                            <thead className="text-[9px] text-[#4B5563] uppercase tracking-widest">
                              <tr className="border-b border-[#F0EBE8]">
                                <th className="text-left font-bold pb-2">Puesto</th>
                                <th className="text-center font-bold pb-2">Usuario</th>
                                <th className="text-right font-bold pb-2">Puntos</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F0EBE8]">
                              {topRanking.length ? (
                                topRanking.map((
                                  row: {
                                    position?: number
                                    rank?: number
                                    displayName?: string
                                    name?: string
                                    username?: string
                                    avatarId?: number
                                    avatar_id?: number
                                    score?: number
                                    points?: number
                                    isBot?: boolean
                                  },
                                  index: number,
                                ) => {
                                  const rankValue =
                                    row?.position ?? row?.rank ?? index + 1
                                  const name =
                                    row?.displayName ??
                                    row?.name ??
                                    row?.username ??
                                    'Usuario'
                                  const avatarId = Number(
                                    row?.avatarId ?? row?.avatar_id ?? 1,
                                  )
                                  const points = row?.score ?? row?.points ?? 0
                                  const isCurrentUserRow =
                                    userRank != null &&
                                    Number(rankValue) === Number(userRank)
                                  const rowOpacity =
                                    index < RANKING_VISIBLE_COUNT
                                      ? 1
                                      : Math.max(
                                          0.42,
                                          0.9 - (index - RANKING_VISIBLE_COUNT) * 0.12,
                                        )
                                  const rowAnimate = isCurrentUserRow
                                    ? {
                                        opacity: rowOpacity,
                                        y: 0,
                                        backgroundPosition: ['320% 0%', '-320% 0%'],
                                      }
                                    : { opacity: rowOpacity, y: 0 }
                                  const rowTransition: Transition = isCurrentUserRow
                                    ? {
                                        duration: 0.35,
                                        ease: 'easeOut' as const,
                                        delay:
                                          CONTENT_ANIMATION_DELAY_MS / 1000 +
                                          Math.min(index, 14) * 0.03,
                                        backgroundPosition: {
                                          duration: 1.1,
                                          repeat: Infinity,
                                          repeatDelay: 2.8,
                                          ease: 'linear' as const,
                                          repeatType: 'loop' as const,
                                        },
                                      }
                                    : {
                                        duration: 0.35,
                                        ease: 'easeOut' as const,
                                        delay:
                                          CONTENT_ANIMATION_DELAY_MS / 1000 +
                                          Math.min(index, 14) * 0.03,
                                      }
                                  return (
                                    <motion.tr
                                      key={`${name}-${rankValue}`}
                                      className={`group transition-transform duration-200 hover:translate-x-[1px] ${isCurrentUserRow ? 'bg-[#FFF3EF]' : ''}`}
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={rowAnimate}
                                      transition={rowTransition}
                                      style={
                                        isCurrentUserRow
                                          ? {
                                              backgroundImage:
                                                'linear-gradient(108deg, rgba(255,225,216,1) 0%, rgba(255,225,216,1) 40%, rgba(255,255,255,0.9) 46%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.9) 54%, rgba(255,225,216,1) 60%, rgba(255,225,216,1) 100%)',
                                              backgroundSize: '220% 100%',
                                              backgroundPosition: '320% 0%',
                                              backgroundRepeat: 'no-repeat',
                                            }
                                          : undefined
                                      }
                                    >
                                      <td className={`py-1.5 font-bold ${isCurrentUserRow ? 'text-[#C4655A] rounded-l-lg' : 'text-[#4B5563]'}`}>
                                        {rankValue}.
                                      </td>
                                      <td className="py-1.5 flex items-center gap-2.5 min-w-0">
                                        <div className="w-9 h-9 rounded-full overflow-hidden">
                                          <Image
                                            src={getAvatarUrl(avatarId)}
                                            alt={name}
                                            width={36}
                                            height={36}
                                            className="w-9 h-9 object-cover rounded-full ring-1 ring-white/30"
                                          />
                                        </div>
                                        <span className={`font-semibold truncate max-w-[150px] sm:max-w-[190px] ${isCurrentUserRow ? 'text-[#C4655A]' : 'text-[#374151]'}`}>
                                          {name}
                                        </span>
                                        {row?.isBot && (
                                          <span className="ml-1 rounded-full bg-[#FAF7F4] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#C4655A]">
                                            Bot
                                          </span>
                                        )}
                                      </td>
                                      <td className={`py-1.5 text-right font-bold ${isCurrentUserRow ? 'text-[#C4655A] rounded-r-lg' : 'text-[#4B5563]'}`}>
                                        {points}
                                      </td>
                                    </motion.tr>
                                  )
                                })
                              ) : (
                                <tr>
                                  <td colSpan={3} className="py-4 text-center text-xs text-[#7D8A96]">
                                    Sin datos de ranking
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className="pt-2">
                          {!isInTopTen && (
                            <div className="mb-2 text-center text-[11px] text-[#7D8A96]">
                              Tu puesto está fuera del top 20
                            </div>
                          )}
                          <motion.div
                            className="p-3 bg-[#FFF8F6] rounded-2xl border border-[#E8A598]/25 shadow-[0_10px_24px_-20px_rgba(232,165,152,0.9)]"
                            animate={{
                              backgroundPosition: ['320% 0%', '-320% 0%'],
                            }}
                            transition={{
                              backgroundPosition: {
                                duration: 1.1,
                                repeat: Infinity,
                                repeatDelay: 2.8,
                                ease: 'linear',
                                repeatType: 'loop',
                              },
                            }}
                            style={{
                              backgroundImage:
                                'linear-gradient(108deg, rgba(255,244,242,1) 0%, rgba(255,244,242,1) 40%, rgba(255,255,255,0.9) 46%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.9) 54%, rgba(255,244,242,1) 60%, rgba(255,244,242,1) 100%)',
                              backgroundSize: '220% 100%',
                              backgroundPosition: '320% 0%',
                              backgroundRepeat: 'no-repeat',
                            }}
                          >
                            <div className="text-center text-[10px] font-bold text-[#7D8A96] uppercase tracking-widest mb-2">Tu puesto actual</div>
                            <div className="flex items-center gap-3">
                              <span className="w-10 shrink-0 text-2xl font-extrabold text-[#374151]">
                                {userRank ?? '--'}.
                              </span>
                              <div className="min-w-0 flex-1 flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-[#E8A598]/20 border-2 border-[#E8A598] flex items-center justify-center text-[#E8A598]">
                                  <span className="material-symbols-outlined text-sm">person</span>
                                </div>
                                <span className="font-bold text-[#374151] truncate">{userDisplayName}</span>
                              </div>
                              <span className="shrink-0 text-lg font-extrabold text-[#E8A598]">
                                {userScore} pts
                              </span>
                            </div>
                          </motion.div>
                        </div>
                      </div>
                    </LazyCard>

                    <LazyCard className="bg-[#FFF8F6] border border-[#E8A598]/30 rounded-2xl p-6 shadow-sm flex flex-col gap-4 min-h-[260px] lg:col-start-3 lg:row-start-4 lg:h-full lg:self-stretch">
                      <div className="flex items-start gap-3">
                        <div className="bg-white p-2 rounded-full shadow-sm text-[#E8A598] mt-1 shrink-0">
                          <span className="material-symbols-outlined filled text-[20px]">psychology</span>
                        </div>
                        <div>
                          <h3 className="text-[#374151] text-sm font-bold mb-1">Sugerencias MIRDaily</h3>
                          <p className="text-[#7D8A96] text-xs leading-relaxed">Basado en tus fallos de este Daily, la IA te recomienda priorizar los siguientes repasos:</p>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col gap-4 justify-between">
                        {[
                          { tag: 'Neumología', title: 'Enfermedades Intersticiales', body: 'Repasa este tema para mejorar tu rendimiento en preguntas clínicas.' },
                          { tag: 'Cardiología', title: 'Insuficiencia Cardíaca', body: 'Errores detectados en tratamiento farmacológico.' },
                        ].map((item) => (
                          <div key={item.title} className="bg-white rounded-xl p-4 border border-[#E8A598]/20 shadow-[0_2px_8px_rgba(232,165,152,0.1)] hover:shadow-md transition-all flex flex-col">
                            <div className="flex flex-col gap-1 mb-3">
                              <span className="text-[10px] font-extrabold text-[#C4655A] uppercase tracking-wider bg-[#FFF8F6] px-2 py-0.5 rounded-full border border-[#C4655A]/10 w-fit">{item.tag}</span>
                              <h4 className="text-[#374151] font-bold text-sm mt-1">{item.title}</h4>
                              <p className="text-[#7D8A96] text-xs leading-snug">{item.body}</p>
                            </div>
                            <button className="mt-auto w-full py-2.5 px-3 rounded-lg bg-[#FAF7F4] text-[#7D8A96] hover:bg-[#E8A598] hover:text-white border border-[#7D8A96]/20 hover:border-[#E8A598] text-xs font-bold transition-all flex items-center justify-center gap-2 group">
                              <span>Ir a la Carpeta del Tema</span>
                              <span className="material-symbols-outlined text-[16px] group-hover:text-white transition-colors">folder_open</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </LazyCard>

                    <div className="flex flex-col gap-6 lg:col-span-2 lg:row-start-4 h-full">
                      <LazyCard
                        className="bg-white rounded-2xl shadow-sm border border-[#F0EBE8] p-6 md:p-8 h-full flex flex-col"
                        onInViewChange={handlePercentileCardInViewChange}
                      >
                        <div className="flex h-full flex-col justify-between gap-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="bg-[#FFF8F6] p-2.5 rounded-xl text-[#E8A598] shadow-sm border border-[#E8A598]/20">
                                <span className="material-symbols-outlined filled">
                                  compare_arrows
                                </span>
                              </div>
                              <div>
                                <h3 className="text-[#374151] font-bold text-lg leading-tight">
                                  Rendimiento Comparativo
                                </h3>
                                <p className="text-[#7D8A96] text-xs font-medium">
                                  vs. Resto de opositores
                                </p>
                              </div>
                            </div>
                          </div>

                          <div
                            className="flex-1 flex items-end pt-6"
                            key={`percentile-${percentileOpenKey}-${percentileChartCycle}`}
                          >
                            <div className="w-full">
                              <div className="text-[#374151] font-bold text-sm uppercase tracking-widest mb-4">
                                Percentil del usuario
                              </div>
                              <div className="w-full h-4 bg-[#EAEFF3] rounded-full relative overflow-visible">
                                <motion.div
                                  key={`percentile-bar-${percentileChartCycle}`}
                                  className="h-full rounded-full"
                                  initial={false}
                                  animate={{ width: ['0%', `${animatedPercentile}%`] }}
                                  transition={{
                                    duration: 1,
                                    ease: [0.22, 1, 0.36, 1],
                                    delay: CONTENT_ANIMATION_DELAY_MS / 1000,
                                  }}
                                  style={{
                                    backgroundColor: style.color,
                                    boxShadow: style.glow,
                                  }}
                                />
                                <motion.div
                                  key={`percentile-dot-${percentileChartCycle}`}
                                  className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white"
                                  initial={false}
                                  animate={{ left: ['0%', `${animatedPercentile}%`] }}
                                  transition={{
                                    duration: 1,
                                    ease: [0.22, 1, 0.36, 1],
                                    delay: CONTENT_ANIMATION_DELAY_MS / 1000,
                                  }}
                                  style={{
                                    transform: 'translate(-50%, -50%)',
                                    backgroundColor: style.color,
                                    boxShadow: style.glow,
                                  }}
                                />
                              </div>
                            <div
                              className="mt-2 text-sm font-bold relative"
                            style={{
                              color: style.color,
                              paddingLeft: `calc(${animatedPercentile}% - 12px)`,
                              transition:
                                'padding-left 1s cubic-bezier(0.22, 1, 0.36, 1)',
                              transitionDelay: `${CONTENT_ANIMATION_DELAY_MS}ms`,
                            }}
                          >
                              {typeof safePercentile === 'number'
                                ? `P${Math.round(safePercentile)}`
                                : '--'}
                            </div>
                          </div>
                          </div>
                          <ZScoreComparisonCard
                            embedded
                            mean={zScoreMean}
                            stdDev={zScoreStdDev}
                            zScore={userZScore}
                            score={userScore}
                          />
                        </div>
                      </LazyCard>
                    </div>
                    <LazyCard className="bg-[#FFF8F6] border border-[#E8A598]/30 rounded-2xl p-6 shadow-sm lg:col-span-3">
                      <div className="flex min-h-[140px] flex-col items-center justify-center text-center">
                        {typeof safePercentile === 'number' ? (() => {
                          const { lead, closing } = getPremiumParts(
                            safePercentile,
                            summary?.trend ?? null,
                            summary?.avgPercentage ?? null,
                            userId ?? 'anon',
                            userZScore,
                          )
                          const quote = getQuoteForToday(percentile)
                          return (
                            <>
                              <p className="text-[#7D8A96] text-sm leading-relaxed">
                                {lead}
                              </p>
                              <p className="text-[#7D8A96] text-sm leading-relaxed mt-2">
                                {closing}
                              </p>
                            {quote && quote.text && quote.author && (
                              <p
                                className="quote animate-quote text-[#7D8A96] text-sm leading-relaxed mt-3 italic"
                                style={{ animationDelay: `${CONTENT_ANIMATION_DELAY_MS}ms` }}
                              >
                                “{quote.text}”
                                <br />
                                <span className="author block text-sm mt-1 opacity-70">
                                  — {quote.author}
                                </span>
                              </p>
                              )}
                            </>
                          )
                        })() : (
                          <p className="text-[#7D8A96] text-sm leading-relaxed">
                            Cargando rendimiento...
                          </p>
                        )}
                      </div>
                    </LazyCard>
                  </div>
                  <div ref={reviewSectionRef} className="w-full">
                    <LazyCard className="w-full">
                      <DailyReviewCarousel questions={reviewQuestions} />
                    </LazyCard>
                  </div>
                  <LazyCard className="w-full flex justify-center pt-1 pb-2">
                    <button
                      onClick={handleCloseQuiz}
                      className="w-full sm:w-auto min-w-[260px] bg-[#E8A598] text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-[#E8A598]/30 hover:opacity-90 transition-all flex items-center justify-center gap-2"
                    >
                      Volver al Hub
                      <span className="material-symbols-outlined text-xl">arrow_forward</span>
                    </button>
                  </LazyCard>
                  <div className="text-center pt-4 pb-8">
                    <p className="text-[#7D8A96]/60 text-xs">
                      MIRDaily © 2023. Preparación inteligente para médicos.
                    </p>
                  </div>
                </div>
              )
              ) : isLoadingQuestions ? (
                <div className="w-full mt-20 text-center text-[#7D8A96] relative z-10 animate-fade-in-up">
                  Cargando preguntas del día...
                </div>
              ) : loadError ? (
                <div className="w-full mt-20 text-center text-[#C4655A] relative z-10 animate-fade-in-up">
                  {loadError}
                </div>
              ) : (
                <>
              <div className="w-full max-w-4xl mx-auto relative z-10 animate-fade-in-up">
                <div className="w-full mb-10">
                <div className="flex justify-between items-end mb-3">
                  <span className="text-[11px] font-bold tracking-[0.15em] text-[#7D8A96] uppercase">
                    Progreso Diario
                  </span>
                  <span className="text-sm font-bold text-[#7D8A96]">
                    Pregunta{' '}
                    <span className="text-[#C45B4B]">
                      {currentQuestionIndex + 1}
                    </span>{' '}
                    de {questions.length}
                  </span>
                </div>
                <div className="h-2 w-full bg-[#E9E4E1] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#E8A598] rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.round(
                        ((currentQuestionIndex + 1) / questions.length) *
                          100,
                      )}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div className="space-y-8 w-full">
                <div>
                  {showSubjects && (
                    <span className="inline-block px-4 py-1.5 rounded-full bg-white border border-[#E9E4E1] text-[11px] font-bold tracking-[0.1em] text-[#7D8A96] uppercase mb-6">
                      {currentQuestion?.subject}
                    </span>
                  )}
                  <h1 className="text-[28px] sm:text-[32px] font-bold leading-tight text-[#2D3748] tracking-tight">
                    {currentQuestion?.statement}
                  </h1>
                </div>

                <div className="grid gap-4">
                  {currentQuestion?.options.map((option, optionIndex) => {
                    const isSelected = currentSelection === optionIndex
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setSelectedAnswers((prev) => {
                            const next = [...prev]
                            next[currentQuestionIndex] = optionIndex
                            return next
                          })
                        }}
                        className={`group flex items-center p-5 rounded-2xl border-2 transition-all duration-200 text-left shadow-sm hover:shadow-md ${
                          isSelected
                            ? 'bg-white border-[#E8A598]/60'
                            : 'bg-white border-transparent hover:border-[#E8A598]/30'
                        }`}
                      >
                        <div
                          className={`size-6 rounded-full border-2 mr-4 shrink-0 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'border-[#E8A598]'
                              : 'border-[#D8D2CE] group-hover:border-[#E8A598]'
                          }`}
                        >
                          <div
                            className={`size-2.5 rounded-full bg-[#E8A598] transition-opacity ${
                              isSelected ? 'opacity-100' : 'opacity-0'
                            }`}
                          ></div>
                        </div>
                        <span className="text-lg font-medium text-[#4B5563]">
                          <span className="font-bold mr-2">
                            {String.fromCharCode(65 + optionIndex)})
                          </span>
                          {option}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="pt-8 flex flex-wrap justify-between items-center gap-4">
                  <button className="flex items-center gap-2 text-[#9CA3AF] hover:text-[#7D8A96] text-sm font-semibold transition-colors">
                    <span className="material-symbols-outlined text-lg">
                      flag
                    </span>
                    Reportar pregunta
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handlePrevious}
                      disabled={currentQuestionIndex === 0}
                      className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-[#E9E4E1] text-sm font-semibold text-[#7D8A96] hover:border-[#E8A598]/40 hover:text-[#2D3748] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-lg">
                        arrow_back
                      </span>
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={
                        currentSelection == null ||
                        isSubmitting ||
                        (!userId && currentQuestionIndex === questions.length - 1)
                      }
                      className={`flex items-center gap-3 px-8 py-4 bg-[#E8A598] text-white font-bold rounded-2xl transition-all shadow-lg shadow-[#E8A598]/20 disabled:opacity-40 disabled:cursor-not-allowed ${
                        isSubmitting && currentQuestionIndex === questions.length - 1
                          ? 'animate-pulse'
                          : ''
                      }`}
                    >
                      {isSubmitting && currentQuestionIndex === questions.length - 1 ? (
                        <>
                          Calculando resultados
                          <span className="material-symbols-outlined animate-spin text-xl">
                            progress_activity
                          </span>
                        </>
                      ) : (
                        <>
                          {currentQuestionIndex === questions.length - 1
                            ? 'Finalizar'
                            : 'Siguiente Pregunta'}
                          <span className="material-symbols-outlined">
                            arrow_forward
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {!userId && (
                  <p className="text-xs text-[#C4655A]">
                    Inicia sesión para guardar tus respuestas.
                  </p>
                )}

                <div className="mt-12 opacity-0 select-none pointer-events-none">
                  <div className="bg-white p-8 rounded-[32px] border border-[#F1EDEB]">
                    <div className="flex items-start gap-4">
                      <div className="bg-[#E8A598]/10 p-3 rounded-2xl">
                        <span className="material-symbols-outlined text-[#E8A598]">
                          lightbulb
                        </span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-2">
                          Explicacion detallada
                        </h3>
                        <p className="text-[#7D8A96]">
                          Selecciona una opcion para ver la respuesta correcta y
                          su explicación clínica.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
            </main>

          </div>
        </div>
      )}
      {showReviewFloatingButton && (
        <div
          className={`fixed left-1/2 bottom-5 sm:bottom-6 z-[120] -translate-x-1/2 transition-all duration-300 ${
            isReviewFloatingButtonVisible
              ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
              : 'opacity-0 translate-y-3 scale-95 pointer-events-none'
          }`}
        >
          <div
            className={`pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 transition-all duration-300 ${
              isReviewFloatingButtonVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 -translate-y-1'
            }`}
          >
            <span className="review-scroll-cue review-scroll-cue-1" />
            <span className="review-scroll-cue review-scroll-cue-2" />
          </div>
          <button
            type="button"
            onClick={scrollToReview}
            className="inline-flex items-center gap-2 rounded-full bg-[#E8A598] text-white px-5 py-3 text-sm font-bold shadow-xl shadow-[#E8A598]/35 hover:bg-[#d68c7f] transition-all duration-300"
          >
            <span className="material-symbols-outlined text-[18px]">
              keyboard_double_arrow_down
            </span>
            Ir a revisión
          </button>
        </div>
      )}
    </div>
  )
}


















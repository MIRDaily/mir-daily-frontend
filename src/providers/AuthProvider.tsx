'use client'

import {
  createContext,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseBrowser'
import { parseApiError } from '@/lib/profile'

export type AuthUser = {
  id: string
  email: string
  display_name: string
  username: string
  avatar_id: number
  medical_year: number | null
  mir_specialty: {
    id: number
    name: string
  } | null
  main_goal: 'prepare_mir' | 'reinforce_degree' | 'explore' | null
  university: {
    id: number
    name: string
    country: string
  } | null
  profile_public: boolean
  onboarding_completed: boolean
  mustUpdateDisplayName: boolean
  created_at: string
}

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  setUser: Dispatch<SetStateAction<AuthUser | null>>
  refreshUser: () => Promise<AuthUser | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function coerceAuthUser(payload: unknown, fallbackSession: Session): AuthUser | null {
  if (!payload || typeof payload !== 'object') return null

  const source =
    'profile' in payload &&
    payload.profile &&
    typeof payload.profile === 'object'
      ? (payload.profile as Record<string, unknown>)
      : (payload as Record<string, unknown>)

  const id =
    typeof source.id === 'string' ? source.id : fallbackSession.user.id
  const email =
    typeof source.email === 'string' ? source.email : fallbackSession.user.email ?? ''
  const displayName =
    typeof source.display_name === 'string'
      ? source.display_name
      : typeof source.displayName === 'string'
        ? source.displayName
        : ''
  const username =
    typeof source.username === 'string' ? source.username : ''
  const avatarId =
    typeof source.avatar_id === 'number'
      ? source.avatar_id
      : typeof source.avatarId === 'number'
        ? source.avatarId
        : 1
  const medicalYear =
    typeof source.medical_year === 'number'
      ? source.medical_year
      : typeof source.medicalYear === 'number'
        ? source.medicalYear
        : null
  const mirSpecialty =
    source.mir_specialty &&
    typeof source.mir_specialty === 'object' &&
    typeof (source.mir_specialty as Record<string, unknown>).id === 'number' &&
    typeof (source.mir_specialty as Record<string, unknown>).name === 'string'
      ? {
          id: (source.mir_specialty as Record<string, unknown>).id as number,
          name: (source.mir_specialty as Record<string, unknown>).name as string,
        }
      : null
  const mainGoal =
    source.main_goal === 'prepare_mir' ||
    source.main_goal === 'reinforce_degree' ||
    source.main_goal === 'explore'
      ? source.main_goal
      : source.mainGoal === 'prepare_mir' ||
          source.mainGoal === 'reinforce_degree' ||
          source.mainGoal === 'explore'
        ? source.mainGoal
        : null
  const university =
    source.university &&
    typeof source.university === 'object' &&
    typeof (source.university as Record<string, unknown>).id === 'number' &&
    typeof (source.university as Record<string, unknown>).name === 'string' &&
    typeof (source.university as Record<string, unknown>).country === 'string'
      ? {
          id: (source.university as Record<string, unknown>).id as number,
          name: (source.university as Record<string, unknown>).name as string,
          country: (source.university as Record<string, unknown>).country as string,
        }
      : null
  const profilePublic =
    typeof source.profile_public === 'boolean'
      ? source.profile_public
      : typeof source.profilePublic === 'boolean'
        ? source.profilePublic
        : false
  const onboardingCompleted =
    typeof source.onboarding_completed === 'boolean'
      ? source.onboarding_completed
      : typeof source.onboardingCompleted === 'boolean'
        ? source.onboardingCompleted
        : false
  const mustUpdateDisplayName =
    typeof source.mustUpdateDisplayName === 'boolean'
      ? source.mustUpdateDisplayName
      : typeof source.must_update_display_name === 'boolean'
        ? source.must_update_display_name
        : false
  const createdAt =
    typeof source.created_at === 'string'
      ? source.created_at
      : new Date().toISOString()

  return {
    id,
    email,
    display_name: displayName,
    username,
    avatar_id: avatarId,
    medical_year: medicalYear,
    mir_specialty: mirSpecialty,
    main_goal: mainGoal,
    university,
    profile_public: profilePublic,
    onboarding_completed: onboardingCompleted,
    mustUpdateDisplayName,
    created_at: createdAt,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''

  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const sessionRef = useRef<Session | null>(null)
  const userRef = useRef<AuthUser | null>(null)
  const inFlightRef = useRef<Promise<AuthUser | null> | null>(null)

  useEffect(() => {
    userRef.current = user
  }, [user])

  const fetchProfile = useCallback(
    async (session: Session, force = false) => {
      if (!apiUrl) {
        throw new Error('NEXT_PUBLIC_API_URL no definida.')
      }

      if (!force && userRef.current?.id === session.user.id) {
        return userRef.current
      }

      if (inFlightRef.current) {
        return inFlightRef.current
      }

      const run = (async () => {
        const response = await fetch(`${apiUrl}/api/profile`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        if (response.status === 401) {
          setUser(null)
          return null
        }

        if (!response.ok) {
          throw new Error(await parseApiError(response))
        }

        const payload = await response.json().catch(() => null)
        const nextUser = coerceAuthUser(payload, session)
        if (!nextUser) {
          throw new Error('Perfil invalido.')
        }

        setUser(nextUser)
        return nextUser
      })()

      inFlightRef.current = run
      try {
        return await run
      } finally {
        inFlightRef.current = null
      }
    },
    [apiUrl],
  )

  const refreshUser = useCallback(async () => {
    const session = sessionRef.current
    if (!session) {
      setUser(null)
      return null
    }

    setLoading(true)
    try {
      return await fetchProfile(session, true)
    } finally {
      setLoading(false)
    }
  }, [fetchProfile])

  useEffect(() => {
    let mounted = true

    const loadSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (!mounted) return
        if (error || !data.session) {
          sessionRef.current = null
          setUser(null)
          return
        }

        sessionRef.current = data.session
        try {
          await fetchProfile(data.session)
        } catch (err) {
          console.error('[AuthProvider] Error cargando perfil inicial:', err)
          setUser(null)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      sessionRef.current = session

      if (!session) {
        setUser(null)
        setLoading(false)
        return
      }

      const shouldFetch = !userRef.current || userRef.current.id !== session.user.id
      if (shouldFetch) {
        setLoading(true)
      }

      void fetchProfile(session)
        .catch((err) => {
          console.error('[AuthProvider] Error actualizando perfil:', err)
          setUser(null)
        })
        .finally(() => {
          if (shouldFetch) {
            setLoading(false)
          }
        })
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const value = useMemo(
    () => ({
      user,
      loading,
      setUser,
      refreshUser,
    }),
    [loading, refreshUser, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext debe usarse dentro de AuthProvider')
  }
  return context
}

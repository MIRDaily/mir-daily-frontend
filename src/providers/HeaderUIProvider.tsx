'use client'

import { createContext, useContext, useMemo, useState } from 'react'

export type HeaderBackAction = {
  /** Texto junto a la flecha, ej. "Minijuegos" */
  label: string
  href: string
}

type HeaderUIContextValue = {
  blurred: boolean
  setBlurred: (value: boolean) => void
  backAction: HeaderBackAction | null
  setBackAction: (value: HeaderBackAction | null) => void
}

const HeaderUIContext = createContext<HeaderUIContextValue | null>(null)

export function HeaderUIProvider({ children }: { children: React.ReactNode }) {
  const [blurred, setBlurred] = useState(false)
  const [backAction, setBackAction] = useState<HeaderBackAction | null>(null)

  const value = useMemo(
    () => ({
      blurred,
      setBlurred,
      backAction,
      setBackAction,
    }),
    [blurred, backAction],
  )

  return <HeaderUIContext.Provider value={value}>{children}</HeaderUIContext.Provider>
}

export function useHeaderUI() {
  const context = useContext(HeaderUIContext)
  if (!context) {
    throw new Error('useHeaderUI debe usarse dentro de HeaderUIProvider')
  }
  return context
}


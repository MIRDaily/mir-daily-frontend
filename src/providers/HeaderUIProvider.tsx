'use client'

import { createContext, useContext, useMemo, useState } from 'react'

type HeaderUIContextValue = {
  blurred: boolean
  setBlurred: (value: boolean) => void
}

const HeaderUIContext = createContext<HeaderUIContextValue | null>(null)

export function HeaderUIProvider({ children }: { children: React.ReactNode }) {
  const [blurred, setBlurred] = useState(false)

  const value = useMemo(
    () => ({
      blurred,
      setBlurred,
    }),
    [blurred],
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


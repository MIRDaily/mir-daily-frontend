import type { ReactNode } from 'react'
import RefrescaSelectorDeMazos from '@/components/studio/RefrescaSelectorDeMazos'

// Solo para que los selectores de «guardar en un mazo» se enteren de lo que se
// cambia aquí (ver RefrescaSelectorDeMazos). No añade nada al DOM.
export default function DecksLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <RefrescaSelectorDeMazos />
      {children}
    </>
  )
}

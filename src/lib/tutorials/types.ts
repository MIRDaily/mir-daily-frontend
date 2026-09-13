/* ════════════════════════════════════════════════════════════════════════
   Los tutoriales de la mascota, como datos.

   El guion NO es JSX a propósito: cambiar lo que dice la mascota tiene que
   poder hacerse sin tocar React, y la app de Flutter consume este mismo
   formato aunque su contenido sea otro (sus pestañas no coinciden con las de
   la web).
═══════════════════════════════════════════════════════════════════════════ */

/** Poses de la mascota. Cada una es un fichero en /img/mascota. */
export type MascotPose = 'saludo' | 'senalando' | 'hablando' | 'despedida'

export type StepPlacement = 'auto' | 'centro'

export type TutorialStep = {
  /**
   * Valor del `data-tutorial` del elemento a iluminar. Si no se indica —o si
   * el elemento no está en la página— el paso sale centrado en vez de romper.
   * Esto no es un apaño: las páginas grandes se refactorizan, y un tutorial
   * no puede ser la razón por la que nadie se atreve a mover un div.
   */
  anchor?: string
  pose: MascotPose
  text: string
  placement?: StepPlacement
}

/**
 * Clave versionada: "pantalla.vN". Subir la versión vuelve a enseñar ese
 * tutorial —y solo ese— a quien ya lo había visto. El backend valida el
 * formato, así que inventarse otro no se guarda.
 */
export type TutorialId = `${string}.v${number}`

export type Tutorial = {
  id: TutorialId
  steps: TutorialStep[]
}

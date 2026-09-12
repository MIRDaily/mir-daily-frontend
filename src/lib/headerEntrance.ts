// Entrada compartida de los controles de la cabecera fija (desafíos,
// notificaciones, perfil): antes cada uno aparecía a su manera —el avatar
// saltaba del esqueleto al real sin transición, las notificaciones estaban
// ya ahí desde el primer pintado, y el botón de racha se materializaba de
// golpe en cuanto llegaba el dato—. Los tres usan ahora el mismo lenguaje
// (desvanecido + rebote, desde abajo) para que la cabecera se sienta como un
// solo sistema en vez de tres.
export function headerPopIn(reduceMotion: boolean | null, delay = 0) {
  if (reduceMotion) {
    return { initial: false as const }
  }

  return {
    initial: { opacity: 0, y: 14, scale: 0.94 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { type: 'spring', stiffness: 320, damping: 22, mass: 0.8, delay } as const,
  }
}

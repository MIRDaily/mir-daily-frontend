import type { MascotPose } from '@/lib/tutorials/types'

/* Los ficheros de cada pose, y su precarga.

   Se sirven en WebP a 320 px —el doble de los 160 a los que se pintan, para
   pantallas retina— y no en los PNG de 512 que salen de la normalización:
   pesan seis veces menos (unos 19 KB frente a 117). Los PNG se quedan en la
   carpeta porque son el original y los usa /mockup-mascota.

   Pasar a SVG no era la solución: los dibujos son raster con degradados, y
   vectorizarlos da ficheros más pesados y peor dibujados. El bocadillo se
   adelantaba porque cada pose se pedía al montar su paso; lo que lo arregla es
   pedirlas todas al arrancar el tutorial. */
export const POSE_SRC: Record<MascotPose, string> = {
  saludo: '/img/mascota/saludo.webp',
  senalando: '/img/mascota/senalando.webp',
  hablando: '/img/mascota/hablando.webp',
  despedida: '/img/mascota/despedida.webp',
  'senalando-abajo': '/img/mascota/senalando-abajo.webp',
  celebracion: '/img/mascota/celebracion.webp',
  'hablando-variante2': '/img/mascota/hablando-variante2.webp',
  confiado: '/img/mascota/confiado.webp',
  dudando: '/img/mascota/dudando.webp',
  'haciendo-examen': '/img/mascota/haciendo-examen.webp',
  'con-mazo': '/img/mascota/con-mazo.webp',
}

/** Las que ya están descargadas: pintarlas es instantáneo. */
const cargadas = new Set<MascotPose>()
const pendientes = new Map<MascotPose, Promise<void>>()

export function poseCargada(pose: MascotPose): boolean {
  return cargadas.has(pose)
}

/** Descarga una pose. Nunca rechaza: si falla, el bocadillo sale solo, que se
    lee perfectamente.

    Va por el evento `load` y no por `img.decode()`: decode puede quedarse
    esperando mientras la pestaña no se pinta, y el bocadillo acababa saliendo
    por el tope de espera aunque la imagen hubiera llegado hacía rato. */
export function precargarPose(pose: MascotPose): Promise<void> {
  if (cargadas.has(pose)) return Promise.resolve()
  const enCurso = pendientes.get(pose)
  if (enCurso) return enCurso

  const promesa = new Promise<void>((resolver) => {
    const img = new window.Image()
    img.onload = () => {
      cargadas.add(pose)
      resolver()
    }
    img.onerror = () => resolver()
    img.src = POSE_SRC[pose]
  }).finally(() => {
    pendientes.delete(pose)
  })
  pendientes.set(pose, promesa)
  return promesa
}

export function precargarPoses(poses: Iterable<MascotPose>): void {
  for (const pose of new Set(poses)) void precargarPose(pose)
}

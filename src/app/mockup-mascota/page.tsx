import { notFound } from 'next/navigation'

import BancoDePruebas from './BancoDePruebas'

/* El banco de pruebas de la mascota, SOLO en desarrollo.

   Es una herramienta interna —sirve para mirar los PNG dentro del tutorial de
   verdad sin loguearse ni levantar el backend—, pero vive en `app/`, así que
   sin esta guarda sería una ruta pública más el día que se despliegue.

   La comprobación va aquí, en un componente de servidor, y no dentro del
   propio banco: `notFound()` lanza, y lanzarlo desde un componente de cliente
   obligaría a ponerlo antes de sus hooks. Separándolo, el banco se queda tal
   cual y esta guarda no tiene que saber nada de él. */
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <BancoDePruebas />
}

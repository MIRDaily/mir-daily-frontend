import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPage, { Hueco, Seccion } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Aviso legal · MIRDaily',
}

export default function AvisoLegalPage() {
  return (
    <LegalPage titulo="Aviso legal">
      <Seccion titulo="1. Datos del titular">
        <p>
          En cumplimiento del artículo 10 de la Ley 34/2002 de Servicios de la Sociedad de la Información
          (LSSI), te informamos de que este sitio web pertenece a:
        </p>
        <ul>
          <li>Titular: <Hueco>NOMBRE O RAZÓN SOCIAL</Hueco></li>
          <li>NIF/CIF: <Hueco>NIF</Hueco></li>
          <li>Domicilio: <Hueco>DOMICILIO</Hueco></li>
          <li>Email: <Hueco>EMAIL</Hueco></li>
          <li>Datos registrales: <Hueco>REGISTRO MERCANTIL, si es sociedad</Hueco></li>
        </ul>
      </Seccion>

      <Seccion titulo="2. Objeto">
        <p>
          MIRDaily es una plataforma de estudio para la preparación del examen MIR: preguntas diarias,
          simulacros, repasos, flashcards, mapas mentales y estadísticas de progreso. El uso de la web implica la
          aceptación de este aviso legal.
        </p>
        <p>
          Las condiciones de contratación de los planes de pago se publicarán en un documento aparte
          (<Hueco>CONDICIONES DE CONTRATACIÓN</Hueco>).
        </p>
      </Seccion>

      <Seccion titulo="3. Uso de la plataforma">
        <p>Al usar MIRDaily te comprometes a:</p>
        <ul>
          <li>Facilitar datos veraces y custodiar tus credenciales de acceso.</li>
          <li>No copiar, extraer de forma masiva ni redistribuir los contenidos de la plataforma.</li>
          <li>No usar MIRDaily para fines ilícitos ni para perjudicar a otros usuarios o al servicio.</li>
        </ul>
        <p>Podemos suspender las cuentas que incumplan estas normas.</p>
      </Seccion>

      <Seccion titulo="4. Propiedad intelectual">
        <p>
          El diseño, el código, las marcas y los contenidos propios de MIRDaily (explicaciones, guías, mapas,
          ilustraciones) son de <Hueco>TITULAR</Hueco> o de sus licenciantes. Las preguntas de convocatorias
          oficiales del examen MIR proceden de los cuadernos publicados por el Ministerio de Sanidad.
        </p>
      </Seccion>

      <Seccion titulo="5. Responsabilidad">
        <p>
          MIRDaily es una herramienta educativa. Cuidamos la calidad del contenido y corregimos los errores que
          se nos reportan, pero no garantizamos que esté libre de ellos y no sustituye a la formación oficial ni
          al criterio clínico. No respondemos de interrupciones del servicio por causas ajenas a nosotros ni del
          contenido de los sitios web externos que se enlacen.
        </p>
      </Seccion>

      <Seccion titulo="6. Protección de datos">
        <p>
          El tratamiento de tus datos se explica en la <Link href="/privacidad">política de privacidad</Link>.
        </p>
      </Seccion>

      <Seccion titulo="7. Ley aplicable">
        <p>
          Este aviso legal se rige por la legislación española. Si eres consumidor, serán competentes los
          juzgados de tu domicilio.
        </p>
      </Seccion>
    </LegalPage>
  )
}

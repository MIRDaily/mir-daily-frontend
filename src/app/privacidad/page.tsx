import type { Metadata } from 'next'
import LegalPage, { Hueco, Seccion } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Política de privacidad · MIRDaily',
}

export default function PrivacidadPage() {
  return (
    <LegalPage titulo="Política de privacidad">
      <p className="mt-8">
        En MIRDaily nos tomamos en serio tus datos. Aquí te explicamos qué recogemos, para qué, durante
        cuánto tiempo y qué derechos tienes, conforme al Reglamento (UE) 2016/679 (RGPD) y a la Ley Orgánica
        3/2018 (LOPDGDD).
      </p>

      <Seccion titulo="1. Responsable del tratamiento">
        <ul>
          <li>Titular: <Hueco>NOMBRE O RAZÓN SOCIAL</Hueco></li>
          <li>NIF/CIF: <Hueco>NIF</Hueco></li>
          <li>Domicilio: <Hueco>DOMICILIO</Hueco></li>
          <li>Contacto para privacidad: <Hueco>EMAIL</Hueco></li>
        </ul>
      </Seccion>

      <Seccion titulo="2. Qué datos tratamos">
        <ul>
          <li>
            <strong>Datos de cuenta:</strong> email, nombre público, nombre de usuario y, si entras con Google o
            Apple, los datos básicos que esos servicios nos facilitan (nombre, email y foto de perfil).
          </li>
          <li>
            <strong>Datos de perfil:</strong> universidad, especialidad objetivo y preferencias que configures.
          </li>
          <li>
            <strong>Datos de estudio:</strong> respuestas, aciertos y fallos, tiempo por pregunta, simulacros,
            preguntas marcadas o subrayadas, mazos, flashcards, mapas mentales, partidas de Versus, progreso,
            rachas y nivel, y los reportes de contenido que nos envíes.
          </li>
          <li>
            <strong>Datos técnicos:</strong> registros de acceso, dirección IP, tipo de navegador y dispositivo,
            necesarios para que el servicio funcione y sea seguro.
          </li>
          <li>
            <strong>Estadísticas de uso:</strong> páginas visitadas, procedencia de la visita y rendimiento de
            la web, medidos sin cookies y de forma agregada (ver apartado 7), y eventos de uso de las funciones
            de MIRDaily asociados a tu cuenta.
          </li>
          <li>
            <strong>Datos de pago</strong> (cuando haya planes de pago): los gestiona <Hueco>PASARELA DE PAGO</Hueco>.
            MIRDaily no almacena los datos completos de tu tarjeta.
          </li>
        </ul>
        <p>No tratamos datos de salud ni otras categorías especiales de datos.</p>
      </Seccion>

      <Seccion titulo="3. Para qué los usamos y con qué base legal">
        <ul>
          <li>
            <strong>Prestarte el servicio</strong> (cuenta, daily, simulacros, repasos, estadísticas personales,
            Versus): ejecución del contrato que aceptas al registrarte (art. 6.1.b RGPD).
          </li>
          <li>
            <strong>Personalizar tu estudio</strong> (repasos espaciados, simulacros adaptados a tus puntos
            débiles): ejecución del contrato. Esta personalización no produce efectos jurídicos ni te afecta de
            forma significativa.
          </li>
          <li>
            <strong>Mejorar MIRDaily</strong> (saber qué funciones se usan, detectar errores y preguntas mal
            planteadas, elaborar estadísticas agregadas y anónimas): interés legítimo (art. 6.1.f RGPD). Puedes
            oponerte escribiéndonos.
          </li>
          <li>
            <strong>Seguridad y prevención de abusos:</strong> interés legítimo.
          </li>
          <li>
            <strong>Comunicaciones del servicio</strong> (avisos de cuenta y cambios importantes): ejecución del
            contrato.
          </li>
          <li>
            <strong>Comunicaciones comerciales:</strong> solo con tu consentimiento o, si ya eres usuario, sobre
            productos de MIRDaily similares a los que usas (art. 21.2 LSSI). Puedes darte de baja en cada envío.
          </li>
          <li>
            <strong>Facturación y obligaciones legales</strong> (cuando haya pagos): obligación legal
            (art. 6.1.c RGPD).
          </li>
        </ul>
        <p>No vendemos tus datos ni los cedemos a terceros con fines publicitarios.</p>
      </Seccion>

      <Seccion titulo="4. Cuánto tiempo los conservamos">
        <p>
          Mientras tengas la cuenta activa. Si la eliminas, borraremos tus datos personales en un plazo máximo
          de <Hueco>PLAZO, p. ej. 30 días</Hueco>, salvo los que debamos conservar por obligación legal (por
          ejemplo, facturas) durante los plazos que marque la ley. Podemos conservar estadísticas que ya no te
          identifiquen.
        </p>
      </Seccion>

      <Seccion titulo="5. Quién más trata tus datos">
        <p>
          Usamos proveedores que tratan datos por cuenta nuestra, con contratos que les obligan a protegerlos:
        </p>
        <ul>
          <li><strong>Supabase</strong>: base de datos y autenticación (región: <Hueco>REGIÓN</Hueco>).</li>
          <li><strong>Railway</strong>: servidor de la aplicación.</li>
          <li><strong>Vercel</strong>: alojamiento de la web y estadísticas de visitas sin cookies.</li>
          <li><strong>Google y Apple</strong>: solo si eliges iniciar sesión con ellos.</li>
          <li><strong>Google Fonts</strong>: carga de iconos; tu navegador se conecta a sus servidores.</li>
          <li><strong><Hueco>PASARELA DE PAGO</Hueco></strong>: cobros, cuando existan.</li>
        </ul>
        <p>
          Algunos de estos proveedores están en Estados Unidos. Las transferencias se amparan en el Marco de
          Privacidad de Datos UE-EE. UU. o en cláusulas contractuales tipo aprobadas por la Comisión Europea.
        </p>
        <p>
          Tu nombre de usuario y nombre público pueden ser visibles para otros usuarios en funciones como Versus
          o clasificaciones.
        </p>
      </Seccion>

      <Seccion titulo="6. Tus derechos">
        <p>
          Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento
          y portabilidad, y retirar tu consentimiento en cualquier momento, escribiendo a <Hueco>EMAIL</Hueco>.
          Te responderemos en el plazo de un mes.
        </p>
        <p>
          Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección
          de Datos (<a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">www.aepd.es</a>).
        </p>
      </Seccion>

      <Seccion titulo="7. Cookies y almacenamiento en tu navegador">
        <p>
          MIRDaily <strong>no usa cookies publicitarias ni de seguimiento de terceros</strong>. Solo usamos:
        </p>
        <ul>
          <li>
            <strong>Cookies técnicas</strong> para mantener tu sesión iniciada. Son imprescindibles y no
            requieren consentimiento.
          </li>
          <li>
            <strong>Almacenamiento local</strong> del navegador para recordar tus preferencias (modo de estudio,
            cursor, avisos vistos…). No sale de tu dispositivo con fines de seguimiento.
          </li>
          <li>
            <strong>Estadísticas de visitas sin cookies</strong> (Vercel Web Analytics y Speed Insights): miden
            visitas y rendimiento de forma agregada, sin guardar nada en tu dispositivo ni identificarte entre
            sitios web.
          </li>
        </ul>
        <p>Si en el futuro añadimos cookies que requieran tu consentimiento, te lo pediremos antes.</p>
      </Seccion>

      <Seccion titulo="8. Edad mínima">
        <p>
          MIRDaily está dirigido a personas mayores de edad que preparan el examen MIR. No recogemos datos de
          menores de forma consciente.
        </p>
      </Seccion>

      <Seccion titulo="9. Cambios en esta política">
        <p>
          Si cambiamos esta política de forma relevante, te avisaremos en la web o por email antes de que el
          cambio se aplique.
        </p>
      </Seccion>
    </LegalPage>
  )
}

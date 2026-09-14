// Fecha del próximo examen MIR.
//
// Fuente ÚNICA: de aquí beben la cuenta atrás del Studio, el botón de
// calendario y la landing. Si se cambia, se cambian los tres a la vez, que
// es justo lo que evita que la web se contradiga a sí misma.
//
// Antes era una estimación («el último sábado de enero», que daba el 30);
// ahora es la fecha real.
export const NEXT_MIR_DATE = new Date('2027-01-23T09:00:00')

/**
 * Dónde termina la cuenta atrás: la VÍSPERA del examen, no el examen.
 *
 * Llegar a cero el día antes es lo que tiene sentido para quien estudia —el
 * último día útil es la víspera— y evita el cartel absurdo de «queda 1 día»
 * la mañana del propio examen.
 *
 * Se calcula restando a la fecha real en vez de escribir otra fecha a mano:
 * dos fechas sueltas se desincronizan a la primera que alguien toque una.
 */
export const VISPERA_MIR = new Date(NEXT_MIR_DATE.getTime() - 86_400_000)

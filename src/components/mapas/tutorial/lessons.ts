import type { MindMapNode } from '@/components/mapas/proto/types/node.types'
import type { MindMapEdge } from '@/components/mapas/proto/types/edge.types'
import { childrenMap, parentMap } from '@/components/mapas/proto/utils/tree'
import type { MascotPose } from '@/lib/tutorials/types'
import type { DemoId } from './demos'
import { MARCA } from '@/components/tutorial/marca'

// El guion del tutorial de mapas. Cada lección: la mascota lo cuenta en una o dos frases cortas
// (se escriben letra a letra), lo enseña con el propio editor (demo) y te deja probarlo con
// tareas que se marcan solas al detectar que lo has hecho.
//
// Mismas reglas que el tutorial del Studio (lib/tutorials/scripts.ts): frases cortas, una idea
// por lección y solo lo que no se descubre solo. Lo que sale aquí son atajos y gestos que nadie
// adivina mirando la pantalla.

/** Lo que una tarea mira para saber si ya está hecha. */
export type CheckCtx = {
  nodes: MindMapNode[]
  edges: MindMapEdge[]
  /** El mapa al empezar a practicar esta lección (después de la demostración). */
  base: { nodes: MindMapNode[]; edges: MindMapEdge[]; selected: string | null }
  /** Lo que ha pasado desde que empezó la práctica: teclas, plegados, buscador abierto… */
  events: Set<string>
  editingNodeId: string | null
}

export type Task = {
  id: string
  text: string
  /** Teclas que se dibujan junto a la tarea. */
  keys?: string[]
  check: (ctx: CheckCtx) => boolean
  /** Elementos de la interfaz que conviene señalar mientras la tarea está pendiente. */
  glow?: string
}

export type Line = { pose: MascotPose; text: string }

export type Lesson = {
  id: string
  title: string
  intro: Line[]
  demo?: DemoId
  /** Lo que dice mientras se ve la demostración. */
  demoLine?: Line
  tasks: Task[]
  /** Al completar las tareas. */
  done?: Line
}

// ─── Comprobaciones ─────────────────────────────────────────────────────────

const plain = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** Nodos nuevos (no estaban al empezar) con texto propio, ya fuera de edición. */
function newWritten(ctx: CheckCtx): MindMapNode[] {
  const before = new Set(ctx.base.nodes.map((n) => n.id))
  return ctx.nodes.filter(
    (n) => !before.has(n.id) && n.id !== ctx.editingNodeId && plain(n.data.label) && plain(n.data.label) !== 'nueva idea',
  )
}

function siblingsWritten(ctx: CheckCtx): boolean {
  const parents = parentMap(ctx.nodes, ctx.edges)
  const seen = new Map<string, number>()
  for (const n of newWritten(ctx)) {
    const p = parents.get(n.id) ?? ''
    seen.set(p, (seen.get(p) ?? 0) + 1)
  }
  return [...seen.values()].some((c) => c >= 2)
}

/** Un nodo con hijos se ha movido y sus hijos con él (el mismo desplazamiento). */
function branchMoved(ctx: CheckCtx): boolean {
  const was = new Map(ctx.base.nodes.map((n) => [n.id, n.position]))
  const children = childrenMap(parentMap(ctx.nodes, ctx.edges))
  return ctx.nodes.some((n) => {
    const p = was.get(n.id)
    const kids = children.get(n.id) ?? []
    if (!p || kids.length === 0) return false
    const dx = n.position.x - p.x
    const dy = n.position.y - p.y
    if (Math.hypot(dx, dy) < 40) return false
    return kids.every((k) => {
      const kn = ctx.nodes.find((x) => x.id === k)
      const kp = was.get(k)
      return kn && kp && Math.abs(kn.position.x - kp.x - dx) < 3 && Math.abs(kn.position.y - kp.y - dy) < 3
    })
  })
}

function reparented(ctx: CheckCtx): boolean {
  const before = parentMap(ctx.base.nodes, ctx.base.edges)
  const now = parentMap(ctx.nodes, ctx.edges)
  return [...now].some(([id, p]) => before.has(id) && before.get(id) !== p)
}

const selectedNode = (ctx: CheckCtx) => ctx.nodes.find((n) => n.selected)

function categoryChanged(ctx: CheckCtx): boolean {
  const was = new Map(ctx.base.nodes.map((n) => [n.id, n.data.category]))
  return ctx.nodes.some((n) => was.has(n.id) && was.get(n.id) !== n.data.category)
}

function categoryChangedTogether(ctx: CheckCtx): boolean {
  const was = new Map(ctx.base.nodes.map((n) => [n.id, n.data.category]))
  const changed = ctx.nodes.filter((n) => was.has(n.id) && was.get(n.id) !== n.data.category)
  const byCat = new Map<string, number>()
  for (const n of changed) byCat.set(String(n.data.category), (byCat.get(String(n.data.category)) ?? 0) + 1)
  return [...byCat.values()].some((c) => c >= 2)
}

function shapeChanged(ctx: CheckCtx): boolean {
  const was = new Map(ctx.base.nodes.map((n) => [n.id, n.data.style.shape]))
  return ctx.nodes.some((n) => was.has(n.id) && was.get(n.id) !== n.data.style.shape)
}

function colorChanged(ctx: CheckCtx): boolean {
  const was = new Map(ctx.base.nodes.map((n) => [n.id, n.data.style.color]))
  return ctx.nodes.some((n) => was.has(n.id) && was.get(n.id) !== n.data.style.color)
}

function edgeProp(ctx: CheckCtx, pick: (d: Record<string, unknown>) => unknown): boolean {
  const was = new Map(ctx.base.edges.map((e) => [e.id, pick((e.data ?? {}) as Record<string, unknown>)]))
  return ctx.edges.some((e) => was.has(e.id) && was.get(e.id) !== pick((e.data ?? {}) as Record<string, unknown>))
}

function colorChangedTogether(ctx: CheckCtx): boolean {
  const was = new Map(ctx.base.nodes.map((n) => [n.id, n.data.style.color]))
  const changed = ctx.nodes.filter((n) => was.has(n.id) && was.get(n.id) !== n.data.style.color)
  const byColor = new Map<string, number>()
  for (const n of changed) byColor.set(n.data.style.color, (byColor.get(n.data.style.color) ?? 0) + 1)
  return [...byColor.values()].some((c) => c >= 2)
}

// ─── Lecciones ──────────────────────────────────────────────────────────────

export const LESSONS: Lesson[] = [
  {
    id: 'bienvenida',
    title: 'Bienvenida',
    intro: [
      { pose: 'saludo', text: '¡Hola! Te enseño los atajos que hacen que un mapa se monte en minutos.' },
      {
        pose: 'hablando',
        text: 'Este mapa es de práctica: no se guarda, así que toca lo que quieras. Pulsa en mi bocadillo para seguir.',
      },
    ],
    tasks: [],
  },
  {
    id: 'raton',
    title: 'Moverte con el ratón',
    intro: [
      { pose: 'hablando', text: 'Antes de los atajos, lo básico: cómo moverte por el mapa y tocar los nodos con el ratón.' },
    ],
    demo: 'mouse',
    demoLine: {
      pose: 'senalando',
      text: 'La rueda mueve el mapa; con Ctrl, acerca y aleja. Clic selecciona y doble clic edita.',
    },
    tasks: [
      {
        id: 'mover-mapa',
        text: 'Mueve el mapa con la rueda (o arrastrando con el botón central o el derecho)',
        keys: ['Rueda'],
        check: (ctx) => ctx.events.has('pan'),
      },
      {
        id: 'zoom',
        text: 'Acerca o aleja con Ctrl + rueda (o con + y − de abajo a la izquierda)',
        keys: ['Ctrl', 'Rueda'],
        check: (ctx) => ctx.events.has('zoom'),
      },
      {
        id: 'clic',
        text: 'Haz clic en un nodo para seleccionarlo',
        check: (ctx) => ctx.events.has('node-click') && !!selectedNode(ctx),
      },
      {
        id: 'recuadro',
        text: 'Arrastra en una zona vacía para seleccionar varios a la vez',
        check: (ctx) => ctx.nodes.filter((n) => n.selected).length >= 2,
      },
      {
        id: 'doble-clic',
        text: 'Haz doble clic en un nodo para editarlo (Esc o clic fuera para salir)',
        keys: ['Doble clic'],
        check: (ctx) => ctx.events.has('dblclick') && ctx.events.has('editing'),
      },
    ],
    done: { pose: 'celebracion', text: 'Con eso ya te mueves por cualquier mapa. Ahora, los atajos.' },
  },
  {
    id: 'crear',
    title: 'Crear con el teclado',
    intro: [{ pose: 'confiado', text: 'Lo más rápido es no soltar el teclado. Tab crea un hijo; Enter, un hermano.' }],
    demo: 'tab',
    demoLine: { pose: 'senalando', text: 'Mira: Tab, escribo, Enter para guardar… y Enter otra vez para el siguiente.' },
    tasks: [
      {
        id: 'hijo',
        text: 'Selecciona un nodo, pulsa Tab, escribe y pulsa Enter',
        keys: ['Tab'],
        check: (ctx) => newWritten(ctx).length >= 1,
      },
      {
        id: 'hermano',
        text: 'Pulsa Enter otra vez para crear un hermano y escríbelo',
        keys: ['Enter'],
        check: siblingsWritten,
      },
    ],
    done: { pose: 'celebracion', text: '¡Eso es! Y si escribiendo pulsas Tab, guardas y bajas un nivel.' },
  },
  {
    id: 'moverse',
    title: 'Moverse con flechas',
    intro: [{ pose: 'hablando', text: 'Con un nodo seleccionado, las flechas te llevan a sus vecinos: padre, hijos y hermanos.' }],
    demo: 'arrows',
    demoLine: { pose: 'senalando', text: 'Así recorres el mapa sin tocar el ratón. Y si escribes con un nodo seleccionado, lo editas.' },
    tasks: [
      {
        id: 'flechas',
        text: 'Selecciona un nodo y muévete con las flechas',
        keys: ['←', '↑', '→', '↓'],
        check: (ctx) => ctx.events.has('Arrow') && (selectedNode(ctx)?.id ?? null) !== ctx.base.selected,
      },
      {
        id: 'escribir',
        text: 'Con un nodo seleccionado, empieza a escribir: la letra sustituye a su texto (Enter guarda, Esc sale)',
        keys: ['A – Z'],
        check: (ctx) => ctx.events.has('typed') && ctx.events.has('editing'),
      },
    ],
    done: { pose: 'confiado', text: 'Perfecto. Doble clic o F2 también editan. Con Supr borras el seleccionado y la selección pasa a su padre.' },
  },
  {
    id: 'plegar',
    title: 'Plegar ramas',
    intro: [
      { pose: 'hablando-variante2', text: 'Un mapa grande agobia. Pliega lo que no estés mirando y estudia por partes.' },
      { pose: 'hablando', text: 'Este mapa tiene tres niveles de ideas: las ramas, sus detalles y los detalles de los detalles.' },
    ],
    demo: 'fold',
    demoLine: { pose: 'senalando', text: 'Espacio pliega la rama. Alt+1 deja solo el primer nivel, Alt+2 los dos primeros, Alt+3 los tres; Alt+0 lo abre todo.' },
    tasks: [
      { id: 'plegar', text: 'Pliega una rama (o varias seleccionadas): Espacio o el botón − junto al nodo', keys: ['Espacio'], check: (ctx) => ctx.events.has('fold') },
      { id: 'desplegar', text: 'Vuelve a desplegarla', keys: ['Espacio'], check: (ctx) => ctx.events.has('unfold') },
      {
        id: 'niveles',
        text: 'Prueba Alt+1, Alt+2 y Alt+3 (hasta ese nivel) y vuelve a verlo todo con Alt+0, o usa el menú «Niveles» de la barra',
        keys: ['Alt', '1·2·3', '0'],
        check: (ctx) => ctx.events.has('Alt1') && ctx.events.has('Alt2') && ctx.events.has('Alt3') && ctx.events.has('Alt0'),
        glow: '[data-tuto="niveles"]',
      },
    ],
    done: { pose: 'celebracion', text: 'Así es como se repasa un tema enorme sin perderse.' },
  },
  {
    id: 'mover',
    title: 'Mover ramas',
    intro: [{ pose: 'confiado', text: 'Al arrastrar un nodo, su rama entera le sigue. Con Alt pulsado, se mueve él solo.' }],
    demo: 'drag',
    demoLine: { pose: 'senalando', text: 'Y si no te gusta cómo ha quedado, Ctrl+Z. Todo se deshace.' },
    tasks: [
      { id: 'arrastrar', text: 'Arrastra un nodo que tenga hijos', check: branchMoved },
      { id: 'deshacer', text: 'Deshazlo con Ctrl+Z', keys: ['Ctrl', 'Z'], check: (ctx) => ctx.events.has('CtrlZ') },
    ],
    done: { pose: 'confiado', text: 'Si sueltas encima de otros nodos, la física los aparta sola.' },
  },
  {
    id: 'cambiar-rama',
    title: 'Cambiar de rama',
    intro: [{ pose: 'dudando', text: '¿Una idea en la rama equivocada? No la borres: cámbiala de sitio.' }],
    demo: 'reparent',
    demoLine: { pose: 'senalando', text: 'Arrastra y pulsa Ctrl. El nodo de debajo se marca: al soltar, pasa a colgar de él.' },
    tasks: [
      {
        id: 'ctrl-arrastrar',
        text: 'Arrastra un nodo y, sin soltarlo, pulsa Ctrl encima de otro',
        keys: ['Ctrl'],
        check: reparented,
      },
    ],
    done: { pose: 'celebracion', text: 'Y se lleva toda su rama. Sin Ctrl nunca pasa, así no lo haces sin querer.' },
  },
  {
    id: 'buscar',
    title: 'Buscar',
    intro: [{ pose: 'hablando', text: 'En un mapa de cien ideas, buscar es más rápido que mirar.' }],
    demo: 'search',
    demoLine: { pose: 'senalando', text: 'Ctrl+F, escribes y te lleva. Si estaba dentro de una rama plegada, la abre.' },
    tasks: [
      { id: 'abrir', text: 'Abre el buscador con Ctrl+F', keys: ['Ctrl', 'F'], check: (ctx) => ctx.events.has('search-open') },
      {
        id: 'bnp',
        text: 'Busca «BNP» (Enter pasa al siguiente resultado)',
        check: (ctx) =>
          ctx.events.has('search-open') && !!selectedNode(ctx) && plain(selectedNode(ctx)!.data.label).includes('bnp'),
      },
    ],
    done: { pose: 'confiado', text: 'Esc cierra el buscador.' },
  },
  {
    id: 'estilo',
    title: 'Categorías',
    intro: [
      { pose: 'con-mazo', text: 'Cada idea tiene su categoría MIR: definición, clínica, tratamiento… y su color.' },
      { pose: 'hablando', text: 'Así, de un vistazo, distingues qué es clínica y qué es una perla. Se asignan con un número del 1 al 7.' },
    ],
    demo: 'category',
    demoLine: {
      pose: 'senalando',
      text: 'Ratón encima y un número. Y en el menú Categorías editas todo de una categoría entera: título, colores, forma y fuente.',
    },
    tasks: [
      { id: 'categoria', text: 'Pasa el ratón por un nodo y pulsa un número del 1 al 7', keys: ['1 – 7'], check: categoryChanged },
      {
        id: 'categoria-varios',
        text: 'Selecciona varios arrastrando en vacío y pulsa un número (o uno de los puntos de colores de su barra): cambian todos',
        check: categoryChangedTogether,
      },
      {
        id: 'menu-categorias',
        text: 'Abre «Categorías» en la barra de arriba',
        check: (ctx) => ctx.events.has('cat-open'),
        glow: 'button[title="Estilos de las categorías"]',
      },
      {
        id: 'color-categoria',
        text: 'Elige una categoría arriba y cámbiale el relleno, el borde, la fuente… se actualizan todos sus nodos',
        check: (ctx) => ctx.events.has('cat-style'),
      },
    ],
    done: { pose: 'celebracion', text: 'Ahí también puedes seleccionar de golpe todos los nodos de una categoría.' },
  },
  {
    id: 'panel',
    title: 'Estilo de los nodos',
    intro: [
      { pose: 'con-mazo', text: 'Para retocar el aspecto de un nodo hay un panel de estilo: forma, colores y grosor del borde.' },
    ],
    demo: 'panel',
    demoLine: {
      pose: 'senalando',
      text: 'Se abre con la paleta que sale sobre el nodo, o con Ctrl+E. Con varios seleccionados, cambia todos a la vez.',
    },
    tasks: [
      {
        id: 'abrir-panel',
        text: 'Selecciona un nodo y abre el panel con la paleta de encima (o Ctrl+E)',
        keys: ['Ctrl', 'E'],
        check: (ctx) => ctx.events.has('style-open'),
      },
      { id: 'forma', text: 'Cámbiale la forma', check: shapeChanged, glow: '[data-tuto="style-panel"]' },
      { id: 'color', text: 'Elige otro color de relleno', check: colorChanged, glow: '[data-tuto="style-panel"]' },
      {
        id: 'varios',
        text: 'Selecciona varios arrastrando en vacío: sale una sola barra para todos. Ábrela con su paleta y cámbiales el color',
        check: colorChangedTogether,
      },
      {
        id: 'restablecer',
        text: 'Pulsa «Restablecer estilo» para volver al aspecto original',
        check: (ctx) => ctx.events.has('style-reset'),
        glow: '[data-tuto="style-reset"]',
      },
    ],
    done: { pose: 'celebracion', text: 'Y siempre puedes deshacerlo con Ctrl+Z.' },
  },
  {
    id: 'lineas',
    title: 'Las líneas',
    intro: [
      { pose: 'hablando', text: 'Las líneas que unen las ideas también se pueden retocar: tipo de trazo, color y grosor.' },
    ],
    demo: 'edges',
    demoLine: {
      pose: 'senalando',
      text: 'Haz clic en una línea: abajo te sale su barra. Con Ctrl+clic eliges varias y se cambian a la vez.',
    },
    tasks: [
      {
        id: 'elegir-linea',
        text: 'Haz clic sobre una línea para seleccionarla',
        check: (ctx) => ctx.edges.some((e) => e.selected),
        glow: '[data-tuto="edge-panel"]',
      },
      { id: 'trazo', text: 'Cámbiale el trazo: continua, guiones o puntos', check: (ctx) => edgeProp(ctx, (d) => d.variant) },
      { id: 'color-linea', text: 'Dale otro color', check: (ctx) => edgeProp(ctx, (d) => d.color) },
      { id: 'grosor', text: 'Cambia su grosor', check: (ctx) => edgeProp(ctx, (d) => d.strokeWidth) },
    ],
    done: { pose: 'celebracion', text: 'Si cambias la categoría de un nodo, la línea que llega a él toma el color de la categoría.' },
  },
  {
    id: 'ordenar',
    title: 'Ordenar',
    intro: [{ pose: 'hablando-variante2', text: 'Cuando el mapa se desordene, no lo coloques a mano.' }],
    demo: 'layout',
    demoLine: { pose: 'senalando', text: '«Ordenar» lo coloca todo en árbol. Con varios seleccionados, ordena solo ese bloque.' },
    tasks: [
      {
        id: 'ordenar',
        text: 'El mapa está desordenado: pulsa «Ordenar» en la barra de arriba',
        check: (ctx) => ctx.events.has('ordenar-cambio'),
        glow: 'button[title="Ordenar el mapa automáticamente"]',
      },
      {
        id: 'bloque',
        text: 'Desordena a mano un par de ramas, selecciónalas (Ctrl+clic o recuadro) y pulsa «Ordenar»: solo se colocan esas',
        check: (ctx) => ctx.events.has('ordenar-bloque-cambio'),
        glow: 'button[title="Ordenar el mapa automáticamente"]',
      },
    ],
    done: { pose: 'celebracion', text: 'Así de fácil. Y si el resultado no te convence, Ctrl+Z.' },
  },
  {
    id: 'exportar',
    title: 'Exportar e imprimir',
    intro: [
      { pose: 'hablando', text: 'Para estudiar en papel, el mapa se exporta a PDF. No es una foto: el texto y las líneas son vectores y salen nítidos.' },
    ],
    demo: 'export',
    demoLine: {
      pose: 'senalando',
      text: 'Ctrl+P o el botón Exportar. Puedes sacar todo el mapa, solo lo seleccionado, o una hoja por cada rama principal.',
    },
    tasks: [
      {
        id: 'abrir-exportar',
        text: 'Abre «Exportar» con Ctrl+P o con el botón de arriba a la derecha',
        keys: ['Ctrl', 'P'],
        check: (ctx) => ctx.events.has('export-open'),
        glow: '[data-tuto="export-open"]',
      },
      {
        id: 'una-hoja-por-rama',
        text: 'Elige «Una hoja por rama»: cada rama principal sale en su hoja, con la letra bien grande',
        check: (ctx) => ctx.events.has('export-branches'),
      },
    ],
    done: { pose: 'celebracion', text: 'Con «Tamaño real, en varias hojas» el mapa se reparte en folios A4 para pegarlos. Descarga cuando quieras.' },
  },
  {
    id: 'fin',
    title: 'Listo',
    intro: [
      { pose: 'celebracion', text: '¡Ya lo tienes! Con esto se monta un tema entero en un rato.' },
      {
        pose: 'despedida',
        text: `Los atajos están siempre en el botón ${MARCA} del editor, y este tutorial en «Mapas mentales». ¡A estudiar!`,
      },
    ],
    tasks: [],
  },
]

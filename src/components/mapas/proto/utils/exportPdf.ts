import { getNodesBounds, getViewportForBounds } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import { useUIStore } from '@/components/mapas/proto/store/ui.store'

const PDF_BG = '#f8f7fe'

/** Elements to strip from the capture */
function shouldIgnore(el: Element): boolean {
  if (el.id === 'interactive-bg-canvas') return true
  const cl = el.classList
  if (!cl) return false
  return (
    cl.contains('react-flow__node-toolbar') ||
    cl.contains('react-flow__controls')     ||
    cl.contains('react-flow__minimap')
  )
}

export async function exportToPdf(
  nodes: Node[],
  setNodes: (updater: (ns: Node[]) => Node[]) => void,
  filename = 'mapa-mental',
) {
  const rootEl = document.querySelector<HTMLElement>('.mapa-root')
  const { theme, setTheme } = useUIStore.getState()
  const wasDark = theme === 'dark'

  // 1. Freeze all transitions/animations to avoid flash
  rootEl?.classList.add('pdf-exporting')

  // 2. If dark, temporarily switch to light so nodes render with light-mode colours
  if (wasDark) {
    setTheme('light')
    rootEl?.setAttribute('data-theme', 'light')
  }

  // 3. Deselect all nodes so toolbars disappear
  setNodes((ns) => ns.map((n) => ({ ...n, selected: false })))

  // Wait for React re-render + browser paint
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

  const rfContainer = document.querySelector('.react-flow')          as HTMLElement | null
  const viewportEl  = document.querySelector('.react-flow__viewport') as HTMLElement | null
  if (!rfContainer || !viewportEl) return

  const W = rfContainer.clientWidth
  const H = rfContainer.clientHeight

  const origTransform = viewportEl.style.transform
  const origBg        = rfContainer.style.background

  rfContainer.style.background = PDF_BG

  // 4. Fit all nodes into view
  if (nodes.length > 0) {
    const bounds   = getNodesBounds(nodes)
    const viewport = getViewportForBounds(bounds, W, H, 0.2, 2, 0.18)
    viewportEl.style.transform =
      `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`
  }

  await document.fonts.ready
  await new Promise<void>((r) => requestAnimationFrame(() => r()))

  try {
    const dataUrl = await toPng(rfContainer, {
      backgroundColor: PDF_BG,
      pixelRatio: 2,
      filter: (el) => !shouldIgnore(el as Element),
    })

    const img = new Image()
    img.src   = dataUrl
    await new Promise<void>((r) => { img.onload = () => r() })

    const pageW = img.naturalWidth  / 2
    const pageH = img.naturalHeight / 2

    const pdf = new jsPDF({
      orientation: pageW >= pageH ? 'landscape' : 'portrait',
      unit: 'px',
      format: [pageW, pageH],
      compress: true,
    })

    pdf.addImage(dataUrl, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST')
    pdf.save(`${filename}.pdf`)
  } finally {
    // Restore viewport and background
    viewportEl.style.transform   = origTransform
    rfContainer.style.background = origBg

    // Restore theme if we switched it
    if (wasDark) {
      setTheme('dark')
      rootEl?.setAttribute('data-theme', 'dark')
    }

    // Re-enable transitions
    rootEl?.classList.remove('pdf-exporting')
  }
}

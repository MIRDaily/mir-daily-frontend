import type { Variants } from 'framer-motion'

export const nodeVariants: Variants = {
  initial: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 350, damping: 20 },
  },
  idle: { scale: 1, opacity: 1 },
  hovered: {
    scale: 1.04,
    transition: { type: 'spring', stiffness: 400, damping: 15 },
  },
  selected: {
    scale: 1.02,
    transition: { type: 'spring', stiffness: 350, damping: 18 },
  },
  editing: {
    scale: 1.03,
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  },
  exit: {
    scale: 0,
    opacity: 0,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
  dividing: {
    scale: [1, 1.15, 0.95, 1],
    transition: { duration: 0.45, times: [0, 0.3, 0.7, 1] },
  },
}

export const panelVariants: Variants = {
  hidden: { x: '100%', opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 280, damping: 26 },
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
}

export const toolbarVariants: Variants = {
  hidden: { y: -10, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  },
}

export const springConfig = {
  gentle: { stiffness: 120, damping: 14, mass: 1 },
  snappy: { stiffness: 300, damping: 20, mass: 0.8 },
  inertia: { stiffness: 80, damping: 18, mass: 1.2 },
  bounce: { type: 'spring' as const, stiffness: 400, damping: 17 },
}

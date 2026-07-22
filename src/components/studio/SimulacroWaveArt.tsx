'use client'

import { type ReactNode } from 'react'
import { motion } from 'framer-motion'

const bounce = { type: 'spring', stiffness: 300, damping: 26, mass: 0.9 } as const

const waveLayers = [
  {
    color: '#FFC7B0',
    opacity: 0.45,
    duration: 9,
    reverse: false,
    path: 'M0,18 C180,-6 360,42 540,18 C720,-6 900,42 1080,18 C1260,-6 1350,10 1440,18 L1440,120 L0,120 Z',
  },
  {
    color: '#FFAB91',
    opacity: 0.65,
    duration: 7,
    reverse: true,
    path: 'M0,24 C200,44 400,4 600,24 C800,44 1000,4 1200,24 C1320,36 1400,20 1440,24 L1440,120 L0,120 Z',
  },
  {
    color: '#F08D75',
    opacity: 0.85,
    duration: 5.5,
    reverse: false,
    path: 'M0,30 C220,10 440,50 660,30 C880,10 1100,50 1320,30 L1440,30 L1440,120 L0,120 Z',
  },
  {
    color: '#E8A598',
    opacity: 1,
    duration: 8,
    reverse: true,
    path: 'M0,40 C240,58 480,22 720,40 C960,58 1200,22 1440,40 L1440,120 L0,120 Z',
  },
] as const

function WaveLayer({ color, opacity, duration, reverse, path }: (typeof waveLayers)[number]) {
  return (
    <motion.div
      className="absolute inset-y-0 left-0 flex h-full"
      style={{ width: '200%' }}
      initial={{ x: '0%' }}
      animate={{ x: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
      transition={{ duration, repeat: Infinity, ease: 'linear' }}
    >
      <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="block h-full w-1/2">
        <path d={path} fill={color} fillOpacity={opacity} />
      </svg>
      <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="block h-full w-1/2">
        <path d={path} fill={color} fillOpacity={opacity} />
      </svg>
    </motion.div>
  )
}

const bubbles = [
  { x: '8%', size: 7, delay: 0, duration: 3.2 },
  { x: '22%', size: 5, delay: 0.6, duration: 2.6 },
  { x: '40%', size: 8, delay: 1.1, duration: 3.6 },
  { x: '58%', size: 5, delay: 0.3, duration: 2.9 },
  { x: '74%', size: 6, delay: 1.4, duration: 3.1 },
  { x: '90%', size: 6, delay: 0.8, duration: 3.4 },
] as const

function Bubble({ x, size, delay, duration }: (typeof bubbles)[number]) {
  return (
    <motion.div
      className="absolute rounded-full bg-white/70"
      style={{ left: x, width: size, height: size, bottom: 10 }}
      initial={{ opacity: 0, y: 0 }}
      animate={{ opacity: [0, 0.9, 0], y: [0, -60] }}
      transition={{ duration, repeat: Infinity, delay, ease: 'easeOut' }}
    />
  )
}

export function WaveCta({ hovered, children }: { hovered: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      className="absolute inset-x-0 bottom-0 z-0 h-24 overflow-hidden rounded-b-2xl"
    >
      <motion.div
        className="absolute inset-0 flex items-end justify-center pb-6"
        initial="rest"
        animate={hovered ? 'risen' : 'rest'}
        variants={{
          rest: { y: '100%', opacity: 0 },
          risen: { y: '0%', opacity: 1 },
        }}
        transition={bounce}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -bottom-4">
          {hovered
            ? waveLayers.map((layer, i) => <WaveLayer key={i} {...layer} />)
            : null}
          {hovered ? bubbles.map((b, i) => <Bubble key={i} {...b} />) : null}
        </div>
        <span className="relative z-10 flex items-center gap-2 text-base font-semibold text-[#2c3e50] [text-shadow:0_1px_2px_rgba(255,255,255,0.55)]">
          {children}
        </span>
      </motion.div>
    </button>
  )
}

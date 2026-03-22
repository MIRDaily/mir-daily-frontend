'use client'

import { useEffect, useRef, useState } from 'react'
import { useZenTimer } from '@/state/zenTimerStore'

type ZenDeskProps = {
  xPct: number
  yPct: number
  occupied?: boolean
  index?: number
}

export default function ZenDesk({
  xPct,
  yPct,
  occupied = false,
  index = 0,
}: ZenDeskProps) {
  const { state } = useZenTimer()
  const isStudying = occupied && state.phase === 'study'

  const showBook = index % 3 !== 2
  const showLamp = index % 4 === 0

  // ── Paper flip: toggles between two static layouts every 5–12 s ──────────
  // No animation — just React re-rendering with different positions.
  // "A on top of B" alternates with "B on top of A" (different x/rotation).
  const [flipped, setFlipped] = useState(false)
  const flipRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (flipRef.current) clearTimeout(flipRef.current)

    if (!isStudying) {
      setFlipped(false)
      return
    }

    function scheduleNext() {
      const gap = 60000 + Math.random() * 60000  // 1–2 min
      flipRef.current = setTimeout(() => {
        setFlipped(prev => !prev)
        scheduleNext()
      }, gap)
    }

    // Stagger first flip per desk so they don't all flip at the same instant
    const initial = (index * 7000 + 30000) % 60000
    flipRef.current = setTimeout(() => {
      setFlipped(prev => !prev)
      scheduleNext()
    }, initial)

    return () => { if (flipRef.current) clearTimeout(flipRef.current) }
  }, [isStudying, index])

  // ── Paper positions via CSS transform so transition animates the swap ───────
  // Both papers share the same base rect (x=27 y=25 w=18 h=13).
  // All positioning is done through CSS transform so the browser interpolates
  // the transition automatically when `flipped` toggles.
  // B is rendered first (always behind), A rendered last (always on top).
  const PAPER_TRANSITION = 'transform 0.55s ease-in-out'

  const transformB = flipped
    ? 'translate(-2px, 1px)  rotate(-5deg)'   // flipped: B moves left/behind
    : 'translate(10px, 2px)  rotate( 5deg)'   // normal:  B sits right/behind

  const transformA = flipped
    ? 'translate(11px, -1px) rotate( 3deg)'   // flipped: A moves right
    : 'translate( 0px, -1px) rotate(-2deg)'   // normal:  A sits left/front

  return (
    <div
      className="absolute"
      style={{
        left:      `${xPct}%`,
        top:       `${yPct}%`,
        transform: 'translate(-50%, -50%)',
        width:     '11%',
        filter:    occupied
          ? 'drop-shadow(0 0 7px rgba(232,165,152,0.65)) drop-shadow(0 2px 4px rgba(180,120,80,0.3))'
          : 'drop-shadow(0 1px 2px rgba(100,70,40,0.15))',
        transition: 'filter 1s ease',
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 80 72" width="100%" xmlns="http://www.w3.org/2000/svg">

        {/* ── Chair ── */}
        <rect x={14} y={50} width={52} height={16} rx={4}
          fill={occupied ? '#B8967A' : '#C9A888'} stroke="#A07A5A" strokeWidth={1.2} />
        <rect x={20} y={43} width={40} height={10} rx={3}
          fill={occupied ? '#C4A07A' : '#D4B090'} stroke="#A07A5A" strokeWidth={1.2} />
        <rect x={18} y={63} width={5} height={7} rx={2} fill="#A07A5A" />
        <rect x={57} y={63} width={5} height={7} rx={2} fill="#A07A5A" />

        {/* ── Desk surface ── */}
        <rect x={4} y={22} width={72} height={24} rx={5}
          fill="#C8A882" stroke="#A8886A" strokeWidth={1.5} />
        <rect x={6} y={23} width={68} height={4} rx={3} fill="#D8B894" opacity={0.6} />
        <rect x={4} y={42} width={72} height={6} rx={2} fill="#A8785A" />
        <rect x={8}  y={46} width={6} height={10} rx={2} fill="#9A6E52" />
        <rect x={66} y={46} width={6} height={10} rx={2} fill="#9A6E52" />

        {/* ── Book decoration ── */}
        {showBook && (
          <g>
            <rect x={10} y={26} width={14} height={16} rx={2}
              fill="#7AADCA" stroke="#5A8DAA" strokeWidth={1} />
            <line x1={11} y1={29} x2={23} y2={29} stroke="#5A8DAA" strokeWidth={0.8} opacity={0.5} />
            <line x1={11} y1={32} x2={23} y2={32} stroke="#5A8DAA" strokeWidth={0.8} opacity={0.5} />
          </g>
        )}

        {/* ── Lamp decoration ── */}
        {showLamp && (
          <g>
            <rect x={58} y={38} width={8} height={4} rx={1.5} fill="#8A7A6A" />
            <rect x={61} y={26} width={2} height={13} fill="#9A8A7A" />
            <ellipse cx={62} cy={26} rx={7} ry={4} fill="#E8C87A" opacity={0.9} />
            <ellipse cx={62} cy={29} rx={6} ry={2} fill="#F0D890" opacity={0.3} />
          </g>
        )}

        {/* ── Papers while studying — smooth animated swap ── */}
        {isStudying && (
          <>
            {/* Paper B — always behind (rendered first) */}
            <g style={{ transform: transformB, transformBox: 'fill-box', transformOrigin: 'center', transition: PAPER_TRANSITION }}>
              <rect x={27} y={25} width={18} height={13} rx={1.2}
                fill="#EDE7D4" stroke="rgba(0,0,0,0.13)" strokeWidth={0.8} />
              <line x1={29.5} y1={28.5} x2={42.5} y2={28.5} stroke="rgba(0,0,0,0.09)" strokeWidth={0.7} />
              <line x1={29.5} y1={31.5} x2={42.5} y2={31.5} stroke="rgba(0,0,0,0.09)" strokeWidth={0.7} />
            </g>

            {/* Paper A — always on top (rendered last) */}
            <g style={{ transform: transformA, transformBox: 'fill-box', transformOrigin: 'center', transition: PAPER_TRANSITION }}>
              <rect x={27} y={25} width={18} height={13} rx={1.2}
                fill="#F8F3E8" stroke="rgba(0,0,0,0.16)" strokeWidth={0.8} />
              <line x1={29.5} y1={28.5} x2={42.5} y2={28.5} stroke="rgba(0,0,0,0.12)" strokeWidth={0.7} />
              <line x1={29.5} y1={31.5} x2={42.5} y2={31.5} stroke="rgba(0,0,0,0.12)" strokeWidth={0.7} />
              <line x1={29.5} y1={34.5} x2={38}   y2={34.5} stroke="rgba(0,0,0,0.12)" strokeWidth={0.7} />
            </g>
          </>
        )}

        {/* ── Notebook when occupied but not studying ── */}
        {occupied && !isStudying && (
          <g>
            <rect x={30} y={27} width={20} height={14} rx={1.5}
              fill="#F5F0E8" stroke="#C4B090" strokeWidth={0.8} />
            <line x1={33} y1={31} x2={47} y2={31} stroke="#C4B090" strokeWidth={0.7} />
            <line x1={33} y1={34} x2={47} y2={34} stroke="#C4B090" strokeWidth={0.7} />
            <line x1={33} y1={37} x2={42} y2={37} stroke="#C4B090" strokeWidth={0.7} />
          </g>
        )}
      </svg>
    </div>
  )
}

'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import ZenDesk from './ZenDesk'

// ─── Desk positions — left ¾ of room ──────────────────────────────────────────
type DeskSlot = { xPct: number; yPct: number }

const DESK_SLOTS: ReadonlyArray<DeskSlot> = [
  // Row 1
  { xPct: 11, yPct: 40 },
  { xPct: 27, yPct: 40 },
  { xPct: 44, yPct: 40 },
  { xPct: 60, yPct: 40 },
  // Row 2
  { xPct: 11, yPct: 60 },
  { xPct: 27, yPct: 60 },
  { xPct: 44, yPct: 60 },
  { xPct: 60, yPct: 60 },
  // Row 3
  { xPct: 11, yPct: 80 },
  { xPct: 27, yPct: 80 },
  { xPct: 44, yPct: 80 },
  { xPct: 60, yPct: 80 },
] as const

// ─── Sofa positions — right ¼ lounge (avatar target coords) ───────────────────
// Sofa 1 faces DOWN (normal) at yPct=43; sofa 2 faces UP (flipped) at yPct=76.
// 3 seats per sofa = 6 total — majority of avatars fill these during breaks.
const SOFA_SLOTS: ReadonlyArray<DeskSlot> = [
  { xPct: 78, yPct: 46 },   // sofa 1 — left seat
  { xPct: 84, yPct: 46 },   // sofa 1 — center seat
  { xPct: 90, yPct: 46 },   // sofa 1 — right seat
  { xPct: 78, yPct: 73 },   // sofa 2 — left seat (flipped)
  { xPct: 84, yPct: 73 },   // sofa 2 — center seat (flipped)
  { xPct: 90, yPct: 73 },   // sofa 2 — right seat (flipped)
] as const

// ─── Book colours ──────────────────────────────────────────────────────────────
const BOOK_COLORS = [
  '#C4655A', '#E8A598', '#8BA888', '#7AADCA',
  '#C4A05A', '#A888C4', '#7D8A96', '#D4905A',
  '#8BA888', '#C4655A', '#7AADCA', '#E8A598',
  '#D4905A', '#A888C4', '#8BA888', '#C4655A',
] as const

// ─── Component ────────────────────────────────────────────────────────────────

type ZenRoomProps = {
  children?: ReactNode
  occupiedDesks?: ReadonlyArray<number>
}

export default function ZenRoom({ children, occupiedDesks = [] }: ZenRoomProps) {
  const occupiedSet = new Set(occupiedDesks)

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-[#D4C8BC] shadow-[0_4px_24px_-4px_rgba(125,100,80,0.18)]"
      style={{ aspectRatio: '16 / 7' }}
      aria-label="Sala de estudio Zen"
      role="img"
    >

      {/* ── Floor ── */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, #E8DCCF 0%, #F0E4D4 60%, #EAD8C4 100%)' }}
      />

      {/* Floor wood-grain lines */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent, transparent 119px, rgba(100,70,40,0.9) 119px, rgba(100,70,40,0.9) 120px)',
        }}
      />

      {/* ── Back wall ── */}
      <div
        className="absolute left-0 right-0 top-0"
        style={{
          height: '27%',
          background: 'linear-gradient(180deg, #C8BAA8 0%, #D4C4B0 100%)',
          borderBottom: '2px solid #B8A890',
        }}
      />
      <div
        className="absolute left-0 right-0 top-0 opacity-[0.07]"
        style={{
          height: '27%',
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 11px, rgba(80,60,40,0.8) 11px, rgba(80,60,40,0.8) 12px)',
        }}
      />

      {/* ── Lounge floor tint (right ¼) ── */}
      <div
        className="absolute"
        style={{
          left: '73%', right: '0', top: '27%', bottom: '0',
          background: 'linear-gradient(180deg, #DDD0B5 0%, #D4C4A0 100%)',
          opacity: 0.6,
        }}
      />

      {/* ── Divider column ── */}
      <div
        className="absolute"
        style={{
          left: '73%', top: '0', bottom: '0', width: '0.7%',
          background: 'linear-gradient(180deg, #B0987A 0%, #C4AE90 30%, #B8A080 100%)',
          boxShadow: '2px 0 8px rgba(100,70,40,0.12), -1px 0 4px rgba(100,70,40,0.06)',
        }}
      />

      {/* ── Bookshelves on back wall (desk area) ── */}
      <BookshelfRow />

      {/* ── Window ── */}
      <RoomWindow />

      {/* ── Lounge decorations ── */}
      <LoungeArea />

      {/* ── Corner plant (left) ── */}
      <CornerPlant />

      {/* ── Floor lamps ── */}
      <FloorLamp xPct={5}  />
      <FloorLamp xPct={68} />

      {/* ── Desks ── */}
      {DESK_SLOTS.map((slot, i) => (
        <ZenDesk
          key={i}
          xPct={slot.xPct}
          yPct={slot.yPct}
          index={i}
          occupied={occupiedSet.has(i)}
        />
      ))}

      {/* ── Walking cat ── */}
      <WalkingCat />

      {/* ── Overlays (avatars etc.) ── */}
      {children}

    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function BookshelfRow() {
  return (
    <>
      {/* Left of window */}
      <div className="absolute" style={{ left: '2%', width: '17%', top: '14%', height: '13%' }}>
        <ShelfSection bookColors={BOOK_COLORS.slice(0, 5)} />
      </div>
      {/* Right of window → up to divider */}
      <div className="absolute" style={{ left: '45%', right: '28%', top: '14%', height: '13%' }}>
        <ShelfSection bookColors={BOOK_COLORS.slice(5, 11)} />
      </div>
    </>
  )
}

function ShelfSection({ bookColors }: { bookColors: ReadonlyArray<string> }) {
  return (
    <div className="relative h-full w-full">
      <div
        className="absolute bottom-0 left-0 right-0 rounded-sm"
        style={{
          height: '18%',
          background: 'linear-gradient(180deg, #B89A7A 0%, #A08060 100%)',
          boxShadow: '0 2px 4px rgba(60,40,20,0.25)',
        }}
      />
      <div className="absolute bottom-[18%] left-1 right-1 flex items-end gap-[1.5%]">
        {bookColors.map((color, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm"
            style={{
              background: `linear-gradient(180deg, ${color} 0%, ${color}CC 100%)`,
              height: `${55 + ((i * 7) % 30)}%`,
              minWidth: 0,
              boxShadow: 'inset -1px 0 0 rgba(0,0,0,0.15)',
            }}
          />
        ))}
      </div>
    </div>
  )
}

function RoomWindow() {
  return (
    <div
      className="absolute"
      style={{ left: '21%', width: '21%', top: '1.5%', height: '17%' }}
      aria-hidden="true"
    >
      <div
        className="relative h-full w-full rounded-t-lg"
        style={{
          background: 'linear-gradient(180deg, #B4D4EC 0%, #C8E4F4 60%, #D8EEF8 100%)',
          border: '2.5px solid #B0A090',
          boxShadow: 'inset 0 2px 6px rgba(100,140,180,0.25)',
        }}
      >
        <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2" style={{ width: '2.5px', background: '#B0A090' }} />
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2" style={{ height: '2.5px', background: '#B0A090' }} />
        <div className="absolute top-1 left-1 rounded" style={{ width: '18%', height: '35%', background: 'rgba(255,255,255,0.4)' }} />
      </div>
      <div className="w-full rounded-b-sm" style={{ height: '8%', background: 'linear-gradient(180deg, #C8B8A0 0%, #B8A890 100%)', border: '1px solid #A89880' }} />
    </div>
  )
}

// ── Lounge ─────────────────────────────────────────────────────────────────────

function LoungeArea() {
  return (
    <>
      {/* Bookcase 1 — against divider wall, upper half */}
      <Bookcase xPct={75.5} yPct={35} />

      {/* Bookcase 2 — against divider wall, lower half */}
      <Bookcase xPct={75.5} yPct={68} />

      {/* Bookcase 3 — against right wall */}
      <Bookcase xPct={98.5} yPct={50} />

      {/* Small lounge window */}
      <div className="absolute" style={{ left: '87%', width: '7%', top: '1.5%', height: '14%' }} aria-hidden="true">
        <div
          className="relative h-full w-full rounded-t-lg"
          style={{
            background: 'linear-gradient(180deg, #B4D4EC 0%, #C8E4F4 60%, #D8EEF8 100%)',
            border: '2px solid #B0A090',
            boxShadow: 'inset 0 1px 4px rgba(100,140,180,0.2)',
          }}
        >
          <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2" style={{ width: '2px', background: '#B0A090' }} />
          <div className="absolute top-1 left-1 rounded" style={{ width: '22%', height: '35%', background: 'rgba(255,255,255,0.35)' }} />
        </div>
        <div className="w-full" style={{ height: '8%', background: '#C8B8A0', border: '1px solid #A89880' }} />
      </div>

      {/* Coffee machine — top-right corner of lounge */}
      <CoffeeMachine xPct={93} yPct={20} />

      {/* Sofa 1 (upper) — faces down (normal) */}
      <Sofa xPct={84} yPct={43} facing="down" />

      {/* Coffee table — centred between sofas */}
      <CoffeeTable xPct={84} yPct={60} />

      {/* Sofa 2 (lower) — faces up (flipped to face sofa 1) */}
      <Sofa xPct={84} yPct={76} facing="up" />

      {/* Lounge corner plant */}
      <div className="absolute" style={{ left: '74%', bottom: '2%', width: '4.5%' }} aria-hidden="true">
        <svg viewBox="0 0 48 60" width="100%" xmlns="http://www.w3.org/2000/svg">
          <path d="M14,48 L10,60 L38,60 L34,48 Z" fill="#C4855A" stroke="#A86840" strokeWidth={1.2} />
          <rect x={10} y={44} width={28} height={6} rx={3} fill="#D49A6A" stroke="#A86840" strokeWidth={1} />
          <ellipse cx={24} cy={44} rx={13} ry={3.5} fill="#7A5A3A" />
          <path d="M24,44 Q20,34 16,26" stroke="#5A8A50" strokeWidth={2} fill="none" strokeLinecap="round" />
          <path d="M24,44 Q24,32 22,22" stroke="#5A8A50" strokeWidth={2} fill="none" strokeLinecap="round" />
          <path d="M24,44 Q28,34 32,26" stroke="#5A8A50" strokeWidth={2} fill="none" strokeLinecap="round" />
          <ellipse cx={15} cy={24} rx={7} ry={4.5} fill="#6AA860" transform="rotate(-20 15 24)" />
          <ellipse cx={22} cy={19} rx={7} ry={4}   fill="#7ABB6A" transform="rotate(-5 22 19)"  />
          <ellipse cx={32} cy={24} rx={7} ry={4.5} fill="#6AA860" transform="rotate(20 32 24)"  />
        </svg>
      </div>
    </>
  )
}

function Sofa({ xPct, yPct, facing = 'down' }: { xPct: number; yPct: number; facing?: 'down' | 'up' }) {
  const flip = facing === 'up' ? ' scaleY(-1)' : ''
  return (
    <div
      className="absolute"
      style={{ left: `${xPct}%`, top: `${yPct}%`, transform: `translate(-50%, -50%)${flip}`, width: '18%' }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 52" width="100%" xmlns="http://www.w3.org/2000/svg">
        {/* Back cushion */}
        <rect x={2} y={2} width={96} height={15} rx={5} fill="#C4A882" stroke="#A87A58" strokeWidth={1.2} />
        <rect x={4} y={3} width={92} height={5}  rx={3} fill="rgba(255,255,255,0.20)" />
        {/* Armrests */}
        <rect x={2}  y={15} width={11} height={31} rx={4} fill="#BFA078" stroke="#A87A58" strokeWidth={1.2} />
        <rect x={87} y={15} width={11} height={31} rx={4} fill="#BFA078" stroke="#A87A58" strokeWidth={1.2} />
        {/* Seat */}
        <rect x={13} y={17} width={74} height={27} rx={3} fill="#D4B894" stroke="#A87A58" strokeWidth={1} />
        {/* Cushion divider */}
        <line x1={50} y1={17} x2={50} y2={44} stroke="#B89870" strokeWidth={1} opacity={0.35} />
        {/* Seat highlight */}
        <rect x={15} y={19} width={70} height={7} rx={2} fill="rgba(255,255,255,0.14)" />
        {/* Front shadow */}
        <rect x={13} y={40} width={74} height={4} rx={2} fill="#9A7050" opacity={0.22} />
      </svg>
    </div>
  )
}

function CoffeeTable({ xPct, yPct }: { xPct: number; yPct: number }) {
  return (
    <div
      className="absolute"
      style={{ left: `${xPct}%`, top: `${yPct}%`, transform: 'translate(-50%, -50%)', width: '9%' }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 56 28" width="100%" xmlns="http://www.w3.org/2000/svg">
        {/* Table top */}
        <rect x={2} y={4} width={52} height={14} rx={4} fill="#C8A87A" stroke="#A88050" strokeWidth={1} />
        <rect x={4} y={5} width={48} height={5}  rx={2} fill="rgba(255,255,255,0.18)" />
        {/* Mug */}
        <rect x={23} y={6} width={6} height={7} rx={2} fill="#E8A598" opacity={0.75} />
        {/* Legs */}
        <rect x={6}  y={17} width={4} height={8} rx={2} fill="#9A7050" />
        <rect x={46} y={17} width={4} height={8} rx={2} fill="#9A7050" />
      </svg>
    </div>
  )
}

// Tall narrow bookcase (top-down, placed against a wall)
function Bookcase({ xPct, yPct }: { xPct: number; yPct: number }) {
  const bc = BOOK_COLORS
  return (
    <div
      className="absolute"
      style={{ left: `${xPct}%`, top: `${yPct}%`, transform: 'translate(-50%, -50%)', width: '5%' }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 30 60" width="100%" xmlns="http://www.w3.org/2000/svg">
        {/* Case body */}
        <rect x={0} y={0} width={30} height={60} rx={2} fill="#B89A7A" stroke="#8A6A4A" strokeWidth={1} />
        {/* Back panel */}
        <rect x={1.5} y={1.5} width={27} height={57} rx={1.5} fill="#C8A880" />
        {/* Shelf 1 */}
        <rect x={1.5} y={19} width={27} height={2} fill="#9A7A54" />
        {/* Shelf 2 */}
        <rect x={1.5} y={38} width={27} height={2} fill="#9A7A54" />
        {/* Books — row 1 (top) */}
        <rect x={3}  y={3}  width={4} height={15} rx={0.8} fill={bc[0]}  />
        <rect x={8}  y={5}  width={3} height={13} rx={0.8} fill={bc[1]}  />
        <rect x={12} y={4}  width={4} height={14} rx={0.8} fill={bc[2]}  />
        <rect x={17} y={3}  width={3} height={15} rx={0.8} fill={bc[3]}  />
        <rect x={21} y={5}  width={4} height={13} rx={0.8} fill={bc[4]}  />
        {/* Books — row 2 (middle) */}
        <rect x={3}  y={22} width={3} height={15} rx={0.8} fill={bc[5]}  />
        <rect x={7}  y={22} width={4} height={14} rx={0.8} fill={bc[6]}  />
        <rect x={12} y={23} width={3} height={13} rx={0.8} fill={bc[7]}  />
        <rect x={16} y={22} width={4} height={15} rx={0.8} fill={bc[8]}  />
        <rect x={21} y={23} width={4} height={13} rx={0.8} fill={bc[9]}  />
        {/* Books — row 3 (bottom) */}
        <rect x={3}  y={41} width={4} height={16} rx={0.8} fill={bc[10]} />
        <rect x={8}  y={42} width={3} height={15} rx={0.8} fill={bc[11]} />
        <rect x={12} y={41} width={4} height={16} rx={0.8} fill={bc[12]} />
        <rect x={17} y={43} width={3} height={14} rx={0.8} fill={bc[13]} />
        <rect x={21} y={41} width={4} height={16} rx={0.8} fill={bc[14]} />
        {/* Top shadow */}
        <rect x={0} y={0} width={30} height={4} rx={2} fill="rgba(0,0,0,0.08)" />
      </svg>
    </div>
  )
}

// Coffee machine on a small counter
function CoffeeMachine({ xPct, yPct }: { xPct: number; yPct: number }) {
  return (
    <div
      className="absolute"
      style={{ left: `${xPct}%`, top: `${yPct}%`, transform: 'translate(-50%, -50%)', width: '7%' }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 44 38" width="100%" xmlns="http://www.w3.org/2000/svg">
        {/* Counter / base */}
        <rect x={0} y={26} width={44} height={12} rx={2} fill="#C4A882" stroke="#A07850" strokeWidth={1} />
        <rect x={0} y={26} width={44} height={3}  rx={1} fill="rgba(255,255,255,0.15)" />
        {/* Machine body */}
        <rect x={6} y={8} width={22} height={18} rx={3} fill="#4A4A54" stroke="#333340" strokeWidth={1} />
        {/* Highlight */}
        <rect x={8} y={10} width={8} height={6} rx={1.5} fill="rgba(255,255,255,0.10)" />
        {/* Display panel */}
        <rect x={9} y={12} width={6} height={4} rx={1} fill="#5A8A70" opacity={0.8} />
        {/* Drip tray */}
        <rect x={10} y={24} width={14} height={3} rx={1} fill="#666672" />
        {/* Cup */}
        <rect x={29} y={20} width={8} height={7} rx={2} fill="#E8D8C0" stroke="#C0A880" strokeWidth={0.8} />
        <rect x={30} y={21} width={6} height={2} rx={1} fill="rgba(60,30,10,0.35)" />
        {/* Cup handle */}
        <path d="M37,22 Q41,23 41,25 Q41,27 37,27" stroke="#C0A880" strokeWidth={0.8} fill="none" />
        {/* Steam */}
        <path d="M32,19 Q31,16 33,13" stroke="#B0B0B0" strokeWidth={0.8} fill="none" strokeLinecap="round" opacity={0.5} />
        <path d="M35,18 Q34,15 36,12" stroke="#B0B0B0" strokeWidth={0.8} fill="none" strokeLinecap="round" opacity={0.4} />
      </svg>
    </div>
  )
}

// Desk repulsion radii — must be < half the desk spacing so fields don't overlap.
// Desk columns are ~16 % apart, rows ~20 % apart → keep radii well below those.
const CAT_DESK_RX = 7    // half-width  of exclusion ellipse
const CAT_DESK_RY = 7    // half-height of exclusion ellipse

function WalkingCat() {
  const catRef                    = useRef<HTMLDivElement>(null)
  const [isSleeping, setIsSleeping] = useState(false)

  useEffect(() => {
    let x = 85, y = 75          // start in lounge — open space, no desks
    let tx = 80, ty = 80
    const speed     = 0.025
    let pauseFrames = 0
    let sleepFrames = 0
    let frameCount  = 0
    let rafId: number
    let snapX = x, snapY = y, snapTimer = 0

    function nearDesk(px: number, py: number): boolean {
      return DESK_SLOTS.some(d => {
        const nx = (px - d.xPct) / CAT_DESK_RX
        const ny = (py - d.yPct) / CAT_DESK_RY
        return Math.hypot(nx, ny) < 1
      })
    }

    // Zone-based target picker — sends cat to distinct areas of the room
    function pickTarget() {
      let attempts = 0
      const zone = Math.random()
      do {
        if (zone < 0.30) {
          // Lounge (right ¼) — always desk-free
          tx = 75 + Math.random() * 20
          ty = 38 + Math.random() * 52
        } else if (zone < 0.50) {
          // Bottom corridor below the desk rows
          tx = 3  + Math.random() * 68
          ty = 85 + Math.random() * 5
        } else if (zone < 0.65) {
          // Left corridor (before first desk column)
          tx = 3  + Math.random() * 6
          ty = 38 + Math.random() * 52
        } else if (zone < 0.78) {
          // Right corridor (after last desk column, before lounge)
          tx = 63 + Math.random() * 9
          ty = 38 + Math.random() * 52
        } else {
          // Anywhere — long cross-room hop
          tx = 3  + Math.random() * 94
          ty = 38 + Math.random() * 52
        }
        attempts++
      } while (nearDesk(tx, ty) && attempts < 30)

      // On arrival:  35 % sleep · 40 % long pause · 25 % short pause
      const r = Math.random()
      if (r < 0.35) {
        sleepFrames = Math.round((90 + Math.random() * 150) * 60) // 1.5–4 min
        setIsSleeping(true)
      } else if (r < 0.75) {
        pauseFrames = Math.round(180 + Math.random() * 420)       // 3–10 s
      } else {
        pauseFrames = Math.round(40  + Math.random() * 60)        // 0.7–1 s
      }
    }

    function step() {
      frameCount++

      // ── Sleeping ────────────────────────────────────────────────────────────
      if (sleepFrames > 0) {
        sleepFrames--
        if (sleepFrames === 0) {
          setIsSleeping(false)
          // Short groggy pause before moving again
          pauseFrames = Math.round(60 + Math.random() * 120)
        }
        rafId = requestAnimationFrame(step)
        return
      }

      // ── Paused (awake) ──────────────────────────────────────────────────────
      if (pauseFrames > 0) {
        pauseFrames--
        rafId = requestAnimationFrame(step)
        return
      }

      // ── Moving ──────────────────────────────────────────────────────────────
      const dx   = tx - x
      const dy   = ty - y
      const dist = Math.hypot(dx, dy)

      if (dist < 0.8) {
        pickTarget()
        rafId = requestAnimationFrame(step)
        return
      }

      let vx = (dx / dist) * speed
      let vy = (dy / dist) * speed

      for (const d of DESK_SLOTS) {
        const ex    = (x - d.xPct) / CAT_DESK_RX
        const ey    = (y - d.yPct) / CAT_DESK_RY
        const eDist = Math.hypot(ex, ey)
        if (eDist < 1.8) {
          const t        = (1.8 - eDist) / 1.8
          const strength = t * t * speed * 5.0
          const rawDist  = Math.hypot(x - d.xPct, y - d.yPct) || 1
          vx += ((x - d.xPct) / rawDist) * strength
          vy += ((y - d.yPct) / rawDist) * strength
        }
      }

      snapTimer++
      if (snapTimer >= 90) {
        if (Math.hypot(x - snapX, y - snapY) < 1.2) pickTarget()
        snapX = x; snapY = y; snapTimer = 0
      }

      const vLen = Math.hypot(vx, vy)
      if (vLen > 0) {
        x += (vx / vLen) * speed
        y += (vy / vLen) * speed
      }

      x = Math.max(2, Math.min(97, x))
      y = Math.max(36, Math.min(91, y))

      if (catRef.current) {
        const bob = Math.sin(frameCount * 0.18) * 0.5
        catRef.current.style.left      = `${x}%`
        catRef.current.style.top       = `${y + bob}%`
        catRef.current.style.transform = vx >= 0 ? 'scaleX(-1)' : 'scaleX(1)'
      }

      rafId = requestAnimationFrame(step)
    }

    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <div
      ref={catRef}
      aria-hidden="true"
      style={{
        position:      'absolute',
        left:          '85%',
        top:           '75%',
        zIndex:        15,
        pointerEvents: 'none',
        fontSize:      'clamp(14px, 2vw, 22px)',
        lineHeight:    1,
        userSelect:    'none',
      }}
    >
      🐈
      {isSleeping && (
        /* Container anchored above-right of the cat head.
           All three spans share the same origin (bottom:0, left:0) and
           float independently via CSS — classic cartoon Zzz effect. */
        <div
          aria-hidden="true"
          style={{
            position:      'absolute',
            bottom:        '88%',
            left:          '55%',
            width:         '2em',
            height:        '2.2em',
            pointerEvents: 'none',
            userSelect:    'none',
          }}
        >
          <span className="zen-zzz zen-zzz-1">z</span>
          <span className="zen-zzz zen-zzz-2">z</span>
          <span className="zen-zzz zen-zzz-3">Z</span>
        </div>
      )}
    </div>
  )
}

function CornerPlant() {
  return (
    <div className="absolute" style={{ left: '1.5%', bottom: '2%', width: '6%' }} aria-hidden="true">
      <svg viewBox="0 0 48 60" width="100%" xmlns="http://www.w3.org/2000/svg">
        <path d="M14,48 L10,60 L38,60 L34,48 Z" fill="#C4855A" stroke="#A86840" strokeWidth={1.2} />
        <rect x={10} y={44} width={28} height={6} rx={3} fill="#D49A6A" stroke="#A86840" strokeWidth={1} />
        <ellipse cx={24} cy={44} rx={13} ry={3.5} fill="#7A5A3A" />
        <path d="M24,44 Q20,34 16,26" stroke="#5A8A50" strokeWidth={2} fill="none" strokeLinecap="round" />
        <path d="M24,44 Q24,32 22,22" stroke="#5A8A50" strokeWidth={2} fill="none" strokeLinecap="round" />
        <path d="M24,44 Q28,34 32,26" stroke="#5A8A50" strokeWidth={2} fill="none" strokeLinecap="round" />
        <ellipse cx={15} cy={24} rx={7} ry={4.5} fill="#6AA860" transform="rotate(-20 15 24)" />
        <ellipse cx={22} cy={19} rx={7} ry={4}   fill="#7ABB6A" transform="rotate(-5 22 19)"  />
        <ellipse cx={32} cy={24} rx={7} ry={4.5} fill="#6AA860" transform="rotate(20 32 24)"  />
        <line x1={11} y1={26} x2={19} y2={22} stroke="#4A8840" strokeWidth={0.7} opacity={0.6} />
        <line x1={28} y1={26} x2={36} y2={22} stroke="#4A8840" strokeWidth={0.7} opacity={0.6} />
      </svg>
    </div>
  )
}

function FloorLamp({ xPct }: { xPct: number }) {
  return (
    <div
      className="absolute"
      style={{ left: `${xPct}%`, bottom: '2%', width: '3.5%', transform: 'translateX(-50%)' }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 28 70" width="100%" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx={14} cy={66} rx={10} ry={3}  fill="#9A8A78" />
        <rect    x={11}  y={60} width={6}  height={7}  rx={2}   fill="#A89880" />
        <rect    x={12.5} y={16} width={3} height={46} rx={1.5} fill="#B4A490" />
        <path d="M4,16 L8,4 L20,4 L24,16 Z" fill="#F0D890" stroke="#C8B060" strokeWidth={1.2} />
        <path d="M6,15 L9,6 L19,6 L22,15 Z" fill="#F8E8A0" opacity={0.5} />
      </svg>
    </div>
  )
}

// ─── Exports ───────────────────────────────────────────────────────────────────
export { DESK_SLOTS, SOFA_SLOTS }
export type { DeskSlot }

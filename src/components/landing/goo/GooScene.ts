import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/* ────────────────────────────────────────────────────────────────────────
   GooScene — organismo neuronal 3D de la sección «Goo».
   Three.js vanilla: núcleos gelatinosos (esferas con displacement de ruido),
   filamentos = cuerdas Verlet con springs renderizadas como tubos
   Catmull-Rom de radio variable (estrechamiento viscoso al tensarse),
   gotas en los extremos libres, rotura por tensión o barrido rápido y
   reconexión progresiva. El scroll controla el crecimiento global; el
   puntero deforma, agarra, estira y rompe.
   Paleta inyectada desde la landing (crema/coral/tinta): nada de neón.
   ──────────────────────────────────────────────────────────────────────── */

export type GooPalette = {
  bg: string
  primary: string
  deep: string
  blush: string
  light: string
}

export type GooLayoutName = 'desktop' | 'mobile'

type NucleusSpec = {
  pos: [number, number, number]
  radius: number
  reveal: [number, number]
}

type RopeSpec = {
  fromNode: number
  /** destino: índice de núcleo, índice de puerto de tarjeta o punto fijo */
  toNode?: number
  toPort?: number
  toPoint?: [number, number, number]
  segments: number
  radius: number
  reveal: [number, number]
  breakable: boolean
  peripheral?: boolean
}

type LayoutSpec = {
  cameraZ: number
  fov: number
  nuclei: NucleusSpec[]
  ropes: RopeSpec[]
}

const LAYOUTS: Record<GooLayoutName, LayoutSpec> = {
  desktop: {
    cameraZ: 26,
    fov: 35,
    nuclei: [
      { pos: [-4.6, 1.1, 0], radius: 1.35, reveal: [0, 0.12] },
      { pos: [1.7, 2.7, -1.1], radius: 0.8, reveal: [0.24, 0.34] },
      { pos: [-0.4, -2.7, 0.8], radius: 0.75, reveal: [0.44, 0.54] },
    ],
    ropes: [
      { fromNode: 0, toNode: 1, segments: 10, radius: 0.3, reveal: [0.08, 0.28], breakable: true },
      { fromNode: 1, toPort: 0, segments: 10, radius: 0.27, reveal: [0.28, 0.46], breakable: true },
      { fromNode: 0, toNode: 2, segments: 10, radius: 0.28, reveal: [0.3, 0.48], breakable: true },
      { fromNode: 2, toPort: 2, segments: 10, radius: 0.26, reveal: [0.5, 0.68], breakable: true },
      { fromNode: 0, toPort: 1, segments: 14, radius: 0.3, reveal: [0.55, 0.75], breakable: true },
      { fromNode: 0, toPoint: [-9.5, 5.5, -3.5], segments: 8, radius: 0.16, reveal: [0.66, 0.84], breakable: false, peripheral: true },
      { fromNode: 1, toPoint: [8.5, 6, -4.5], segments: 8, radius: 0.15, reveal: [0.7, 0.88], breakable: false, peripheral: true },
      { fromNode: 2, toPoint: [4.5, -6.5, -3], segments: 8, radius: 0.15, reveal: [0.74, 0.92], breakable: false, peripheral: true },
      { fromNode: 0, toPoint: [-8, -4.5, -4], segments: 8, radius: 0.14, reveal: [0.78, 0.95], breakable: false, peripheral: true },
    ],
  },
  mobile: {
    cameraZ: 30,
    fov: 42,
    nuclei: [
      { pos: [0, 8, 0], radius: 1.1, reveal: [0, 0.12] },
      { pos: [-2.6, 3.4, -0.8], radius: 0.65, reveal: [0.22, 0.32] },
      { pos: [3.7, -0.6, 0.6], radius: 0.6, reveal: [0.42, 0.52] },
    ],
    ropes: [
      { fromNode: 0, toNode: 1, segments: 8, radius: 0.26, reveal: [0.08, 0.26], breakable: true },
      { fromNode: 1, toPort: 0, segments: 8, radius: 0.23, reveal: [0.26, 0.44], breakable: true },
      { fromNode: 0, toNode: 2, segments: 8, radius: 0.24, reveal: [0.3, 0.48], breakable: true },
      { fromNode: 2, toPort: 1, segments: 8, radius: 0.22, reveal: [0.46, 0.62], breakable: true },
      { fromNode: 2, toPort: 2, segments: 9, radius: 0.22, reveal: [0.58, 0.74], breakable: true },
      { fromNode: 0, toPoint: [-5, 11, -3], segments: 6, radius: 0.12, reveal: [0.7, 0.88], breakable: false, peripheral: true },
      { fromNode: 2, toPoint: [5.5, -11, -3.5], segments: 6, radius: 0.12, reveal: [0.76, 0.94], breakable: false, peripheral: true },
    ],
  },
}

const TUBE_SAMPLES = 32
const TUBE_RADIAL = 10
const THREAD_SAMPLES = 12

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const smooth = (t: number) => t * t * (3 - 2 * t)

/* ─── Textura granular procedural (citoplasma tipo histología) ─────────── */

function makeGranuleTexture(base: string, granule: string, dark: string) {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.fillStyle = base
  g.fillRect(0, 0, size, size)
  // moteado suave de fondo
  for (let i = 0; i < 46; i++) {
    g.globalAlpha = 0.06 + Math.random() * 0.09
    g.fillStyle = Math.random() < 0.5 ? granule : '#FFFFFF'
    g.beginPath()
    g.arc(Math.random() * size, Math.random() * size, 10 + Math.random() * 26, 0, Math.PI * 2)
    g.fill()
  }
  // gránulos densos (zimógeno)
  for (let i = 0; i < 950; i++) {
    g.globalAlpha = 0.14 + Math.random() * 0.26
    g.fillStyle = Math.random() < 0.82 ? granule : dark
    g.beginPath()
    g.arc(Math.random() * size, Math.random() * size, 0.6 + Math.random() * 1.9, 0, Math.PI * 2)
    g.fill()
  }
  // motas claras dispersas
  for (let i = 0; i < 220; i++) {
    g.globalAlpha = Math.random() * 0.22
    g.fillStyle = '#FFFFFF'
    g.beginPath()
    g.arc(Math.random() * size, Math.random() * size, 0.5 + Math.random() * 1.2, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/* ─── Tubo deformable con buffers reutilizados ─────────────────────────── */

class Tube {
  mesh: THREE.Mesh
  private geo: THREE.BufferGeometry
  private pos: Float32Array
  private nor: Float32Array
  private samples: number
  private radial: number
  private curve = new THREE.CatmullRomCurve3([], false, 'catmullrom', 0.5)
  private sampled: THREE.Vector3[] = []
  private tangent = new THREE.Vector3()
  private normal = new THREE.Vector3()
  private binormal = new THREE.Vector3()
  private tmp = new THREE.Vector3()

  constructor(material: THREE.Material, samples = TUBE_SAMPLES, radial = TUBE_RADIAL) {
    this.samples = samples
    this.radial = radial
    const vcount = (samples + 1) * radial
    this.pos = new Float32Array(vcount * 3)
    this.nor = new Float32Array(vcount * 3)
    const index: number[] = []
    for (let s = 0; s < samples; s++) {
      for (let r = 0; r < radial; r++) {
        const a = s * radial + r
        const b = s * radial + ((r + 1) % radial)
        const c = (s + 1) * radial + r
        const d = (s + 1) * radial + ((r + 1) % radial)
        index.push(a, c, b, b, c, d)
      }
    }
    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    this.geo.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3))
    // UVs estáticos: u alrededor del tubo, v a lo largo (tileado)
    const uv = new Float32Array(vcount * 2)
    for (let i = 0; i <= samples; i++) {
      for (let r = 0; r < radial; r++) {
        const vi = (i * radial + r) * 2
        uv[vi] = r / radial
        uv[vi + 1] = (i / samples) * 2.5
      }
    }
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    this.geo.setIndex(index)
    for (let i = 0; i <= samples; i++) this.sampled.push(new THREE.Vector3())
    this.mesh = new THREE.Mesh(this.geo, material)
    this.mesh.frustumCulled = false
  }

  update(points: THREE.Vector3[], radiusAt: (t: number) => number) {
    if (points.length < 2) {
      this.mesh.visible = false
      return
    }
    this.mesh.visible = true
    this.curve.points = points
    const S = this.samples
    for (let i = 0; i <= S; i++) this.curve.getPoint(i / S, this.sampled[i])

    // Marcos por transporte paralelo para evitar giros bruscos del tubo
    this.tangent.subVectors(this.sampled[1], this.sampled[0]).normalize()
    this.normal.set(-this.tangent.y, this.tangent.x, 0)
    if (this.normal.lengthSq() < 1e-4) this.normal.set(1, 0, 0)
    this.normal.normalize()

    for (let i = 0; i <= S; i++) {
      const p = this.sampled[i]
      if (i > 0) {
        const prev = this.sampled[i - 1]
        const next = this.sampled[Math.min(S, i + 1)]
        this.tangent.subVectors(next, prev).normalize()
        // proyecta la normal anterior al plano perpendicular al nuevo tangente
        this.tmp.copy(this.tangent).multiplyScalar(this.normal.dot(this.tangent))
        this.normal.sub(this.tmp)
        if (this.normal.lengthSq() < 1e-6) this.normal.set(-this.tangent.y, this.tangent.x, 0.01)
        this.normal.normalize()
      }
      this.binormal.crossVectors(this.tangent, this.normal)
      const radius = Math.max(0.001, radiusAt(i / S))
      for (let r = 0; r < this.radial; r++) {
        const ang = (r / this.radial) * Math.PI * 2
        const cos = Math.cos(ang)
        const sin = Math.sin(ang)
        const nx = this.normal.x * cos + this.binormal.x * sin
        const ny = this.normal.y * cos + this.binormal.y * sin
        const nz = this.normal.z * cos + this.binormal.z * sin
        const vi = (i * this.radial + r) * 3
        this.pos[vi] = p.x + nx * radius
        this.pos[vi + 1] = p.y + ny * radius
        this.pos[vi + 2] = p.z + nz * radius
        this.nor[vi] = nx
        this.nor[vi + 1] = ny
        this.nor[vi + 2] = nz
      }
    }
    ;(this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(this.geo.attributes.normal as THREE.BufferAttribute).needsUpdate = true
  }

  dispose() {
    this.geo.dispose()
  }
}

/* ─── Punto físico Verlet ──────────────────────────────────────────────── */

type RopeState = 'intact' | 'broken' | 'seeking' | 'joining'

class Rope {
  spec: RopeSpec
  pts: THREE.Vector3[] = []
  prev: THREE.Vector3[] = []
  rest: number
  grown = 0
  state: RopeState = 'intact'
  brokenSeg = -1
  timer = 0
  delay = 0
  joinDur = 0
  joinStartDist = 0
  phase = Math.random() * Math.PI * 2
  tubeA: Tube
  tubeB: Tube
  thread: Tube
  dropA: THREE.Mesh
  dropB: THREE.Mesh
  dropTip: THREE.Mesh

  constructor(spec: RopeSpec, tubeMat: THREE.Material, dropGeo: THREE.SphereGeometry, dropMat: THREE.Material) {
    this.spec = spec
    const n = spec.segments + 1
    for (let i = 0; i < n; i++) {
      this.pts.push(new THREE.Vector3())
      this.prev.push(new THREE.Vector3())
    }
    this.rest = 1
    this.tubeA = new Tube(tubeMat)
    this.tubeB = new Tube(tubeMat)
    this.thread = new Tube(tubeMat, THREAD_SAMPLES, 7)
    this.dropA = new THREE.Mesh(dropGeo, dropMat)
    this.dropB = new THREE.Mesh(dropGeo, dropMat)
    this.dropTip = new THREE.Mesh(dropGeo, dropMat)
    this.dropA.visible = this.dropB.visible = this.dropTip.visible = false
  }

  addTo(group: THREE.Group) {
    group.add(this.tubeA.mesh, this.tubeB.mesh, this.thread.mesh, this.dropA, this.dropB, this.dropTip)
  }

  dispose() {
    this.tubeA.dispose()
    this.tubeB.dispose()
    this.thread.dispose()
  }
}

/* ─── Núcleo gelatinoso ────────────────────────────────────────────────── */

class Nucleus {
  spec: NucleusSpec
  mesh: THREE.Mesh
  base: Float32Array
  pos: THREE.Vector3
  reveal = 0
  phase = Math.random() * Math.PI * 2

  constructor(spec: NucleusSpec, material: THREE.Material) {
    this.spec = spec
    this.pos = new THREE.Vector3(...spec.pos)
    const geo = new THREE.SphereGeometry(1, 36, 24)
    this.base = (geo.attributes.position.array as Float32Array).slice()
    this.mesh = new THREE.Mesh(geo, material)
    this.mesh.position.copy(this.pos)
    this.mesh.frustumCulled = false
  }

  deform(time: number, pointer: THREE.Vector3 | null, pointerStrength: number, amp: number) {
    const attr = this.mesh.geometry.attributes.position as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    const t = time + this.phase
    let bx = 0
    let by = 0
    let bz = 0
    let bump = 0
    if (pointer && pointerStrength > 0.001) {
      const dx = pointer.x - this.pos.x
      const dy = pointer.y - this.pos.y
      const d = Math.sqrt(dx * dx + dy * dy)
      const w = clamp(1 - d / (this.spec.radius * 3.2), 0, 1)
      if (w > 0 && d > 1e-4) {
        bx = dx / d
        by = dy / d
        bz = 0
        bump = w * pointerStrength
      }
    }
    for (let i = 0; i < this.base.length; i += 3) {
      const x = this.base[i]
      const y = this.base[i + 1]
      const z = this.base[i + 2]
      let d =
        1 +
        amp *
          (0.55 * Math.sin(2.6 * x + t * 0.9) * Math.sin(2.2 * y - t * 0.7) +
            0.45 * Math.sin(3.1 * z + 1.7 * y + t * 1.15))
      if (bump > 0) {
        const facing = x * bx + y * by + z * bz
        if (facing > 0) d -= 0.4 * bump * facing * facing * facing
      }
      arr[i] = x * d
      arr[i + 1] = y * d
      arr[i + 2] = z * d
    }
    attr.needsUpdate = true
    this.mesh.geometry.computeVertexNormals()
  }

  dispose() {
    this.mesh.geometry.dispose()
  }
}

/* ─── Escena ───────────────────────────────────────────────────────────── */

export type GooSceneOptions = {
  canvas: HTMLCanvasElement
  host: HTMLElement
  layout: GooLayoutName
  palette: GooPalette
  reducedMotion: boolean
  onCardTug?: (card: number, dx: number, dy: number) => void
  /** progreso suavizado, emitido solo cuando cambia: para estilos scroll-linked en el DOM */
  onProgress?: (p: number) => void
}

export class GooScene {
  private opts: GooSceneOptions
  private layout: LayoutSpec
  private renderer!: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera!: THREE.PerspectiveCamera
  private group = new THREE.Group()
  private nuclei: Nucleus[] = []
  private ropes: Rope[] = []
  private materials: THREE.Material[] = []
  private geometries: THREE.BufferGeometry[] = []
  private textures: THREE.Texture[] = []
  private pmrem?: THREE.PMREMGenerator
  private envTarget?: THREE.WebGLRenderTarget

  private raf = 0
  private running = false
  private disposed = false
  private lastT = 0
  private time = 0
  private frameEMA = 16
  private lowTier = false

  private targetProgress = 0
  private progress = 0
  private lastEmittedProgress = -1

  private portsRel: { x: number; y: number; inx: number }[] = []
  /** punto de contacto visible (borde de la tarjeta) */
  private portWorld: THREE.Vector3[] = []
  /** punto final real: tras el borde y en profundidad, oculto por la tarjeta HTML */
  private portInner: THREE.Vector3[] = []

  private pointerNDC = new THREE.Vector2(10, 10)
  private pointerWorld = new THREE.Vector3()
  private pointerPrevWorld = new THREE.Vector3()
  private pointerSpeed = 0
  private pointerActive = false
  private pointerWasActive = false
  private grabbed: { rope: Rope; idx: number } | null = null
  private camBase = new THREE.Vector3()

  private tmpV = new THREE.Vector3()
  private tmpV2 = new THREE.Vector3()
  private tmpV3 = new THREE.Vector3()

  private removeListeners: (() => void)[] = []

  constructor(opts: GooSceneOptions) {
    this.opts = opts
    this.layout = LAYOUTS[opts.layout]

    this.renderer = new THREE.WebGLRenderer({
      canvas: opts.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    const { palette } = opts
    this.scene.fog = new THREE.Fog(new THREE.Color(palette.bg), this.layout.cameraZ - 4, this.layout.cameraZ + 18)

    this.camera = new THREE.PerspectiveCamera(this.layout.fov, 1, 0.1, 80)
    this.camera.position.set(0, 0, this.layout.cameraZ)
    this.camBase.copy(this.camera.position)

    // Entorno suave para reflejos gelatinosos, sin texturas externas
    this.pmrem = new THREE.PMREMGenerator(this.renderer)
    this.envTarget = this.pmrem.fromScene(new RoomEnvironment(), 0.05)
    this.scene.environment = this.envTarget.texture

    const hemi = new THREE.HemisphereLight(new THREE.Color(palette.light), new THREE.Color(palette.blush), 0.9)
    const key = new THREE.DirectionalLight(new THREE.Color(palette.light), 1.4)
    key.position.set(6, 8, 10)
    const fill = new THREE.PointLight(new THREE.Color(palette.primary), 30, 40)
    fill.position.set(-8, -4, 6)
    this.scene.add(hemi, key, fill)

    // Texturas granulares derivadas de la paleta (citoplasma H&E).
    // Las bases mantienen el coral original: el material es blanco y el mapa aporta el color.
    const ropeBase = new THREE.Color(palette.primary).lerp(new THREE.Color(palette.deep), 0.35)
    const darkDot = '#8C5F56'
    const nucleusTex = makeGranuleTexture(palette.primary, palette.deep, darkDot)
    const ropeTex = makeGranuleTexture('#' + ropeBase.getHexString(), palette.deep, darkDot)
    this.textures.push(nucleusTex, ropeTex)

    const nucleusMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: nucleusTex,
      bumpMap: nucleusTex,
      bumpScale: 0.35,
      roughness: 0.38,
      metalness: 0,
      clearcoat: 0.55,
      clearcoatRoughness: 0.35,
      envMapIntensity: 0.5,
      emissive: new THREE.Color(palette.deep),
      emissiveIntensity: 0.06,
    })
    const ropeMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: ropeTex,
      bumpMap: ropeTex,
      bumpScale: 0.25,
      roughness: 0.42,
      metalness: 0,
      clearcoat: 0.45,
      clearcoatRoughness: 0.4,
      envMapIntensity: 0.42,
      emissive: new THREE.Color(palette.deep),
      emissiveIntensity: 0.04,
    })
    const periMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.primary).lerp(new THREE.Color(palette.bg), 0.45),
      roughness: 0.6,
      metalness: 0,
      transparent: true,
      opacity: 0.65,
      envMapIntensity: 0.2,
    })
    this.materials.push(nucleusMat, ropeMat, periMat)

    const dropGeo = new THREE.SphereGeometry(1, 18, 14)
    this.geometries.push(dropGeo)

    for (const spec of this.layout.nuclei) {
      const n = new Nucleus(spec, nucleusMat)
      this.nuclei.push(n)
      this.group.add(n.mesh)
    }
    for (const spec of this.layout.ropes) {
      const rope = new Rope(spec, spec.peripheral ? periMat : ropeMat, dropGeo, spec.peripheral ? periMat : nucleusMat)
      this.initRopePoints(rope)
      rope.addTo(this.group)
      this.ropes.push(rope)
    }
    this.scene.add(this.group)

    this.bindPointer()
    this.resize()
  }

  /* ── API pública ── */

  setProgress(p: number) {
    this.targetProgress = clamp(p, 0, 1)
  }

  /** Estado interno para depuración/tests (no usar en producción) */
  debugState() {
    return {
      progress: this.progress,
      grabbed: this.grabbed ? this.ropes.indexOf(this.grabbed.rope) : -1,
      ropes: this.ropes.map((r) => ({ state: r.state, grown: +r.grown.toFixed(2) })),
    }
  }

  setPortsRel(rels: { x: number; y: number; inx: number }[]) {
    this.portsRel = rels
    this.updatePortWorld()
  }

  setRunning(run: boolean) {
    if (this.disposed) return
    if (run && !this.running) {
      this.running = true
      this.lastT = performance.now()
      this.raf = requestAnimationFrame(this.loop)
    } else if (!run && this.running) {
      this.running = false
      cancelAnimationFrame(this.raf)
    }
  }

  resize() {
    const w = this.opts.host.clientWidth
    const h = this.opts.host.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.updatePortWorld()
  }

  dispose() {
    this.disposed = true
    this.setRunning(false)
    this.removeListeners.forEach((fn) => fn())
    this.ropes.forEach((r) => r.dispose())
    this.nuclei.forEach((n) => n.dispose())
    this.materials.forEach((m) => m.dispose())
    this.geometries.forEach((g) => g.dispose())
    this.textures.forEach((t) => t.dispose())
    this.envTarget?.dispose()
    this.pmrem?.dispose()
    this.renderer.dispose()
  }

  /* ── Geometría auxiliar ── */

  private worldFromNDC(nx: number, ny: number, z = 0, out = new THREE.Vector3()) {
    out.set(nx, ny, 0.5).unproject(this.camera)
    out.sub(this.camera.position).normalize()
    const t = (z - this.camera.position.z) / out.z
    return out.multiplyScalar(t).add(this.camera.position)
  }

  private updatePortWorld() {
    this.portWorld = this.portsRel.map((r) =>
      this.worldFromNDC(r.x * 2 - 1, -(r.y * 2 - 1), 0),
    )
    // el extremo real entra bajo la tarjeta y se hunde en z: el corte queda oculto
    this.portInner = this.portWorld.map((p, i) => {
      const inner = p.clone()
      inner.x += this.portsRel[i].inx * 0.7
      inner.z = -0.4
      return inner
    })
  }

  private ropeTarget(rope: Rope, out: THREE.Vector3) {
    const s = rope.spec
    if (s.toNode !== undefined) {
      // entra por detrás del cuerpo celular para ocultar la unión
      out.copy(this.nuclei[s.toNode].pos)
      out.z -= this.nuclei[s.toNode].spec.radius * 0.55
    } else if (s.toPort !== undefined && this.portInner[s.toPort]) {
      out.copy(this.portInner[s.toPort])
    } else if (s.toPoint) {
      out.set(...s.toPoint)
    } else {
      out.set(0, 0, 0)
    }
    return out
  }

  private initRopePoints(rope: Rope) {
    const from = this.nuclei[rope.spec.fromNode].pos
    const to = this.ropeTarget(rope, this.tmpV)
    const n = rope.pts.length
    for (let i = 0; i < n; i++) {
      rope.pts[i].lerpVectors(from, to, i / (n - 1))
      rope.prev[i].copy(rope.pts[i])
    }
    rope.rest = from.distanceTo(to) / (n - 1)
  }

  /* ── Puntero ── */

  private bindPointer() {
    const host = this.opts.host
    const toNDC = (clientX: number, clientY: number) => {
      const rect = this.opts.canvas.getBoundingClientRect()
      this.pointerNDC.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -(((clientY - rect.top) / rect.height) * 2 - 1),
      )
    }

    const findGrab = () => this.findGrabCandidate()

    const onMove = (e: PointerEvent) => {
      toNDC(e.clientX, e.clientY)
      this.pointerActive = true
      // agarre "al vuelo": botón pulsado pasando despacio sobre un filamento
      if (!this.grabbed && e.isPrimary && (e.buttons & 1) === 1 && this.pointerSpeed < 15) {
        const hit = findGrab()
        if (hit) {
          this.grabbed = hit
          host.style.cursor = 'grabbing'
          host.style.userSelect = 'none'
        }
      }
    }
    const onDown = (e: PointerEvent) => {
      toNDC(e.clientX, e.clientY)
      this.pointerActive = true
      const hit = findGrab()
      if (hit) {
        this.grabbed = hit
        host.style.cursor = 'grabbing'
        // evita que el arrastre seleccione texto de la página
        e.preventDefault()
        host.style.userSelect = 'none'
        host.setPointerCapture?.(e.pointerId)
      }
    }
    const onUp = (e: PointerEvent) => {
      this.grabbed = null
      host.style.cursor = ''
      host.style.userSelect = ''
      host.releasePointerCapture?.(e.pointerId)
    }
    const onLeave = () => {
      this.pointerActive = false
      this.grabbed = null
      host.style.cursor = ''
      host.style.userSelect = ''
    }
    // En táctil: solo bloquea el scroll si el gesto empieza sobre un filamento
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      toNDC(t.clientX, t.clientY)
      this.pointerActive = true
      const hit = findGrab()
      if (hit) {
        this.grabbed = hit
        e.preventDefault()
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      toNDC(t.clientX, t.clientY)
      if (this.grabbed) e.preventDefault()
    }
    const onTouchEnd = () => {
      this.grabbed = null
      this.pointerActive = false
    }

    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerdown', onDown)
    host.addEventListener('pointerup', onUp)
    host.addEventListener('pointerleave', onLeave)
    host.addEventListener('touchstart', onTouchStart, { passive: false })
    host.addEventListener('touchmove', onTouchMove, { passive: false })
    host.addEventListener('touchend', onTouchEnd)
    this.removeListeners.push(() => {
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerdown', onDown)
      host.removeEventListener('pointerup', onUp)
      host.removeEventListener('pointerleave', onLeave)
      host.removeEventListener('touchstart', onTouchStart)
      host.removeEventListener('touchmove', onTouchMove)
      host.removeEventListener('touchend', onTouchEnd)
    })
  }

  private findGrabCandidate() {
    if (this.opts.reducedMotion) return null
    this.worldFromNDC(this.pointerNDC.x, this.pointerNDC.y, 0, this.pointerWorld)
    let best: { rope: Rope; idx: number; d: number } | null = null
    for (const rope of this.ropes) {
      if (rope.grown < 0.85 || rope.spec.peripheral) continue
      for (let i = 1; i < rope.pts.length - 1; i++) {
        const dx = rope.pts[i].x - this.pointerWorld.x
        const dy = rope.pts[i].y - this.pointerWorld.y
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < 1.8 && (!best || d < best.d)) best = { rope, idx: i, d }
      }
    }
    return best
  }

  /* ── Simulación ── */

  private frameCount = 0

  private loop = (now: number) => {
    if (!this.running || this.disposed) return
    const dtMs = clamp(now - this.lastT, 4, 40)
    this.lastT = now
    this.frameEMA = this.frameEMA * 0.95 + dtMs * 0.05
    if (!this.lowTier && this.frameEMA > 27) {
      this.lowTier = true
      this.renderer.setPixelRatio(1)
    }
    const dt = dtMs / 1000
    this.time += dt

    // Suaviza el scrub del scroll para que la reversa no produzca saltos
    // (con movimiento reducido, sin animación: estado final directo)
    if (this.opts.reducedMotion) {
      this.progress = this.targetProgress
    } else {
      this.progress += (this.targetProgress - this.progress) * clamp(dt * 7, 0, 1)
    }
    if (Math.abs(this.progress - this.lastEmittedProgress) > 0.0015) {
      this.lastEmittedProgress = this.progress
      this.opts.onProgress?.(this.progress)
    }

    this.worldFromNDC(this.pointerNDC.x, this.pointerNDC.y, 0, this.pointerWorld)
    // el primer frame activo no tiene velocidad: evita falsos swipe-break al entrar
    if (this.pointerActive && !this.pointerWasActive) this.pointerPrevWorld.copy(this.pointerWorld)
    this.pointerWasActive = this.pointerActive
    this.pointerSpeed = this.pointerWorld.distanceTo(this.pointerPrevWorld) / Math.max(dt, 1e-3)

    this.stepPhysics(dt)
    this.updateVisuals()

    // affordance: cursor "grab" al sobrevolar un filamento agarrable
    this.frameCount++
    if (!this.grabbed && this.pointerActive && this.frameCount % 8 === 0) {
      this.opts.host.style.cursor = this.findGrabCandidate() ? 'grab' : ''
    }

    this.pointerPrevWorld.copy(this.pointerWorld)

    // Cámara con parallax mínimo (solo con puntero real dentro de la sección)
    const usePointer = this.pointerActive && !this.opts.reducedMotion
    const px = usePointer ? clamp(this.pointerNDC.x, -1, 1) : 0
    const py = usePointer ? clamp(this.pointerNDC.y, -1, 1) : 0
    this.camera.position.x += (this.camBase.x + px * 0.5 - this.camera.position.x) * clamp(dt * 2.5, 0, 1)
    this.camera.position.y += (this.camBase.y + py * 0.35 + (this.progress - 0.5) * -0.6 - this.camera.position.y) * clamp(dt * 2.5, 0, 1)
    this.camera.lookAt(0, 0, 0)
    this.camera.updateMatrixWorld()
    // los puertos siguen a la cámara para que el tubo quede pegado a la tarjeta
    this.updatePortWorld()

    this.renderer.render(this.scene, this.camera)
    this.raf = requestAnimationFrame(this.loop)
  }

  private reveal(range: [number, number]) {
    return smooth(clamp((this.progress - range[0]) / (range[1] - range[0]), 0, 1))
  }

  private stepPhysics(dt: number) {
    const reduced = this.opts.reducedMotion
    const ambient = reduced ? 0 : 1

    for (const n of this.nuclei) n.reveal = this.reveal(n.spec.reveal)

    for (const rope of this.ropes) {
      rope.grown = this.reveal(rope.spec.reveal)
      if (rope.grown <= 0.01) continue
      const n = rope.pts.length
      const from = this.nuclei[rope.spec.fromNode].pos
      const target = this.ropeTarget(rope, this.tmpV3)
      // el extremo lejano avanza con el crecimiento (tentáculo que crece)
      const tip = this.tmpV2.lerpVectors(from, target, rope.grown)
      rope.rest = (from.distanceTo(tip) / (n - 1)) * 1.02

      // fuerzas + integración Verlet
      for (let i = 1; i < n - 1; i++) {
        const p = rope.pts[i]
        const pr = rope.prev[i]
        let ax = ambient * 0.5 * Math.sin(0.8 * p.x + this.time * 0.6 + i + rope.phase)
        let ay = ambient * 0.5 * Math.sin(0.7 * p.y - this.time * 0.5 + i * 1.3 + rope.phase)
        let az = ambient * 0.3 * Math.sin(0.9 * p.z + this.time * 0.4 + i * 0.7)
        if (this.pointerActive && !reduced) {
          const dx = p.x - this.pointerWorld.x
          const dy = p.y - this.pointerWorld.y
          const d = Math.sqrt(dx * dx + dy * dy)
          const R = 2.4
          if (d < R && d > 1e-4) {
            const w = (1 - d / R) * (1 - d / R)
            const f = 22 * w
            ax += (dx / d) * f
            ay += (dy / d) * f
          }
        }
        // atracción de extremos libres buscándose
        if ((rope.state === 'seeking' || rope.state === 'joining') && (i === rope.brokenSeg || i === rope.brokenSeg + 1)) {
          const other = rope.pts[i === rope.brokenSeg ? rope.brokenSeg + 1 : rope.brokenSeg]
          const k = rope.state === 'joining' ? 26 : 10
          ax += (other.x - p.x) * k + Math.sin(this.time * 6 + rope.phase) * 1.2
          ay += (other.y - p.y) * k + Math.cos(this.time * 5 + rope.phase) * 1.2
          az += (other.z - p.z) * k
        }
        const vx = (p.x - pr.x) * 0.985
        const vy = (p.y - pr.y) * 0.985
        const vz = (p.z - pr.z) * 0.985
        pr.copy(p)
        p.x += vx + ax * dt * dt * 60
        p.y += vy + ay * dt * dt * 60
        p.z += vz + az * dt * dt * 60
      }

      // anclaje de origen: el tentáculo nace por DETRÁS del cuerpo celular,
      // así el arranque del tubo queda oculto tras la esfera
      const fromNuc = this.nuclei[rope.spec.fromNode]
      const nr = fromNuc.spec.radius * Math.max(fromNuc.reveal, 0.001)
      const dir0 = this.tmpV.subVectors(rope.pts[1], from)
      dir0.z = 0
      const l0 = dir0.length() || 1
      dir0.multiplyScalar(1 / l0)
      rope.pts[0].set(
        from.x + dir0.x * nr * 0.3,
        from.y + dir0.y * nr * 0.3,
        from.z - nr * 0.85,
      )
      rope.prev[0].copy(rope.pts[0])
      rope.pts[n - 1].copy(tip)
      rope.prev[n - 1].copy(rope.pts[n - 1])

      // punto agarrado
      if (this.grabbed?.rope === rope) {
        const gi = this.grabbed.idx
        const restPos = this.tmpV.lerpVectors(from, tip, gi / (n - 1))
        const maxD = rope.rest * (n - 1) * 0.9
        const target2 = this.tmpV2.copy(this.pointerWorld)
        const off = target2.sub(restPos)
        if (off.length() > maxD) off.setLength(maxD)
        rope.pts[gi].copy(restPos).add(off)
        rope.prev[gi].copy(rope.pts[gi])
      }

      // constraints
      const iterations = 4
      for (let it = 0; it < iterations; it++) {
        for (let i = 0; i < n - 1; i++) {
          if (rope.state !== 'intact' && i === rope.brokenSeg) {
            if (rope.state !== 'joining') continue
            // al reunirse, la distancia de reposo se contrae progresivamente
            const jr = clamp(rope.timer / rope.joinDur, 0, 1)
            const rest = rope.joinStartDist * (1 - jr) + rope.rest * jr
            this.solveConstraint(rope, i, rest)
            continue
          }
          this.solveConstraint(rope, i, rope.rest)
        }
      }

      // rotura por tensión (solo cuerdas completas y rompibles)
      if (rope.spec.breakable && rope.state === 'intact' && rope.grown > 0.99 && !reduced) {
        let worst = -1
        let worstS = 0
        for (let i = 1; i < n - 2; i++) {
          const s = rope.pts[i].distanceTo(rope.pts[i + 1]) / rope.rest
          if (s > worstS) {
            worstS = s
            worst = i
          }
        }
        const swipe = this.pointerActive && !this.grabbed && this.pointerSpeed > 30
        if (worstS > 2.0) {
          this.breakRope(rope, worst)
        } else if (swipe) {
          for (let i = 1; i < n - 2; i++) {
            const dx = rope.pts[i].x - this.pointerWorld.x
            const dy = rope.pts[i].y - this.pointerWorld.y
            if (dx * dx + dy * dy < 0.36) {
              this.breakRope(rope, clamp(i, 2, n - 4))
              break
            }
          }
        }
      }

      // máquina de estados de reconexión
      if (rope.state !== 'intact') {
        rope.timer += dt
        const a = rope.pts[rope.brokenSeg]
        const b = rope.pts[rope.brokenSeg + 1]
        if (rope.state === 'broken' && rope.timer > rope.delay) {
          rope.state = 'seeking'
        } else if (rope.state === 'seeking' && a.distanceTo(b) < rope.rest * 2.2) {
          rope.state = 'joining'
          rope.timer = 0
          rope.joinDur = 0.55 + Math.random() * 0.35
          rope.joinStartDist = a.distanceTo(b)
        } else if (rope.state === 'joining' && rope.timer >= rope.joinDur) {
          rope.state = 'intact'
          rope.brokenSeg = -1
        }
      }
    }
  }

  private solveConstraint(rope: Rope, i: number, rest: number) {
    const a = rope.pts[i]
    const b = rope.pts[i + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dz = b.z - a.z
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6
    const diff = (d - rest) / d
    const n = rope.pts.length
    const aPinned = i === 0 || (this.grabbed?.rope === rope && this.grabbed.idx === i)
    const bPinned = i + 1 === n - 1 || (this.grabbed?.rope === rope && this.grabbed.idx === i + 1)
    const wa = aPinned ? 0 : bPinned ? 1 : 0.5
    const wb = bPinned ? 0 : aPinned ? 1 : 0.5
    a.x += dx * diff * wa
    a.y += dy * diff * wa
    a.z += dz * diff * wa
    b.x -= dx * diff * wb
    b.y -= dy * diff * wb
    b.z -= dz * diff * wb
  }

  private breakRope(rope: Rope, seg: number) {
    rope.state = 'broken'
    rope.brokenSeg = seg
    rope.timer = 0
    rope.delay = 0.9 + Math.random() * 0.8
    // retroceso elástico de ambos extremos
    const a = rope.pts[seg]
    const b = rope.pts[seg + 1]
    const dir = this.tmpV.subVectors(b, a).normalize()
    rope.prev[seg].copy(a).addScaledVector(dir, 0.3)
    rope.prev[seg + 1].copy(b).addScaledVector(dir, -0.3)
    if (this.grabbed?.rope === rope) this.grabbed = null
  }

  /* ── Render de tubos, gotas y núcleos ── */

  private updateVisuals() {
    const reduced = this.opts.reducedMotion
    for (const nuc of this.nuclei) {
      const visible = nuc.reveal > 0.01
      nuc.mesh.visible = visible
      if (!visible) continue
      const breath = reduced ? 1 : 1 + 0.035 * Math.sin(this.time * 1.3 + nuc.phase)
      nuc.mesh.scale.setScalar(nuc.spec.radius * nuc.reveal * breath)
      const strength = this.pointerActive && !reduced ? 0.8 : 0
      nuc.deform(this.time, this.pointerActive ? this.pointerWorld : null, strength, reduced ? 0 : 0.11)
    }

    for (const rope of this.ropes) {
      const visible = rope.grown > 0.02
      rope.tubeA.mesh.visible = visible
      rope.tubeB.mesh.visible = false
      rope.thread.mesh.visible = false
      rope.dropA.visible = rope.dropB.visible = false
      rope.dropTip.visible = false
      if (!visible) {
        rope.tubeA.mesh.visible = false
        continue
      }
      const n = rope.pts.length
      const baseR = rope.spec.radius * (0.35 + 0.65 * rope.grown)
      const pulseT = reduced ? -1 : (this.time * 0.22 + rope.phase) % 1.3

      // estrechamiento por tensión de cada tramo
      const stretch: number[] = []
      for (let i = 0; i < n - 1; i++) {
        stretch.push(rope.pts[i].distanceTo(rope.pts[i + 1]) / rope.rest)
      }
      const radiusAt = (t: number, offset = 0, count = n - 1) => {
        const seg = clamp(Math.floor(offset + t * count), 0, n - 2)
        const tg = (offset + t * count) / (n - 1)
        const s = stretch[seg]
        const thin = clamp(1 / Math.pow(Math.max(s, 1), 1.3), 0.3, 1.12)
        const pulse = pulseT >= 0 ? 1 + 0.16 * Math.exp(-Math.pow((t - pulseT) * 6, 2)) : 1
        const taperEnd = rope.spec.peripheral ? 1 - smooth(clamp((t - 0.55) / 0.45, 0, 1)) * 0.9 : 1
        // el tubo se acampana al fundirse con el borde de la tarjeta
        const flare =
          rope.spec.toPort !== undefined
            ? 1 + smooth(clamp((tg - 0.8) / 0.2, 0, 1)) * smooth(clamp((rope.grown - 0.85) / 0.15, 0, 1))
            : 1
        return baseR * thin * pulse * taperEnd * flare
      }

      if (rope.state === 'intact') {
        rope.tubeA.update(rope.pts, (t) => radiusAt(t))
      } else {
        const segsA = rope.brokenSeg + 1
        const a = rope.pts.slice(0, segsA)
        const b = rope.pts.slice(segsA)
        rope.tubeA.update(a, (t) => radiusAt(t, 0, segsA - 1) * (1 - 0.5 * Math.pow(t, 3)))
        rope.tubeB.mesh.visible = b.length > 1
        if (b.length > 1) rope.tubeB.update(b, (t) => radiusAt(t, segsA, n - 1 - segsA) * (0.5 + 0.5 * Math.pow(t, 0.6)))
        // gotas viscosas en los extremos libres
        const endA = rope.pts[rope.brokenSeg]
        const endB = rope.pts[rope.brokenSeg + 1]
        rope.dropA.visible = rope.dropB.visible = true
        const wob = reduced ? 1 : 1 + 0.12 * Math.sin(this.time * 7 + rope.phase)
        rope.dropA.position.copy(endA)
        rope.dropA.scale.setScalar(baseR * 1.35 * wob)
        rope.dropB.position.copy(endB)
        rope.dropB.scale.setScalar(baseR * 1.3 * (2 - wob))
        // hilo fino que se vuelve a formar
        if (rope.state === 'joining') {
          const jr = clamp(rope.timer / rope.joinDur, 0, 1)
          rope.thread.mesh.visible = true
          rope.thread.update([endA, this.tmpV.lerpVectors(endA, endB, 0.5).add(this.tmpV2.set(0, Math.sin(this.time * 9) * 0.08, 0)), endB], () => baseR * (0.12 + 0.88 * jr))
        }
      }

      // gota en la punta mientras la rama crece hacia su destino
      if (rope.grown > 0.03 && rope.grown < 0.995) {
        rope.dropTip.visible = true
        rope.dropTip.position.copy(rope.pts[n - 1])
        rope.dropTip.scale.setScalar(baseR * 1.45)
      } else if (rope.spec.toPort !== undefined && rope.grown >= 0.995 && this.portWorld[rope.spec.toPort]) {
        // ventosa aplastada contra el borde: funde tubo y tarjeta sin corte
        const pad = this.portWorld[rope.spec.toPort]
        const wob = reduced ? 1 : 1 + 0.06 * Math.sin(this.time * 2.2 + rope.phase)
        rope.dropTip.visible = true
        rope.dropTip.position.set(pad.x, pad.y, -0.1)
        rope.dropTip.scale.set(baseR * 1.8 * wob, baseR * 1.8 * wob, baseR * 0.9)
      }

      // tirón transmitido a la tarjeta conectada
      if (rope.spec.toPort !== undefined && this.opts.onCardTug && rope.grown > 0.99) {
        const e = Math.max(0, stretch[n - 2] - 1)
        const dirx = rope.pts[n - 2].x - rope.pts[n - 1].x
        const diry = rope.pts[n - 2].y - rope.pts[n - 1].y
        const l = Math.sqrt(dirx * dirx + diry * diry) || 1
        const k = clamp(e * 10, 0, 8)
        this.opts.onCardTug(rope.spec.toPort, (dirx / l) * k, (-diry / l) * k)
      }
    }
  }
}

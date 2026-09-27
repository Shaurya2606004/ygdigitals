import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MeshTransmissionMaterial, Text } from '@react-three/drei'
import { AmazonBox, BLACK, Clapper, FeedPhone, FlipkartBag, InstaCube, MIST, Phone, RED_DEEP, displayFont } from './clay'
import { Buddy } from './character'
import { REDUCED, TOUCH, aim, clamp01, elasticOut } from '../lib/motion'

/* Block-letter headline: stacked troika layers fake a chunky extrusion; each line is scaled to fit `width`. */
function FitLine({ text, width, y, onHeight, layers = 8 }) {
  const g = useRef()
  const bounds = useRef(null)
  const apply = () => {
    const b = bounds.current
    if (!b || !g.current) return
    const s = width / (b[2] - b[0])
    g.current.scale.setScalar(s)
    onHeight((b[3] - b[1]) * s)
  }
  useEffect(apply, [width])
  return (
    <group ref={g} position-y={y} scale={0.0001}>
      {Array.from({ length: layers }, (_, i) => {
        const d = layers - 1 - i // 0 = front face
        return (
          <Text
            key={d}
            font={displayFont}
            fontSize={1}
            letterSpacing={-0.03}
            lineHeight={1}
            anchorX="center"
            anchorY="top"
            position={[d * 0.008, -d * 0.0095, -d * 0.02]}
            color={d === 0 ? BLACK : d === 1 ? '#3a3a3a' : RED_DEEP}
            onSync={
              d === 0
                ? (mesh) => {
                    bounds.current = mesh.textRenderInfo.blockBounds
                    apply()
                  }
                : undefined
            }
          >
            {text}
          </Text>
        )
      })}
    </group>
  )
}

/* Anything that pops in after the loader, bobs, and explodes outward on scroll. */
// fly = [how far it spreads sideways, how far it rushes the camera] by the end of the hero scroll
function Pop({ readyAt, sp, delay = 0, position, rotation = [0, 0, 0], scale = 1, fly = [1.8, 4], children }) {
  const g = useRef()
  const seed = useMemo(() => Math.random() * 100, [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const k = readyAt.current == null ? 0 : elasticOut((t - readyAt.current - delay) / 1.2)
    const p = sp.current
    const out = 1 + p * fly[0]
    const bob = REDUCED ? 0 : Math.sin(t * 0.9 + seed) * 0.12
    g.current.position.set(position[0] * out, position[1] * out + bob, position[2] + p * fly[1])
    const wob = REDUCED ? 0 : 1
    const a = aim(state)
    g.current.rotation.set(
      rotation[0] + wob * Math.sin(t * 0.5 + seed) * 0.15 + p * 2 - a.y * 0.2,
      rotation[1] + wob * Math.sin(t * 0.4 + seed) * 0.3 + a.x * 0.35,
      rotation[2] + p * 1.5,
    )
    g.current.scale.setScalar(Math.max(1e-4, k * scale))
  })
  return <group ref={g}>{children}</group>
}

/*
 * The cursor lens: real refraction of the scene, jelly-stretches along its velocity.
 * Touch screens have no hover, so it sweeps a slow figure-eight over the headline (where the refraction reads best)
 * and springs to wherever a finger lands or slides, drifting back once the finger lifts.
 */
function Lens({ radius, sp, wander }) {
  const m = useRef()
  const st = useRef({ x: 0, y: 0, px: 9, py: 9, last: -9 })
  useFrame((state, dt) => {
    dt = Math.max(dt, 1e-3)
    const cam = state.camera
    const dist = 5
    const hh = Math.tan((cam.fov * Math.PI) / 360) * dist
    const hw = hh * (state.size.width / state.size.height)
    const s = st.current
    const t = state.clock.elapsedTime
    if (state.pointer.x !== s.px || state.pointer.y !== s.py) {
      s.px = state.pointer.x
      s.py = state.pointer.y
      s.last = t
    }
    let tx = s.px * hw
    let ty = s.py * hh
    if (TOUCH && t - s.last > 1.8) {
      tx = Math.sin(t * 0.42) * wander.ax * hw
      ty = (wander.y + Math.sin(t * 0.84 + 1) * wander.ay) * hh
    }
    const k = 1 - Math.exp(-dt * (TOUCH ? 4 : 10))
    const nx = s.x + (tx - s.x) * k
    const ny = s.y + (ty - s.y) * k
    const vx = (nx - s.x) / dt
    const vy = (ny - s.y) / dt
    s.x = nx
    s.y = ny
    const speed = REDUCED ? 0 : Math.min(Math.hypot(vx, vy) * 0.05, 0.4)
    const fade = 1 - clamp01((sp.current - 0.35) / 0.3)
    const r = radius * Math.max(1e-4, fade)
    m.current.position.set(nx, ny, cam.position.z - dist)
    m.current.rotation.set(0, 0, Math.atan2(vy, vx))
    m.current.scale.set(r * (1 + speed), r * (1 - speed * 0.5), r * 0.42)
  })
  return (
    <mesh ref={m} raycast={() => null}>
      <sphereGeometry args={[1, 64, 64]} />
      <MeshTransmissionMaterial
        samples={TOUCH ? 4 : 8}
        resolution={TOUCH ? 512 : 1024}
        transmission={1}
        thickness={1.4}
        roughness={0.06}
        ior={1.28}
        chromaticAberration={0.09}
        anisotropicBlur={0.25}
        distortion={0.35}
        distortionScale={0.4}
        temporalDistortion={0.08}
        clearcoat={1}
        attenuationDistance={2}
        attenuationColor="#ffffff"
        color="#ffffff"
      />
    </mesh>
  )
}

// the brands the studio works on: an Instagram post on the phone, the Instagram cube, the Flipkart bag, the Amazon box — plus the video clapper
const DESKTOP = [
  { el: <Phone />, p: [-0.8, 0.24, 0.8], r: [0.1, 0.45, 0.2], s: 0.62, d: 0.1 },
  { el: <InstaCube />, p: [-0.72, -0.52, 0.6], r: [0.3, 0.6, -0.15], s: 0.5, d: 0.25 },
  { el: <FlipkartBag />, p: [0.82, 0.26, -0.6], r: [0.15, -0.5, -0.1], s: 0.76, d: 0.2 },
  { el: <AmazonBox />, p: [0.76, -0.32, 1.0], r: [0.3, -0.45, 0.05], s: 0.5, d: 0.3 },
  { el: <Clapper />, p: [0.02, 0.72, -1.8], r: [0.2, -0.3, 0.2], s: 0.5, d: 0.35 },
]

// a soft oval of shade on the floor under the phone and the two of them
let shadeMap
function getShadeMap() {
  if (shadeMap) return shadeMap
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(0,0,0,0.2)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 64, 64)
  return (shadeMap = new THREE.CanvasTexture(c))
}

const LINES_WIDE = [
  { t: 'STOP', f: 1 },
  { t: 'THE SCROLL.', f: 1 },
]
const LINES_PORTRAIT = [
  { t: 'STOP', f: 1 },
  { t: 'THE', f: 0.52 },
  { t: 'SCROLL.', f: 1 },
]

export default function HeroScene({ ready, progress, onReady }) {
  const { viewport, size, clock, camera } = useThree()
  const portrait = size.width / size.height < 0.85
  const vw = viewport.width
  const vh = viewport.height
  // phones: the layout fills the band between the kicker and the call button, measured in units of `u`.
  // Their room follows .hero-ui's CSS: the gutter, plus a taller button row and the scroll hint above 640px.
  const px = vh / size.height
  const gutter = Math.min(56, Math.max(16, size.width * 0.04))
  const narrow = size.width <= 640
  const bandTop = vh / 2 - (gutter + (narrow ? 102 : 110)) * px
  const bandBottom = -vh / 2 + (gutter + (narrow ? 72 : 100)) * px
  const mid = (bandTop + bandBottom) / 2
  const u = Math.min(vw / 2.75, (bandTop - bandBottom) / 4.1)
  const width = portrait ? Math.min(u * 2.15, vw * 0.92) : Math.min(vw * 0.45, 6.2)
  const lines = portrait ? LINES_PORTRAIT : LINES_WIDE
  const [h, setH] = useState({})
  const readyAt = useRef(null)
  const sp = useRef(0)
  const text = useRef()
  const stage = useRef()
  const reported = useRef(false)

  useEffect(() => {
    if (ready && readyAt.current == null) readyAt.current = clock.elapsedTime
  }, [ready, clock])


  const gap = width * 0.03
  // stack lines top-down; each FitLine reports its scaled height once troika has laid it out
  let cursor = 0
  const ys = lines.map((l) => {
    const y = cursor
    cursor -= (h[l.t] || 0) + gap
    return y
  })
  const total = -cursor - gap
  const textY = portrait ? mid + u * 2 - total / 2 : vh * 0.04
  // the middle of the short "THE" line: the Instagram slab and the Flipkart bag fill the gaps either side of it
  const theY = textY + total / 2 + ys[1] - (h.THE || 0) / 2

  const framesSinceSync = useRef(0)
  useFrame((state, dt) => {
    // ready = headline laid out AND real frames on screen (frames only start once the shaders are compiled)
    if (!reported.current && lines.every((l) => h[l.t]) && ++framesSinceSync.current === 2) {
      reported.current = true
      onReady()
    }
    sp.current += (progress.current - sp.current) * (1 - Math.exp(-dt * 6))
    const p = sp.current
    const since = readyAt.current == null ? null : state.clock.elapsedTime - readyAt.current
    const k = since == null ? 0 : elasticOut(since / 1.4)
    const g = text.current
    g.scale.setScalar(Math.max(1e-4, k))
    const a = REDUCED ? { x: 0, y: 0 } : aim(state)
    g.position.set(0, textY + p * vh * 0.12, -p * (portrait ? 3 : 5))
    g.rotation.set(-p * 0.6 - a.y * 0.05, a.x * 0.1, 0)
    // the phone pops a beat after the headline, then leaves with it
    if (portrait) {
      const s = stage.current
      s.scale.setScalar(Math.max(1e-4, since == null ? 0 : elasticOut((since - 0.12) / 1.4)))
      s.position.set(0, mid + p * vh * 0.12, -p * 3)
      s.rotation.set(-p * 0.6 - a.y * 0.05, a.x * 0.1, 0)
    }
    camera.position.z = 10 - p * 1.5
  })

  const items = portrait
    ? [
        { el: <InstaCube />, p: [-u * 0.8, theY, 0.4], r: [0.3, 0.6, -0.15], s: u * 0.4, d: 0.25 },
        { el: <FlipkartBag />, p: [u * 0.8, theY, 0.2], r: [0.15, -0.5, -0.1], s: u * 0.3, d: 0.2 },
        { el: <AmazonBox />, p: [-u * 0.97, mid - u * 0.08, 0.4], r: [0.3, 0.45, 0.05], s: u * 0.26, d: 0.3 },
      ]
    : DESKTOP.map((it) => ({ ...it, p: [it.p[0] * vw * 0.5, it.p[1] * vh * 0.5, it.p[2]] }))
  // on a narrow screen a sideways burst leaves it empty at once, so props swell toward the camera and rush past instead
  const fly = portrait ? [0.9, 6.5] : undefined
  return (
    <>
      <color attach="background" args={[MIST]} />
      <group ref={text}>
        <group position-y={total / 2}>
          {lines.map((l, i) => (
            <FitLine key={l.t} text={l.t} width={width * l.f} y={ys[i]} onHeight={(v) => setH((o) => (o[l.t] === v ? o : { ...o, [l.t]: v }))} />
          ))}
        </group>
        {/* she peeks over the top of STOP, he waves from the bottom corner */}
        {!portrait && (
          <>
            <Buddy look="girl" outfit="white" seed={2} position={[width * 0.3, total / 2 - width * 0.045, -0.6]} scale={width * 0.1} rotation={[0, -0.25, 0]} />
            <Buddy look="guy" outfit="black" seed={5} wave position={[-width * 0.5, -total / 2 - width * 0.02, 0.8]} scale={width * 0.06} rotation={[0, 0.4, 0]} />
          </>
        )}
      </group>
      {/* phones: under the headline, the phone with its feed stopping on our post, the two of them either side on a patch of shade */}
      {portrait && (
        <group ref={stage}>
          <group position={[0, -u * 0.72, -0.6]} rotation={[0.06, -0.18, 0.03]} scale={u * 1.19}>
            <FeedPhone readyAt={readyAt} />
          </group>
          <Buddy look="guy" outfit="black" seed={5} wave position={[-u * 0.8, -u * 1.267, 0.4]} scale={u * 0.58} rotation={[0, 0.35, 0]} />
          <Buddy look="girl" outfit="white" seed={2} position={[u * 0.82, -u * 1.303, 0.2]} scale={u * 0.55} rotation={[0, -0.35, 0]} />
          <mesh position={[0, -u * 1.99, -0.9]} scale={[u * 2.9, u * 0.34, 1]}>
            <planeGeometry />
            <meshBasicMaterial map={getShadeMap()} transparent depthWrite={false} />
          </mesh>
        </group>
      )}
      {items.map((it, i) => (
        <Pop key={i + (portrait ? 'p' : 'd')} readyAt={readyAt} sp={sp} fly={fly} delay={it.d} position={it.p} rotation={it.r} scale={it.s}>
          {it.el}
        </Pop>
      ))}
      {/* the cursor lens is a desktop thing: on a phone it only wandered over the headline */}
      {!portrait && <Lens radius={0.2} sp={sp} wander={{ y: textY / (vh / 2), ax: (width / vw) * 0.75, ay: (total / vh) * 0.7 }} />}
    </>
  )
}

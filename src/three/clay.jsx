import * as THREE from 'three'
import { Component, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer, RoundedBox, Text } from '@react-three/drei'
import displayFont from '@fontsource/unbounded/files/unbounded-latin-800-normal.woff?url'
import { REDUCED, TOUCH, aim, spring } from '../lib/motion'

export { displayFont }
export const RED = '#e04c5c'
export const RED_DEEP = '#a92a39'
export const WHITE = '#ffffff'
export const BLACK = '#161616'
export const TONE = { red: RED, white: WHITE, black: BLACK }

/* ---------- material + geometry ---------- */

export function Clay({ color, ...props }) {
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={0.72}
      sheen={0.5}
      sheenRoughness={0.8}
      sheenColor="#ffffff"
      clearcoat={0.06}
      clearcoatRoughness={0.7}
      {...props}
    />
  )
}

// Hand-pressed look: wobble each vertex along its direction with cheap trig noise.
function lumpy(geo, amt, seed) {
  const p = geo.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const n = Math.sin(v.x * 5.1 + seed) * Math.sin(v.y * 4.3 + seed * 1.7) * Math.sin(v.z * 5.7 + seed * 2.3)
    v.multiplyScalar(1 + n * amt)
    p.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
  return geo
}

const useLumpySphere = (r, amt = 0.04, seed = 1, seg = 56) =>
  useMemo(() => lumpy(new THREE.SphereGeometry(r, seg, seg), amt, seed), [r, amt, seed, seg])

let heartGeo
function getHeart() {
  if (heartGeo) return heartGeo
  const s = new THREE.Shape()
  s.moveTo(5, 5)
  s.bezierCurveTo(5, 5, 4, 0, 0, 0)
  s.bezierCurveTo(-6, 0, -6, 7, -6, 7)
  s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19)
  s.bezierCurveTo(12, 15.4, 16, 11, 16, 7)
  s.bezierCurveTo(16, 7, 16, 0, 10, 0)
  s.bezierCurveTo(7, 0, 5, 5, 5, 5)
  heartGeo = new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: true, bevelSize: 2, bevelThickness: 2.4, bevelSegments: 8, curveSegments: 28 })
  heartGeo.center()
  heartGeo.rotateZ(Math.PI)
  heartGeo.scale(0.05, 0.05, 0.05)
  return heartGeo
}

export function Heart({ color = RED, ...props }) {
  return (
    <mesh geometry={getHeart()} {...props}>
      <Clay color={color} />
    </mesh>
  )
}

const Rb = ({ color, args, radius = 0.08, ...props }) => (
  <RoundedBox args={args} radius={radius} smoothness={5} {...props}>
    <Clay color={color} />
  </RoundedBox>
)

const Ball = ({ color, r, ...props }) => (
  <mesh {...props}>
    <sphereGeometry args={[r, 24, 24]} />
    <Clay color={color} />
  </mesh>
)

/* ---------- the mascot ---------- */

// 3D hovers can't reach the DOM cursor via pointerover, so they announce themselves.
const cursorLabel = (label) => window.dispatchEvent(new CustomEvent('cursor-label', { detail: label }))

const LIMB = { [WHITE]: BLACK, [BLACK]: WHITE, [RED]: BLACK, [RED_DEEP]: WHITE }

export function ClayBuddy({ color = RED, seed = 1, wave = false, hop = 0, children, ...props }) {
  const body = useLumpySphere(1, 0.035, seed, 64)
  const limb = LIMB[color] ?? BLACK
  const inner = useRef()
  const bodyRef = useRef()
  const armL = useRef()
  const armR = useRef()
  const eyes = useRef()
  const pupils = [useRef(), useRef()]
  const jump = useRef({ x: 0, v: 0 })

  const doJump = () => {
    jump.current.v = 9
  }
  useEffect(() => {
    if (hop) doJump()
  }, [hop])

  useFrame((state, dt) => {
    dt = Math.min(dt, 1 / 30)
    const t = state.clock.elapsedTime + seed * 7
    const j = jump.current
    spring(j, 0, dt, 90, 7)
    const b = REDUCED ? 0 : Math.sin(t * 3.2)
    // squash & stretch: idle breathing + jump
    const stretch = b * 0.045 + j.x * 0.12
    bodyRef.current.scale.set(1 - stretch * 0.6, 1.05 + stretch, 0.95 - stretch * 0.6)
    inner.current.position.y = Math.max(0, j.x) * 0.5 + (REDUCED ? 0 : Math.abs(Math.sin(t * 1.6)) * 0.06)
    // arms
    armL.current.rotation.z = -0.25 - (REDUCED ? 0 : Math.sin(t * 2) * 0.12) - j.x * 0.4
    armR.current.rotation.z = wave && !REDUCED ? 2.3 + Math.sin(t * 9) * 0.45 : 0.25 + Math.sin(t * 2) * 0.12 + j.x * 0.4
    // blink every ~4s
    const blink = (t % 4.3) < 0.13 ? 0.12 : 1
    eyes.current.scale.y = blink
    // pupils look at the pointer (or follow the phone's tilt)
    const a = aim(state)
    for (const p of pupils) {
      p.current.position.x = a.x * 0.07
      p.current.position.y = a.y * 0.07
    }
  })

  return (
    <group {...props}>
      <group
        ref={inner}
        onClick={(e) => {
          e.stopPropagation()
          doJump()
        }}
        onPointerOver={() => cursorLabel('Poke')}
        onPointerOut={() => cursorLabel(null)}
      >
        <mesh ref={bodyRef} geometry={body}>
          <Clay color={color} />
        </mesh>
        <group ref={eyes} position={[0, 0.3, 0]}>
          {[-1, 1].map((s, i) => (
            <group key={s} position={[s * 0.33, 0, 0.84]}>
              <Ball color={WHITE} r={0.23} scale={[1, 1.12, 0.7]} />
              <group ref={pupils[i]}>
                <Ball color={BLACK} r={0.11} position={[0, 0, 0.14]} />
                <Ball color={WHITE} r={0.035} position={[0.04, 0.05, 0.24]} />
              </group>
            </group>
          ))}
        </group>
        {/* smile */}
        <mesh position={[0, 0.0, 0.97]} rotation={[0.35, 0, Math.PI]}>
          <torusGeometry args={[0.17, 0.045, 12, 24, Math.PI]} />
          <Clay color={limb} />
        </mesh>
        {/* cheeks */}
        {[-1, 1].map((s) => (
          <Ball key={s} color={color === RED ? '#f28a95' : RED} r={0.1} scale={[1, 0.6, 0.4]} position={[s * 0.55, 0.02, 0.8]} />
        ))}
        {/* arms pivot at the shoulder */}
        <group ref={armL} position={[-0.88, 0.05, 0]}>
          <mesh position={[0, -0.32, 0]}>
            <capsuleGeometry args={[0.13, 0.42, 8, 16]} />
            <Clay color={limb} />
          </mesh>
        </group>
        <group ref={armR} position={[0.88, 0.05, 0]}>
          <mesh position={[0, -0.32, 0]}>
            <capsuleGeometry args={[0.13, 0.42, 8, 16]} />
            <Clay color={limb} />
          </mesh>
        </group>
        {children}
      </group>
      {[-1, 1].map((s) => (
        <Ball key={s} color={limb} r={0.26} scale={[1, 0.55, 1.35]} position={[s * 0.4, -1.02, 0.15]} />
      ))}
    </group>
  )
}

/* ---------- service props ---------- */

export function Phone({ body = BLACK, screen = WHITE, accent = RED }) {
  return (
    <group>
      <Rb color={body} args={[1.1, 2.1, 0.22]} radius={0.15} />
      <Rb color={screen} args={[0.94, 1.86, 0.05]} radius={0.1} position={[0, 0, 0.1]} />
      <Rb color={body} args={[0.3, 0.07, 0.04]} radius={0.03} position={[0, 0.84, 0.14]} />
      <Rb color={accent} args={[0.78, 0.8, 0.05]} radius={0.06} position={[0, 0.3, 0.13]} />
      <Heart color={WHITE} scale={0.3} position={[0, 0.3, 0.2]} />
      <Rb color={body} args={[0.62, 0.09, 0.04]} radius={0.04} position={[-0.07, -0.3, 0.14]} />
      <Rb color={body} args={[0.42, 0.09, 0.04]} radius={0.04} position={[-0.17, -0.45, 0.14]} />
      <Rb color={accent} args={[0.78, 0.2, 0.06]} radius={0.09} position={[0, -0.7, 0.14]} />
    </group>
  )
}

export function Bag({ body = RED, trim = WHITE }) {
  return (
    <group>
      <Rb color={body} args={[1.3, 1.45, 0.62]} radius={0.12} />
      <mesh position={[0, 0.72, 0]}>
        <torusGeometry args={[0.34, 0.07, 16, 36, Math.PI]} />
        <Clay color={trim} />
      </mesh>
      <Text font={displayFont} fontSize={0.62} position={[0, -0.02, 0.32]} color={trim} anchorX="center" anchorY="middle">
        %
      </Text>
    </group>
  )
}

export function Box({ body = RED, tape = BLACK, label = WHITE }) {
  return (
    <group>
      <Rb color={body} args={[1.4, 1.1, 1.4]} radius={0.08} />
      <Rb color={tape} args={[0.3, 1.13, 1.43]} radius={0.03} />
      <Rb color={tape} args={[1.43, 1.13, 0.3]} radius={0.03} />
      <Rb color={label} args={[0.4, 0.26, 0.03]} radius={0.03} position={[0.42, -0.24, 0.71]} />
      {/* bow */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.2, 0.66, 0]} rotation={[Math.PI / 2, s * 0.5, 0]} scale={[1, 1, 0.6]}>
          <torusGeometry args={[0.18, 0.07, 12, 24]} />
          <Clay color={tape} />
        </mesh>
      ))}
    </group>
  )
}

export function Browser({ frame = WHITE, bar = BLACK, accent = RED }) {
  return (
    <group>
      <Rb color={frame} args={[2.1, 1.5, 0.16]} radius={0.1} />
      <Rb color={bar} args={[2.1, 0.3, 0.18]} radius={0.08} position={[0, 0.6, 0.01]} />
      {[-0.85, -0.7, -0.55].map((x, i) => (
        <Ball key={x} color={i === 0 ? accent : frame} r={0.05} position={[x, 0.6, 0.11]} />
      ))}
      <Rb color={accent} args={[0.85, 0.62, 0.06]} radius={0.06} position={[-0.47, 0.02, 0.1]} />
      <Rb color={bar} args={[0.72, 0.1, 0.05]} radius={0.045} position={[0.46, 0.2, 0.1]} />
      <Rb color={bar} args={[0.56, 0.1, 0.05]} radius={0.045} position={[0.38, 0.04, 0.1]} />
      <Rb color={accent} args={[0.42, 0.17, 0.07]} radius={0.08} position={[0.31, -0.18, 0.1]} />
      <Rb color={bar} args={[1.8, 0.14, 0.05]} radius={0.06} position={[0, -0.5, 0.1]} />
    </group>
  )
}

export function Clapper({ body = RED, a = WHITE, b = BLACK }) {
  const arm = useRef()
  useFrame(({ clock }) => {
    if (REDUCED) return
    const c = clock.elapsedTime % 2.2
    arm.current.rotation.z = c < 1.5 ? 0.5 * Math.min(1, c / 0.4) : c < 1.6 ? 0.5 * (1 - (c - 1.5) / 0.1) : 0
  })
  const stripes = (y) => [0, 1, 2, 3, 4].map((i) => <Rb key={i} color={i % 2 ? b : a} args={[0.34, 0.22, 0.2]} radius={0.03} position={[-0.68 + i * 0.34, y, 0]} />)
  return (
    <group>
      <Rb color={body} args={[1.7, 1.15, 0.2]} radius={0.08} position={[0, -0.12, 0]} />
      {stripes(0.56)}
      <group ref={arm} position={[-0.85, 0.72, 0]} rotation-z={0.5}>
        <group position={[0.85, 0.08, 0]}>{stripes(0)}</group>
      </group>
      <group position={[0.05, -0.15, 0.11]} rotation-z={Math.PI / 2}>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.28, 0.28, 0.1, 3]} />
          <Clay color={a} />
        </mesh>
      </group>
    </group>
  )
}

export const SERVICE_PROPS = {
  ads: <Phone />,
  ecom: <Bag />,
  pack: <Box />,
  web: <Browser />,
  video: <Clapper />,
}

/* ---------- canvas shell ---------- */

function ClayLights() {
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 6, 6]} intensity={2.1} />
      <directionalLight position={[-6, -2, 3]} intensity={0.5} color="#ffd9dd" />
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={2.5} position={[0, 5, 5]} scale={[10, 3, 1]} />
        <Lightformer form="ring" intensity={1.5} position={[-5, 1, 3]} scale={3} />
        <Lightformer form="rect" intensity={1} position={[5, -1, -3]} scale={[4, 6, 1]} />
      </Environment>
    </>
  )
}

// Renders only while on screen; WebGL failure falls back to `fallback` instead of crashing the page.
export class SafeGL extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}

export function Stage({ children, className, camera = { position: [0, 0, 10], fov: 30 }, eventSource, ...rest }) {
  const wrap = useRef()
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '120px' })
    io.observe(wrap.current)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={wrap} className={className}>
      <Canvas
        flat
        frameloop={visible ? 'always' : 'never'}
        dpr={[1, TOUCH ? 1.5 : 2]}
        camera={camera}
        eventSource={eventSource}
        eventPrefix={eventSource ? 'client' : 'offset'}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        {...rest}
      >
        <ClayLights />
        {children}
      </Canvas>
    </div>
  )
}

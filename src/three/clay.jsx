import * as THREE from 'three'
import { Component, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { PerformanceMonitor, RoundedBox, Text } from '@react-three/drei'
import displayFont from '@fontsource/unbounded/files/unbounded-latin-800-normal.woff?url'
import envAtlas from './studio-env.png'
import { REDUCED, TOUCH } from '../lib/motion'

export { displayFont }
export const RED = '#e04c5c'
export const RED_DEEP = '#a92a39'
export const WHITE = '#ffffff'
export const BLACK = '#161616'
export const MIST = '#f2f1ee' // the light backdrop behind the 3D (hero, contact)

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

// a tube along a smooth path whose thickness follows taper(0..1): hair clumps, brows, mouth, cords
export function strand(pts, r, taper = (u) => Math.sin(Math.PI * u) ** 0.5, segs = 28, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)))
  const g = new THREE.TubeGeometry(curve, segs, r, radial, false)
  const pos = g.attributes.position
  const P = new THREE.Vector3()
  const V = new THREE.Vector3()
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, P)
    const k = Math.max(0.04, taper(i / segs))
    for (let j = 0; j <= radial; j++) {
      const n = i * (radial + 1) + j
      V.fromBufferAttribute(pos, n).sub(P).multiplyScalar(k).add(P)
      pos.setXYZ(n, V.x, V.y, V.z)
    }
  }
  g.computeVertexNormals()
  return g
}


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

// gentle independent float, so a group of props doesn't move as one rigid block
function Bob({ phase = 0, children, ...props }) {
  const g = useRef()
  useFrame(({ clock }) => {
    if (REDUCED) return
    const t = clock.elapsedTime + phase
    g.current.position.y = Math.sin(t * 1.3) * 0.05
    g.current.rotation.z = Math.sin(t * 0.9) * 0.05
  })
  return (
    <group {...props}>
      <group ref={g}>{children}</group>
    </group>
  )
}

/* ---------- service props ---------- */

// Meta's infinity mark: one closed loop that rises into two arches and crosses itself low in the middle
let metaGeo
function getMeta() {
  if (metaGeo) return metaGeo
  const half = [[0.2, 0.3], [0.42, 0.5], [0.64, 0.48], [0.82, 0.25], [0.86, -0.08], [0.74, -0.36], [0.5, -0.42], [0.25, -0.24]]
  const pts = [
    [0, 0, 0.08],
    ...half.map(([x, y], i) => [x, y, 0.06 - i * 0.015]),
    [0, 0, -0.08],
    ...half.map(([x, y], i) => [-x, y, -0.06 + i * 0.015]),
  ].map((p) => new THREE.Vector3(...p))
  metaGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'centripetal'), 220, 0.1, 16, true)
  return metaGeo
}

export function MetaLogo({ color = '#0866ff', ...props }) {
  return (
    <mesh geometry={getMeta()} {...props}>
      <Clay color={color} roughness={0.45} sheen={0.15} clearcoat={0.4} />
    </mesh>
  )
}

export function Phone({ body = BLACK, screen = WHITE, accent = RED }) {
  return (
    <group>
      <Rb color={body} args={[1.1, 2.1, 0.22]} radius={0.15} />
      <Rb color={screen} args={[0.94, 1.86, 0.05]} radius={0.1} position={[0, 0, 0.1]} />
      <Rb color={body} args={[0.3, 0.07, 0.04]} radius={0.03} position={[0, 0.84, 0.14]} />
      {/* a Meta ad: the post, two lines of copy, the CTA */}
      <Rb color="#e9f0ff" args={[0.78, 0.8, 0.05]} radius={0.06} position={[0, 0.3, 0.13]} />
      <MetaLogo scale={0.36} position={[0, 0.3, 0.2]} />
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

/* marketplace stand-ins: an Amazon shipping box, the Flipkart bag and Walmart's spark */
let smileGeo
const getSmile = () => (smileGeo ??= strand([[-0.4, 0, 0], [-0.12, -0.15, 0], [0.18, -0.13, 0], [0.38, -0.02, 0]], 0.045, (u) => 0.45 + 0.55 * Math.sin(Math.PI * u), 40, 12))

export function AmazonBox() {
  return (
    <group>
      <Rb color="#c9965e" args={[1.5, 1.0, 1.1]} radius={0.06} />
      <Rb color="#b3814b" args={[0.3, 0.03, 1.12]} radius={0.012} position={[0, 0.5, 0]} />
      <Text font={displayFont} fontSize={0.2} letterSpacing={-0.04} position={[0, 0.12, 0.56]} color={BLACK} anchorX="center" anchorY="middle">
        amazon
      </Text>
      <group position={[0.02, -0.02, 0.57]}>
        <mesh geometry={getSmile()}>
          <Clay color="#ff9900" />
        </mesh>
        <mesh position={[0.4, 0.02, 0]} rotation-z={-0.95}>
          <coneGeometry args={[0.075, 0.15, 20]} />
          <Clay color="#ff9900" />
        </mesh>
      </group>
    </group>
  )
}

// italic slant for the "f", which the display font doesn't have
const SLANT = new THREE.Matrix4().makeShear(0, 0, 0.22, 0, 0, 0)

export function FlipkartBag() {
  return (
    <group>
      <Rb color="#ffe11b" args={[1.2, 1.3, 0.5]} radius={0.1} />
      <mesh position={[0, 0.64, 0]}>
        <torusGeometry args={[0.3, 0.06, 16, 36, Math.PI]} />
        <Clay color="#2874f0" />
      </mesh>
      <group position={[0.03, -0.05, 0.26]}>
        <group matrix={SLANT} matrixAutoUpdate={false}>
          <Text font={displayFont} fontSize={0.9} color="#2874f0" anchorX="center" anchorY="middle">
            f
          </Text>
        </group>
      </group>
    </group>
  )
}

export function WalmartSpark({ color = '#ffc220' }) {
  return (
    <group>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i * Math.PI) / 3
        return (
          <mesh key={i} position={[Math.sin(a) * 0.43, Math.cos(a) * 0.43, 0]} rotation-z={-a} scale={[1, 1, 0.7]}>
            <capsuleGeometry args={[0.13, 0.3, 8, 16]} />
            <Clay color={color} />
          </mesh>
        )
      })}
    </group>
  )
}

export function Marketplaces() {
  return (
    <group>
      <Bob phase={0} position={[-0.52, -0.38, -0.35]} rotation={[0.2, 0.5, 0]} scale={0.78}>
        <AmazonBox />
      </Bob>
      <Bob phase={1.7} position={[0.6, -0.12, 0.3]} rotation={[0.05, -0.4, 0.04]} scale={0.72}>
        <FlipkartBag />
      </Bob>
      <Bob phase={3.1} position={[-0.25, 0.78, -0.1]} rotation={[0.1, 0.35, 0]} scale={0.62}>
        <WalmartSpark />
      </Bob>
    </group>
  )
}

export function Box({ body = BLACK, tape = RED, label = WHITE }) {

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

export function Browser({ frame = WHITE, bar = BLACK, accent = RED, img = BLACK }) {
  return (
    <group>
      <Rb color={frame} args={[2.1, 1.5, 0.16]} radius={0.1} />
      <Rb color={bar} args={[2.1, 0.3, 0.18]} radius={0.08} position={[0, 0.6, 0.01]} />
      {[-0.85, -0.7, -0.55].map((x, i) => (
        <Ball key={x} color={i === 0 ? accent : frame} r={0.05} position={[x, 0.6, 0.11]} />
      ))}
      <Rb color={img} args={[0.85, 0.62, 0.06]} radius={0.06} position={[-0.47, 0.02, 0.1]} />
      <Rb color={bar} args={[0.72, 0.1, 0.05]} radius={0.045} position={[0.46, 0.2, 0.1]} />
      <Rb color={bar} args={[0.56, 0.1, 0.05]} radius={0.045} position={[0.38, 0.04, 0.1]} />
      <Rb color={accent} args={[0.42, 0.17, 0.07]} radius={0.08} position={[0.31, -0.18, 0.1]} />
      <Rb color={bar} args={[1.8, 0.14, 0.05]} radius={0.06} position={[0, -0.5, 0.1]} />
    </group>
  )
}

export function Clapper({ body = BLACK, a = WHITE, b = BLACK, play = RED }) {
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
          <Clay color={play} />
        </mesh>
      </group>
    </group>
  )
}

export const SERVICE_PROPS = {
  ads: <Phone />,
  ecom: <Marketplaces />,
  pack: <Box />,
  web: <Browser />,
  video: <Clapper />,
}

/* ---------- canvas shell ---------- */

/*
 * Soft studio reflections: three glowing panels (a wide top softbox, a ring, a side strip), pre-filtered
 * once through three's PMREM and baked into a 23 KB CubeUV atlas (8-bit sRGB, scaled down by 2.5).
 * Using the atlas directly skips PMREM at runtime, whose synchronous shader compile blocked the main thread
 * for ~0.4s per 3D stage. Suspends until loaded, so shaders are compiled against it (see Warmup).
 */
function StudioEnv() {
  const { scene } = useThree()
  const env = useLoader(THREE.TextureLoader, envAtlas)
  useLayoutEffect(() => {
    env.mapping = THREE.CubeUVReflectionMapping
    env.colorSpace = THREE.SRGBColorSpace
    env.generateMipmaps = false
    env.minFilter = env.magFilter = THREE.LinearFilter
    scene.environment = env
    scene.environmentIntensity = 2.5
    return () => (scene.environment = null)
  }, [env, scene])
  return null
}

function ClayLights() {
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 6, 6]} intensity={2.1} />
      <directionalLight position={[-6, -2, 3]} intensity={0.5} color="#ffd9dd" />
      <StudioEnv />
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

/*
 * Compiles every shader in the scene before the first frame, in parallel and off the main thread
 * (KHR_parallel_shader_compile), instead of three.js doing it synchronously on first render — which froze the
 * page for over a second. `offscreen` also compiles the variants used when the scene is drawn into a render
 * target (the glass lens re-renders the scene into one every frame).
 */
function Warmup({ offscreen, onDone }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    let alive = true
    const jobs = [gl.compileAsync(scene, camera)]
    const rt = offscreen && new THREE.WebGLRenderTarget(1, 1)
    if (rt) {
      gl.setRenderTarget(rt)
      jobs.push(gl.compileAsync(scene, camera))
      gl.setRenderTarget(null)
    }
    Promise.all(jobs).then(() => alive && onDone(), () => alive && onDone())
    return () => {
      alive = false
      rt?.dispose()
    }
  }, [gl, scene, camera, offscreen, onDone])
  return null
}

/*
 * A WebGL context is only created once the stage comes within ~1.5 screens of the viewport, so the scenes
 * further down don't compete with the hero while the page loads. Once mounted it stays mounted and only
 * renders while on screen (and only after its shaders are compiled). If the device can't hold the frame
 * rate, it drops to 1x pixel density.
 */
export function Stage({ children, className, camera = { position: [0, 0, 10], fov: 30 }, eventSource, warmOffscreen = false, ...rest }) {
  const wrap = useRef()
  const [near, setNear] = useState(false)
  const [visible, setVisible] = useState(false)
  const [compiled, setCompiled] = useState(false)
  const [lowDpr, setLowDpr] = useState(false)
  const onCompiled = useCallback(() => setCompiled(true), [])
  useEffect(() => {
    const onScreen = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '120px' })
    const ahead = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '150% 0px' })
    onScreen.observe(wrap.current)
    ahead.observe(wrap.current)
    return () => {
      onScreen.disconnect()
      ahead.disconnect()
    }
  }, [])
  return (
    <div ref={wrap} className={className}>
      {near && (
        <Canvas
          flat
          frameloop={visible && compiled ? 'always' : 'never'}
          dpr={lowDpr ? 1 : [1, TOUCH ? 1.5 : 2]}
          camera={camera}
          eventSource={eventSource}
          eventPrefix={eventSource ? 'client' : 'offset'}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          {...rest}
        >
          <PerformanceMonitor onDecline={() => setLowDpr(true)} />
          <ClayLights />
          {children}
          <Warmup offscreen={warmOffscreen} onDone={onCompiled} />
        </Canvas>
      )}
    </div>
  )
}

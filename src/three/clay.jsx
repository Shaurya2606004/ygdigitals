import * as THREE from 'three'
import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { PerformanceMonitor, RoundedBox, Text } from '@react-three/drei'
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'
import displayFont from '@fontsource/unbounded/files/unbounded-latin-800-normal.woff?url'
import envAtlas from './studio-env.png'
import { REDUCED, TOUCH, clamp01, elasticOut } from '../lib/motion'

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

/*
 * Instagram: the gradient squircle with the white camera glyph. One unit across, face on +z.
 * Flat as the post on the phone, an app-icon slab floating in the hero.
 */
// a square with soft corners (superellipse |x|⁴ + |y|⁴ = r⁴), an app icon's outline
const squircle = (r, n = 64) =>
  Array.from({ length: n }, (_, i) => {
    const c = Math.cos((i / n) * Math.PI * 2)
    const s = Math.sin((i / n) * Math.PI * 2)
    return new THREE.Vector2(Math.sign(c) * Math.sqrt(Math.abs(c)) * r, Math.sign(s) * Math.sqrt(Math.abs(s)) * r)
  })

// Instagram's radial gradient: pale yellow in the bottom-left corner → coral → magenta → blue at the top
let igMap
function getIgMap() {
  if (igMap) return igMap
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')
  const g = x.createRadialGradient(38, 137, 0, 38, 137, 164)
  ;[[0, '#fdf497'], [0.05, '#fdf497'], [0.45, '#fd5949'], [0.6, '#d6249f'], [0.9, '#285aeb']].forEach(([at, col]) => g.addColorStop(at, col))
  x.fillStyle = g
  x.fillRect(0, 0, 128, 128)
  igMap = new THREE.CanvasTexture(c)
  igMap.colorSpace = THREE.SRGBColorSpace
  return igMap
}

// the icon as a rounded slab `depth + 2 * bevel` thick, the gradient projected straight onto its face
function igSlab(depth, bevel) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(squircle(0.5 - bevel)), { depth, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 6 })
  g.center()
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) g.attributes.uv.setXY(i, p.getX(i) + 0.5, p.getY(i) + 0.5)
  return toCreasedNormals(g, 0.6)
}
let igTile, igCube, igGlyph
const getIgTile = () => (igTile ??= igSlab(0.02, 0.03))
// the hero's slab: 0.12 deep plus a 0.12 bevel each side, so its faces sit at z = ±0.18
const getIgCube = () => (igCube ??= igSlab(0.12, 0.12))
// the camera glyph, centred on the face: rounded-square outline, lens ring and flash dot, one mesh
const getIgGlyph = () =>
  (igGlyph ??= mergeGeometries([
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(squircle(0.28).map((v) => new THREE.Vector3(v.x, v.y, 0)), true), 128, 0.04, 10, true),
    new THREE.TorusGeometry(0.12, 0.04, 10, 40),
    new THREE.SphereGeometry(0.042, 16, 12).translate(0.165, 0.165, 0),
  ]))

const IG_MAT = { roughness: 0.45, sheen: 0.15, clearcoat: 0.4 }

export function InstagramLogo(props) {
  return (
    <group {...props}>
      <mesh geometry={getIgTile()}>
        <Clay color={WHITE} map={getIgMap()} {...IG_MAT} />
      </mesh>
      <mesh geometry={getIgGlyph()} position-z={0.04}>
        <Clay color={WHITE} {...IG_MAT} />
      </mesh>
    </group>
  )
}

// the glyph sits on the front and the back, so it still reads when the cube tumbles away on scroll
export function InstaCube() {
  return (
    <group>
      <mesh geometry={getIgCube()}>
        <Clay color={WHITE} map={getIgMap()} {...IG_MAT} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} geometry={getIgGlyph()} position-z={s * 0.18} rotation-y={s < 0 ? Math.PI : 0}>
          <Clay color={WHITE} {...IG_MAT} />
        </mesh>
      ))}
    </group>
  )
}

export function Phone({ body = BLACK, screen = WHITE, accent = RED }) {
  return (
    <group>
      <Rb color={body} args={[1.1, 2.1, 0.22]} radius={0.15} />
      <Rb color={screen} args={[0.94, 1.86, 0.05]} radius={0.1} position={[0, 0, 0.1]} />
      <Rb color={body} args={[0.3, 0.07, 0.04]} radius={0.03} position={[0, 0.84, 0.14]} />
      {/* an Instagram post: the logo, two lines of copy, the CTA */}
      <InstagramLogo scale={0.78} position={[0, 0.3, 0.16]} />
      <Rb color={body} args={[0.62, 0.09, 0.04]} radius={0.04} position={[-0.07, -0.3, 0.14]} />
      <Rb color={body} args={[0.42, 0.09, 0.04]} radius={0.04} position={[-0.17, -0.45, 0.14]} />
      <Rb color={accent} args={[0.78, 0.2, 0.06]} radius={0.09} position={[0, -0.7, 0.14]} />
    </group>
  )
}

/*
 * The phone hero's phone: a feed races up the screen and snaps to a stop on the studio's own post, which then gets
 * liked, the headline acted out. `readyAt` holds the clock time the intro starts (null = hold still). The posts are
 * clipped to the screen by two planes that follow the phone wherever it moves.
 */
const POST_H = 1.3
const FEED = ['#d8d2c7', '#262626', '#c9965e', '#bec5c8', '#e6e0d5', '#3a3d44'] // everyone else's posts, scrolled past
const SCREEN_EDGES = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.9), new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.9)]
const easeOut = (x) => 1 - (1 - clamp01(x)) ** 4

// avatar + name, the picture, like / comment / save, two lines of caption
function Post({ y, image, avatar = '#b9b3a9', clip, children }) {
  const m = (color) => <Clay color={color} clippingPlanes={clip} />
  const bar = (args, position, color, radius = 0.017) => (
    <RoundedBox args={args} radius={radius} smoothness={3} position={position}>
      {m(color)}
    </RoundedBox>
  )
  return (
    <group position-y={y}>
      <mesh position={[-0.36, 0.53, 0]} scale={[0.055, 0.055, 0.02]}>
        <sphereGeometry args={[1, 20, 14]} />
        {m(avatar)}
      </mesh>
      {bar([0.26, 0.045, 0.02], [-0.17, 0.53, 0], BLACK)}
      {bar([0.86, 0.78, 0.02], [0, 0.07, 0], image, 0.05)}
      <mesh geometry={getHeart()} position={[-0.36, -0.42, 0]} scale={0.075}>
        {m(BLACK)}
      </mesh>
      <mesh position={[-0.23, -0.42, 0]}>
        <torusGeometry args={[0.032, 0.012, 8, 20]} />
        {m(BLACK)}
      </mesh>
      {bar([0.05, 0.07, 0.015], [0.38, -0.42, 0], BLACK, 0.012)}
      {bar([0.62, 0.035, 0.015], [-0.1, -0.54, 0], '#9a948b')}
      {bar([0.4, 0.035, 0.015], [-0.21, -0.61, 0], '#9a948b')}
      {children}
    </group>
  )
}

export function FeedPhone({ readyAt }) {
  const { gl } = useThree()
  const screen = useRef()
  const strip = useRef()
  const badge = useRef()
  const liked = useRef()
  const like = useRef()
  const clip = useMemo(() => SCREEN_EDGES.map((p) => p.clone()), [])
  useLayoutEffect(() => {
    gl.localClippingEnabled = true
  }, [gl])
  useFrame((state) => {
    screen.current.updateWorldMatrix(true, false)
    clip.forEach((p, i) => p.copy(SCREEN_EDGES[i]).applyMatrix4(screen.current.matrixWorld))
    const t = readyAt.current == null ? 0 : state.clock.elapsedTime - readyAt.current
    // full speed at once, braking hard onto our post, then a little spring-back
    const after = REDUCED ? 9 : t - 2.1
    const settle = after > 0 ? Math.sin(after * 16) * Math.exp(-after * 6) * 0.05 : 0
    strip.current.position.y = FEED.length * POST_H * (REDUCED ? 1 : easeOut((t - 0.3) / 1.8)) - settle
    badge.current.scale.setScalar(Math.max(1e-4, elasticOut(after / 0.9)))
    liked.current.scale.setScalar(Math.max(1e-4, 0.075 * elasticOut((after - 0.35) / 0.6)))
    // the double-tap heart: pops, holds, then floats off shrinking; again every 4s
    const c = REDUCED || after < 0.3 ? -1 : (after - 0.3) % 4
    const on = c >= 0 && c < 1.3
    like.current.scale.setScalar(Math.max(1e-4, on ? 0.3 * (c < 0.9 ? elasticOut(c / 0.5) : 1 - (c - 0.9) / 0.4) : 0))
    like.current.position.y = 0.07 + (on && c > 0.9 ? (c - 0.9) * 0.6 : 0)
  })
  return (
    <group>
      <Rb color={BLACK} args={[1.1, 2.1, 0.22]} radius={0.15} />
      <Rb color={WHITE} args={[0.94, 1.86, 0.05]} radius={0.1} position={[0, 0, 0.1]} />
      <Rb color={BLACK} args={[0.3, 0.07, 0.04]} radius={0.03} position={[0, 0.84, 0.17]} />
      <group ref={screen} position-z={0.14}>
        <group ref={strip}>
          {FEED.map((c, i) => (
            <Post key={i} y={-i * POST_H} image={c} clip={clip} />
          ))}
          <Post y={-FEED.length * POST_H} image={RED} avatar={RED} clip={clip}>
            <group ref={badge} position={[0, 0.07, 0.02]} scale={1e-4}>
              <Text font={displayFont} fontSize={0.34} letterSpacing={-0.04} color={BLACK} anchorX="center" anchorY="middle">
                YG
              </Text>
            </group>
            <mesh ref={liked} geometry={getHeart()} position={[-0.36, -0.42, 0.012]} scale={1e-4}>
              <Clay color={RED} />
            </mesh>
            <mesh ref={like} geometry={getHeart()} position={[0, 0.07, 0.12]} scale={1e-4}>
              <Clay color={WHITE} />
            </mesh>
          </Post>
        </group>
      </group>
    </group>
  )
}

/* marketplace stand-ins: an Amazon shipping box, the Flipkart bag and a Meesho tag */
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

// Meesho's lowercase wordmark, white on its pink
export function MeeshoTag() {
  return (
    <group>
      <Rb color="#f43397" args={[1.5, 0.66, 0.26]} radius={0.13} />
      <Text font={displayFont} fontSize={0.27} letterSpacing={-0.04} position={[0, 0.03, 0.135]} color={WHITE} anchorX="center" anchorY="middle">
        meesho
      </Text>
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
      <Bob phase={3.1} position={[-0.35, 0.82, -0.1]} rotation={[0.1, 0.35, 0]} scale={0.62}>
        <MeeshoTag />
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

// a movie camera, side on, its lens toward the mascot; the film reels turn while it rolls
export function Camera({ body = WHITE, reel = RED, dots = BLACK }) {
  const reels = useRef([])
  useFrame((_, dt) => {
    if (REDUCED) return
    for (const r of reels.current) r.rotation.z -= dt * 1.5
  })
  return (
    <group>
      <Rb color={body} args={[1.3, 0.78, 0.62]} radius={0.1} position={[-0.2, -0.3, 0]} />
      <mesh position={[0.65, -0.3, 0]} rotation-z={-Math.PI / 2}>
        <cylinderGeometry args={[0.32, 0.2, 0.4, 32]} />
        <Clay color={body} />
      </mesh>
      <Ball color={reel} r={0.06} position={[0.26, -0.02, 0.3]} scale={[1, 1, 0.5]} />
      {[
        [-0.52, 0.39, 0.3],
        [0.1, 0.33, 0.24],
      ].map(([x, y, r], i) => (
        <group key={i} ref={(el) => (reels.current[i] = el)} position={[x, y, 0]}>
          <mesh rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[r, r, 0.14, 40]} />
            <Clay color={reel} />
          </mesh>
          {[0, 1, 2].map((k) => (
            <Ball key={k} color={dots} r={r * 0.2} position={[Math.cos(k * 2.09) * r * 0.55, Math.sin(k * 2.09) * r * 0.55, 0.07]} scale={[1, 1, 0.35]} />
          ))}
          <Ball color={body} r={r * 0.15} position-z={0.07} scale={[1, 1, 0.5]} />
        </group>
      ))}
    </group>
  )
}

export const SERVICE_PROPS = {
  ads: <Phone />,
  ecom: <Marketplaces />,
  pack: <Box />,
  web: <Browser />,
  video: <Clapper />,
  shoot: <Camera />,
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
    const rt = offscreen ? new THREE.WebGLRenderTarget(1, 1) : null // not `&&`: false?.dispose() throws
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

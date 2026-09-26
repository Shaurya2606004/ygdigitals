import * as THREE from 'three'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Clay, RED, WHITE, strand } from './clay'
import { REDUCED, aim, spring } from '../lib/motion'

/*
 * The studio's two clay mascots: "guy" (pompadour, big nose, hoodie) and "girl" (bun, round glasses, sweater).
 * Every rigid part is merged into one vertex-coloured mesh, so a whole character is ~16 draw calls however
 * much detail it carries. Origin sits mid-body: feet at y≈-1.23, top of the hair at y≈1.4.
 */

const HAIR = '#221814'
const SKIN = { guy: '#c58660', girl: '#d49b76' }
const OUTFIT = {
  black: { top: '#232323', trim: '#171717', cord: '#f1f1f1', pants: '#cbb894', shoe: '#f7f7f7', sole: '#1c1c1c' },
  white: { top: '#f6f6f6', trim: '#e2e2e2', cord: '#1c1c1c', pants: '#2c2e34', shoe: '#f7f7f7', sole: RED },
}

// head: an ellipsoid at HC, turning about the top of the neck (HP)
const HC = [0, 0.64, 0]
const HR = 0.56
const HS = [1.04, 1, 0.97]
const HP = [0, 0.18, 0]
// z of the face surface at (x, y), plus `lift`
const faceZ = (x, y, lift = 0) => {
  const u = x / (HR * HS[0])
  const v = (y - HC[1]) / (HR * HS[1])
  return HC[2] + HR * HS[2] * Math.sqrt(Math.max(0, 1 - u * u - v * v)) + lift
}
const face = (x, y, lift) => [x, y, faceZ(x, y, lift)]

// eyes: centre, radius, squash, and how far each one turns outward with the curve of the head
const EX = 0.2
const EY = 0.71
const ER = 0.12
const ES = [ER, ER * 1.05, ER * 0.92]
// eyelids sit proud of the eyeball: enough margin that it stays covered however far the lid rotates
const LS = ES.map((v) => v * 1.16)
const LID_EDGE = 1.62 // upper lid covers from the top of the eye down to this latitude (radians)
const LID_OPEN = -0.5
const LID_SHUT = 0.7

// transform from position / euler / scale; a plain number means the same value on all three axes
const v3 = (a) => (Array.isArray(a) ? a : [a, a, a])
const M = (p = 0, r = 0, s = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(...v3(p)), new THREE.Quaternion().setFromEuler(new THREE.Euler(...v3(r))), new THREE.Vector3(...v3(s)))
const eyeM = (s) => M([s * EX, EY, faceZ(s * EX, EY) - 0.055], [0, s * 0.28, 0])

// one coloured piece of a merged mesh
function piece(geo, color, m) {
  const g = geo.clone()
  g.deleteAttribute('uv')
  if (m) g.applyMatrix4(m)
  const c = new THREE.Color(color)
  const a = new Float32Array(g.attributes.position.count * 3)
  for (let i = 0; i < a.length; i += 3) c.toArray(a, i)
  g.setAttribute('color', new THREE.BufferAttribute(a, 3))
  return g
}

const tint = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString()
const ring = (r, t, seg = 40) => new THREE.TorusGeometry(r, t, 10, seg).rotateX(Math.PI / 2) // lies flat, around y

const cache = new Map()
function build(look, outfit) {
  const key = look + outfit
  if (cache.has(key)) return cache.get(key)
  const girl = look === 'girl'
  const skin = SKIN[look]
  const o = OUTFIT[outfit]
  const ball = new THREE.SphereGeometry(1, 40, 28)
  const hi = new THREE.SphereGeometry(1, 72, 54)
  const cap = (from, len) => new THREE.SphereGeometry(1, 36, 14, 0, Math.PI * 2, from, len)
  const merge = (parts) => mergeGeometries(parts)
  const toHead = (g) => g.translate(-HP[0], -HP[1], -HP[2])
  const both = (fn) => [fn(-1), fn(1)]

  /* ---- head (skin, features, glasses) ---- */
  const nose = tint(skin, '#a8452f', girl ? 0.1 : 0.16)
  const blush = tint(skin, '#e46f5f', girl ? 0.22 : 0.12)
  const head = [
    piece(hi, skin, M(HC, 0, HS.map((v) => v * HR))),
    // cheeks, pushed up at the corners of the smile
    ...both((s) => piece(ball, blush, M(face(s * 0.28, 0.5, -0.095), 0, [0.13, 0.11, 0.09]))),
    // nose + nostril wings
    piece(ball, nose, M(face(0, girl ? 0.58 : 0.575, 0.02), 0, girl ? [0.085, 0.075, 0.08] : [0.108, 0.094, 0.1])),
    ...both((s) => piece(ball, nose, M(face(s * (girl ? 0.062 : 0.085), 0.545, -0.005), 0, girl ? 0.042 : 0.055))),
    // ears + inner ear
    ...both((s) => piece(ball, skin, M([s * 0.575, 0.6, -0.02], [0, -s * 0.3, s * 0.1], [0.055, 0.135, 0.1]))),
    ...both((s) => piece(ball, tint(skin, '#6b2e1e', 0.25), M([s * 0.622, 0.6, -0.005], [0, -s * 0.3, s * 0.1], [0.024, 0.085, 0.055]))),
    // lower lids
    ...both((s) => piece(cap(Math.PI - 0.6, 0.6), skin, eyeM(s).multiply(M(0, [-0.12, 0, 0], LS)))),
    // mouth
    piece(
      strand(
        girl ? [face(-0.12, 0.44, 0.004), face(0, 0.415, 0.006), face(0.12, 0.44, 0.004)] : [face(-0.13, 0.435, 0.004), face(-0.02, 0.41, 0.006), face(0.08, 0.418, 0.006), face(0.155, 0.458, 0.004)],
        girl ? 0.02 : 0.021,
        (u) => Math.sin(Math.PI * u) ** 0.35,
      ),
      girl ? '#8f3b36' : '#5a2721',
    ),
  ]
  if (girl) {
    head.push(
      piece(ball, '#b3564c', M(face(0, 0.398, -0.012), 0, [0.058, 0.022, 0.03])), // lower lip
      // round glasses
      ...both((s) => piece(new THREE.TorusGeometry(0.135, 0.016, 10, 44), '#161616', M(face(s * 0.2, 0.715, 0.075), [0, s * 0.15, 0]))),
      piece(strand([[-0.075, 0.73, 0.585], [0, 0.755, 0.6], [0.075, 0.73, 0.585]], 0.016, () => 1), '#161616'),
      ...both((s) => piece(strand([[s * 0.33, 0.735, 0.545], [s * 0.47, 0.73, 0.39], [s * 0.565, 0.72, 0.1]], 0.013, () => 1), '#161616')),
      // gold hoops
      ...both((s) => piece(new THREE.TorusGeometry(0.042, 0.011, 8, 24), '#d6a646', M([s * 0.585, 0.42, 0.02], [0, Math.PI / 2, 0]))),
    )
  }

  /* ---- hair ---- */
  const hair = []
  if (girl) {
    hair.push(
      // main mass: a slightly bigger sphere shifted up and back, so the hairline falls where they cross
      piece(hi, HAIR, M([HC[0], HC[1] + 0.085, HC[2] - 0.07], 0, HS.map((v) => v * HR * 1.035))),
      piece(ball, HAIR, M([0, 0.34, -0.26], 0, [0.58, 0.6, 0.34])), // length down the back
      piece(ball, HAIR, M([0, 1.36, -0.2], 0, 0.2)), // bun
      piece(ring(0.13, 0.042), HAIR, M([0, 1.2, -0.17], [-0.45, 0, 0])),
      // curtain bangs parted in the middle
      ...[-1, 1].flatMap((s) => [
        piece(strand([[s * 0.02, 1.15, 0.26], face(s * 0.16, 1.08, 0.05), face(s * 0.32, 0.93, 0.05), face(s * 0.44, 0.76, 0.03), face(s * 0.5, 0.6, 0)], 0.075, (u) => Math.sin(Math.PI * (0.18 + 0.82 * u)) ** 0.5), HAIR),
        piece(strand([[s * 0.05, 1.2, 0.12], face(s * 0.24, 1.07, 0.04), face(s * 0.42, 0.88, 0.03), face(s * 0.52, 0.7, 0.0)], 0.07, (u) => Math.sin(Math.PI * (0.18 + 0.82 * u)) ** 0.5), HAIR),
      ]),
    )
  } else {
    hair.push(
      piece(hi, HAIR, M([HC[0], HC[1] + 0.095, HC[2] - 0.075], 0, HS.map((v) => v * HR * 1.03))),
      // pompadour: a swept-up mass over the forehead, its surface ridged by clumps rolling back to one side
      piece(ball, HAIR, M([0.02, 1.13, 0.2], [-0.45, 0, -0.08], [0.42, 0.17, 0.3])),
      ...[
        [-0.3, 0.05, 0.1, 0.095],
        [-0.18, 0.09, 0.12, 0.11],
        [-0.05, 0.12, 0.12, 0.115],
        [0.08, 0.13, 0.1, 0.115],
        [0.2, 0.1, 0.08, 0.105],
        [0.31, 0.05, 0.06, 0.09],
      ].map(([x, h, sw, r]) =>
        piece(
          strand([[x, 0.96, faceZ(x, 0.96) - 0.06], [x * 1.02, 1.06 + h * 0.5, faceZ(x, 1.0) + 0.02], [x + sw * 0.5, 1.12 + h, 0.3], [x + sw, 1.14 + h * 0.8, 0.02], [x + sw * 1.2, 1.08 + h * 0.3, -0.25]], r, (u) => Math.sin(Math.PI * (0.1 + 0.9 * u)) ** 0.6),
          HAIR,
        ),
      ),
      // sideburns
      ...both((s) => piece(strand([face(s * 0.52, 0.84, -0.02), face(s * 0.55, 0.72, 0), face(s * 0.555, 0.63, -0.01)], 0.045, (u) => Math.sin(Math.PI * (0.2 + 0.8 * u)) ** 0.4), HAIR)),
    )
  }

  /* ---- brows (raise when surprised) ---- */
  const browPts = girl
    ? (s) => [face(s * 0.1, 0.895, 0.012), face(s * 0.21, 0.94, 0.012), face(s * 0.31, 0.9, 0.012)]
    : (s) => [face(s * 0.085, 0.9, 0.014), face(s * 0.2, 0.925, 0.014), face(s * 0.315, 0.9, 0.014)]
  const brows = both((s) => piece(strand(browPts(s), girl ? 0.025 : 0.036, (u) => (1 - 0.5 * u) * Math.sin(Math.PI * (0.06 + 0.9 * u)) ** 0.45), HAIR))

  /* ---- eyes ---- */
  const whites = both((s) => piece(ball, '#f8f6f3', eyeM(s).multiply(M(0, 0, ES))))
  const pupils = [-1, 1].flatMap((s) => [
    piece(ball, girl ? '#3a2418' : '#4a2e1f', eyeM(s).multiply(M([0, 0, ES[2] - 0.012], 0, [0.068, 0.068, 0.024]))),
    piece(ball, '#0e0e0e', eyeM(s).multiply(M([0, 0, ES[2] + 0.002], 0, [0.036, 0.036, 0.014]))),
    piece(ball, '#ffffff', eyeM(s).multiply(M([0.022, 0.03, ES[2] + 0.012], 0, 0.016))),
  ])
  // upper lids: each rotates about its own eye to blink, so each is its own mesh (in eye space)
  const lid = (s) => {
    const parts = [
      piece(cap(0, LID_EDGE), skin, M(0, 0, LS)),
      piece(ring(1, 0.09, 48), skin, M([0, LS[1] * Math.cos(LID_EDGE), 0], 0, [LS[0] * Math.sin(LID_EDGE), 0.13, LS[2] * Math.sin(LID_EDGE)])),
    ]
    if (girl)
      for (const phi of [2.45, 2.2]) {
        const f = s > 0 ? phi : Math.PI - phi
        const e = [LS[0] * -Math.cos(f) * Math.sin(LID_EDGE), LS[1] * Math.cos(LID_EDGE), LS[2] * Math.sin(f) * Math.sin(LID_EDGE)]
        parts.push(piece(strand([e, [e[0] + s * 0.035, e[1] + 0.015, e[2] + 0.01], [e[0] + s * 0.06, e[1] + 0.04, e[2]]], 0.011, (u) => 1 - 0.8 * u, 10, 6), HAIR))
      }
    return merge(parts)
  }

  /* ---- body ---- */
  const profile = new THREE.SplineCurve(
    [[0.02, -0.8], [0.36, -0.79], [0.42, -0.7], [0.44, -0.5], [0.44, -0.3], [0.42, -0.12], [0.35, 0.0], [0.21, 0.08], [0.02, 0.1]].map(([x, y]) => new THREE.Vector2(x, y)),
  ).getPoints(40)
  const bodyW = girl ? 0.94 : 1
  const torso = [
    piece(new THREE.LatheGeometry(profile, 48), o.top, M(0, 0, [bodyW, 1, 0.8])),
    piece(ring(0.415, 0.05, 48), o.trim, M([0, -0.745, 0], 0, [bodyW, 1, 0.8])), // ribbed hem
    piece(new THREE.CapsuleGeometry(0.14, 0.14, 8, 20), skin, M([0, 0.12, -0.03])), // neck
    // brand badge on the chest: the one red detail
    piece(ball, RED, M([-0.2 * bodyW, -0.12, 0.29], [0, -0.45, 0], [0.058, 0.058, 0.016])),
  ]
  if (girl) {
    torso.push(piece(ring(0.165, 0.036), o.trim, M([0, 0.075, -0.02], [-0.12, 0, 0], [1, 1, 0.9]))) // crew collar
  } else {
    torso.push(
      piece(ring(0.19, 0.07), o.top, M([0, 0.07, -0.02], [-0.12, 0, 0], [1, 1, 0.85])), // hood rolled round the neck
      piece(ball, o.top, M([0, 0.14, -0.24], [-0.3, 0, 0], [0.3, 0.16, 0.18])),
      ...both((s) => piece(strand([[s * 0.05, 0.08, 0.2], [s * 0.065, 0.0, 0.3], [s * 0.07, -0.14, 0.365], [s * 0.075, -0.3, 0.39]], 0.017, () => 1, 20, 8), o.cord)),
      ...both((s) => piece(new THREE.CapsuleGeometry(0.022, 0.05, 4, 10), o.cord, M([s * 0.075, -0.33, 0.392]))),
    )
  }
  const legs = [-1, 1].flatMap((s) => [
    piece(new THREE.CapsuleGeometry(0.12, 0.2, 8, 20), o.pants, M([s * 0.19, -0.92, 0])),
    piece(ring(0.118, 0.03), o.pants, M([s * 0.19, -1.07, 0])),
    // sneaker: upper, toe cap, flat sole
    piece(ball, o.shoe, M([s * 0.2, -1.13, 0.06], 0, [0.14, 0.1, 0.2])),
    piece(ball, o.shoe, M([s * 0.2, -1.15, 0.18], 0, [0.13, 0.08, 0.1])),
    piece(new THREE.CylinderGeometry(1, 1, 1, 32), o.sole, M([s * 0.2, -1.2, 0.08], 0, [0.148, 0.05, 0.225])),
  ])

  /* ---- arms: shoulder → elbow → wrist, identical both sides (the hand is symmetric) ---- */
  const upper = merge([piece(ball, o.top, M(0, 0, 0.105)), piece(new THREE.CapsuleGeometry(0.105, 0.17, 8, 20), o.top, M([0, -0.14, 0]))])
  const fore = merge([piece(new THREE.CapsuleGeometry(0.098, 0.13, 8, 20), o.top, M([0, -0.1, 0])), piece(ring(0.093, 0.03), o.trim, M([0, -0.21, 0]))])
  const hand = merge([
    piece(ball, skin, M([0, -0.075, 0], 0, [0.052, 0.082, 0.085])),
    ...[0, 1, 2, 3].map((k) => {
      const z = (k - 1.5) * 0.036
      return piece(new THREE.CapsuleGeometry(0.026, 0.055, 6, 12), skin, M([0, -0.165, z * 1.1], [-z * 1.4, 0, 0]))
    }),
    piece(new THREE.CapsuleGeometry(0.028, 0.05, 6, 12), skin, M([0, -0.07, 0.085], [-0.9, 0, 0])),
  ])

  const out = {
    head: toHead(merge(head)),
    hair: toHead(merge(hair)),
    brows: toHead(merge(brows)),
    whites: toHead(merge(whites)),
    pupils: toHead(merge(pupils)),
    lids: [lid(-1), lid(1)],
    eyes: [-1, 1].map((s) => new THREE.Vector3(s * EX, EY - HP[1], faceZ(s * EX, EY) - 0.055)),
    torso: merge(torso),
    legs: merge(legs),
    upper,
    fore,
    hand,
  }
  cache.set(key, out)
  return out
}

// 3D hovers can't reach the DOM cursor via pointerover, so they announce themselves.
const cursorLabel = (label) => window.dispatchEvent(new CustomEvent('cursor-label', { detail: label }))

const SKIN_MAT = { roughness: 0.7, sheen: 0.4, sheenColor: '#ffb49c', clearcoat: 0.02 }
const HAIR_MAT = { roughness: 0.42, sheen: 0.6, sheenColor: '#9a7a68', clearcoat: 0.25, clearcoatRoughness: 0.4 }
// fabric sheen reads as velvet on white but washes a black hoodie out to grey, so it scales with the outfit
const CLOTH_MAT = {
  black: { roughness: 0.8, sheen: 0.3, sheenRoughness: 0.6, sheenColor: '#6f6f6f', clearcoat: 0.02 },
  white: { roughness: 0.85, sheen: 1, sheenRoughness: 0.55, clearcoat: 0.02 },
}
const EYE_MAT = { roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08 }

export function Buddy({ look = 'guy', outfit = 'black', seed = 1, wave = false, hop = 0, ...props }) {
  const g = useMemo(() => build(look, outfit), [look, outfit])
  const cloth = CLOTH_MAT[outfit]
  const root = useRef()
  const torso = useRef()
  const head = useRef()
  const brows = useRef()
  const pupils = useRef()
  const lids = [useRef(), useRef()]
  const shoulders = [useRef(), useRef()]
  const elbows = [useRef(), useRef()]
  const wrists = [useRef(), useRef()]
  const jump = useRef({ x: 0, v: 0 })
  const gaze = useRef({ x: 0, y: 0 })

  const doJump = () => (jump.current.v = 9)
  useEffect(() => {
    if (hop) doJump()
  }, [hop])

  useFrame((state, dt) => {
    dt = Math.min(dt, 1 / 30)
    const t = state.clock.elapsedTime + seed * 7
    const idle = REDUCED ? 0 : 1
    const j = jump.current
    spring(j, 0, dt, 90, 7)
    const up = Math.max(0, j.x)
    // squash & stretch on the hop
    root.current.position.y = up * 0.45
    const st = j.x * 0.08
    root.current.scale.set(1 - st * 0.5, 1 + st, 1 - st * 0.5)
    root.current.rotation.z = Math.sin(t * 0.8) * 0.025 * idle
    torso.current.scale.y = 1 + Math.sin(t * 2.4) * 0.012 * idle
    // head and eyes follow the pointer (or the phone's tilt)
    const a = aim(state)
    const gz = gaze.current
    const k = 1 - Math.exp(-dt * 6)
    gz.x += (a.x - gz.x) * k
    gz.y += (a.y - gz.y) * k
    head.current.rotation.set(-gz.y * 0.22, gz.x * 0.45, -gz.x * 0.06 + Math.sin(t * 0.9) * 0.03 * idle)
    pupils.current.position.set(gz.x * 0.02, gz.y * 0.016, 0)
    brows.current.position.y = up * 0.035
    // blink every ~4s
    const b = (t + seed * 1.3) % 4.2
    const shut = b < 0.16 ? Math.sin((b / 0.16) * Math.PI) : 0
    for (const l of lids) l.current.rotation.x = LID_OPEN + (LID_SHUT - LID_OPEN) * shut - up * 0.15
    // arms: hang relaxed (and fling up on the hop); the right one waves if asked
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1
      const waving = wave && i === 1 && !REDUCED
      const sw = Math.sin(t * 2 + i) * 0.04 * idle
      shoulders[i].current.rotation.set(0, 0, waving ? 2.35 : s * (0.12 + sw + up * 0.5))
      elbows[i].current.rotation.set(waving ? 0 : -0.22, 0, waving ? 0.45 + Math.sin(t * 8) * 0.38 : 0)
      wrists[i].current.rotation.set(0, waving ? Math.PI / 2 : 0, 0)
    }
  })

  const arm = (i) => (
    <group key={i} ref={shoulders[i]} position={[i ? 0.36 : -0.36, -0.03, 0]}>
      <mesh geometry={g.upper}>
        <Clay color={WHITE} vertexColors {...cloth} />
      </mesh>
      <group ref={elbows[i]} position={[0, -0.26, 0]}>
        <mesh geometry={g.fore}>
          <Clay color={WHITE} vertexColors {...cloth} />
        </mesh>
        <group ref={wrists[i]} position={[0, -0.25, 0]}>
          <mesh geometry={g.hand}>
            <Clay color={WHITE} vertexColors {...SKIN_MAT} />
          </mesh>
        </group>
      </group>
    </group>
  )

  return (
    <group {...props}>
      <group
        ref={root}
        onClick={(e) => {
          e.stopPropagation()
          doJump()
        }}
        onPointerOver={() => cursorLabel('Poke')}
        onPointerOut={() => cursorLabel(null)}
      >
        <mesh geometry={g.legs}>
          <Clay color={WHITE} vertexColors {...cloth} />
        </mesh>
        <group ref={torso}>
          <mesh geometry={g.torso}>
            <Clay color={WHITE} vertexColors {...cloth} />
          </mesh>
          {arm(0)}
          {arm(1)}
          <group ref={head} position={HP}>
            <mesh geometry={g.head}>
              <Clay color={WHITE} vertexColors {...SKIN_MAT} />
            </mesh>
            <mesh geometry={g.hair}>
              <Clay color={WHITE} vertexColors {...HAIR_MAT} />
            </mesh>
            <mesh ref={brows} geometry={g.brows}>
              <Clay color={WHITE} vertexColors {...HAIR_MAT} />
            </mesh>
            <mesh geometry={g.whites}>
              <Clay color={WHITE} vertexColors {...EYE_MAT} />
            </mesh>
            <mesh ref={pupils} geometry={g.pupils}>
              <Clay color={WHITE} vertexColors {...EYE_MAT} />
            </mesh>
            {g.eyes.map((p, i) => (
              <group key={i} position={p} rotation={[0, (i ? 1 : -1) * 0.28, 0]}>
                <mesh ref={lids[i]} geometry={g.lids[i]} rotation-x={LID_OPEN}>
                  <Clay color={WHITE} vertexColors {...SKIN_MAT} />
                </mesh>
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  )
}

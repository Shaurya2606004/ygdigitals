import * as THREE from 'three'
import { Suspense, use, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { REDUCED, aim, spring } from '../lib/motion'

/*
 * The brand's signature mascot, as real 3D: one ready-made textured model per pose (positions + uv, simplified for
 * the web; texture alongside as webp). Each mesh is scaled
 * so 1 unit is his standing height, feet on y=0, facing +Z. Service poses are keyed by service id.
 */
const files = import.meta.glob('./mascot/*.{glb,webp}', { eager: true, query: '?url', import: 'default' })
const pose = (name) => ({ mesh: files[`./mascot/${name}.glb`], tex: files[`./mascot/${name}.webp`] })
const POSES = {
  hero: pose('hero-point'),
  ads: pose('svc-social'),
  shoot: pose('svc-shoot'),
  ecom: pose('svc-ecom'),
  pack: pose('svc-pack'),
  web: pose('svc-web'),
  video: pose('svc-edit'),
}

// a soft oval of shade for things standing on the floor
let shadeMap
export function getShadeMap() {
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

const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
// old Safari uploads ImageBitmaps wrongly (three's GLTFLoader makes the same check), so it decodes through an <img> as before
const ua = navigator.userAgent
const oldSafari = /^((?!chrome|android).)*safari/i.test(ua) && +(ua.match(/Version\/(\d+)/)?.[1] ?? 0) < 17
const imageLoader = typeof createImageBitmap === 'undefined' || oldSafari ? new THREE.TextureLoader() : new THREE.ImageBitmapLoader()

/*
 * A pose's mesh and texture download side by side, and the texture is decoded off the main thread: an <img> was
 * decoded during the first draw, freezing the page ~90ms each time a pose appeared. Shown exactly as painted
 * (unlit, no added lighting or shadow). The mesh's positions are quantised: its node carries the scale/offset that
 * restores them, so that transform is kept.
 */
const poses = new Map()
function loadPose(name) {
  if (!poses.has(name))
    poses.set(
      name,
      Promise.all([gltfLoader.loadAsync(POSES[name].mesh), imageLoader.loadAsync(POSES[name].tex)]).then(([{ scene }, img]) => {
        let mesh
        scene.traverse((o) => o.isMesh && (mesh = o))
        scene.updateMatrixWorld(true)
        const node = new THREE.Object3D()
        mesh.matrixWorld.decompose(node.position, node.quaternion, node.scale)
        mesh.geometry.computeBoundingBox()
        const map = img.isTexture ? img : new THREE.Texture(img)
        map.colorSpace = THREE.SRGBColorSpace
        map.flipY = false // glTF UV convention
        map.anisotropy = 8
        map.needsUpdate = true
        const box = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld)
        return { geometry: mesh.geometry, node, box, material: new THREE.MeshBasicMaterial({ map }) }
      }),
    )
  return poses.get(name)
}

// resolves once the pose can be drawn (or failed to load), for a loader to wait on
export const poseReady = (name) => loadPose(name).then(() => {}, () => {})

/*
 * Downloads poses into the browser's cache one after another, in the order given, so the first one a visitor
 * reaches arrives first instead of all of them sharing a slow connection. Only the download: a pose is decoded
 * when its scene mounts it, so poses nobody scrolls to never take up memory.
 */
export async function prefetchPoses(names) {
  for (const n of names) await Promise.all([POSES[n].mesh, POSES[n].tex].map((u) => fetch(u, { priority: 'low' }).then((r) => r.blob()).catch(() => {})))
}

// 3D hovers can't reach the DOM cursor via pointerover, so they announce themselves.
const cursorLabel = (label) => window.dispatchEvent(new CustomEvent('cursor-label', { detail: label }))

/*
 * Origin at his feet, shifted sideways so his bounding box is centred. `show` squishes him in and out like clay: width and height ride springs of different
 * stiffness, so the outgoing pose flattens and the incoming one stretches up and wobbles into place.
 * He turns toward the pointer (and drifts a little on his own, so phones see the depth too); click to make him hop.
 */
function Figure({ name, height, show, seed, shade, turn }) {
  const { geometry, node, box, material } = use(loadPose(name))
  const w = (box.max.x - box.min.x) * height
  const d = (box.max.z - box.min.z) * height
  const cx = ((box.max.x + box.min.x) / 2) * height // held props stick out to one side: centre the whole figure, not the feet
  const pop = useRef()
  const body = useRef()
  const sx = useRef({ x: 0, v: 0 })
  const sy = useRef({ x: 0, v: 0 })
  const jump = useRef({ x: 0, v: 0 })
  const lean = useRef({ x: 0, y: 0 })

  useFrame((state, dt) => {
    dt = Math.min(dt, 1 / 30)
    spring(sx.current, show ? 1 : 0, dt, 130, 11)
    spring(sy.current, show ? 1 : 0, dt, 260, 12)
    const x = Math.max(0, sx.current.x)
    const y = Math.max(0, sy.current.x)
    pop.current.visible = x > 0.002 && y > 0.002
    pop.current.scale.set(x, y, x)
    const j = jump.current
    spring(j, 0, dt, 90, 7)
    const up = Math.max(0, j.x)
    const t = state.clock.elapsedTime + seed * 7
    const idle = REDUCED ? 0 : 1
    const a = aim(state)
    const l = lean.current
    const k = 1 - Math.exp(-dt * 4)
    l.x += (a.x - l.x) * k
    l.y += (a.y - l.y) * k
    const st = j.x * 0.06
    body.current.position.y = up * height * 0.16
    body.current.scale.set(1 - st * 0.5, 1 + st + Math.sin(t * 2.2) * 0.008 * idle, 1 - st * 0.5)
    // he's modelled all round, so he can turn well toward the pointer (~±40° with the drift)
    body.current.rotation.set(
      -l.y * 0.08,
      turn + l.x * 0.55 + Math.sin(t * 0.45) * 0.14 * idle,
      Math.sin(t * 0.8) * 0.02 * idle - l.x * 0.02,
    )
  })

  return (
    <group ref={pop} scale={0} position-x={-cx}>
      {shade && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.002} scale={[w * 1.1, Math.max(d, w * 0.5) * 1.1, 1]} raycast={() => null}>
          <planeGeometry />
          <meshBasicMaterial map={getShadeMap()} transparent depthWrite={false} />
        </mesh>
      )}
      <group ref={body}>
        <group scale={height}>
          <mesh
            geometry={geometry}
            material={material}
            position={node.position}
            quaternion={node.quaternion}
            scale={node.scale}
            onClick={(e) => {
              e.stopPropagation()
              jump.current.v = 9
            }}
            onPointerOver={() => cursorLabel('Poke')}
            onPointerOut={() => cursorLabel(null)}
          />
        </group>
      </group>
    </group>
  )
}

// loads on its own, so a scene never waits on him
export function Mascot({ pose: name, height = 3, show = true, seed = 1, shade = true, turn = 0, ...props }) {
  return (
    <group {...props}>
      <Suspense fallback={null}>
        <Figure name={name} height={height} show={show} seed={seed} shade={shade} turn={turn} />
      </Suspense>
    </group>
  )
}

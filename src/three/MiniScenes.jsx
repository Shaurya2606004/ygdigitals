import { useThree } from '@react-three/fiber'
import { Mascot } from './Mascot'
import { SERVICES } from '../data'

// One pose per service, squished in as the service comes on screen; sized to the canvas (tall on desktop, wide on phones).
export function ServicesScene({ index, near = index }) {
  const { size, camera } = useThree()
  const hh = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z // visible half-height
  const hw = hh * (size.width / size.height)
  const h = Math.min(hh * 1.7, (hw * 1.7) / 0.71) // the widest pose is 0.68 of its height across, plus a little room
  // only the poses around `near` are mounted (each is ~1MB): the next one is ready, the last one can squish out
  return SERVICES.map(
    (x, i) => Math.abs(i - near) <= 1 && <Mascot key={x.id} pose={x.id} show={i === index} seed={i} height={h} position={[0, -h / 2, 0]} />,
  )
}

import * as THREE from 'three'
import type { BaselinePlaneId } from '../state/editorStore'

export type BaselinePlane = {
  id: BaselinePlaneId
  group: THREE.Group
  pickMesh: THREE.Mesh
  normal: THREE.Vector3
  uAxis: THREE.Vector3
  vAxis: THREE.Vector3
  origin: THREE.Vector3
}

type CreateBaselinePlanesOptions = {
  size?: number
  gridStep?: number
}

function createGridLines(size: number, gridStep: number) {
  const half = size / 2
  const points: number[] = []

  const addLine = (x1: number, y1: number, x2: number, y2: number) => {
    points.push(x1, y1, 0, x2, y2, 0)
  }

  for (let p = -half; p <= half + 1e-6; p += gridStep) {
    // vertical line (x = p)
    addLine(p, -half, p, half)
    // horizontal line (y = p)
    addLine(-half, p, half, p)
  }

  // axis lines
  addLine(-half, 0, half, 0)
  addLine(0, -half, 0, half)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  const mat = new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.65 })
  return new THREE.LineSegments(geo, mat)
}

function createPlaneVisual(size: number, color: number) {
  const geo = new THREE.PlaneGeometry(size, size)
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  return new THREE.Mesh(geo, mat)
}

export function createBaselinePlanes(options: CreateBaselinePlanesOptions = {}) {
  const size = options.size ?? 300
  const gridStep = options.gridStep ?? 10

  const make = (id: BaselinePlaneId, color: number) => {
    const group = new THREE.Group()
    group.name = `baselinePlaneGroup_${id}`

    const pickMesh = createPlaneVisual(size, color)
    pickMesh.name = `baselinePlane_${id}`
    pickMesh.userData = { planeId: id }

    const grid = createGridLines(size, gridStep)
    grid.name = `baselineGrid_${id}`

    group.add(pickMesh)
    group.add(grid)

    const origin = new THREE.Vector3(0, 0, 0)
    let normal = new THREE.Vector3()
    let uAxis = new THREE.Vector3()
    let vAxis = new THREE.Vector3()

    if (id === 'XY') {
      // local plane is already XY, normal +Z
      normal = new THREE.Vector3(0, 0, 1)
      uAxis = new THREE.Vector3(1, 0, 0)
      vAxis = new THREE.Vector3(0, 1, 0)
    } else if (id === 'YZ') {
      // rotate plane so normal points +X
      group.rotateY(Math.PI / 2)
      normal = new THREE.Vector3(1, 0, 0)
      uAxis = new THREE.Vector3(0, 1, 0)
      vAxis = new THREE.Vector3(0, 0, 1)
    } else {
      // ZX: y=0, normal +Y
      group.rotateX(-Math.PI / 2)
      normal = new THREE.Vector3(0, 1, 0)
      uAxis = new THREE.Vector3(0, 0, 1)
      vAxis = new THREE.Vector3(1, 0, 0)
    }

    return {
      id,
      group,
      pickMesh,
      origin,
      normal,
      uAxis,
      vAxis,
    } satisfies BaselinePlane
  }

  const planes: BaselinePlane[] = [
    make('XY', 0x60a5fa), // blue-ish
    make('YZ', 0x34d399), // green-ish
    make('ZX', 0xfbbf24), // amber-ish
  ]

  return planes
}



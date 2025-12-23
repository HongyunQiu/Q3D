import * as THREE from 'three'
import type { Vec2 } from '../state/editorStore'

export type PlaneBasis = {
  origin: THREE.Vector3
  normal: THREE.Vector3
  uAxis: THREE.Vector3
  vAxis: THREE.Vector3
}

export function worldToUV(world: THREE.Vector3, basis: PlaneBasis): Vec2 {
  const v = world.clone().sub(basis.origin)
  return {
    x: v.dot(basis.uAxis),
    y: v.dot(basis.vAxis),
  }
}

export function uvToWorld(uv: Vec2, basis: PlaneBasis): THREE.Vector3 {
  return basis.origin
    .clone()
    .add(basis.uAxis.clone().multiplyScalar(uv.x))
    .add(basis.vAxis.clone().multiplyScalar(uv.y))
}

export function snapUV(uv: Vec2, grid: number): Vec2 {
  return {
    x: Math.round(uv.x / grid) * grid,
    y: Math.round(uv.y / grid) * grid,
  }
}



import * as THREE from 'three'
import type { SketchEntity } from '../state/editorStore'
import { uvToWorld, type PlaneBasis } from './planeMath'

export class SketchSystem {
  private group = new THREE.Group()
  private basis: PlaneBasis | null = null
  private mat = new THREE.LineBasicMaterial({ color: 0xe6e8ee, transparent: true, opacity: 0.95 })
  private zOffset = 0.3

  constructor(scene: THREE.Scene) {
    this.group.name = 'sketchGroup'
    scene.add(this.group)
  }

  setPlaneBasis(basis: PlaneBasis | null) {
    this.basis = basis
  }

  setEntities(entities: SketchEntity[], draft: SketchEntity | null = null) {
    this.group.clear()
    if (!this.basis) return

    const list = draft ? [...entities, draft] : entities
    for (const e of list) {
      const obj = this.entityToObject3D(e, this.basis)
      if (obj) this.group.add(obj)
    }
  }

  dispose() {
    this.group.clear()
    this.mat.dispose()
  }

  private entityToObject3D(entity: SketchEntity, basis: PlaneBasis): THREE.Object3D | null {
    if (entity.type === 'line') {
      return this.makePolyline([entity.a, entity.b], basis)
    }

    if (entity.type === 'rect') {
      const x1 = entity.a.x
      const y1 = entity.a.y
      const x2 = entity.b.x
      const y2 = entity.b.y
      const a = { x: x1, y: y1 }
      const b = { x: x2, y: y1 }
      const c = { x: x2, y: y2 }
      const d = { x: x1, y: y2 }
      return this.makePolyline([a, b, c, d, a], basis)
    }

    if (entity.type === 'circle') {
      const segments = 64
      const pts: { x: number; y: number }[] = []
      for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * Math.PI * 2
        pts.push({ x: entity.c.x + Math.cos(t) * entity.r, y: entity.c.y + Math.sin(t) * entity.r })
      }
      return this.makePolyline(pts, basis)
    }

    return null
  }

  private makePolyline(uvPoints: { x: number; y: number }[], basis: PlaneBasis) {
    const pos: number[] = []
    const offset = basis.normal.clone().multiplyScalar(this.zOffset)

    for (let i = 0; i < uvPoints.length; i++) {
      const w = uvToWorld(uvPoints[i], basis).add(offset)
      pos.push(w.x, w.y, w.z)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    const line = new THREE.Line(geo, this.mat)
    line.frustumCulled = false
    return line
  }
}



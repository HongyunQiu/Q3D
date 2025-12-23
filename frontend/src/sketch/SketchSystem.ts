import * as THREE from 'three'
import type { SketchEntity } from '../state/editorStore'
import { uvToWorld, type PlaneBasis } from './planeMath'
import { extractSketchRegions } from './regions'

export class SketchSystem {
  private fillGroup = new THREE.Group()
  private group = new THREE.Group()
  private basis: PlaneBasis | null = null
  private mat = new THREE.LineBasicMaterial({ color: 0xe6e8ee, transparent: true, opacity: 0.95 })
  private zOffset = 0.3
  private fillMat = new THREE.MeshBasicMaterial({
    color: 0xe6e8ee,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  private fillZOffset = 0.12

  constructor(scene: THREE.Scene) {
    this.fillGroup.name = 'sketchFillGroup'
    scene.add(this.fillGroup)
    this.group.name = 'sketchGroup'
    scene.add(this.group)
  }

  setPlaneBasis(basis: PlaneBasis | null) {
    this.basis = basis
  }

  setEntities(entities: SketchEntity[], draft: SketchEntity | null = null) {
    this.fillGroup.clear()
    this.group.clear()
    if (!this.basis) return

    const list = draft ? [...entities, draft] : entities

    // 先渲染闭合区域填充（更淡颜色）
    const regions = extractSketchRegions(list)
    if (regions.length > 0) {
      const planeMatrix = this.makePlaneMatrix(this.basis)
      const offset = this.basis.normal.clone().multiplyScalar(this.fillZOffset)
      for (const r of regions) {
        const geo = new THREE.ShapeGeometry(r.shape, 24)
        const mesh = new THREE.Mesh(geo, this.fillMat)
        mesh.applyMatrix4(planeMatrix)
        mesh.position.add(offset)
        mesh.frustumCulled = false
        this.fillGroup.add(mesh)
      }
    }

    for (const e of list) {
      const obj = this.entityToObject3D(e, this.basis)
      if (obj) this.group.add(obj)
    }
  }

  dispose() {
    this.fillGroup.clear()
    this.group.clear()
    this.mat.dispose()
    this.fillMat.dispose()
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

  private makePlaneMatrix(basis: PlaneBasis) {
    const u = basis.uAxis.clone().normalize()
    const v = basis.vAxis.clone().normalize()
    const n = basis.normal.clone().normalize()
    const m = new THREE.Matrix4().makeBasis(u, v, n)
    m.setPosition(basis.origin)
    return m
  }
}



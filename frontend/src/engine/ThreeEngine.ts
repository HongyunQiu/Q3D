import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createBaselinePlanes, type BaselinePlane } from './createBaselinePlanes'
import { SketchSystem } from '../sketch/SketchSystem'
import type { SketchEntity } from '../state/editorStore'
import type { PlaneBasis } from '../sketch/planeMath'

export class ThreeEngine {
  private canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private rafId: number | null = null
  private resizeObserver: ResizeObserver | null = null
  private baselinePlanes: BaselinePlane[] = []
  private sketchSystem: SketchSystem

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0b0d12)

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 5000)
    this.camera.position.set(180, 140, 180)
    this.camera.lookAt(0, 0, 0)

    this.controls = new OrbitControls(this.camera, this.canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.screenSpacePanning = false

    const ambient = new THREE.AmbientLight(0xffffff, 0.45)
    this.scene.add(ambient)

    const dir = new THREE.DirectionalLight(0xffffff, 0.8)
    dir.position.set(120, 200, 120)
    this.scene.add(dir)

    const axes = new THREE.AxesHelper(120)
    // X=red, Y=green, Z=blue (Three.js default)
    this.scene.add(axes)

    const grid = new THREE.GridHelper(400, 40, 0x2b3a6a, 0x232734)
    grid.position.set(0, 0, 0)
    this.scene.add(grid)

    this.baselinePlanes = createBaselinePlanes({ size: 260, gridStep: 10 })
    for (const p of this.baselinePlanes) {
      this.scene.add(p.group)
    }

    this.sketchSystem = new SketchSystem(this.scene)
  }

  start() {
    this.handleResize()
    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(this.canvas.parentElement ?? this.canvas)
    this.tick()
  }

  dispose() {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }

    this.resizeObserver?.disconnect()
    this.resizeObserver = null

    this.controls.dispose()
    this.sketchSystem.dispose()
    this.renderer.dispose()
  }

  private tick = () => {
    this.rafId = requestAnimationFrame(this.tick)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  private handleResize() {
    const el = this.canvas.parentElement ?? this.canvas
    const rect = el.getBoundingClientRect()
    const width = Math.max(1, Math.floor(rect.width))
    const height = Math.max(1, Math.floor(rect.height))

    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  getPickablePlaneMeshes(): THREE.Object3D[] {
    return this.baselinePlanes.map((p) => p.pickMesh)
  }

  getPlanePickMesh(planeId: string): THREE.Object3D | null {
    return this.baselinePlanes.find((p) => p.id === planeId)?.pickMesh ?? null
  }

  getPlaneBasis(planeId: string): PlaneBasis | null {
    const plane = this.baselinePlanes.find((p) => p.id === planeId) ?? null
    if (!plane) return null
    return {
      origin: plane.origin.clone(),
      normal: plane.normal.clone(),
      uAxis: plane.uAxis.clone(),
      vAxis: plane.vAxis.clone(),
    }
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera
  }

  setActivePlane(id: string | null) {
    for (const p of this.baselinePlanes) {
      const mat = p.pickMesh.material as THREE.MeshBasicMaterial
      const isActive = id != null && p.id === id
      mat.opacity = isActive ? 0.18 : 0.08
    }
  }

  updateSketch(planeId: string | null, entities: SketchEntity[], draft: SketchEntity | null = null) {
    if (!planeId) {
      this.sketchSystem.setPlaneBasis(null)
      this.sketchSystem.setEntities([], null)
      return
    }

    const plane = this.baselinePlanes.find((p) => p.id === planeId) ?? null
    if (!plane) return

    this.sketchSystem.setPlaneBasis({
      origin: plane.origin.clone(),
      normal: plane.normal.clone(),
      uAxis: plane.uAxis.clone(),
      vAxis: plane.vAxis.clone(),
    })
    this.sketchSystem.setEntities(entities, draft)
  }
}



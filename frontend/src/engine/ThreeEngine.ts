import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createBaselinePlanes, type BaselinePlane } from './createBaselinePlanes'
import { SketchSystem } from '../sketch/SketchSystem'
import type { SketchEntity } from '../state/editorStore'
import type { PlaneBasis } from '../sketch/planeMath'
import type { EditorMode } from '../state/editorStore'
import { extractSketchRegions } from '../sketch/regions'

type OpResult = { ok: true } | { ok: false; message: string }

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
  private solidGroup = new THREE.Group()

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
    // 交互约定：仅在按住中键（滚轮按钮）拖拽时旋转场景；左键用于选面/绘制。
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN,
    }
    // 为简化交互：禁用平移；保留缩放（滚轮）与中键旋转
    this.controls.enablePan = false
    this.controls.enableRotate = true
    this.controls.enableZoom = true

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
    this.solidGroup.name = 'solidGroup'
    this.scene.add(this.solidGroup)
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

  setEditorMode(mode: EditorMode) {
    // 统一约定：旋转只用中键拖拽；左键留给选面/绘制。
    // 目前 view/sketch 两种模式的轨道配置一致，仅保留入口用于后续扩展。
    void mode
    this.controls.enablePan = false
    this.controls.enableRotate = true
    this.controls.enableZoom = true
  }

  focusOnPlane(planeId: string) {
    const basis = this.getPlaneBasis(planeId)
    if (!basis) return

    const target = basis.origin.clone()
    const normal = basis.normal.clone().normalize()
    const up = basis.vAxis.clone().normalize()

    // 让相机正视该平面：相机位于法向方向一定距离处，up 方向对齐 vAxis
    const dist = 360
    this.controls.target.copy(target)
    this.camera.up.copy(up)
    this.camera.position.copy(target.clone().add(normal.multiplyScalar(dist)))
    this.camera.lookAt(target)
    this.camera.updateProjectionMatrix()
    this.controls.update()
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

  extrudeBoss(planeId: string, entities: SketchEntity[], height: number): OpResult {
    const basis = this.getPlaneBasis(planeId)
    if (!basis) return { ok: false, message: '未找到当前平面的坐标系。' }
    if (!Number.isFinite(height) || height <= 0) return { ok: false, message: '拉伸高度必须大于 0。' }

    const regions = extractSketchRegions(entities)
    if (regions.length === 0) {
      return { ok: false, message: '当前平面未检测到可拉伸的闭合区域（请先绘制闭合轮廓，例如矩形/圆，或用线段闭合成环）。' }
    }

    const u = basis.uAxis.clone().normalize()
    const v = basis.vAxis.clone().normalize()
    const n = basis.normal.clone().normalize()
    const m = new THREE.Matrix4().makeBasis(u, v, n)
    m.setPosition(basis.origin)

    const mat = new THREE.MeshStandardMaterial({
      color: 0x9ca3af,
      metalness: 0.05,
      roughness: 0.55,
    })

    for (const r of regions) {
      const geom = new THREE.ExtrudeGeometry(r.shape, {
        depth: height,
        steps: 1,
        bevelEnabled: false,
      })
      geom.computeVertexNormals()
      const mesh = new THREE.Mesh(geom, mat)
      mesh.applyMatrix4(m)
      mesh.castShadow = false
      mesh.receiveShadow = false
      mesh.name = `solid_extrude_boss_${Date.now()}`
      this.solidGroup.add(mesh)
    }

    return { ok: true }
  }
}



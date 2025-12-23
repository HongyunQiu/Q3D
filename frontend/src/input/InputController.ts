import * as THREE from 'three'
import type { BaselinePlaneId, SketchEntity, Vec2, SketchPlane } from '../state/editorStore'
import { useEditorStore } from '../state/editorStore'
import type { ThreeEngine } from '../engine/ThreeEngine'
import { snapUV, worldToUV } from '../sketch/planeMath'

export class InputController {
  private canvas: HTMLCanvasElement
  private engine: ThreeEngine
  private raycaster = new THREE.Raycaster()
  private drawing:
    | null
    | { tool: 'line' | 'rect'; start: Vec2 }
    | { tool: 'circle'; center: Vec2 } = null

  constructor(canvas: HTMLCanvasElement, engine: ThreeEngine) {
    this.canvas = canvas
    this.engine = engine
  }

  attach() {
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('keydown', this.onKeyDown)
  }

  detach() {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('keydown', this.onKeyDown)
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const isCtrl = e.ctrlKey || e.metaKey
    if (isCtrl && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      if (e.shiftKey) useEditorStore.getState().redo()
      else useEditorStore.getState().undo()
      return
    }
    if (isCtrl && e.key.toLowerCase() === 'y') {
      e.preventDefault()
      useEditorStore.getState().redo()
      return
    }

    if (e.key === 'Escape') {
      useEditorStore.getState().setMode('view')
      useEditorStore.getState().setActivePlane(null)
      useEditorStore.getState().setSelectedSurface({ kind: 'none' })
      useEditorStore.getState().setSketchPlane(null)
      useEditorStore.getState().setDraftEntity(null)
      this.engine.setActivePlane(null)
      this.engine.clearSelectedFace()
      this.drawing = null
    }
  }

  private onPointerDown = (e: PointerEvent) => {
    // only left click / primary
    if (e.button !== 0) return

    const rect = this.canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)

    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.engine.getCamera())
    const hits = this.raycaster.intersectObjects(this.engine.getPickableObjects(), true)
    const hit = hits[0]
    const mode = useEditorStore.getState().mode
    const entityTool = useEditorStore.getState().entityTool

    // 实体特征“选择面”模式：仅选择平面/实体面，不进入草图也不绘制
    if (entityTool === 'select_face') {
      this.drawing = null
      useEditorStore.getState().setDraftEntity(null)

      if (!hit) {
        useEditorStore.getState().setSelectedSurface({ kind: 'none' })
        this.engine.setActivePlane(null)
        this.engine.clearSelectedFace()
        return
      }

      const planeId = (hit.object.userData?.planeId ?? null) as BaselinePlaneId | null
      if (planeId) {
        useEditorStore.getState().setSelectedSurface({ kind: 'baselinePlane', planeId })
        this.engine.clearSelectedFace()
        this.engine.setActivePlane(planeId)
        return
      }

      const face = this.engine.highlightFaceFromIntersection(hit)
      if (face) {
        useEditorStore.getState().setSelectedSurface({
          kind: 'solidFace',
          objectName: face.objectName,
          point: { x: face.point.x, y: face.point.y, z: face.point.z },
          normal: { x: face.normal.x, y: face.normal.y, z: face.normal.z },
        })
        this.engine.setActivePlane(null)
      }
      return
    }

    // In view mode: only handle plane selection.
    if (mode === 'view') {
      if (!hit) return
      const planeId = (hit.object.userData?.planeId ?? null) as BaselinePlaneId | null
      if (planeId) {
        useEditorStore.getState().setSelectedSurface({ kind: 'baselinePlane', planeId })
        this.engine.clearSelectedFace()
        useEditorStore.getState().setActivePlane(planeId)
        useEditorStore.getState().setSketchPlane({ kind: 'baselinePlane', planeId })
        useEditorStore.getState().setMode('sketch')
        this.engine.setActivePlane(planeId)
        this.engine.focusOnPlane(planeId)
        return
      }

      // Solid face selection
      const face = this.engine.highlightFaceFromIntersection(hit)
      if (face) {
        useEditorStore.getState().setSelectedSurface({
          kind: 'solidFace',
          objectName: face.objectName,
          point: { x: face.point.x, y: face.point.y, z: face.point.z },
          normal: { x: face.normal.x, y: face.normal.y, z: face.normal.z },
        })
      }
      return
    }

    // In sketch mode: allow clicking planes to switch active plane, and draw on active plane.
    if (hit) {
      const planeId = (hit.object.userData?.planeId ?? null) as BaselinePlaneId | null
      if (planeId) {
        useEditorStore.getState().setSelectedSurface({ kind: 'baselinePlane', planeId })
        useEditorStore.getState().setActivePlane(planeId)
        useEditorStore.getState().setSketchPlane({ kind: 'baselinePlane', planeId })
        this.engine.setActivePlane(planeId)
        this.engine.focusOnPlane(planeId)
      }
    }

    const sketchPlane = useEditorStore.getState().sketchPlane
    if (!sketchPlane) return

    const uv = this.getSnappedUVForSketchPlane(sketchPlane, x, y)
    if (!uv) return

    const tool = useEditorStore.getState().tool
    if (tool === 'select') return

    if (!this.drawing) {
      // start drawing
      if (tool === 'line' || tool === 'rect') {
        this.drawing = { tool, start: uv }
        useEditorStore.getState().setDraftEntity(this.makeDraft(tool, uv, uv))
      } else if (tool === 'circle') {
        this.drawing = { tool: 'circle', center: uv }
        useEditorStore.getState().setDraftEntity(this.makeDraft('circle', uv, uv))
      }
      return
    }

    // finish drawing
    const current = useEditorStore.getState().sketchEntities
    const id = crypto.randomUUID()
    let entity: SketchEntity | null = null

    if (this.drawing.tool === 'line') {
      entity = { id, type: 'line', a: this.drawing.start, b: uv }
    } else if (this.drawing.tool === 'rect') {
      entity = { id, type: 'rect', a: this.drawing.start, b: uv }
    } else if (this.drawing.tool === 'circle') {
      const dx = uv.x - this.drawing.center.x
      const dy = uv.y - this.drawing.center.y
      const r = Math.sqrt(dx * dx + dy * dy)
      entity = { id, type: 'circle', c: this.drawing.center, r }
    }

    if (entity) {
      useEditorStore.getState().commitEntities([...current, entity])
    } else {
      useEditorStore.getState().setDraftEntity(null)
    }

    this.drawing = null
  }

  private onPointerMove = (e: PointerEvent) => {
    // 按住中键旋转时，不更新草图预览，避免误触
    if ((e.buttons & 4) !== 0) return
    if (!this.drawing) return
    if (useEditorStore.getState().mode !== 'sketch') return

    const sketchPlane = useEditorStore.getState().sketchPlane
    if (!sketchPlane) return

    const rect = this.canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
    const uv = this.getSnappedUVForSketchPlane(sketchPlane, x, y)
    if (!uv) return

    if (this.drawing.tool === 'line') {
      useEditorStore.getState().setDraftEntity(this.makeDraft('line', this.drawing.start, uv))
    } else if (this.drawing.tool === 'rect') {
      useEditorStore.getState().setDraftEntity(this.makeDraft('rect', this.drawing.start, uv))
    } else if (this.drawing.tool === 'circle') {
      useEditorStore.getState().setDraftEntity(this.makeDraft('circle', this.drawing.center, uv))
    }
  }

  private getSnappedUVForSketchPlane(
    sketchPlane: SketchPlane,
    ndcX: number,
    ndcY: number,
  ): Vec2 | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.engine.getCamera())

    if (sketchPlane.kind === 'baselinePlane') {
      const basis = this.engine.getPlaneBasis(sketchPlane.planeId)
      const mesh = this.engine.getPlanePickMesh(sketchPlane.planeId)
      if (!basis || !mesh) return null
      const hits = this.raycaster.intersectObjects([mesh], false)
      const hit = hits[0]
      if (!hit) return null
      const uv = worldToUV(hit.point, basis)
      const snapEnabled = useEditorStore.getState().snapEnabled
      const gridSize = useEditorStore.getState().gridSize
      return snapEnabled ? snapUV(uv, gridSize) : uv
    }

    const mesh = this.engine.getDynamicSketchPickPlane()
    if (!mesh) return null
    const basis = {
      origin: new THREE.Vector3(sketchPlane.origin.x, sketchPlane.origin.y, sketchPlane.origin.z),
      normal: new THREE.Vector3(sketchPlane.normal.x, sketchPlane.normal.y, sketchPlane.normal.z),
      uAxis: new THREE.Vector3(sketchPlane.uAxis.x, sketchPlane.uAxis.y, sketchPlane.uAxis.z),
      vAxis: new THREE.Vector3(sketchPlane.vAxis.x, sketchPlane.vAxis.y, sketchPlane.vAxis.z),
    }
    const hits = this.raycaster.intersectObjects([mesh], false)
    const hit = hits[0]
    if (!hit) return null
    const uv = worldToUV(hit.point, basis)
    const snapEnabled = useEditorStore.getState().snapEnabled
    const gridSize = useEditorStore.getState().gridSize
    return snapEnabled ? snapUV(uv, gridSize) : uv
  }

  private makeDraft(tool: 'line' | 'rect' | 'circle', a: Vec2, b: Vec2): SketchEntity {
    if (tool === 'line') return { id: '__draft__', type: 'line', a, b }
    if (tool === 'rect') return { id: '__draft__', type: 'rect', a, b }
    const dx = b.x - a.x
    const dy = b.y - a.y
    const r = Math.sqrt(dx * dx + dy * dy)
    return { id: '__draft__', type: 'circle', c: a, r }
  }
}



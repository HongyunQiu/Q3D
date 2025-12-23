import * as THREE from 'three'
import type { BaselinePlaneId, SketchEntity, Vec2 } from '../state/editorStore'
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
      useEditorStore.getState().setDraftEntity(null)
      this.engine.setActivePlane(null)
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
    const hits = this.raycaster.intersectObjects(this.engine.getPickablePlaneMeshes(), false)
    const hit = hits[0]
    const mode = useEditorStore.getState().mode

    // In view mode: only handle plane selection.
    if (mode === 'view') {
      if (!hit) return
      const planeId = (hit.object.userData?.planeId ?? null) as BaselinePlaneId | null
      if (!planeId) return

      useEditorStore.getState().setActivePlane(planeId)
      useEditorStore.getState().setMode('sketch')
      this.engine.setActivePlane(planeId)
      return
    }

    // In sketch mode: allow clicking planes to switch active plane, and draw on active plane.
    if (hit) {
      const planeId = (hit.object.userData?.planeId ?? null) as BaselinePlaneId | null
      if (planeId) {
        useEditorStore.getState().setActivePlane(planeId)
        this.engine.setActivePlane(planeId)
      }
    }

    const activePlane = useEditorStore.getState().activePlane
    if (!activePlane) return

    const uv = this.getSnappedUV(activePlane, x, y)
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
    if (!this.drawing) return
    if (useEditorStore.getState().mode !== 'sketch') return

    const activePlane = useEditorStore.getState().activePlane
    if (!activePlane) return

    const rect = this.canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
    const uv = this.getSnappedUV(activePlane, x, y)
    if (!uv) return

    if (this.drawing.tool === 'line') {
      useEditorStore.getState().setDraftEntity(this.makeDraft('line', this.drawing.start, uv))
    } else if (this.drawing.tool === 'rect') {
      useEditorStore.getState().setDraftEntity(this.makeDraft('rect', this.drawing.start, uv))
    } else if (this.drawing.tool === 'circle') {
      useEditorStore.getState().setDraftEntity(this.makeDraft('circle', this.drawing.center, uv))
    }
  }

  private getSnappedUV(planeId: BaselinePlaneId, ndcX: number, ndcY: number): Vec2 | null {
    const basis = this.engine.getPlaneBasis(planeId)
    const mesh = this.engine.getPlanePickMesh(planeId)
    if (!basis || !mesh) return null

    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.engine.getCamera())
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



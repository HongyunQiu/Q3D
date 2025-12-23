import { useEffect, useRef } from 'react'
import styles from './threeViewport.module.css'
import { ThreeEngine } from '../engine/ThreeEngine'
import { InputController } from '../input/InputController'
import { useEditorStore } from '../state/editorStore'
import * as THREE from 'three'

export function ThreeViewport() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<ThreeEngine | null>(null)
  const inputRef = useRef<InputController | null>(null)
  const sketchEntities = useEditorStore((s) => s.sketchEntities)
  const draftEntity = useEditorStore((s) => s.draftEntity)
  const mode = useEditorStore((s) => s.mode)
  const sketchPlane = useEditorStore((s) => s.sketchPlane)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new ThreeEngine(canvas)
    engineRef.current = engine
    engine.start()
    useEditorStore.getState().setEngine(engine)

    const input = new InputController(canvas, engine)
    input.attach()
    inputRef.current = input

    return () => {
      inputRef.current?.detach()
      inputRef.current = null
      useEditorStore.getState().setEngine(null)
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [])

  // NOTE: 草图渲染由 sketchPlane 驱动（基准面/实体面都可）

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.setSketchPlane(sketchPlane)

    if (!sketchPlane) {
      engine.updateSketchBasis(null, sketchEntities, draftEntity)
      return
    }

    if (sketchPlane.kind === 'baselinePlane') {
      // 继续走原来的基准面渲染逻辑
      engine.updateSketch(sketchPlane.planeId, sketchEntities, draftEntity)
      return
    }

    const basis = {
      origin: new THREE.Vector3(sketchPlane.origin.x, sketchPlane.origin.y, sketchPlane.origin.z),
      normal: new THREE.Vector3(sketchPlane.normal.x, sketchPlane.normal.y, sketchPlane.normal.z),
      uAxis: new THREE.Vector3(sketchPlane.uAxis.x, sketchPlane.uAxis.y, sketchPlane.uAxis.z),
      vAxis: new THREE.Vector3(sketchPlane.vAxis.x, sketchPlane.vAxis.y, sketchPlane.vAxis.z),
    }
    engine.updateSketchBasis(basis, sketchEntities, draftEntity)
  }, [sketchPlane, sketchEntities, draftEntity])

  useEffect(() => {
    engineRef.current?.setEditorMode(mode)
  }, [mode])

  return (
    <div className={styles.root}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}



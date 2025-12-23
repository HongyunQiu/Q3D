import { useEffect, useRef } from 'react'
import styles from './threeViewport.module.css'
import { ThreeEngine } from '../engine/ThreeEngine'
import { InputController } from '../input/InputController'
import { useEditorStore } from '../state/editorStore'

export function ThreeViewport() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<ThreeEngine | null>(null)
  const inputRef = useRef<InputController | null>(null)
  const activePlane = useEditorStore((s) => s.activePlane)
  const sketchEntities = useEditorStore((s) => s.sketchEntities)
  const draftEntity = useEditorStore((s) => s.draftEntity)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new ThreeEngine(canvas)
    engineRef.current = engine
    engine.start()

    const input = new InputController(canvas, engine)
    input.attach()
    inputRef.current = input

    return () => {
      inputRef.current?.detach()
      inputRef.current = null
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    engineRef.current?.updateSketch(activePlane, sketchEntities, draftEntity)
  }, [activePlane, sketchEntities, draftEntity])

  return (
    <div className={styles.root}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}



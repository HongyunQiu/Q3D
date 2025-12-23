import styles from './toolbar.module.css'
import { useEditorStore } from '../state/editorStore'
import * as THREE from 'three'

export function Toolbar() {
  const tool = useEditorStore((s) => s.tool)
  const setTool = useEditorStore((s) => s.setTool)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const selectedSurface = useEditorStore((s) => s.selectedSurface)
  const setMode = useEditorStore((s) => s.setMode)
  const setActivePlane = useEditorStore((s) => s.setActivePlane)
  const setSketchPlane = useEditorStore((s) => s.setSketchPlane)
  const resetSketch = useEditorStore((s) => s.resetSketch)
  const setEntityTool = useEditorStore((s) => s.setEntityTool)
  const engine = useEditorStore((s) => s.engine)

  const canCreateSketch = selectedSurface.kind !== 'none' && !!engine

  return (
    <div className={styles.root}>
      <div className={styles.hint}>草图绘制</div>

      <div className={styles.group}>
        <button
          type="button"
          disabled={!canCreateSketch}
          onClick={() => {
            if (!engine) return
            if (selectedSurface.kind === 'none') return

            // 退出“选择面”模式，否则 InputController 会拦截绘制
            setEntityTool('none')
            resetSketch()

            if (selectedSurface.kind === 'baselinePlane') {
              const planeId = selectedSurface.planeId
              setSketchPlane({ kind: 'baselinePlane', planeId })
              setActivePlane(planeId)
              engine.setActivePlane(planeId)
              engine.clearSelectedFace()
              engine.focusOnPlane(planeId)
              setMode('sketch')
              return
            }

            // solid face → dynamic sketch plane
            const origin = new THREE.Vector3(selectedSurface.point.x, selectedSurface.point.y, selectedSurface.point.z)
            const normal = new THREE.Vector3(selectedSurface.normal.x, selectedSurface.normal.y, selectedSurface.normal.z).normalize()
            const upCandidate =
              Math.abs(normal.dot(new THREE.Vector3(0, 1, 0))) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
            const u = upCandidate.clone().cross(normal).normalize()
            const v = normal.clone().cross(u).normalize()

            setSketchPlane({
              kind: 'solidFace',
              origin: { x: origin.x, y: origin.y, z: origin.z },
              normal: { x: normal.x, y: normal.y, z: normal.z },
              uAxis: { x: u.x, y: u.y, z: u.z },
              vAxis: { x: v.x, y: v.y, z: v.z },
            })
            setActivePlane(null)
            engine.setActivePlane(null)
            engine.focusOnBasis({ origin, normal, uAxis: u, vAxis: v })
            setMode('sketch')
          }}
          title={canCreateSketch ? '基于当前选中面创建新草图（会清空当前草图）' : '请先选择一个面（基准面/实体面）'}
        >
          创建新草图
        </button>
      </div>

      <div className={styles.group}>
        <button
          className={tool === 'select' ? styles.active : undefined}
          onClick={() => setTool('select')}
          type="button"
        >
          选择
        </button>
        <button
          className={tool === 'line' ? styles.active : undefined}
          onClick={() => setTool('line')}
          type="button"
        >
          线段
        </button>
        <button
          className={tool === 'rect' ? styles.active : undefined}
          onClick={() => setTool('rect')}
          type="button"
        >
          矩形
        </button>
        <button
          className={tool === 'circle' ? styles.active : undefined}
          onClick={() => setTool('circle')}
          type="button"
        >
          圆
        </button>
      </div>

      <div className={styles.group}>
        <button onClick={undo} type="button">
          撤销
        </button>
        <button onClick={redo} type="button">
          重做
        </button>
      </div>

      <div className={styles.note}>
        提示：点击任意基准面进入草图；两次点击完成绘制；Ctrl+Z/Ctrl+Y 撤销/重做；Esc 退出草图。
      </div>
    </div>
  )
}



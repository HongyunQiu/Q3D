import { useMemo, useState } from 'react'
import styles from './extrudeBossDialog.module.css'
import { useEditorStore } from '../state/editorStore'

export function ExtrudeBossDialog() {
  const entityTool = useEditorStore((s) => s.entityTool)
  const setEntityTool = useEditorStore((s) => s.setEntityTool)
  const activePlane = useEditorStore((s) => s.activePlane)
  const mode = useEditorStore((s) => s.mode)
  const engine = useEditorStore((s) => s.engine)
  const sketchEntities = useEditorStore((s) => s.sketchEntities)
  const setMode = useEditorStore((s) => s.setMode)
  const setActivePlane = useEditorStore((s) => s.setActivePlane)
  const setDraftEntity = useEditorStore((s) => s.setDraftEntity)
  const setTool = useEditorStore((s) => s.setTool)

  const open = entityTool === 'extrude_boss'
  const disabled = mode !== 'sketch' || !activePlane || !engine

  const [heightText, setHeightText] = useState('20')
  const height = useMemo(() => Number(heightText), [heightText])

  if (!open) return null

  const close = () => setEntityTool('none')

  const onConfirm = () => {
    if (disabled) {
      alert('请先选择一个基准面进入草图。')
      return
    }
    if (!Number.isFinite(height) || height <= 0) {
      alert('拉伸高度必须是大于 0 的数字。')
      return
    }

    const result = engine.extrudeBoss(activePlane, sketchEntities, height)
    if (!result.ok) {
      alert(result.message)
      return
    }

    // 拉伸成功：退出草图模式，恢复视图旋转
    setEntityTool('none')
    setDraftEntity(null)
    setTool('select')
    setMode('view')
    setActivePlane(null)
    engine.setActivePlane(null)
  }

  return (
    <div className={styles.backdrop} onMouseDown={close} role="presentation">
      <div className={styles.dialog} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.title}>拉伸凸台</div>

        <div className={styles.row}>
          <label className={styles.label} htmlFor="extrudeHeight">
            高度
          </label>
          <input
            id="extrudeHeight"
            className={styles.input}
            type="number"
            step={1}
            min={0.001}
            value={heightText}
            onChange={(e) => setHeightText(e.target.value)}
            autoFocus
          />
        </div>

        <div className={styles.hint}>
          说明：需要草图中存在闭合区域（当前实现优先支持矩形/圆；线段闭合环为次级支持）。
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.btn} onClick={close}>
            取消
          </button>
          <button type="button" className={styles.btnPrimary} onClick={onConfirm}>
            确认
          </button>
        </div>
      </div>
    </div>
  )
}



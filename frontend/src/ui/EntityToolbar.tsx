import styles from './entityToolbar.module.css'
import { useEditorStore } from '../state/editorStore'

export function EntityToolbar() {
  const entityTool = useEditorStore((s) => s.entityTool)
  const setEntityTool = useEditorStore((s) => s.setEntityTool)
  const activePlane = useEditorStore((s) => s.activePlane)
  const mode = useEditorStore((s) => s.mode)

  const disabled = mode !== 'sketch' || !activePlane

  return (
    <div className={styles.root}>
      <div className={styles.hint}>实体特征</div>
      <div className={styles.group}>
        <button
          type="button"
          disabled={disabled}
          className={entityTool === 'extrude_boss' ? styles.active : undefined}
          onClick={() => setEntityTool(entityTool === 'extrude_boss' ? 'none' : 'extrude_boss')}
          title={disabled ? '请先选择一个基准面进入草图' : '基于当前草图执行拉伸凸台（占位）'}
        >
          拉伸凸台
        </button>
        <button
          type="button"
          disabled={disabled}
          className={entityTool === 'extrude_cut' ? styles.active : undefined}
          onClick={() => setEntityTool(entityTool === 'extrude_cut' ? 'none' : 'extrude_cut')}
          title={disabled ? '请先选择一个基准面进入草图' : '基于当前草图执行拉伸切除（占位）'}
        >
          拉伸切除
        </button>
      </div>
      <div className={styles.note}>
        当前：{disabled ? '不可用（需先进入草图）' : entityTool === 'none' ? '未选择' : entityTool}
      </div>
    </div>
  )
}



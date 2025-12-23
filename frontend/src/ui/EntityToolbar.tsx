import styles from './entityToolbar.module.css'
import { useEditorStore } from '../state/editorStore'

export function EntityToolbar() {
  const entityTool = useEditorStore((s) => s.entityTool)
  const setEntityTool = useEditorStore((s) => s.setEntityTool)
  const mode = useEditorStore((s) => s.mode)
  const setMode = useEditorStore((s) => s.setMode)
  const setTool = useEditorStore((s) => s.setTool)
  const setDraftEntity = useEditorStore((s) => s.setDraftEntity)
  const sketchPlane = useEditorStore((s) => s.sketchPlane)

  const canExtrude = mode === 'sketch' && !!sketchPlane

  return (
    <div className={styles.root}>
      <div className={styles.hint}>实体特征</div>
      <div className={styles.group}>
        <button
          type="button"
          className={entityTool === 'select_face' ? styles.active : undefined}
          onClick={() => {
            const next = entityTool === 'select_face' ? 'none' : 'select_face'
            setEntityTool(next)
            if (next === 'select_face') {
              // 切换到“选择面”时，明确进入视图模式，避免与草图绘制冲突
              setDraftEntity(null)
              setTool('select')
              setMode('view')
            }
          }}
          title="仅用于选择面：基准面与实体面（不进入草图、不绘制）"
        >
          选择面
        </button>
        <button
          type="button"
          disabled={!canExtrude}
          className={entityTool === 'extrude_boss' ? styles.active : undefined}
          onClick={() => setEntityTool(entityTool === 'extrude_boss' ? 'none' : 'extrude_boss')}
          title={canExtrude ? '基于当前草图执行拉伸凸台' : '请先在某个面上创建新草图并进入草图模式'}
        >
          拉伸凸台
        </button>
        <button
          type="button"
          disabled={!canExtrude}
          className={entityTool === 'extrude_cut' ? styles.active : undefined}
          onClick={() => setEntityTool(entityTool === 'extrude_cut' ? 'none' : 'extrude_cut')}
          title={canExtrude ? '基于当前草图执行拉伸切除（待实现）' : '请先在某个面上创建新草图并进入草图模式'}
        >
          拉伸切除
        </button>
      </div>
      <div className={styles.note}>
        当前：{canExtrude ? (entityTool === 'none' ? '未选择' : entityTool) : '不可用（需先创建新草图）'}
      </div>
    </div>
  )
}



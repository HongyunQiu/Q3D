import styles from './toolbar.module.css'
import { useEditorStore } from '../state/editorStore'

export function Toolbar() {
  const tool = useEditorStore((s) => s.tool)
  const setTool = useEditorStore((s) => s.setTool)
  const mode = useEditorStore((s) => s.mode)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)

  return (
    <div className={styles.root}>
      <div className={styles.hint}>模式：{mode === 'view' ? '视图' : '草图'}</div>

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



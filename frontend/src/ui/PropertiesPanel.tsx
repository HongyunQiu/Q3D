import styles from './propertiesPanel.module.css'
import { useEditorStore } from '../state/editorStore'

export function PropertiesPanel() {
  const activePlane = useEditorStore((s) => s.activePlane)
  const gridSize = useEditorStore((s) => s.gridSize)
  const snapEnabled = useEditorStore((s) => s.snapEnabled)
  const setGridSize = useEditorStore((s) => s.setGridSize)
  const setSnapEnabled = useEditorStore((s) => s.setSnapEnabled)

  return (
    <div className={styles.root}>
      <div className={styles.row}>
        <div className={styles.label}>当前平面</div>
        <div className={styles.value}>{activePlane ?? '-'}</div>
      </div>

      <div className={styles.row}>
        <label className={styles.label} htmlFor="gridSize">
          网格间距
        </label>
        <input
          id="gridSize"
          className={styles.input}
          type="number"
          step={0.5}
          min={0.1}
          value={gridSize}
          onChange={(e) => setGridSize(Math.max(0.1, Number(e.target.value)))}
        />
      </div>

      <div className={styles.row}>
        <label className={styles.label} htmlFor="snapEnabled">
          网格捕捉
        </label>
        <input
          id="snapEnabled"
          type="checkbox"
          checked={snapEnabled}
          onChange={(e) => setSnapEnabled(e.target.checked)}
        />
      </div>
    </div>
  )
}



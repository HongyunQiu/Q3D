import { PropertiesPanel } from '../../ui/PropertiesPanel'
import { Toolbar } from '../../ui/Toolbar'
import { ThreeViewport } from '../../viewport/ThreeViewport'
import styles from './editorLayout.module.css'

export function EditorLayout() {
  return (
    <div className={styles.root}>
      <aside className={styles.left}>
        <div className={styles.panelTitle}>工具 / 特征</div>
        <Toolbar />
      </aside>

      <main className={styles.center}>
        <ThreeViewport />
      </main>

      <aside className={styles.right}>
        <div className={styles.panelTitle}>属性</div>
        <PropertiesPanel />
      </aside>
    </div>
  )
}



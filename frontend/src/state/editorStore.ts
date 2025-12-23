import { create } from 'zustand'
import type { ThreeEngine } from '../engine/ThreeEngine'

export type EditorMode = 'view' | 'sketch'
export type SketchTool = 'select' | 'line' | 'rect' | 'circle'
export type BaselinePlaneId = 'XY' | 'YZ' | 'ZX'
export type EntityTool = 'none' | 'extrude_boss' | 'extrude_cut'

export type Vec2 = { x: number; y: number }

export type SketchEntity =
  | { id: string; type: 'line'; a: Vec2; b: Vec2 }
  | { id: string; type: 'rect'; a: Vec2; b: Vec2 }
  | { id: string; type: 'circle'; c: Vec2; r: number }

type EditorState = {
  mode: EditorMode
  tool: SketchTool
  entityTool: EntityTool
  engine: ThreeEngine | null
  activePlane: BaselinePlaneId | null
  gridSize: number
  snapEnabled: boolean
  sketchEntities: SketchEntity[]
  draftEntity: SketchEntity | null
  past: SketchEntity[][]
  future: SketchEntity[][]

  setMode: (mode: EditorMode) => void
  setTool: (tool: SketchTool) => void
  setEntityTool: (tool: EntityTool) => void
  setEngine: (engine: ThreeEngine | null) => void
  setActivePlane: (plane: BaselinePlaneId | null) => void
  setGridSize: (grid: number) => void
  setSnapEnabled: (enabled: boolean) => void
  setSketchEntities: (entities: SketchEntity[]) => void
  setDraftEntity: (entity: SketchEntity | null) => void
  commitEntities: (entities: SketchEntity[]) => void
  undo: () => void
  redo: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  mode: 'view',
  tool: 'select',
  entityTool: 'none',
  engine: null,
  activePlane: null,
  gridSize: 5,
  snapEnabled: true,
  sketchEntities: [],
  draftEntity: null,
  past: [],
  future: [],

  setMode: (mode) => set({ mode }),
  setTool: (tool) => set({ tool }),
  setEntityTool: (entityTool) => set({ entityTool }),
  setEngine: (engine) => set({ engine }),
  setActivePlane: (activePlane) => set({ activePlane }),
  setGridSize: (gridSize) => set({ gridSize }),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
  setSketchEntities: (sketchEntities) => set({ sketchEntities }),
  setDraftEntity: (draftEntity) => set({ draftEntity }),
  commitEntities: (entities) =>
    set((s) => ({
      past: [...s.past, s.sketchEntities],
      future: [],
      sketchEntities: entities,
      draftEntity: null,
    })),
  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1]
      if (!prev) return s
      return {
        past: s.past.slice(0, -1),
        future: [...s.future, s.sketchEntities],
        sketchEntities: prev,
        draftEntity: null,
      }
    }),
  redo: () =>
    set((s) => {
      const next = s.future[s.future.length - 1]
      if (!next) return s
      return {
        past: [...s.past, s.sketchEntities],
        future: s.future.slice(0, -1),
        sketchEntities: next,
        draftEntity: null,
      }
    }),
}))



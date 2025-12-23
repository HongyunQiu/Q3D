import { create } from 'zustand'
import type { ThreeEngine } from '../engine/ThreeEngine'

export type EditorMode = 'view' | 'sketch'
export type SketchTool = 'select' | 'line' | 'rect' | 'circle'
export type BaselinePlaneId = 'XY' | 'YZ' | 'ZX'
export type EntityTool = 'none' | 'select_face' | 'extrude_boss' | 'extrude_cut'

export type Vec2 = { x: number; y: number }
export type Vec3 = { x: number; y: number; z: number }

export type SelectedSurface =
  | { kind: 'none' }
  | { kind: 'baselinePlane'; planeId: BaselinePlaneId }
  | { kind: 'solidFace'; objectName: string; point: Vec3; normal: Vec3 }

export type SketchPlane =
  | { kind: 'baselinePlane'; planeId: BaselinePlaneId }
  | { kind: 'solidFace'; origin: Vec3; normal: Vec3; uAxis: Vec3; vAxis: Vec3 }

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
  selectedSurface: SelectedSurface
  sketchPlane: SketchPlane | null
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
  setSelectedSurface: (s: SelectedSurface) => void
  setSketchPlane: (p: SketchPlane | null) => void
  setGridSize: (grid: number) => void
  setSnapEnabled: (enabled: boolean) => void
  setSketchEntities: (entities: SketchEntity[]) => void
  setDraftEntity: (entity: SketchEntity | null) => void
  commitEntities: (entities: SketchEntity[]) => void
  undo: () => void
  redo: () => void
  resetSketch: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  mode: 'view',
  tool: 'select',
  entityTool: 'none',
  engine: null,
  activePlane: null,
  selectedSurface: { kind: 'none' },
  sketchPlane: null,
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
  setSelectedSurface: (selectedSurface) => set({ selectedSurface }),
  setSketchPlane: (sketchPlane) => set({ sketchPlane }),
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
  resetSketch: () => set({ sketchEntities: [], draftEntity: null, past: [], future: [] }),
}))



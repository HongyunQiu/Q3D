import * as THREE from 'three'
import type { SketchEntity, Vec2 } from '../state/editorStore'

type ContourKind = 'rect' | 'circle' | 'poly'

type Contour = {
  kind: ContourKind
  areaAbs: number
  sample: Vec2
  // For poly/rect: explicit points (closed not required)
  points?: Vec2[]
  // For circle
  center?: Vec2
  radius?: number
}

function polygonAreaAbs(pts: Vec2[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    a += p.x * q.y - q.x * p.y
  }
  return Math.abs(a) * 0.5
}

function polygonCentroid(pts: Vec2[]): Vec2 {
  // fallback: average
  let x = 0
  let y = 0
  for (const p of pts) {
    x += p.x
    y += p.y
  }
  const n = Math.max(1, pts.length)
  return { x: x / n, y: y / n }
}

function pointInPolygon(pt: Vec2, poly: Vec2[]): boolean {
  // ray casting
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y
    const xj = poly[j].x,
      yj = poly[j].y
    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function contains(contour: Contour, pt: Vec2): boolean {
  if (contour.kind === 'circle') {
    const c = contour.center!
    const r = contour.radius!
    const dx = pt.x - c.x
    const dy = pt.y - c.y
    return dx * dx + dy * dy < r * r - 1e-9
  }
  const poly = contour.points!
  return pointInPolygon(pt, poly)
}

function contourToOuterShape(c: Contour): THREE.Shape {
  if (c.kind === 'circle') {
    const s = new THREE.Shape()
    s.absellipse(c.center!.x, c.center!.y, c.radius!, c.radius!, 0, Math.PI * 2, false, 0)
    return s
  }
  const pts = c.points!
  const s = new THREE.Shape()
  s.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i].x, pts[i].y)
  s.lineTo(pts[0].x, pts[0].y)
  return s
}

function contourToHolePath(c: Contour): THREE.Path {
  if (c.kind === 'circle') {
    const p = new THREE.Path()
    p.absellipse(c.center!.x, c.center!.y, c.radius!, c.radius!, 0, Math.PI * 2, false, 0)
    return p
  }
  const pts = c.points!
  const p = new THREE.Path()
  p.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y)
  p.lineTo(pts[0].x, pts[0].y)
  return p
}

function keyOf(p: Vec2): string {
  return `${p.x.toFixed(6)},${p.y.toFixed(6)}`
}

function buildPolylineLoops(lines: Extract<SketchEntity, { type: 'line' }>[]): Vec2[][] {
  // Build loops only for components where every node degree == 2
  const posOf = new Map<string, Vec2>()
  const adj = new Map<string, { to: string; edgeId: string }[]>()

  const addEdge = (a: Vec2, b: Vec2, edgeId: string) => {
    const ka = keyOf(a)
    const kb = keyOf(b)
    if (!posOf.has(ka)) posOf.set(ka, { x: a.x, y: a.y })
    if (!posOf.has(kb)) posOf.set(kb, { x: b.x, y: b.y })
    if (!adj.has(ka)) adj.set(ka, [])
    if (!adj.has(kb)) adj.set(kb, [])
    adj.get(ka)!.push({ to: kb, edgeId })
    adj.get(kb)!.push({ to: ka, edgeId })
  }

  for (let i = 0; i < lines.length; i++) addEdge(lines[i].a, lines[i].b, `e${i}`)

  // quick filter: only keep degree-2 nodes
  for (const [, ns] of adj) {
    if (ns.length !== 2) return []
  }

  const visitedEdges = new Set<string>()
  const loops: Vec2[][] = []

  for (const startKey of adj.keys()) {
    // if both incident edges visited, skip
    const ns0 = adj.get(startKey)!
    if (ns0.every((n) => visitedEdges.has(n.edgeId))) continue

    const loop: Vec2[] = []
    let prevKey: string | null = null
    let currKey: string = startKey

    for (let step = 0; step < lines.length + 5; step++) {
      const pos = posOf.get(currKey)
      if (!pos) break
      loop.push(pos)

      const neighbors = adj.get(currKey)!
      const next =
        neighbors.find((n) => n.to !== prevKey && !visitedEdges.has(n.edgeId)) ??
        neighbors.find((n) => n.to !== prevKey)
      if (!next) break

      visitedEdges.add(next.edgeId)
      prevKey = currKey
      currKey = next.to
      if (currKey === startKey) break
    }

    if (currKey === startKey && loop.length >= 3) loops.push(loop)
  }

  return loops
}

export type SketchRegion = {
  shape: THREE.Shape
  depth: number
}

export function extractSketchRegions(entities: SketchEntity[]): SketchRegion[] {
  const contours: Contour[] = []

  for (const e of entities) {
    if (e.type === 'rect') {
      const x1 = Math.min(e.a.x, e.b.x)
      const y1 = Math.min(e.a.y, e.b.y)
      const x2 = Math.max(e.a.x, e.b.x)
      const y2 = Math.max(e.a.y, e.b.y)
      if (Math.abs(x2 - x1) < 1e-6 || Math.abs(y2 - y1) < 1e-6) continue
      const pts: Vec2[] = [
        { x: x1, y: y1 },
        { x: x2, y: y1 },
        { x: x2, y: y2 },
        { x: x1, y: y2 },
      ]
      contours.push({
        kind: 'rect',
        points: pts,
        areaAbs: Math.abs((x2 - x1) * (y2 - y1)),
        sample: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 },
      })
    } else if (e.type === 'circle') {
      if (!Number.isFinite(e.r) || e.r <= 0) continue
      contours.push({
        kind: 'circle',
        center: e.c,
        radius: e.r,
        areaAbs: Math.PI * e.r * e.r,
        sample: e.c,
      })
    }
  }

  const lines = entities.filter((x) => x.type === 'line') as Extract<SketchEntity, { type: 'line' }>[]
  const loops = buildPolylineLoops(lines)
  for (const pts of loops) {
    const areaAbs = polygonAreaAbs(pts)
    if (areaAbs < 1e-4) continue
    contours.push({ kind: 'poly', points: pts, areaAbs, sample: polygonCentroid(pts) })
  }

  if (contours.length === 0) return []

  // Build containment tree by smallest containing parent
  const idxByArea = contours.map((_, i) => i).sort((a, b) => contours[a].areaAbs - contours[b].areaAbs)
  const parent: number[] = new Array(contours.length).fill(-1)
  const depth: number[] = new Array(contours.length).fill(0)

  for (const i of idxByArea) {
    let bestParent = -1
    let bestArea = Number.POSITIVE_INFINITY
    for (let j = 0; j < contours.length; j++) {
      if (i === j) continue
      const cj = contours[j]
      if (cj.areaAbs <= contours[i].areaAbs + 1e-9) continue
      if (!contains(cj, contours[i].sample)) continue
      if (cj.areaAbs < bestArea) {
        bestArea = cj.areaAbs
        bestParent = j
      }
    }
    parent[i] = bestParent
  }

  const computeDepth = (i: number): number => {
    if (parent[i] === -1) return 0
    if (depth[i] !== 0) return depth[i]
    depth[i] = computeDepth(parent[i]) + 1
    return depth[i]
  }
  for (let i = 0; i < contours.length; i++) depth[i] = computeDepth(i)

  // For each even depth contour, create a region shape with holes from its direct odd children
  const children: number[][] = new Array(contours.length).fill(0).map(() => [])
  for (let i = 0; i < contours.length; i++) {
    if (parent[i] !== -1) children[parent[i]].push(i)
  }

  const regions: SketchRegion[] = []
  for (let i = 0; i < contours.length; i++) {
    if (depth[i] % 2 !== 0) continue // holes are not regions
    const outer = contourToOuterShape(contours[i])
    for (const ch of children[i]) {
      if (depth[ch] === depth[i] + 1 && depth[ch] % 2 === 1) {
        outer.holes.push(contourToHolePath(contours[ch]))
      }
    }
    regions.push({ shape: outer, depth: depth[i] })
  }

  return regions
}



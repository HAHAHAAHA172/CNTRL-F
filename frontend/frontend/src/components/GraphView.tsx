import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { Loader2 } from 'lucide-react'
import { API_BASE } from '../config'

interface Props {
  repoUrl: string
  onSelectFile: (path: string) => void
  repoReady: boolean
  repoError: string | null
}

// ── Color palette ──────────────────────────────────────────────────────────
const EXT_COLOR: Record<string, number> = {
  ts: 0x3b82f6, tsx: 0x6366f1,
  js: 0xf59e0b, jsx: 0xf97316,
  py: 0x22c55e,
  java: 0xef4444,
  go: 0x06b6d4,
  rs: 0xf97316,
  c: 0xa855f7, cpp: 0xa855f7, h: 0xa855f7, hpp: 0xa855f7,
  rb: 0xec4899,
  php: 0x8b5cf6,
  css: 0x14b8a6, scss: 0x14b8a6,
  html: 0xf59e0b,
  json: 0x64748b, yaml: 0x64748b, yml: 0x64748b,
  md: 0x94a3b8,
}
const ROOT_COLOR   = 0x6366f1
const FOLDER_COLOR = 0x475569
const BG_COLOR     = 0x080b12

function extColor(filename: string): number {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return EXT_COLOR[ext] ?? 0x64748b
}

// ── Graph types ────────────────────────────────────────────────────────────
type NodeKind = 'root' | 'folder' | 'file'
interface GNode {
  id: string; label: string; kind: NodeKind
  color: number; depth: number
  position: THREE.Vector3
}
interface GEdge { source: string; target: string }

// ── Build tree ─────────────────────────────────────────────────────────────
function buildTree(filePaths: string[], repoName: string, enrichMap: Record<string, string>) {
  const nodes: GNode[] = []
  const edges: GEdge[] = []
  const seen = new Set<string>()

  const add = (id: string, label: string, kind: NodeKind, color: number, depth: number) => {
    if (!seen.has(id)) {
      seen.add(id)
      nodes.push({ id, label, kind, color, depth, position: new THREE.Vector3() })
    }
  }

  add('__root__', repoName, 'root', ROOT_COLOR, 0)

  for (const path of filePaths) {
    const parts = path.split('/')
    let parent = '__root__'
    for (let i = 0; i < parts.length - 1; i++) {
      const fid = parts.slice(0, i + 1).join('/')
      add(fid, parts[i], 'folder', FOLDER_COLOR, i + 1)
      edges.push({ source: parent, target: fid })
      parent = fid
    }
    const fname = parts[parts.length - 1]
    add(path, enrichMap[path] ?? fname, 'file', extColor(fname), parts.length)
    edges.push({ source: parent, target: path })
  }

  // dedupe edges
  const eset = new Set<string>()
  return {
    nodes,
    edges: edges.filter(e => {
      const k = `${e.source}→${e.target}`
      if (eset.has(k)) return false
      eset.add(k); return true
    }),
  }
}

// ── 3D orbital layout ─────────────────────────────────────────────────────
function layoutOrbital(nodes: GNode[], edges: GEdge[]) {
  const idxMap: Record<string, number> = {}
  nodes.forEach((n, i) => { idxMap[n.id] = i })

  const children: Record<string, string[]> = {}
  const depthOf: Record<string, number> = { '__root__': 0 }
  edges.forEach(e => {
    if (!children[e.source]) children[e.source] = []
    children[e.source].push(e.target)
  })

  // BFS depth
  const q = ['__root__']
  while (q.length) {
    const cur = q.shift()!
    for (const ch of children[cur] ?? []) {
      if (depthOf[ch] === undefined) { depthOf[ch] = depthOf[cur] + 1; q.push(ch) }
    }
  }

  const maxDepth = Math.max(...Object.values(depthOf), 1)
  const byDepth: Record<number, string[]> = {}
  nodes.forEach(n => {
    const d = depthOf[n.id] ?? maxDepth
    if (!byDepth[d]) byDepth[d] = []
    byDepth[d].push(n.id)
  })

  // Spherical placement — each depth = one orbital shell
  nodes.forEach(n => {
    const d = depthOf[n.id] ?? maxDepth
    if (d === 0) { n.position.set(0, 0, 0); return }

    const siblings = byDepth[d] ?? [n.id]
    const idx = siblings.indexOf(n.id)
    const total = siblings.length

    // Distribute evenly on a sphere shell using Fibonacci spiral with dynamic spacing for dense shells
    const shellExtra = Math.max(0, Math.sqrt(total) * 14)
    const radius = 70 + d * 95 + shellExtra
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))
    const theta = goldenAngle * idx
    const phi = Math.acos(1 - (2 * (idx + 0.5)) / total)

    n.position.set(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta),
    )
  })
}

// ── Sprite text label ──────────────────────────────────────────────────────
function makeLabel(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256; canvas.height = 40
  const ctx = canvas.getContext('2d')!
  ctx.font = 'bold 18px ui-monospace, Consolas, monospace'
  const tw = ctx.measureText(text).width
  ctx.fillStyle = 'rgba(8,11,18,0.75)'
  ctx.beginPath()
  ctx.roundRect((256 - tw) / 2 - 6, 6, tw + 12, 28, 4)
  ctx.fill()
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 128, 22)
  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(40, 7, 1)
  return sprite
}

// ── Main component ─────────────────────────────────────────────────────────
export default function GraphView({ repoUrl, onSelectFile, repoReady, repoError }: Props) {
  const mountRef   = useRef<HTMLDivElement>(null)
  const sceneRef   = useRef<THREE.Scene | null>(null)
  const cameraRef  = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const rafRef     = useRef<number>(0)
  const meshMapRef = useRef<Record<string, THREE.Mesh>>({})
  const lineMapRef = useRef<THREE.LineSegments | null>(null)
  const nodesRef   = useRef<GNode[]>([])
  const edgesRef   = useRef<GEdge[]>([])

  // Orbit controls state
  const orbitRef = useRef({
    theta: 0, phi: Math.PI / 2,
    targetTheta: 0, targetPhi: Math.PI / 2,
    radius: 500, targetRadius: 500,
    minRadius: 60, maxRadius: 5000,
    isDragging: false,
    startX: 0, startY: 0,
    lastX: 0, lastY: 0,
    autoRotate: true,
  })
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset idle timer & stop auto-rotation on any user interaction
  const handleUserInteraction = useCallback(() => {
    orbitRef.current.autoRotate = false
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
    }
    idleTimerRef.current = setTimeout(() => {
      if (!orbitRef.current.isDragging) {
        orbitRef.current.autoRotate = true
      }
    }, 5000)
  }, [])

  const [loaded,     setLoaded]     = useState(false)
  const [hovered,    setHovered]    = useState<string | null>(null)
  const [selected,   setSelected]   = useState<string | null>(null)
  const [enrichMap,  setEnrichMap]  = useState<Record<string, string>>({})
  const rawRef = useRef<{ paths: string[]; repoName: string } | null>(null)

  // ── Three.js init ──────────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene    = new THREE.Scene()
    scene.background = new THREE.Color(BG_COLOR)
    scene.fog = new THREE.FogExp2(BG_COLOR, 0.00025)
    sceneRef.current = scene

    const initW = mount.clientWidth || 800
    const initH = mount.clientHeight || 600

    const camera = new THREE.PerspectiveCamera(60, initW / initH, 1, 30000)
    camera.position.set(0, 0, 500)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(initW, initH)
    mount.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Ambient + point lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.4))
    const pLight = new THREE.PointLight(0x6366f1, 2, 800)
    pLight.position.set(0, 0, 0)
    scene.add(pLight)

    // Deep starfield
    const starGeo = new THREE.BufferGeometry()
    const starPos = new Float32Array(4500).map(() => (Math.random() - 0.5) * 16000)
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, transparent: true, opacity: 0.35 })))

    // Resize
    const onResize = () => {
      const curW = mount.clientWidth
      const curH = mount.clientHeight
      if (curW <= 0 || curH <= 0) return
      camera.aspect = curW / curH
      camera.updateProjectionMatrix()
      renderer.setSize(curW, curH)
    }
    const obs = new ResizeObserver(onResize)
    obs.observe(mount)

    // Animate
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate)
      const o = orbitRef.current

      // Auto-rotate
      if (o.autoRotate && !o.isDragging) o.targetTheta += 0.002

      // Smooth lerp
      o.theta  += (o.targetTheta  - o.theta)  * 0.06
      o.phi    += (o.targetPhi    - o.phi)    * 0.06
      o.radius += (o.targetRadius - o.radius) * 0.08

      o.phi = Math.max(0.1, Math.min(Math.PI - 0.1, o.phi))

      camera.position.set(
        o.radius * Math.sin(o.phi) * Math.sin(o.theta),
        o.radius * Math.cos(o.phi),
        o.radius * Math.sin(o.phi) * Math.cos(o.theta),
      )
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(rafRef.current)
      obs.disconnect()
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }
      renderer.dispose()
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  // ── Build/rebuild scene graph ──────────────────────────────────────────
  const buildScene = useCallback((paths: string[], repoName: string, em: Record<string, string>) => {
    const scene = sceneRef.current
    if (!scene) {
      setTimeout(() => buildScene(paths, repoName, em), 60)
      return
    }

    // Clear old nodes/edges
    Object.values(meshMapRef.current).forEach(m => scene.remove(m))
    if (lineMapRef.current) scene.remove(lineMapRef.current)
    meshMapRef.current = {}

    const { nodes, edges } = buildTree(paths, repoName, em)
    layoutOrbital(nodes, edges)
    nodesRef.current = nodes
    edgesRef.current = edges

    // Node meshes
    const nodeIdx: Record<string, number> = {}
    nodes.forEach((n, i) => { nodeIdx[n.id] = i })

    nodes.forEach(n => {
      const r = n.kind === 'root' ? 14 : n.kind === 'folder' ? 8 : 5
      const geo = new THREE.SphereGeometry(r, 24, 24)
      const mat = new THREE.MeshStandardMaterial({
        color: n.color,
        emissive: n.color,
        emissiveIntensity: n.kind === 'root' ? 0.6 : 0.25,
        roughness: 0.3,
        metalness: 0.5,
        transparent: true,
        opacity: 1,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.copy(n.position)
      mesh.userData = { id: n.id, kind: n.kind }
      scene.add(mesh)
      meshMapRef.current[n.id] = mesh

      // Label sprite
      const labelColor = n.kind === 'root' ? '#e0e7ff' : n.kind === 'folder' ? '#cbd5e1' : '#94a3b8'
      const sprite = makeLabel(n.label, labelColor)
      sprite.position.set(0, r + 8, 0)
      sprite.userData.isLabel = true
      // Only always-visible for root/folder; files hidden by default
      sprite.visible = n.kind !== 'file'
      mesh.add(sprite)
    })

    // Edge lines
    const linePositions: number[] = []
    edges.forEach(e => {
      const s = nodes[nodeIdx[e.source]], t = nodes[nodeIdx[e.target]]
      if (!s || !t) return
      linePositions.push(s.position.x, s.position.y, s.position.z)
      linePositions.push(t.position.x, t.position.y, t.position.z)
    })
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3))
    const lineMat = new THREE.LineBasicMaterial({ color: 0x2e3a55, transparent: true, opacity: 0.5 })
    const lines = new THREE.LineSegments(lineGeo, lineMat)
    scene.add(lines)
    lineMapRef.current = lines

    // Dynamically calculate camera radius and zoom limits based on graph size
    let maxDist = 250
    nodes.forEach(n => {
      const d = n.position.length()
      if (d > maxDist) maxDist = d
    })

    const initialRadius = Math.max(500, maxDist * 1.5)
    const maxZoomOut = Math.max(4000, maxDist * 4, nodes.length * 25)

    orbitRef.current.minRadius = 60
    orbitRef.current.maxRadius = maxZoomOut
    orbitRef.current.radius = initialRadius
    orbitRef.current.targetRadius = initialRadius

    // Ensure camera & renderer sizes sync
    if (mountRef.current && rendererRef.current && cameraRef.current) {
      const mw = mountRef.current.clientWidth
      const mh = mountRef.current.clientHeight
      if (mw > 0 && mh > 0) {
        cameraRef.current.aspect = mw / mh
        cameraRef.current.updateProjectionMatrix()
        rendererRef.current.setSize(mw, mh)
      }
    }
  }, [])

  // ── Fetch graph ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!repoReady) return
    fetch(`${API_BASE}/api/graph?repo=${encodeURIComponent(repoUrl)}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        const paths: string[] = (data.nodes || []).map((n: { id: string }) => n.id)
        const repoName = repoUrl.split('/').pop() ?? 'repo'
        rawRef.current = { paths, repoName }
        buildScene(paths, repoName, enrichMap)
        setLoaded(true)
      })
      .catch(err => {
        console.error('Failed to load graph:', err)
      })
  }, [repoReady, repoUrl, buildScene, enrichMap])

  // ── Fetch enrichment ───────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return
    fetch(`${API_BASE}/api/enriched?repo=${encodeURIComponent(repoUrl)}`)
      .then(r => {
        if (!r.ok) return null
        return r.json()
      })
      .then(data => {
        if (!data) return
        const map: Record<string, string> = {}
        for (const item of data.enriched ?? []) map[item.path] = item.label
        setEnrichMap(map)
        if (rawRef.current) buildScene(rawRef.current.paths, rawRef.current.repoName, map)
      })
      .catch(() => {})
  }, [loaded, repoUrl, buildScene])

  // ── Hover / Select (raycasting) ────────────────────────────────────────
  const raycast = useCallback((clientX: number, clientY: number): string | null => {
    const mount = mountRef.current
    const camera = cameraRef.current
    const scene  = sceneRef.current
    if (!mount || !camera || !scene) return null

    const rect = mount.getBoundingClientRect()
    const ndc  = new THREE.Vector2(
      ((clientX - rect.left) / rect.width)  * 2 - 1,
      -((clientY - rect.top)  / rect.height) * 2 + 1,
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(ndc, camera)
    const meshes = Object.values(meshMapRef.current)
    const hits = raycaster.intersectObjects(meshes)
    return hits.length > 0 ? (hits[0].object.userData.id as string) : null
  }, [])

  const applyHighlight = useCallback((hovId: string | null, selId: string | null) => {
    const nodes = nodesRef.current
    const edges = edgesRef.current
    const meshMap = meshMapRef.current

    const connectedTo = (id: string) => new Set(
      edges.flatMap(e => e.source === id ? [e.target] : e.target === id ? [e.source] : [])
    )
    const hoverConn = hovId ? connectedTo(hovId) : new Set<string>()
    const selConn   = selId ? connectedTo(selId)  : new Set<string>()

    nodes.forEach(n => {
      const mesh = meshMap[n.id]
      if (!mesh) return
      const mat = mesh.material as THREE.MeshStandardMaterial
      const isActive = n.id === hovId || n.id === selId || hoverConn.has(n.id) || selConn.has(n.id)
      const isNone   = !hovId && !selId

      mat.opacity = isNone ? 1 : isActive ? 1 : 0.15
      mat.emissiveIntensity = n.id === selId ? 1.2 : n.id === hovId ? 0.9 : isActive ? 0.4 : 0.1

      // Show file labels on hover/select
      const sprite = mesh.children.find(c => c.userData.isLabel)
      if (sprite) {
        sprite.visible = n.kind !== 'file' || n.id === hovId || n.id === selId || isActive
      }
    })

    // Edge color
    if (lineMapRef.current) {
      const lm = lineMapRef.current.material as THREE.LineBasicMaterial
      lm.opacity = hovId || selId ? 0.15 : 0.45
    }
  }, [])

  // Mouse events
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    handleUserInteraction()

    if (orbitRef.current.isDragging) {
      const dx = e.clientX - orbitRef.current.lastX
      const dy = e.clientY - orbitRef.current.lastY
      orbitRef.current.targetTheta -= dx * 0.005
      orbitRef.current.targetPhi   -= dy * 0.005
      orbitRef.current.lastX = e.clientX
      orbitRef.current.lastY = e.clientY
      return
    }
    const hit = raycast(e.clientX, e.clientY)
    setHovered(hit)
    applyHighlight(hit, selected)
  }, [handleUserInteraction, raycast, applyHighlight, selected])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    handleUserInteraction()
    orbitRef.current.isDragging = true
    orbitRef.current.startX = e.clientX
    orbitRef.current.startY = e.clientY
    orbitRef.current.lastX = e.clientX
    orbitRef.current.lastY = e.clientY
  }, [handleUserInteraction])

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    handleUserInteraction()
    const dist = Math.hypot(e.clientX - orbitRef.current.startX, e.clientY - orbitRef.current.startY)
    const isClick = dist < 5
    orbitRef.current.isDragging = false

    if (isClick) {
      const hit = raycast(e.clientX, e.clientY)
      if (hit) {
        const nd = nodesRef.current.find(n => n.id === hit)
        setSelected(hit)
        applyHighlight(hovered, hit)
        if (nd?.kind === 'file') onSelectFile(hit)
      } else {
        setSelected(null)
        applyHighlight(hovered, null)
      }
    }
  }, [handleUserInteraction, raycast, applyHighlight, hovered, onSelectFile])

  const onMouseLeave = useCallback(() => {
    orbitRef.current.isDragging = false
    setHovered(null)
    applyHighlight(null, selected)
    handleUserInteraction()
  }, [handleUserInteraction, applyHighlight, selected])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    handleUserInteraction()
    const o = orbitRef.current
    const minR = o.minRadius ?? 60
    const maxR = o.maxRadius ?? 5000
    // Proportional zoom: scales smoothly whether close or zoomed far out
    const zoomDelta = e.deltaY * (o.targetRadius * 0.0018)
    o.targetRadius = Math.max(minR, Math.min(maxR, o.targetRadius + zoomDelta))
  }, [handleUserInteraction])

  const hovNode = hovered ? nodesRef.current.find(n => n.id === hovered) : null

  return (
    <div
      className="graph-container"
      style={{ position: 'relative', overflow: 'hidden', cursor: hovered ? 'pointer' : 'grab' }}
      ref={mountRef}
      onMouseMove={onMouseMove}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onWheel={onWheel}
    >
      {/* Loading overlay */}
      {(!repoReady || !loaded) && !repoError && (
        <div className="graph-loading">
          <Loader2 size={24} className="spin" />
          <span>{!repoReady ? 'Analyzing repository…' : 'Building 3D graph…'}</span>
        </div>
      )}

      {/* Error overlay */}
      {repoError && (
        <div className="graph-error">
          <p>{repoError}</p>
        </div>
      )}

      {/* HUD tooltip */}
      {loaded && hovNode && (
        <div className="graph-tooltip">
          <span style={{ color: `#${hovNode.color.toString(16).padStart(6, '0')}` }}>●</span>
          &nbsp;{hovNode.kind === 'file' ? hovNode.id : hovNode.label}
          <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 10 }}>{hovNode.kind}</span>
        </div>
      )}

      {/* Legend */}
      {loaded && (
        <div className="graph-legend">
          {[
            { label: 'root',   color: '#6366f1' },
            { label: 'folder', color: '#475569' },
            { label: '.ts',    color: '#3b82f6' },
            { label: '.tsx',   color: '#6366f1' },
            { label: '.js',    color: '#f59e0b' },
            { label: '.py',    color: '#22c55e' },
            { label: '.java',  color: '#ef4444' },
            { label: '.go',    color: '#06b6d4' },
          ].map(({ label, color }) => (
            <div key={label} className="legend-item">
              <span className="legend-dot" style={{ background: color }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Controls hint */}
      {loaded && (
        <div style={{ position: 'absolute', top: 12, left: 12, fontSize: 10, color: 'var(--text-muted)', pointerEvents: 'none' }}>
          Drag to rotate · Scroll to zoom · Click node to inspect
        </div>
      )}
    </div>
  )
}

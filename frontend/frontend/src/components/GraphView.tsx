import { useCallback, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Loader2 } from 'lucide-react'

interface Props {
  repoUrl: string
  onSelectFile: (path: string) => void
  repoReady: boolean
  repoError: string | null
}

const EMPTY_NODES: Node[] = []
const EMPTY_EDGES: Edge[] = []

function layoutNodes(rawNodes: { id: string; data: { label: string }; type: string }[]): Node[] {
  const COLS = 6
  const COL_W = 220
  const ROW_H = 80
  return rawNodes.map((n, i) => ({
    ...n,
    position: { x: (i % COLS) * COL_W, y: Math.floor(i / COLS) * ROW_H },
  }))
}

export default function GraphView({ repoUrl, onSelectFile, repoReady, repoError }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(EMPTY_NODES)
  const [edges, setEdges, onEdgesChange] = useEdgesState(EMPTY_EDGES)

  // Dashboard already fetched the graph — read from cache
  useEffect(() => {
    if (!repoReady) return
    fetch(`/api/graph?repo=${encodeURIComponent(repoUrl)}`)
      .then(res => res.json())
      .then(data => {
        setNodes(layoutNodes(data.nodes))
        setEdges(data.edges.map((e: Edge) => ({ ...e, animated: false })))
      })
      .catch(() => {/* error shown by Dashboard */})
  }, [repoReady, repoUrl])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const label = node.data?.label
    if (typeof label === 'string') onSelectFile(label)
  }, [onSelectFile])

  if (!repoReady && !repoError) {
    return (
      <div className="graph-loading">
        <Loader2 size={24} className="spin" />
        <span>Analyzing repository…</span>
      </div>
    )
  }

  if (repoError) {
    return (
      <div className="graph-error">
        <p>{repoError}</p>
      </div>
    )
  }

  if (repoReady && nodes.length === 0) {
    return (
      <div className="graph-loading">
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          No JS/TS files found in this repository.
        </p>
      </div>
    )
  }

  return (
    <div className="graph-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        nodesDraggable
        style={{ background: 'var(--bg)' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--border)" />
        <Controls />
        <MiniMap
          nodeColor="var(--accent)"
          maskColor="rgba(13,14,20,0.8)"
          style={{ background: 'var(--surface)' }}
        />
      </ReactFlow>
    </div>
  )
}

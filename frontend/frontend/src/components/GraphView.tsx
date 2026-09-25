import { useCallback, useEffect, useState } from 'react'
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
}

// Placeholder graph while backend isn't wired yet
const PLACEHOLDER_NODES: Node[] = [
  { id: '1', position: { x: 340, y: 40  }, data: { label: 'src/index.ts' },  type: 'default' },
  { id: '2', position: { x: 160, y: 160 }, data: { label: 'App.tsx' },        type: 'default' },
  { id: '3', position: { x: 520, y: 160 }, data: { label: 'router.ts' },      type: 'default' },
  { id: '4', position: { x: 60,  y: 280 }, data: { label: 'Header.tsx' },     type: 'default' },
  { id: '5', position: { x: 260, y: 280 }, data: { label: 'Dashboard.tsx' },  type: 'default' },
  { id: '6', position: { x: 460, y: 280 }, data: { label: 'api/client.ts' },  type: 'default' },
  { id: '7', position: { x: 620, y: 280 }, data: { label: 'utils/auth.ts' },  type: 'default' },
]

const PLACEHOLDER_EDGES: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e1-3', source: '1', target: '3' },
  { id: 'e2-4', source: '2', target: '4' },
  { id: 'e2-5', source: '2', target: '5' },
  { id: 'e3-6', source: '3', target: '6' },
  { id: 'e3-7', source: '3', target: '7' },
]

export default function GraphView({ repoUrl, onSelectFile }: Props) {
  const [nodes, _setNodes, onNodesChange] = useNodesState(PLACEHOLDER_NODES)
  const [edges, _setEdges, onEdgesChange] = useEdgesState(PLACEHOLDER_EDGES)
  const [loading, setLoading] = useState(false)
  const [error, _setError] = useState<string | null>(null)

  useEffect(() => {
    // TODO: fetch `/api/graph?repo=${encodeURIComponent(repoUrl)}` once backend ready
    // For now, placeholder graph is shown
    setLoading(false)
  }, [repoUrl])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const label = node.data?.label
    if (typeof label === 'string') onSelectFile(label)
  }, [onSelectFile])

  if (loading) {
    return (
      <div className="graph-loading">
        <Loader2 size={24} className="spin" />
        <span>Analyzing repository…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="graph-error">
        <p>{error}</p>
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

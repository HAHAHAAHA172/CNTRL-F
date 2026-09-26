import { FileText } from 'lucide-react'

interface Props {
  filePath: string
  repoUrl: string
  onSelectFile?: (path: string) => void
  onTraceImpact?: () => void
  onAskAI?: () => void
}

export default function FileInspector({
  filePath,
  onTraceImpact,
  onAskAI,
}: Props) {
  const ext = filePath.split('.').pop() ?? ''

  return (
    <div className="file-inspector">
      <div className="inspector-header">
        <FileText size={14} />
        <span className="inspector-filename">{filePath.split('/').pop()}</span>
      </div>

      <div className="inspector-section">
        <div className="inspector-label">Path</div>
        <code className="inspector-path">{filePath}</code>
      </div>

      <div className="inspector-section">
        <div className="inspector-label">Type</div>
        <span className="inspector-value">{ext.toUpperCase() || 'Unknown'}</span>
      </div>

      <div className="inspector-actions">
        <button className="btn-secondary" onClick={onTraceImpact}>Trace Impact</button>
        <button className="btn-secondary" onClick={onAskAI}>Ask AI</button>
      </div>
    </div>
  )
}


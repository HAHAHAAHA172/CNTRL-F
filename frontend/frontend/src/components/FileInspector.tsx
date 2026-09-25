import { FileText, GitBranch, Zap } from 'lucide-react'

interface Props {
  filePath: string
  repoUrl: string
}

export default function FileInspector({ filePath }: Props) {
  // TODO: fetch file details from /api/file?repo=...&path=...
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

      <div className="inspector-section">
        <div className="inspector-label flex-row">
          <GitBranch size={12} /> Imports
        </div>
        <p className="inspector-placeholder">Fetching dependencies…</p>
      </div>

      <div className="inspector-section">
        <div className="inspector-label flex-row">
          <Zap size={12} /> Used by
        </div>
        <p className="inspector-placeholder">Fetching dependents…</p>
      </div>

      <div className="inspector-actions">
        <button className="btn-secondary">Trace Impact</button>
        <button className="btn-secondary">Ask AI</button>
      </div>
    </div>
  )
}

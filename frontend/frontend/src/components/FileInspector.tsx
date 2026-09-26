import { useState, useEffect } from 'react'
import { FileText, GitBranch, Zap, Loader2 } from 'lucide-react'
import { API_BASE } from '../config'

interface Props {
  filePath: string
  repoUrl: string
  onSelectFile?: (path: string) => void
  onTraceImpact?: () => void
  onAskAI?: () => void
}

interface FileDetails {
  path: string
  imports: string[]
  used_by: string[]
  language: string
  symbols: string[]
  lines: number
}

export default function FileInspector({
  filePath,
  repoUrl,
  onSelectFile,
  onTraceImpact,
  onAskAI,
}: Props) {
  const [details, setDetails] = useState<FileDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ext = filePath.split('.').pop() ?? ''

  useEffect(() => {
    if (!filePath || !repoUrl) return

    let cancelled = false
    setLoading(true)
    setError(null)
    setDetails(null)

    fetch(
      `${API_BASE}/api/file?repo=${encodeURIComponent(repoUrl)}&path=${encodeURIComponent(filePath)}`
    )
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || `Server error (${res.status})`)
        }
        return res.json()
      })
      .then((data: FileDetails) => {
        if (!cancelled) setDetails(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? 'Failed to load file details')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [filePath, repoUrl])

  const renderList = (items: string[], emptyMsg: string) => {
    if (loading) {
      return (
        <p className="inspector-placeholder">
          <Loader2 size={12} className="spin" style={{ display: 'inline', marginRight: 4 }} />
          Loading…
        </p>
      )
    }
    if (error) {
      return <p className="inspector-placeholder" style={{ color: 'var(--error)' }}>Error loading</p>
    }
    if (!details || items.length === 0) {
      return <p className="inspector-placeholder">{emptyMsg}</p>
    }
    return (
      <ul className="inspector-dep-list">
        {items.map((item) => (
          <li
            key={item}
            className="inspector-dep-item"
            onClick={() => onSelectFile?.(item)}
            title={item}
          >
            {item.split('/').pop()}
          </li>
        ))}
      </ul>
    )
  }

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
        {renderList(details?.imports ?? [], 'No imports found')}
      </div>

      <div className="inspector-section">
        <div className="inspector-label flex-row">
          <Zap size={12} /> Used by
        </div>
        {renderList(details?.used_by ?? [], 'No dependents found')}
      </div>

      <div className="inspector-actions">
        <button className="btn-secondary" onClick={onTraceImpact}>Trace Impact</button>
        <button className="btn-secondary" onClick={onAskAI}>Ask AI</button>
      </div>
    </div>
  )
}

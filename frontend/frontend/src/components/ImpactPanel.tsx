import { useState, useEffect } from 'react'
import { Zap, Loader2, AlertTriangle, ChevronRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  repoUrl: string
  selectedFile: string | null
  repoReady: boolean
}

interface ImpactResult {
  file: string
  affected: string[][]
  total_affected: number
  explanation: string
}

export default function ImpactPanel({ repoUrl, selectedFile, repoReady }: Props) {
  const [result,  setResult]  = useState<ImpactResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [tracedFile, setTracedFile] = useState<string | null>(null)

  function runTrace(file: string) {
    if (!repoReady) return
    setLoading(true)
    setError(null)
    setResult(null)
    setTracedFile(file)
    fetch(`/api/impact?repo=${encodeURIComponent(repoUrl)}&file=${encodeURIComponent(file)}`)
      .then(r => {
        if (!r.ok) return r.json().then(d => Promise.reject(d.detail ?? 'Server error'))
        return r.json()
      })
      .then(data => setResult(data))
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }

  // Auto-run when selectedFile changes and we're on this tab
  useEffect(() => {
    if (selectedFile && repoReady && selectedFile !== tracedFile) {
      runTrace(selectedFile)
    }
  }, [selectedFile, repoReady])

  const riskColor = (total: number) =>
    total === 0 ? 'var(--green)' : total < 5 ? '#f59e0b' : '#ef4444'

  const riskLabel = (total: number) =>
    total === 0 ? 'No impact' : total < 5 ? 'Low risk' : total < 15 ? 'Medium risk' : 'High risk'

  if (!repoReady) return (
    <div className="placeholder-panel">
      <Zap size={32} className="placeholder-icon" />
      <p>Analyzing repository…</p>
    </div>
  )

  return (
    <div className="impact-panel">
      <div className="impact-header">
        <Zap size={16} />
        <span>Impact Explorer</span>
      </div>

      {/* File selector */}
      <div className="impact-file-row">
        <input
          className="impact-file-input"
          placeholder="Enter a file path to trace…"
          value={tracedFile ?? selectedFile ?? ''}
          onChange={e => setTracedFile(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && tracedFile && runTrace(tracedFile)}
          spellCheck={false}
        />
        <button
          className="btn-primary"
          style={{ padding: '8px 16px', fontSize: 12 }}
          onClick={() => tracedFile && runTrace(tracedFile)}
          disabled={loading || !tracedFile}
        >
          {loading ? <Loader2 size={13} className="spin" /> : 'Trace'}
        </button>
      </div>

      {!selectedFile && !tracedFile && (
        <p className="impact-hint">Click a node in the graph to select a file, then trace its impact.</p>
      )}

      {error && (
        <div className="impact-error">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {result && (
        <div className="impact-result">
          {/* Risk badge */}
          <div className="impact-risk" style={{ borderColor: riskColor(result.total_affected), color: riskColor(result.total_affected) }}>
            <Zap size={13} />
            {riskLabel(result.total_affected)}
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
              · {result.total_affected} file{result.total_affected !== 1 ? 's' : ''} affected
            </span>
          </div>

          {/* Traced file */}
          <div className="impact-section-label">Changed file</div>
          <code className="impact-file-pill" style={{ borderColor: 'var(--accent-border)', color: 'var(--accent)' }}>
            {result.file}
          </code>

          {/* Affected layers */}
          {result.affected.length > 0 && (
            <>
              <div className="impact-section-label" style={{ marginTop: 16 }}>Dependency chain</div>
              {result.affected.map((layer, i) => (
                <div key={i} className="impact-layer">
                  <div className="impact-layer-label">
                    <ChevronRight size={11} />
                    Level {i + 1} — {layer.length} file{layer.length !== 1 ? 's' : ''}
                  </div>
                  <div className="impact-files">
                    {layer.map(f => (
                      <code key={f} className="impact-file-pill">{f.split('/').pop()}</code>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {result.affected.length === 0 && (
            <p className="impact-hint" style={{ marginTop: 12 }}>
              No other files import this one — safe to change.
            </p>
          )}

          {/* AI explanation */}
          <div className="impact-section-label" style={{ marginTop: 16 }}>AI Analysis</div>
          <div className="impact-explanation msg-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {result.explanation}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

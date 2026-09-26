import { useState, useEffect } from 'react'
import GraphView from './GraphView'
import ChatPanel from './ChatPanel'
import FileInspector from './FileInspector'
import ImpactPanel from './ImpactPanel'
import OnboardingPanel from './OnboardingPanel'
import { Search, GitBranch, Zap, Map, MessageSquare, ChevronRight, Loader2 } from 'lucide-react'

import { API_BASE, parseApiError } from '../config'

interface Props {
  repoUrl: string
  onReset: () => void
}

export type PanelMode = 'graph' | 'chat' | 'impact' | 'onboarding'

export default function Dashboard({ repoUrl, onReset }: Props) {
  const [activePanel, setActivePanel] = useState<PanelMode>('graph')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [rightOpen, setRightOpen] = useState(true)
  const [repoReady, setRepoReady] = useState(false)
  const [repoError, setRepoError] = useState<string | null>(null)

  const repoName = repoUrl.replace('https://github.com/', '')

  // Fetch + cache the repo on mount so all tabs have data
  useEffect(() => {
    setRepoReady(false)
    setRepoError(null)
    fetch(`${API_BASE}/api/graph?repo=${encodeURIComponent(repoUrl)}`)
      .then(async res => {
        if (!res.ok) {
          const detail = await parseApiError(res)
          return Promise.reject(detail)
        }
        return res.json()
      })
      .then(() => setRepoReady(true))
      .catch(err => setRepoError(String(err)))
  }, [repoUrl])

  const navItems: { id: PanelMode; label: string; icon: React.ReactNode }[] = [
    { id: 'graph',      label: 'Graph',     icon: <GitBranch size={16} /> },
    { id: 'chat',       label: 'Ask AI',    icon: <MessageSquare size={16} /> },
    { id: 'impact',     label: 'Impact',    icon: <Zap size={16} /> },
    { id: 'onboarding', label: 'Onboarding',icon: <Map size={16} /> },
  ]

  return (
    <div className="dashboard">
      {/* ── Top bar ── */}
      <header className="topbar">
        <div className="topbar-left">
          <button className="logo-btn" onClick={onReset}>CNTRL F</button>
          <span className="topbar-sep">/</span>
          <span className="topbar-repo">
            <Search size={12} />
            <span>{repoName}</span>
          </span>
        </div>

        <nav className="topbar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-btn ${activePanel === item.id ? 'active' : ''}`}
              onClick={() => setActivePanel(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="topbar-right">
          {!repoReady && !repoError && <Loader2 size={13} className="spin" />}
          <span className="status-dot" style={{ background: repoError ? '#ef4444' : repoReady ? 'var(--green)' : '#f59e0b' }} />
          <span className="status-text">
            {repoError ? 'Error' : repoReady ? 'Ready' : 'Analyzing…'}
          </span>
        </div>
      </header>

      {/* ── Main workspace ── */}
      <div className="workspace">
        <main className="main-view">
          <div style={{ display: activePanel === 'graph' ? 'block' : 'none', height: '100%', width: '100%' }}>
            <GraphView
              repoUrl={repoUrl}
              onSelectFile={setSelectedFile}
              repoReady={repoReady}
              repoError={repoError}
              visible={activePanel === 'graph'}
            />
          </div>
          <div style={{ display: activePanel === 'chat' ? 'flex' : 'none', flexDirection: 'column', height: '100%', width: '100%' }}>
            <ChatPanel repoUrl={repoUrl} selectedFile={selectedFile} repoReady={repoReady} />
          </div>
          <div style={{ display: activePanel === 'impact' ? 'flex' : 'none', flexDirection: 'column', height: '100%', width: '100%' }}>
            <ImpactPanel repoUrl={repoUrl} selectedFile={selectedFile} repoReady={repoReady} />
          </div>
          <div style={{ display: activePanel === 'onboarding' ? 'flex' : 'none', flexDirection: 'column', height: '100%', width: '100%' }}>
            <OnboardingPanel repoUrl={repoUrl} repoReady={repoReady} onSelectFile={setSelectedFile} />
          </div>
        </main>

        {selectedFile && (
          <aside className={`right-panel ${rightOpen ? 'open' : 'closed'}`}>
            <button
              className="panel-toggle"
              onClick={() => setRightOpen(o => !o)}
              title={rightOpen ? 'Collapse' : 'Expand'}
            >
              <ChevronRight
                size={14}
                style={{ transform: rightOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }}
              />
            </button>
            {rightOpen && (
              <FileInspector
                filePath={selectedFile}
                repoUrl={repoUrl}
                onSelectFile={setSelectedFile}
                onTraceImpact={() => setActivePanel('impact')}
                onAskAI={() => setActivePanel('chat')}
              />
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

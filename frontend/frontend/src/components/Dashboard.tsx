import { useState } from 'react'
import GraphView from './GraphView'
import ChatPanel from './ChatPanel'
import FileInspector from './FileInspector'
import { Search, GitBranch, Zap, Map, MessageSquare, ChevronRight } from 'lucide-react'

interface Props {
  repoUrl: string
  onReset: () => void
}

export type PanelMode = 'graph' | 'chat' | 'impact' | 'onboarding'

export default function Dashboard({ repoUrl, onReset }: Props) {
  const [activePanel, setActivePanel] = useState<PanelMode>('graph')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [rightOpen, setRightOpen] = useState(true)

  const repoName = repoUrl.replace('https://github.com/', '')

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
          <span className="status-dot" />
          <span className="status-text">Ready</span>
        </div>
      </header>

      {/* ── Main workspace ── */}
      <div className="workspace">
        {/* Center — Graph / main view */}
        <main className="main-view">
          {activePanel === 'graph' && (
            <GraphView repoUrl={repoUrl} onSelectFile={setSelectedFile} />
          )}
          {activePanel === 'chat' && (
            <ChatPanel repoUrl={repoUrl} selectedFile={selectedFile} />
          )}
          {activePanel === 'impact' && (
            <div className="placeholder-panel">
              <Zap size={32} className="placeholder-icon" />
              <h2>Impact Explorer</h2>
              <p>Select a file in the graph to trace its impact across the codebase.</p>
            </div>
          )}
          {activePanel === 'onboarding' && (
            <div className="placeholder-panel">
              <Map size={32} className="placeholder-icon" />
              <h2>Guided Onboarding</h2>
              <p>Generating your learning path…</p>
            </div>
          )}
        </main>

        {/* Right — File inspector */}
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
              <FileInspector filePath={selectedFile} repoUrl={repoUrl} />
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

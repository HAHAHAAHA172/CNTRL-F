import { useState, type KeyboardEvent } from 'react'
import { Search, GitBranch, Zap, Map } from 'lucide-react'

interface Props {
  onAnalyze: (url: string) => void
}

const DEMO_URL = 'https://github.com/vercel/next.js'

const FEATURES = [
  {
    icon: <GitBranch size={18} />,
    title: 'Dependency Graph',
    desc: 'Interactive map of every file and import relationship.',
  },
  {
    icon: <Search size={18} />,
    title: 'Codebase-Aware AI',
    desc: 'Ask questions — get answers grounded in actual code.',
  },
  {
    icon: <Zap size={18} />,
    title: 'Impact Explorer',
    desc: 'See exactly what breaks when you touch a file.',
  },
  {
    icon: <Map size={18} />,
    title: 'Guided Onboarding',
    desc: 'A step-by-step tour from entry point to first contribution.',
  },
]

export default function LandingPage({ onAnalyze }: Props) {
  const [url, setUrl] = useState('')

  function handleSubmit() {
    const trimmed = url.trim()
    if (trimmed) onAnalyze(trimmed)
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="landing">
      <header className="landing-header">
        <span className="logo-text">CNTRL F</span>
      </header>

      <main className="landing-main">
        <div className="landing-hero">
          <h1 className="hero-title">
            Find your way through<br />
            <span className="hero-accent">any codebase.</span>
          </h1>
          <p className="hero-sub">
            Drop a GitHub URL. Get an interactive graph, AI Q&amp;A, and a guided
            tour. All from static analysis.
          </p>

          <div className="url-row">
            <div className="url-input-wrap">
              <Search size={16} className="url-icon" />
              <input
                type="url"
                className="url-input"
                placeholder="https://github.com/owner/repo"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={handleKey}
                spellCheck={false}
              />
            </div>
            <button className="btn-primary" onClick={handleSubmit}>
              Analyze Repository
            </button>
          </div>

          <button
            className="demo-link"
            onClick={() => onAnalyze(DEMO_URL)}
          >
            Try a demo → <code>{DEMO_URL}</code>
          </button>
        </div>

        <div className="features-grid">
          {FEATURES.map(f => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="landing-footer">
        Built with IBM Bob 2.0
      </footer>
    </div>
  )
}

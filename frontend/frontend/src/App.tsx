import { useState } from 'react'
import LandingPage from './components/LandingPage'
import Dashboard from './components/Dashboard'
import './App.css'

type View = 'landing' | 'dashboard'

export default function App() {
  const [view, setView] = useState<View>('landing')
  const [repoUrl, setRepoUrl] = useState('')

  function handleAnalyze(url: string) {
    setRepoUrl(url)
    setView('dashboard')
  }

  return view === 'landing'
    ? <LandingPage onAnalyze={handleAnalyze} />
    : <Dashboard repoUrl={repoUrl} onReset={() => setView('landing')} />
}

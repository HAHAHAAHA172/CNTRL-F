import { useState, useEffect } from 'react'
import { Map, Loader2, BookOpen, Lightbulb, FileCode, ChevronRight, ChevronDown, RotateCcw } from 'lucide-react'

interface Props {
  repoUrl: string
  repoReady: boolean
  onSelectFile: (path: string) => void
}

interface OnboardingStep {
  title: string
  description: string
  files: string[]
  tip: string
}

export default function OnboardingPanel({ repoUrl, repoReady, onSelectFile }: Props) {
  const [steps, setSteps] = useState<OnboardingStep[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState(0)
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0]))

  useEffect(() => {
    if (!repoReady) return
    fetchOnboarding()
  }, [repoReady, repoUrl])

  function fetchOnboarding() {
    setLoading(true)
    setError(null)
    fetch(`/api/onboarding?repo=${encodeURIComponent(repoUrl)}`)
      .then(r => {
        if (!r.ok) return r.json().then(d => Promise.reject(d.detail ?? 'Server error'))
        return r.json()
      })
      .then(data => {
        setSteps(data.steps ?? [])
        setActiveStep(0)
        setExpandedSteps(new Set([0]))
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }

  function toggleStep(i: number) {
    setActiveStep(i)
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function nextStep() {
    if (activeStep < steps.length - 1) {
      const next = activeStep + 1
      setActiveStep(next)
      setExpandedSteps(prev => new Set(prev).add(next))
    }
  }

  if (!repoReady) return (
    <div className="placeholder-panel">
      <Map size={32} className="placeholder-icon" />
      <p>Analyzing repository…</p>
    </div>
  )

  if (loading) return (
    <div className="placeholder-panel">
      <Loader2 size={32} className="spin placeholder-icon" />
      <h2 style={{ marginTop: 12 }}>Generating your learning path…</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 360, textAlign: 'center' }}>
        AI is analyzing the codebase structure, entry points, and dependencies to create a guided tour.
      </p>
    </div>
  )

  if (error) return (
    <div className="placeholder-panel">
      <Map size={32} className="placeholder-icon" />
      <p style={{ color: '#ef4444' }}>{error}</p>
      <button className="btn-secondary" style={{ marginTop: 12 }} onClick={fetchOnboarding}>
        <RotateCcw size={13} /> Retry
      </button>
    </div>
  )

  if (steps.length === 0) return (
    <div className="placeholder-panel">
      <Map size={32} className="placeholder-icon" />
      <p>No onboarding data available.</p>
    </div>
  )

  const progress = ((activeStep + 1) / steps.length) * 100

  return (
    <div className="onboarding-panel">
      {/* Header */}
      <div className="onboarding-header">
        <div className="onboarding-header-left">
          <BookOpen size={16} />
          <span>Guided Onboarding</span>
        </div>
        <span className="onboarding-progress-label">
          Step {activeStep + 1} of {steps.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="onboarding-progress-bar">
        <div className="onboarding-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Steps */}
      <div className="onboarding-steps">
        {steps.map((step, i) => {
          const isExpanded = expandedSteps.has(i)
          const isActive = i === activeStep
          const isCompleted = i < activeStep

          return (
            <div
              key={i}
              className={`onboarding-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
            >
              {/* Step header */}
              <button className="onboarding-step-header" onClick={() => toggleStep(i)}>
                <div className="step-number">
                  {isCompleted ? '✓' : i + 1}
                </div>
                <span className="step-title">{step.title}</span>
                {isExpanded
                  ? <ChevronDown size={14} className="step-chevron" />
                  : <ChevronRight size={14} className="step-chevron" />
                }
              </button>

              {/* Step body */}
              {isExpanded && (
                <div className="onboarding-step-body">
                  <p className="step-description">{step.description}</p>

                  {/* Files */}
                  {step.files.length > 0 && (
                    <div className="step-files">
                      <div className="step-section-label">
                        <FileCode size={12} /> Key files
                      </div>
                      {step.files.map(f => (
                        <button
                          key={f}
                          className="step-file-link"
                          onClick={() => onSelectFile(f)}
                          title={`Select ${f} in graph`}
                        >
                          <FileCode size={11} />
                          {f}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Tip */}
                  {step.tip && (
                    <div className="step-tip">
                      <Lightbulb size={13} />
                      <span>{step.tip}</span>
                    </div>
                  )}

                  {/* Navigation */}
                  {i < steps.length - 1 && (
                    <button className="btn-primary step-next-btn" onClick={nextStep}>
                      Next Step <ChevronRight size={13} />
                    </button>
                  )}
                  {i === steps.length - 1 && (
                    <div className="step-complete-msg">
                      🎉 You've completed the onboarding tour!
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

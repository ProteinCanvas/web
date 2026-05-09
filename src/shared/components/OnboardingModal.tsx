'use client'

import { useState } from 'react'
import { Dna, BarChart2, Box, FlaskConical, ArrowRight, X } from 'lucide-react'

const ONBOARDING_KEY = 'proteincanvas_onboarding_v1'

interface OnboardingModalProps {
  onOpenImport: () => void
  onLoadDemo: () => void
}

export function OnboardingModal({ onOpenImport, onLoadDemo }: OnboardingModalProps) {
  const [visible, setVisible] = useState(() => !localStorage.getItem(ONBOARDING_KEY))
  const [step, setStep] = useState(0)

  const dismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setVisible(false)
  }

  const handleImport = () => { dismiss(); onOpenImport() }
  const handleDemo = () => { dismiss(); onLoadDemo() }

  if (!visible) return null

  const TOTAL = 3

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="relative flex flex-col bg-background border border-border rounded-lg shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          className="absolute top-3.5 right-3.5 p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors z-10"
        >
          <X size={14} />
        </button>

        <div className="px-8 pt-10 pb-4">
          {step === 0 && <WelcomeStep />}
          {step === 1 && <FeaturesStep />}
          {step === 2 && <StartStep onImport={handleImport} onDemo={handleDemo} />}
        </div>

        <div className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL }).map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === step ? 'w-4 bg-primary' : 'w-1.5 bg-border hover:bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
          {step < TOTAL - 1 && (
            <div className="flex items-center gap-3">
              <button
                onClick={dismiss}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip
              </button>
              <button
                onClick={() => setStep((s) => s + 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Continue
                <ArrowRight size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function WelcomeStep() {
  return (
    <div className="flex flex-col items-center text-center gap-5 py-4">
      <div className="flex items-center justify-center w-11 h-11 rounded-lg border border-border bg-card">
        <Dna size={19} className="text-primary" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground tracking-tight mb-2">
          Welcome to ProteinCanvas
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
          A browser-first visual analytics workbench for generative protein design. Explore candidates, visualize structures, and track design cycles — no backend required.
        </p>
      </div>
      <p className="text-[11px] text-muted-foreground/50 mt-1">
        A quick look at what you can do
      </p>
    </div>
  )
}

function FeaturesStep() {
  const features = [
    {
      Icon: BarChart2,
      title: 'Analyze',
      description: 'Metric distributions, scatter plots, UMAP embeddings, and correlation heatmaps across thousands of candidates.',
    },
    {
      Icon: Box,
      title: 'Visualize',
      description: 'Interactive Mol* 3D viewer, PAE matrices, sequence alignment, and per-residue pLDDT coloring.',
    },
    {
      Icon: FlaskConical,
      title: 'Track',
      description: 'DBTL cycles, experimental outcomes, shortlists, and full provenance across design rounds.',
    },
  ]

  return (
    <div className="flex flex-col gap-5 py-2">
      <div className="text-center">
        <h2 className="text-sm font-semibold text-foreground tracking-tight mb-1">
          What you can do
        </h2>
        <p className="text-xs text-muted-foreground">
          Everything in your browser, no installation required
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {features.map(({ Icon, title, description }) => (
          <div key={title} className="flex items-start gap-3 p-3 rounded bg-card border border-border">
            <div className="flex items-center justify-center w-7 h-7 rounded border border-border bg-background shrink-0 mt-0.5">
              <Icon size={13} className="text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground mb-0.5">{title}</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StartStep({ onImport, onDemo }: { onImport: () => void; onDemo: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-6 py-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground tracking-tight mb-1.5">
          Ready to explore?
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
          Load sample data to explore all features, or import your own campaign from a CSV, ZIP bundle, or tool output.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full">
        <button
          onClick={onImport}
          className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Import campaign
        </button>
        <button
          onClick={onDemo}
          className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-medium rounded border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          Load demo data
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground/50">
        Supports CSV, RFdiffusion, ProteinMPNN, Rosetta, and more
      </p>
    </div>
  )
}

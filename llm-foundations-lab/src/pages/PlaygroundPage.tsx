import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TransformerExplorer } from '../components/lab/TransformerExplorer'
import { TokenizerLab } from '../components/lab/TokenizerLab'
import { SamplingLab } from '../components/lab/SamplingLab'
import { LearningLab } from '../components/lab/LearningLab'
import { AlignmentLab } from '../components/lab/AlignmentLab'
import { InferenceLab } from '../components/lab/InferenceLab'
import { PromptLab } from '../components/lab/PromptLab'
import { useProgress } from '../state/hooks'
import type { SavedPlaygroundConfig } from '../core/progress'
import { LABS, labByTab } from '../content/labs'
import { Badge, Button, Callout, Panel, Tabs } from '../components/ui/primitives'

type LabId = SavedPlaygroundConfig['lab']

export function PlaygroundPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { progress, saveConfig, removeConfig } = useProgress()
  const [savedName, setSavedName] = useState<string | null>(null)

  /*
   * The selected laboratory is derived from the URL rather than stored in
   * state. Reading it once in a `useState` initialiser would mean the URL and
   * the panel could disagree: changing the address, or pressing Back after
   * switching laboratories, would leave the old laboratory on screen. Deriving
   * it makes the address bar the single source of truth.
   */
  const configParam = searchParams.get('config')
  const savedConfig = useMemo(
    () => (configParam ? progress.playgroundConfigs.find((config) => config.id === configParam) : undefined),
    [configParam, progress.playgroundConfigs],
  )
  const requestedLab = searchParams.get('lab')
  const lab: LabId = labByTab(requestedLab)?.tab ?? (savedConfig?.lab ?? 'transformer')
  const importedSettings = savedConfig?.settings ?? null
  /** Changes when a different configuration is loaded, so the laboratory remounts. */
  const configKey = configParam ?? 'default'

  const active = useMemo(() => labByTab(lab)!, [lab])

  const handleSave = (settings: Record<string, number | string | boolean>) => {
    const config: SavedPlaygroundConfig = {
      id: `${lab}-${Date.now()}`,
      name: `${active.title} configuration ${progress.playgroundConfigs.length + 1}`,
      lab,
      settings,
      savedAt: new Date().toISOString(),
    }
    saveConfig(config)
    setSavedName(config.name)
  }

  return (
    <div className="animate-rise space-y-5">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">Interactive playground</h1>
        <p className="max-w-3xl text-sm text-muted">
          {LABS.length} laboratories, each computing its results in this browser tab. Configurations you save are added
          to your local progress file and can be reopened from the dashboard or exported as JSON.
        </p>
      </header>

      <Tabs
        label="Laboratories"
        value={lab}
        onChange={(next) => {
          setSearchParams({ lab: next })
        }}
        tabs={LABS.map((item) => ({ value: item.tab, label: item.label }))}
      />

      {/* Each laboratory renders its own titled header, so this panel only carries
          transient messages instead of repeating the title. */}
      {importedSettings || savedName ? (
        <Panel className="space-y-2">
          {importedSettings ? (
            <Callout tone="teal" title="Saved configuration loaded">
              The controls have been set to the values stored in your progress file:{' '}
              <span className="font-mono text-xs">
                {Object.entries(importedSettings)
                  .slice(0, 6)
                  .map(([key, value]) => `${key}=${String(value).slice(0, 24)}`)
                  .join(' · ')}
              </span>
              . Change anything and save it again to keep the new values.
            </Callout>
          ) : null}
          {savedName ? (
            <Callout tone="teal" title="Configuration saved">
              “{savedName}” was added to your local progress.{' '}
              <button type="button" className="underline" onClick={() => setSavedName(null)}>
                Dismiss
              </button>
            </Callout>
          ) : null}
        </Panel>
      ) : null}

      {/*
        The key changes when a saved configuration is loaded, so the laboratory
        remounts and picks the stored values up as its initial state. Without
        it the controls would keep their defaults and the configuration would
        only be displayed, not restored.
      */}
      {lab === 'transformer' ? (
        <TransformerExplorer
          key={`transformer-${configKey}`}
          initialSettings={importedSettings ?? undefined}
          onSaveConfig={handleSave}
        />
      ) : null}
      {lab === 'tokenizer' ? (
        <TokenizerLab
          key={`tokenizer-${configKey}`}
          initialSettings={importedSettings ?? undefined}
          onSaveConfig={handleSave}
        />
      ) : null}
      {lab === 'sampling' ? (
        <SamplingLab
          key={`sampling-${configKey}`}
          initialSettings={importedSettings ?? undefined}
          onSaveConfig={handleSave}
        />
      ) : null}
      {lab === 'learning' ? (
        <LearningLab
          key={`learning-${configKey}`}
          initialSettings={importedSettings ?? undefined}
          onSaveConfig={handleSave}
        />
      ) : null}
      {lab === 'alignment' ? (
        <AlignmentLab
          key={`alignment-${configKey}`}
          initialSettings={importedSettings ?? undefined}
          onSaveConfig={handleSave}
        />
      ) : null}
      {lab === 'inference' ? (
        <InferenceLab
          key={`inference-${configKey}`}
          initialSettings={importedSettings ?? undefined}
          onSaveConfig={handleSave}
        />
      ) : null}
      {lab === 'prompt' ? (
        <PromptLab
          key={`prompt-${configKey}`}
          initialSettings={importedSettings ?? undefined}
          onSaveConfig={handleSave}
        />
      ) : null}

      {progress.playgroundConfigs.length > 0 ? (
        <Panel>
          <h2 className="font-display text-lg font-semibold text-fg">Saved configurations</h2>
          <ul className="mt-2 space-y-2">
            {progress.playgroundConfigs
              .slice()
              .reverse()
              .map((config) => (
                <li key={config.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-control bg-panel-2/40 p-2.5">
                  <div>
                    <p className="text-sm text-fg">{config.name}</p>
                    <p className="font-mono text-[11px] text-faint">
                      <Badge tone="neutral">{config.lab}</Badge>{' '}
                      {Object.entries(config.settings)
                        .slice(0, 6)
                        .map(([key, value]) => `${key}=${String(value).slice(0, 24)}`)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSearchParams({ lab: config.lab, config: config.id })
                      }}
                    >
                      Load
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeConfig(config.id)}>
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  )
}

export default PlaygroundPage

import { useMemo, useState } from 'react'
import {
  DILEMMA_OPPONENTS,
  DILEMMA_STRATEGIES,
  PRISONERS_DILEMMA,
  runDilemma,
  type DilemmaAction,
} from '../../engine/demos/dilemma'
import { Badge, Button, cn } from '../primitives'
import { DemoShell } from './DemoShell'

/**
 * Social dilemmas, playable.
 *
 * Chapter 15 measures cooperation with games whose equilibrium is known, so
 * that a model's behaviour can be scored against a formal prediction. This
 * demonstration lets the student take the seat of the model: play against a
 * fixed opponent over a stated horizon, and see the equilibrium line.
 *
 * The point it makes is uncomfortable and worth making: cooperation is
 * *strictly dominated* in the one-shot game and *sustainable* in the repeated
 * one. A dilemma result without its horizon is not a result.
 */
export function DilemmaDemo() {
  const [opponentId, setOpponentId] = useState('tit-for-tat')
  const [horizon, setHorizon] = useState(10)
  const [myActions, setMyActions] = useState<DilemmaAction[]>([])

  const opponent = useMemo(
    () => DILEMMA_OPPONENTS.find((entry) => entry.id === opponentId) ?? DILEMMA_OPPONENTS[0],
    [opponentId],
  )

  const run = useMemo(
    () => runDilemma(opponent, horizon, (history) => myActions[history.length] ?? 'cooperate'),
    [opponent, horizon, myActions],
  )

  const played = myActions.length

  return (
    <DemoShell
      title="Playing a social dilemma"
      source="Ch. 15, §15.4 Cooperation and coordination in social dilemmas"
      summary="Play against a fixed opponent over a stated number of rounds and watch the equilibrium line. The same behaviour is rational at one horizon and irrational at another."
      controls={
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="demo-dilemma-opponent" className="text-muted text-xs font-medium">
              Opponent
            </label>
            <select
              id="demo-dilemma-opponent"
              value={opponentId}
              onChange={(event) => {
                setOpponentId(event.target.value)
                setMyActions([])
              }}
              className="focus-ring surface-2 mt-1 w-full rounded-lg border px-2 py-1.5 text-xs"
              style={{ color: 'var(--text-strong)', borderColor: 'var(--border-soft)' }}
            >
              {DILEMMA_OPPONENTS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="demo-dilemma-horizon" className="text-muted text-xs font-medium">
              Rounds: {horizon}
            </label>
            <input
              id="demo-dilemma-horizon"
              type="range"
              min={1}
              max={20}
              step={1}
              value={horizon}
              onChange={(event) => {
                setHorizon(Number(event.target.value))
                setMyActions([])
              }}
              className="focus-ring mt-1 w-full accent-cyan-400"
            />
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="surface-2 overflow-x-auto rounded-lg border p-3 text-xs" style={{ borderColor: 'var(--border-soft)' }}>
          <table className="w-full border-collapse">
            <caption className="text-muted mb-2 text-left">
              Prisoner&apos;s Dilemma payoffs. Rows are your action, columns theirs; each cell is (you, them). T &gt; R &gt; P &gt; S, and
              defection dominates.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="border-b px-2 py-1 text-left">
                  you \ them
                </th>
                <th scope="col" className="border-b px-2 py-1 text-left">
                  cooperate
                </th>
                <th scope="col" className="border-b px-2 py-1 text-left">
                  defect
                </th>
              </tr>
            </thead>
            <tbody>
              {(['cooperate', 'defect'] as DilemmaAction[]).map((row) => (
                <tr key={row}>
                  <th scope="row" className="border-b px-2 py-1 text-left font-medium">
                    {row}
                  </th>
                  <td className="border-b px-2 py-1">({PRISONERS_DILEMMA.matrix[row].cooperate.join(', ')})</td>
                  <td className="border-b px-2 py-1">({PRISONERS_DILEMMA.matrix[row].defect.join(', ')})</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={run.reachedOptimal ? 'emerald' : 'amber'}>
            you {run.myTotal} · opponent {run.theirTotal}
          </Badge>
          <Badge tone="neutral">best possible {run.bestPossibleMyTotal}</Badge>
          <Badge tone="neutral">optimal play {run.optimalMyTotal}</Badge>
          <Badge tone="neutral">
            {played}/{horizon} rounds played
          </Badge>
        </div>

        <ol
          tabIndex={0}
          aria-label="Rounds played"
          className="thin-scroll focus-ring max-h-48 space-y-1 overflow-y-auto pr-1 text-xs"
        >
          {run.rounds.map((round) => (
            <li
              key={round.round}
              className={cn(
                'flex flex-wrap items-baseline gap-2 rounded border px-2 py-1',
                round.myAction === 'defect' ? 'text-rose-200' : 'text-emerald-200',
              )}
              style={{ borderColor: 'var(--border-soft)' }}
            >
              <span className="text-muted font-mono text-[10px]">#{round.round}</span>
              <span>you {round.myAction}</span>
              <span className="text-muted">· they {round.theirAction}</span>
              <span className="text-muted">· ({round.myPayoff}, {round.theirPayoff})</span>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => setMyActions((current) => [...current, 'cooperate'])}
            disabled={played >= horizon}
          >
            Cooperate
          </Button>
          <Button size="sm" onClick={() => setMyActions((current) => [...current, 'defect'])} disabled={played >= horizon}>
            Defect
          </Button>
          {DILEMMA_STRATEGIES.map((strategy) => (
            <Button
              key={strategy.id}
              size="sm"
              variant="ghost"
              title={strategy.description}
              onClick={() => {
                const history: DilemmaAction[] = []
                const actions: DilemmaAction[] = []
                for (let round = 0; round < horizon; round += 1) {
                  const action = strategy.policy([...history])
                  actions.push(action)
                  history.push(action)
                }
                setMyActions(actions)
              }}
            >
              {strategy.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setMyActions([])}>
            Reset
          </Button>
        </div>

        <p className="text-muted text-[11px] leading-relaxed">
          {run.summary}{' '}
          {run.horizon > 1 && !run.reachedOptimal
            ? 'Notice that "always cooperate" falls short of optimal play: in the final round there is no future left to protect, so a rational player defects and takes the temptation payoff. A dilemma result without its horizon is not a result.'
            : ''}
        </p>
      </div>
    </DemoShell>
  )
}

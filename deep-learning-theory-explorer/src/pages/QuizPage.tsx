import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Panel, Badge, Button, Table } from '../components/ui';
import { DownloadCsv } from '../components/DownloadCsv';
import { Rich } from '../components/Math';
import { QUIZ } from '../content/quizzes';
import { useProgress, quizScore } from '../lib/persistence';
import { LESSON_BY_ID } from '../content/lessons';

export function QuizPage() {
  const { progress, recordQuiz } = useProgress();
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [numericInput, setNumericInput] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [how, setHow] = useState<'option' | 'number' | null>(null);
  const [order, setOrder] = useState<number[]>(() => QUIZ.map((_, i) => i));

  const question = QUIZ[order[index] ?? 0];
  const score = quizScore(progress);
  const answeredIds = useMemo(() => new Set(progress.quiz.map((a) => a.questionId)), [progress.quiz]);
  const previous = progress.quiz.find((a) => a.questionId === question.id);
  // the questions that were answered incorrectly, most recent first
  const wrong = useMemo(
    () =>
      progress.quiz
        .filter((a) => !a.correct)
        .sort((a, b) => b.answeredAt.localeCompare(a.answeredAt))
        .map((a) => QUIZ.find((q) => q.id === a.questionId))
        .filter((q): q is (typeof QUIZ)[number] => Boolean(q)),
    [progress.quiz],
  );

  const submit = () => {
    // A question may be answerable either way: by choosing an option, by typing
    // a number, or both. Either route counts as correct, and the verdict says
    // which one was used.
    let correct = false;
    let how: 'option' | 'number' | null = null;
    if (question.numeric && numericInput.trim() !== '') {
      const v = Number(numericInput);
      if (Number.isFinite(v) && Math.abs(v - question.numeric.answer) <= question.numeric.tolerance) {
        correct = true;
        how = 'number';
      }
    }
    if (!correct && choice !== null && choice === question.answerIndex) {
      correct = true;
      how = 'option';
    }
    recordQuiz({ questionId: question.id, correct, answeredAt: new Date().toISOString(), choice: choice ?? -1 });
    setRevealed(true);
    setHow(how);
  };

  const next = () => {
    setRevealed(false);
    setHow(null);
    setChoice(null);
    setNumericInput('');
    setIndex((i) => (i + 1) % QUIZ.length);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-lab-100">Assessment</h1>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-lab-300">
            Twenty questions covering the whole course. Numeric answers are accepted within the stated tolerance and are
            checked against values computed by the same code the laboratories run.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone="good">
            score {score.correct}/{score.attempted || 0}
          </Badge>
          <Button
            variant="ghost"
            onClick={() => {
              const shuffled = [...order].sort(() => Math.random() - 0.5);
              setOrder(shuffled);
              setIndex(0);
              setRevealed(false);
              setChoice(null);
            }}
          >
            shuffle order
          </Button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Panel
          title={`Question ${index + 1} of ${QUIZ.length}`}
          right={
            <div className="flex gap-1.5">
              <Badge>{question.difficulty}</Badge>
              <Badge>{LESSON_BY_ID[question.lessonId]?.chapter ?? ''}</Badge>
              {answeredIds.has(question.id) && <Badge tone={previous?.correct ? 'good' : 'bad'}>{previous?.correct ? 'correct' : 'attempted'}</Badge>}
            </div>
          }
          subtitle={<Link to={`/lessons/${question.lessonId}`}>from lesson: {LESSON_BY_ID[question.lessonId]?.title}</Link>}
        >
          <p className="text-[14px] leading-relaxed text-lab-100">
            <Rich text={question.prompt} />
          </p>

          {question.numeric ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                className="mono w-40 rounded border border-lab-600 bg-lab-850 px-2 py-1.5 text-[13px] text-lab-100 focus:border-signal-blue focus:outline-none"
                placeholder="numeric answer"
                aria-label={`your numeric answer for question ${index + 1}`}
                value={numericInput}
                onChange={(e) => setNumericInput(e.target.value)}
                disabled={revealed}
              />
              <span className="text-[12px] text-lab-400">
                {question.numeric.unit ?? ''} · tolerance ±{question.numeric.tolerance}
              </span>
              <span className="text-[12px] text-lab-400">(or simply pick the right option below)</span>
            </div>
          ) : null}

          <ul className="mt-3 space-y-2">
            {question.options.map((opt, i) => {
              const isChosen = choice === i;
              const isAnswer = i === question.answerIndex;
              const state = revealed ? (isAnswer ? 'answer' : isChosen ? 'wrong' : 'idle') : isChosen ? 'chosen' : 'idle';
              const styles =
                state === 'answer'
                  ? 'border-signal-green/60 bg-signal-green/10'
                  : state === 'wrong'
                    ? 'border-signal-red/60 bg-signal-red/10'
                    : state === 'chosen'
                      ? 'border-signal-blue bg-signal-blue/10'
                      : 'border-lab-700 bg-lab-850/40 hover:border-lab-500';
              return (
                <li key={i}>
                  <button
                    type="button"
                    disabled={revealed}
                    onClick={() => setChoice(i)}
                    className={`w-full rounded border px-3 py-2 text-left text-[13px] text-lab-100 transition-colors ${styles}`}
                  >
                    <span className="mono mr-2 text-lab-500">{String.fromCharCode(65 + i)}</span>
                    <Rich text={opt} />
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex flex-wrap gap-2">
            {!revealed ? (
              <Button onClick={submit} disabled={choice === null && numericInput.trim() === ''}>
                submit answer
              </Button>
            ) : (
              <Button onClick={next}>next question →</Button>
            )}
            <Button variant="ghost" onClick={() => setRevealed(true)}>
              reveal
            </Button>
          </div>

          {revealed && (
            <div
              role="status"
              aria-live="polite"
              className="mt-3 rounded border border-signal-blue/40 bg-signal-blue/10 p-3"
            >
              <div className="text-[11px] uppercase tracking-wider text-signal-blue">Explanation</div>
              {how && (
                <p className="mt-1 text-[12.5px] text-lab-100">
                  Marked correct on your{' '}
                  <span className="text-signal-green">{how === 'number' ? 'numeric answer' : 'multiple choice'}</span>.
                </p>
              )}
              <p className="mt-1 text-[13px] leading-relaxed text-lab-100">
                <Rich text={question.explanation} />
              </p>
              {question.numeric && (
                <p className="mt-1 text-[12px] text-lab-300">
                  The expected numeric answer is{' '}
                  <span className="mono text-lab-100">
                    {question.numeric.answer}
                    {question.numeric.unit ? ` ${question.numeric.unit}` : ''}
                  </span>{' '}
                  (±{question.numeric.tolerance}).
                </p>
              )}
              <p className="mt-2 text-[11.5px] text-lab-300">Sources: {question.citations.join(', ')}</p>
              <Link to={`/lessons/${question.lessonId}`} className="mt-2 inline-block text-[12px]">
                revisit the lesson →
              </Link>
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Progress"
            subtitle="Stored locally; nothing leaves your browser."
            right={
              <DownloadCsv
                filename="assessment-answers.csv"
                meta={{
                  questions: QUIZ.length,
                  attempted: score.attempted,
                  correct: score.correct,
                  when: new Date().toISOString(),
                }}
                header={['question', 'lesson', 'prompt', 'your answer', 'correct answer', 'result', 'explanation', 'sources']}
                rows={QUIZ.map((q) => {
                  const attempt = progress.quiz.find((a) => a.questionId === q.id);
                  const yours = attempt && attempt.choice >= 0 ? q.options[attempt.choice] : '';
                  return [
                    q.id,
                    q.lessonId,
                    q.prompt,
                    yours,
                    q.options[q.answerIndex] ?? '',
                    !attempt ? 'not attempted' : attempt.correct ? 'correct' : 'incorrect',
                    q.explanation,
                    q.citations.join(', '),
                  ];
                })}
                label="download as a study sheet"
              />
            }
          >
            <Table
              head={['Metric', 'Value']}
              rows={[
                ['questions attempted', String(score.attempted)],
                ['correct', String(score.correct)],
                ['accuracy', Number.isFinite(score.accuracy) ? `${(100 * score.accuracy).toFixed(0)}%` : '—'],
              ]}
            />
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {QUIZ.map((q, i) => {
                const attempt = progress.quiz.find((a) => a.questionId === q.id);
                const state = !attempt ? 'not attempted' : attempt.correct ? 'correct' : 'incorrect';
                const tone = !attempt ? 'bg-lab-700' : attempt.correct ? 'bg-signal-green/70' : 'bg-signal-red/70';
                return (
                  <button
                    key={q.id}
                    type="button"
                    title={`${q.id}: ${state}`}
                    /* the number alone says nothing; the state is the point */
                    aria-label={`question ${i + 1}: ${state}`}
                    onClick={() => {
                      setIndex(order.indexOf(i));
                      setRevealed(false);
                      setChoice(null);
                      setNumericInput('');
                    }}
                    className={`h-6 rounded ${tone} text-[10px] text-lab-950`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel
            title="The ones you got wrong"
            subtitle="Worth more than the ones you got right: these are the gaps."
          >
            {wrong.length === 0 ? (
              <p className="text-[12.5px] leading-relaxed text-lab-300">
                {score.attempted === 0
                  ? 'Nothing attempted yet. Answer a question and it will be listed here if you get it wrong, with the reasoning beside it.'
                  : 'Nothing wrong so far. If a question is answered incorrectly it appears here with its reasoning, so you can close the gap rather than remember that you had one.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {wrong.map((q) => {
                  const attempt = progress.quiz.find((a) => a.questionId === q.id);
                  return (
                    <li key={q.id} className="rounded border border-signal-red/30 bg-signal-red/5 p-2.5">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <Badge tone="bad">{q.id}</Badge>
                        <span className="text-[12.5px] leading-snug text-lab-100">
                          <Rich text={q.prompt} />
                        </span>
                      </div>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-lab-300">
                        <Rich text={q.explanation} />
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Link
                          to={`/lessons/${q.lessonId}`}
                          className="text-[11.5px] text-signal-blue underline decoration-dotted"
                        >
                          revisit the lesson →
                        </Link>
                        {attempt && (
                          <span className="text-[11px] text-lab-500">
                            answered {new Date(attempt.answeredAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="How the numeric answers were obtained">
            <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-lab-300">
              <li>· Critical values such as 2 and 1.882 come from the quadrature-based criticality scanner.</li>
              <li>· The fluctuation variance 2ℓ/n is the leading finite-width result, verified against 400 seeded networks in the test suite.</li>
              <li>· The NTK value x·x′ + 1 was obtained by differentiating a single-layer network by hand and is checked against Jacobians in the app.</li>
            </ul>
            <p className="mt-2 text-[11.5px] text-lab-400">
              If a question&apos;s expected value and the app&apos;s computation ever disagreed, the app&apos;s computation would
              be the one under suspicion — which is why the tests in <span className="mono">tests/</span> assert the same
              numbers.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

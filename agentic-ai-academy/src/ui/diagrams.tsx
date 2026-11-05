import type { ReactNode } from 'react'
import type { DiagramId } from '../types/curriculum'

/**
 * Original diagrams authored for this course as inline SVG.
 *
 * Nothing here is traced from the textbook PDF: each diagram is a simplified
 * teaching reconstruction of the mechanism described in the referenced section.
 * Labels stay close to the book's terminology so students can cross-check.
 */

const CYAN = '#35e6ff'
const VIOLET = '#a78bfa'
const AMBER = '#fbbf24'
const ROSE = '#fb7185'
const EMERALD = '#34d399'
const INK = '#0b1020'
const SOFT = '#9aa7c7'

function Box({
  x,
  y,
  w = 140,
  h = 52,
  title,
  sub,
  color = CYAN,
  dashed,
}: {
  x: number
  y: number
  w?: number
  h?: number
  title: string
  sub?: string
  color?: string
  dashed?: boolean
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        fill={`${color}14`}
        stroke={color}
        strokeWidth={1.4}
        strokeDasharray={dashed ? '5 4' : undefined}
      />
      <text x={x + 12} y={y + (sub ? 22 : 31)} fill="#e8edfb" fontSize={12.5} fontWeight={600}>
        {title}
      </text>
      {sub ? (
        <text x={x + 12} y={y + 38} fill={SOFT} fontSize={11}>
          {sub}
        </text>
      ) : null}
    </g>
  )
}

function Arrow({
  from,
  to,
  label,
  color = SOFT,
  dashed,
  curve = 0,
}: {
  from: [number, number]
  to: [number, number]
  label?: string
  color?: string
  dashed?: boolean
  curve?: number
}) {
  const [x1, y1] = from
  const [x2, y2] = to
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2 - curve
  const path = `M ${x1} ${y1} Q ${midX + curve / 2} ${midY}, ${x2} ${y2}`
  return (
    <g>
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} markerEnd="url(#arrowhead)" strokeDasharray={dashed ? '5 4' : undefined} />
      {label ? (
        <text x={midX} y={midY - 6} fill={color} fontSize={10.5} textAnchor="middle">
          {label}
        </text>
      ) : null}
    </g>
  )
}

function Frame({ height, children, caption }: { height: number; children: ReactNode; caption?: string }) {
  return (
    <figure className="surface-2 rounded-xl border p-3" style={{ borderColor: 'var(--border-soft)' }}>
      <svg role="img" viewBox={`0 0 720 ${height}`} className="h-auto w-full" aria-label={caption ?? 'Course diagram'}>
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill={SOFT} />
          </marker>
        </defs>
        <rect x={0} y={0} width={720} height={height} rx={12} fill={INK} opacity={0.35} />
        {children}
      </svg>
      {caption ? <figcaption className="text-muted mt-2 text-xs">{caption}</figcaption> : null}
    </figure>
  )
}

const diagrams: Record<DiagramId, () => ReactNode> = {
  'harness-loop': () => (
    <Frame height={230} caption="Agentic loop: the harness owns prompts, tools and state; the model supplies decisions.">
      <Box x={24} y={30} title="User goal" sub="task, constraints" color={AMBER} />
      <Box x={210} y={30} title="Harness" sub="prompt · state · tools · policy" color={CYAN} w={200} />
      <Box x={470} y={30} title="LLM" sub="language · code · decisions" color={VIOLET} w={200} />
      <Box x={210} y={140} title="Environment / tools" sub="APIs · files · browser" color={EMERALD} w={200} />
      <Box x={470} y={140} title="Observations" sub="results, errors, feedback" color={ROSE} w={200} />
      <Arrow from={[164, 56]} to={[210, 56]} />
      <Arrow from={[410, 56]} to={[470, 56]} label="call" />
      <Arrow from={[570, 82]} to={[570, 140]} label="reason → act" />
      <Arrow from={[470, 166]} to={[410, 166]} label="observe" />
      <Arrow from={[310, 140]} to={[310, 82]} label="feedback" dashed />
    </Frame>
  ),
  'reflection-loop': () => (
    <Frame height={250} caption="Self-reflection: the harness calls one model in several roles and searches or learns over the prompt.">
      <Box x={20} y={95} title="Initial problem" sub="goal + state" color={AMBER} />
      <Box x={200} y={20} title="1 · Generate" sub="subproblems, candidate steps" color={CYAN} />
      <Box x={200} y={100} title="2 · Evaluate" sub="score against goal" color={VIOLET} />
      <Box x={200} y={180} title="3 · Improve" sub="rewrite prompt / plan" color={EMERALD} />
      <Box x={440} y={100} title="Search (tree search)" sub="Style D · in context" color={CYAN} w={150} />
      <Box x={440} y={20} title="RL over prompts" sub="Style D · reward-driven" color={VIOLET} w={150} />
      <Box x={440} y={180} title="RLVR finetuning" sub="Style E · weights change" color={ROSE} w={150} />
      <Arrow from={[160, 121]} to={[200, 121]} />
      <Arrow from={[270, 72]} to={[270, 100]} />
      <Arrow from={[270, 152]} to={[270, 180]} />
      <Arrow from={[340, 46]} to={[440, 46]} />
      <Arrow from={[340, 126]} to={[440, 126]} />
      <Arrow from={[340, 206]} to={[440, 206]} />
      <text x={620} y={120} fill={SOFT} fontSize={11} textAnchor="middle">
        state buffers
      </text>
      <text x={620} y={136} fill={SOFT} fontSize={11} textAnchor="middle">
        (history, critique)
      </text>
    </Frame>
  ),
  'llm-transformer': () => (
    <Frame height={230} caption="Decoder-only transformer: tokens → embeddings → stacked blocks → next-token distribution.">
      <Box x={20} y={80} title="Tokens" sub="subword units" color={AMBER} w={110} />
      <Box x={160} y={80} title="Embeddings" sub="+ positions" color={CYAN} w={120} />
      <Box x={310} y={40} title="Attention" sub="Q · K · V, multi-head" color={VIOLET} w={150} />
      <Box x={310} y={110} title="Feed-forward" sub="per-token MLP" color={EMERALD} w={150} />
      <Box x={500} y={80} title="Next-token distribution" sub="softmax over vocabulary" color={ROSE} w={190} />
      <Arrow from={[130, 106]} to={[160, 106]} />
      <Arrow from={[280, 106]} to={[310, 66]} />
      <Arrow from={[280, 106]} to={[310, 136]} />
      <Arrow from={[460, 106]} to={[500, 106]} />
      <text x={310} y={180} fill={SOFT} fontSize={11}>
        residual stream: every block reads and adds back
      </text>
      <text x={310} y={198} fill={SOFT} fontSize={11}>
        × N layers (attention cost grows with n²)
      </text>
    </Frame>
  ),
  'training-pipeline': () => (
    <Frame height={210} caption="Five stages (Ch. 3): acquire data → pretrain → finetune → preference tuning → infer.">
      <Box x={16} y={70} title="Acquire data" sub="corpus + filters" color={AMBER} w={124} />
      <Box x={156} y={70} title="Pretrain" sub="next-token objective" color={CYAN} w={124} />
      <Box x={296} y={70} title="Finetune" sub="instruction pairs" color={VIOLET} w={124} />
      <Box x={436} y={70} title="Preference tuning" sub="RLHF-style signals" color={EMERALD} w={136} />
      <Box x={588} y={70} title="Infer" sub="serve + agent loop" color={ROSE} w={116} />
      <Arrow from={[140, 96]} to={[156, 96]} />
      <Arrow from={[280, 96]} to={[296, 96]} />
      <Arrow from={[420, 96]} to={[436, 96]} />
      <Arrow from={[572, 96]} to={[588, 96]} />
      <text x={20} y={170} fill={SOFT} fontSize={11}>
        Each stage answers a different question; preference tuning only makes sense after the model follows instructions.
      </text>
    </Frame>
  ),
  'scaling-curve': () => (
    <Frame height={220} caption="Loss against model size at a fixed compute budget: underfitting on the left, data-starved on the right. See the interactive explorer below.">
      <path d="M80 180 C 200 60, 340 50, 420 70 C 500 92, 580 150, 680 172" fill="none" stroke={CYAN} strokeWidth={2.4} />
      <line x1={80} y1={180} x2={680} y2={180} stroke={SOFT} strokeWidth={1.2} />
      <line x1={80} y1={40} x2={80} y2={180} stroke={SOFT} strokeWidth={1.2} />
      <circle cx={420} cy={62} r={5} fill={VIOLET} />
      <text x={430} y={52} fill={VIOLET} fontSize={11.5}>
        compute-optimal N* (IsoFLOP minimum)
      </text>
      <text x={90} y={196} fill={SOFT} fontSize={11}>
        model size N →
      </text>
      <text x={22} y={50} fill={SOFT} fontSize={11} transform="rotate(-90 30 50)">
        loss
      </text>
      <text x={120} y={140} fill={SOFT} fontSize={11}>
        underfits
      </text>
      <text x={600} y={140} fill={SOFT} fontSize={11}>
        too few tokens
      </text>
    </Frame>
  ),
  'react-cycle': () => (
    <Frame height={210} caption="ReAct: reason, act, observe. Errors arrive as observations, which is what makes recovery possible.">
      <Box x={40} y={70} title="Thought" sub="reasoning trace" color={VIOLET} />
      <Box x={290} y={70} title="Action" sub="tool call, command" color={CYAN} />
      <Box x={540} y={70} title="Observation" sub="result or error" color={EMERALD} />
      <Arrow from={[180, 96]} to={[290, 96]} />
      <Arrow from={[430, 96]} to={[540, 96]} />
      <Arrow from={[610, 122]} to={[110, 122]} label="feedback into the prompt" curve={70} dashed />
    </Frame>
  ),
  'vlm-architecture': () => (
    <Frame height={215} caption="Vision-language model: encode pixels, project into the embedding space, then attend over both modalities.">
      <Box x={20} y={75} title="Image" sub="pixels / frames" color={AMBER} w={120} />
      <Box x={170} y={75} title="Vision encoder" sub="CNN / ViT" color={CYAN} w={150} />
      <Box x={350} y={75} title="Projection" sub="features → embedding dim" color={VIOLET} w={160} />
      <Box x={550} y={40} title="Language model" sub="text + visual tokens" color={EMERALD} w={150} />
      <Box x={550} y={120} title="Output" sub="answer / caption / action" color={ROSE} w={150} />
      <Arrow from={[140, 101]} to={[170, 101]} />
      <Arrow from={[320, 101]} to={[350, 101]} />
      <Arrow from={[510, 101]} to={[550, 80]} />
      <Arrow from={[625, 92]} to={[625, 120]} />
    </Frame>
  ),
  'world-model-loop': () => (
    <Frame height={235} caption="Model-based control: plan inside the learned model, act in the real environment, update both from the outcome.">
      <Box x={30} y={80} title="Agent / policy" sub="π(a | s)" color={CYAN} />
      <Box x={280} y={20} title="World model" sub="f(s,a) → s′, g(s,a) → r" color={VIOLET} w={170} />
      <Box x={280} y={140} title="Environment" sub="true dynamics" color={EMERALD} w={170} />
      <Box x={540} y={80} title="Planning" sub="roll-outs before acting" color={AMBER} w={150} />
      <Arrow from={[170, 100]} to={[280, 46]} label="imagine" />
      <Arrow from={[170, 120]} to={[280, 166]} label="act" />
      <Arrow from={[450, 46]} to={[540, 96]} />
      <Arrow from={[450, 166]} to={[540, 120]} label="observation" />
      <Arrow from={[615, 132]} to={[100, 106]} dashed curve={60} label="update model + policy" />
    </Frame>
  ),
  'memory-layers': () => (
    <Frame height={240} caption="Memory layers: parameters, context window with compression, and harness-managed stores with read/write and forgetting.">
      <Box x={20} y={30} title="Parameters" sub="finetuning, LoRA" color={VIOLET} w={200} />
      <Box x={20} y={110} title="Context window" sub="history + compression" color={CYAN} w={200} />
      <Box x={20} y={190} title="Explicit store" sub="read / write / forget" color={EMERALD} w={200} />
      <Box x={280} y={110} title="Harness" sub="retrieval policy, summarisation" color={AMBER} w={190} />
      <Box x={520} y={60} title="Episodic memory" sub="events + salience" color={EMERALD} w={170} />
      <Box x={520} y={160} title="Vector index" sub="embeddings, top-k" color={CYAN} w={170} />
      <Arrow from={[220, 50]} to={[280, 120]} />
      <Arrow from={[220, 130]} to={[280, 130]} />
      <Arrow from={[220, 210]} to={[280, 150]} />
      <Arrow from={[470, 120]} to={[520, 86]} />
      <Arrow from={[470, 140]} to={[520, 176]} />
      <text x={280} y={200} fill={SOFT} fontSize={11}>
        forgetting is a feature: capacity forces prioritisation
      </text>
    </Frame>
  ),
  'mcp-topology': () => (
    <Frame height={215} caption="Model Context Protocol: one host manages clients, each connected to a server over STDIO (local) or Streamable HTTP (remote).">
      <Box x={20} y={75} title="MCP host" sub="the AI application" color={VIOLET} w={160} />
      <Box x={230} y={30} title="Client A" sub="STDIO" color={CYAN} w={140} />
      <Box x={230} y={120} title="Client B" sub="Streamable HTTP" color={CYAN} w={140} />
      <Box x={430} y={30} title="Local server" sub="files, database" color={EMERALD} w={150} />
      <Box x={430} y={120} title="Remote server" sub="search, SaaS tools" color={EMERALD} w={150} />
      <Box x={620} y={75} title="Context" sub="host-managed" color={AMBER} w={90} />
      <Arrow from={[180, 96]} to={[230, 56]} />
      <Arrow from={[180, 106]} to={[230, 146]} />
      <Arrow from={[370, 56]} to={[430, 56]} />
      <Arrow from={[370, 146]} to={[430, 146]} />
      <Arrow from={[580, 56]} to={[620, 90]} />
      <Arrow from={[580, 146]} to={[620, 112]} />
    </Frame>
  ),
  'rag-pipeline': () => (
    <Frame height={245} caption="RAG: chunk and index, formulate a query, retrieve and rerank, then generate grounded in the passages.">
      <Box x={20} y={30} title="Documents" sub="provenance recorded" color={AMBER} w={130} />
      <Box x={170} y={30} title="Chunk" sub="size + overlap" color={CYAN} w={120} />
      <Box x={310} y={30} title="Embed + index" sub="dense (+ sparse)" color={VIOLET} w={140} />
      <Box x={470} y={30} title="Query" sub="rewrite / decompose" color={AMBER} w={120} />
      <Box x={310} y={130} title="Retrieve + rerank" sub="top-k candidates" color={EMERALD} w={140} />
      <Box x={470} y={130} title="Generate" sub="answer + citations" color={ROSE} w={140} />
      <Box x={620} y={80} title="Evaluate" sub="Recall@k · MRR · faithfulness" color={CYAN} w={90} />
      <Arrow from={[150, 56]} to={[170, 56]} />
      <Arrow from={[290, 56]} to={[310, 56]} />
      <Arrow from={[450, 56]} to={[470, 56]} />
      <Arrow from={[530, 82]} to={[380, 130]} />
      <Arrow from={[450, 156]} to={[470, 156]} />
      <Arrow from={[610, 156]} to={[620, 112]} />
      <Arrow from={[310, 56]} to={[310, 130]} dashed />
      <text x={20} y={200} fill={SOFT} fontSize={11}>
        Failure can enter at any stage — including a generator that ignores its retrieved context.
      </text>
    </Frame>
  ),
  'multi-agent-roles': () => (
    <Frame height={250} caption="Role-based team: each role owns a context and a tool set; artefacts travel through a shared workspace.">
      <Box x={20} y={100} title="Coordinator" sub="planner agent" color={AMBER} w={140} />
      <Box x={220} y={20} title="Researcher" sub="retrieval tools" color={CYAN} w={140} />
      <Box x={220} y={100} title="Executor" sub="action tools" color={VIOLET} w={140} />
      <Box x={220} y={180} title="Verifier" sub="checks + tests" color={EMERALD} w={140} />
      <Box x={430} y={100} title="Critic" sub="adversarial review" color={ROSE} w={130} />
      <Box x={430} y={20} title="Shared workspace" sub="artefacts + messages" color={SOFT} w={150} />
      <Box x={620} y={100} title="Outcome" sub="scored answer" color={AMBER} w={90} />
      <Arrow from={[160, 112]} to={[220, 46]} />
      <Arrow from={[160, 122]} to={[220, 126]} />
      <Arrow from={[160, 132]} to={[220, 206]} />
      <Arrow from={[360, 46]} to={[430, 46]} />
      <Arrow from={[360, 126]} to={[430, 112]} />
      <Arrow from={[360, 206]} to={[430, 136]} />
      <Arrow from={[580, 112]} to={[620, 112]} />
    </Frame>
  ),
  'emergent-society': () => (
    <Frame height={230} caption="Emergence: local pairwise interactions aggregate into society-level norms that no single agent was instructed to produce.">
      <g>
        {[
          [90, 60],
          [150, 130],
          [70, 150],
          [130, 40],
          [110, 105],
        ].map(([x, y], index) => (
          <circle key={index} cx={x} cy={y} r={9} fill={CYAN} opacity={0.85} />
        ))}
        <line x1={90} y1={60} x2={110} y2={105} stroke={SOFT} strokeWidth={1.2} />
        <line x1={110} y1={105} x2={150} y2={130} stroke={SOFT} strokeWidth={1.2} />
        <line x1={110} y1={105} x2={70} y2={150} stroke={SOFT} strokeWidth={1.2} />
        <line x1={90} y1={60} x2={130} y2={40} stroke={SOFT} strokeWidth={1.2} />
        <text x={50} y={195} fill={SOFT} fontSize={11}>
          local interaction
        </text>
      </g>
      <Arrow from={[210, 105]} to={[300, 105]} label="aggregate" />
      <g>
        <rect x={330} y={40} width={340} height={140} rx={14} fill={`${VIOLET}12`} stroke={VIOLET} strokeWidth={1.3} />
        <text x={352} y={70} fill="#e8edfb" fontSize={12.5} fontWeight={600}>
          Society-level patterns
        </text>
        <text x={352} y={96} fill={SOFT} fontSize={11.5}>
          conventions · norms · meta-norms
        </text>
        <text x={352} y={120} fill={SOFT} fontSize={11.5}>
          convention stability under new arrivals
        </text>
        <text x={352} y={144} fill={SOFT} fontSize={11.5}>
          coordination and free-riding dynamics
        </text>
        <text x={352} y={166} fill={ROSE} fontSize={11}>
          risk: prompt fragility, model dependence
        </text>
      </g>
    </Frame>
  ),
  'interpretability-levels': () => (
    <Frame height={230} caption="Four paradigms and three evidence levels: behaviour, representations, mechanism.">
      <Box x={20} y={30} title="Behavioural" sub="what does it do?" color={AMBER} w={160} />
      <Box x={20} y={110} title="Attributional" sub="which inputs matter?" color={CYAN} w={160} />
      <Box x={20} y={190} title="Concept-based" sub="which concepts are used?" color={VIOLET} w={160} />
      <Box x={260} y={110} title="Mechanistic" sub="which components compute what?" color={EMERALD} w={180} />
      <Box x={500} y={30} title="Residual stream" sub="iterative refinement" color={CYAN} w={200} />
      <Box x={500} y={110} title="Logit / tuned lens" sub="prediction per layer" color={VIOLET} w={200} />
      <Box x={500} y={190} title="Circuits + SAEs" sub="induction heads, sparse features" color={EMERALD} w={200} />
      <Arrow from={[180, 56]} to={[260, 120]} />
      <Arrow from={[180, 136]} to={[260, 136]} />
      <Arrow from={[180, 216]} to={[260, 156]} />
      <Arrow from={[440, 136]} to={[500, 56]} />
      <Arrow from={[440, 136]} to={[500, 136]} />
      <Arrow from={[440, 136]} to={[500, 216]} />
    </Frame>
  ),
}

export function Diagram({ id, caption }: { id: DiagramId; caption: string }) {
  const render = diagrams[id]
  if (!render) {
    return (
      <p className="text-muted text-xs">
        Diagram “{id}” is not registered. {caption}
      </p>
    )
  }
  return <div>{render()}</div>
}

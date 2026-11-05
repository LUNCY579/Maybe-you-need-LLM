# Citations, licensing and provenance

This document records where the course's material comes from, what licence governs each source, and
what the course authored itself. The in-app **References** page carries the same information in a
browsable form (`src/content/references.ts` is the single source of truth for it).

---

## 1. Primary source

> **Agentic Large Language Models**
> Max van Duijn, Michiel van der Meer, Aske Plaat, Niki van Stein
> arXiv:2610.13455v1 (9 October 2026) — <https://arxiv.org/abs/2610.13455>

**Licence.** The arXiv listing shows **CC0 1.0 Universal** (a public-domain dedication). Version-
specific terms can differ between arXiv versions, so check the record for the exact version you
reuse.

**How the course uses it.** The textbook is the *source*; the course is the *teaching artifact*.
Concretely:

- Definitions, mechanisms, taxonomies, results and case-study descriptions are taken from the book
  and are cited by chapter and section (for example `Ch. 11, §11.5 Robustness, Error Handling, and
  Recovery`).
- The **structure** of the course — the order of the lessons, the grouping into parts, the
  assessment format, the labs, the project — was authored for this course.
- The **PDF is not redistributed** in this repository. The application is fully usable without it.

**Credits preserved.** The four authors are credited on the landing page, in the site footer, in the
References page, in the primary-source panel, and in the provenance panel of every lesson. No
lesson presents the textbook's content without an attribution to it.

**Citation format used in this course:**

```
van Duijn, M., van der Meer, M., Plaat, A., & van Stein, N. (2026).
Agentic Large Language Models. arXiv:2610.13455v1.
```

---

## 2. What this course authored

Everything below is original work released under this project's licence (MIT):

- All lesson prose, section headings, worked examples, checkpoint answers, discussion prompts and
  assessment questions (62 questions with explanations and chapter references).
- All 71 lesson sections, including the twelve advanced-track sections.
- All diagrams: every figure is an original inline SVG written for this course. **No figure is
  traced, redrawn or extracted from the textbook's PDF.** They are *reconstructions of mechanisms
  described in the text*, not reproductions of the book's figures.
- All simulation engines: the workflow execution engine, the planning, memory, world-model and
  multi-agent simulators, the seeded PRNG, the search index and its ranking function.
- The 42-entry glossary, the references list, the rubric, the project briefs and the course UI.
- The term "course term" in the glossary marks a concept this project introduced rather than one
  the book defines. The book-derived terms carry their chapter reference.

---

## 3. Third-party works

The course **links** to third-party work; it **redistributes none of it**. No third-party source
code, dataset, model weight or figure is bundled in this repository.

| Work | Role in the course | Licence status | How it is used |
| --- | --- | --- | --- |
| **nanochat** (Karpathy) | Background for the textbook's Case Study 1 (Ch. 5) | MIT — verified against the repository's LICENSE file | Linked. Not vendored, not adapted. The course's own "build a model from scratch" framing is the textbook's, not this repository's. |
| **LangChain** | Referenced in the textbook's tool-chain discussion (Ch. 11, §11.3.1) | MIT — verified against the repository's LICENSE file | Linked and described. This project has no LangChain dependency; its tool-calling pattern is implemented from scratch in `engine/workflow.ts`. |
| **MCP** (Model Context Protocol) | The context-management standard discussed in Ch. 11, §11.4 | Mixed licensing across the specification and SDK repositories — verify per component before reuse | Linked and described. No MCP SDK is bundled. |
| **BALROG** | The reasoning-and-reflection case study (Ch. 10) | See the upstream repository — verify before reuse | Linked and described. The course simulates the *architecture* (prompt builder, agent loop, reflection) with its own deterministic engine. |
| **Generative Agents** (Park et al.) | The social-simulation background for Ch. 18 | See the original publication | Linked and described. The multi-agent lab is an original simulation. |
| **ReAct** | The reasoning + acting loop discussed in Ch. 6 and Ch. 9 | See the original publication | Described and *re-implemented* from the published description in the builder's node model. No code is taken from the original. |
| **Self-RAG / Self-Ask** | Adaptive retrieval methods in Ch. 12, §12.4 | See the original publications | Described. The course's retrieval discussion is original prose. |
| **Chinchilla / Kaplan scaling laws** | Ch. 4 | See the original publications | Described. The scaling explorer uses the coefficient values *as printed in the textbook* and is explicitly labelled a teaching approximation, not a fit to experimental data. |
| **Logit lens / tuned lens / SAEs** | Ch. 21 | See the original publications | Described as research results. No implementation is bundled. |
| **Chain-of-Thought, RAG, MemGPT, MemoryBank, Mem1, Gist tokens, "Lost in the Middle"** | The primary literature behind Ch. 5, 6, 7, 9 and 12 — each linked from the relevant lesson's *Further reading* list | arXiv preprints; the version-specific licence is on each arXiv record | Linked and described. Each link goes to the arXiv abstract page, and each carries a note saying why that paper is worth reading. Nothing is quoted at length and no figure is reproduced. |
| **Attention is All You Need, T5, LoRA, DPO, DeepSeek-R1, π0, RT-2, "To CoT or Not to CoT?", Mem-α, the agentic-RAG survey, GPT-4** | The primary literature behind Ch. 2, 3, 7, 12 and 23 | arXiv preprints, an ACL Anthology page, and a JMLR page — each carries its own terms | Linked and described, the same way. Nothing is quoted at length and no figure is reproduced. |

**Provenance check method.** For each entry above, the licence was checked against the project's own
`LICENSE` file or its arXiv/journal listing rather than against a secondary summary. Where a
project has mixed or unclear licensing (notably MCP), the note says so rather than asserting a
single licence.

**The further-reading links.** Every arXiv identifier in the further-reading lists was checked
against the arXiv record during October 2026, and each is the identifier the textbook's own
bibliography prints for that paper. The links go to the abstract page rather than to a PDF, so a
reader can see the version and the licence before downloading anything.

**If you reuse third-party material.** The licences above apply to the upstream projects, not to
this course's description of them. Check the upstream terms before redistributing anything derived
from them.

---

## 4. Diagram and figure policy

- Every diagram in the course is an original inline SVG in `src/ui/diagrams.tsx`.
- Diagrams are **reconstructions of mechanisms described in the text** — for example the agentic
  loop of Ch. 1 §1.2.2 or the retrieval pipeline of Ch. 12 §12.3. They are not traced from the
  textbook's figures, and no part of the PDF is embedded in the application.
- The textbook's own figures are referenced by chapter and figure number in prose (for example
  "Figure 1.1"), so a reader with the book can compare.
- `public/` contains only a favicon and an icon sprite, both original.

---

## 5. No data collection

- No analytics, no telemetry, no fonts or scripts from a CDN, no cookies.
- The application makes **no network requests at runtime**. The only outbound links are
  user-initiated clicks to the canonical sources listed above, all with `rel="noreferrer noopener"`.
- Student state is stored exclusively in `localStorage`:
  - `agentic-ai-academy/progress`
  - `agentic-ai-academy/project/v1`
  - `agentic-ai-academy/theme/v1`

  The schema version lives inside the progress payload rather than in the key, so that a future
  change to the schema can be migrated rather than orphaned; an earlier release's key,
  `agentic-ai-academy/progress/v1`, is read once and migrated on first load.

  Students can export and inspect all of it from the dashboard, and delete it by resetting progress.

---

## 6. How to cite this course

If you use the teaching materials (not the textbook) in your own work:

```
Agentic AI Academy — an interactive course on Agentic Large Language Models.
Source textbook: van Duijn, M., van der Meer, M., Plaat, A., & van Stein, N. (2026).
Agentic Large Language Models. arXiv:2610.13455v1.
```

---

## 7. Compliance checklist

| Requirement | Status |
| --- | --- |
| Author credit for the textbook preserved | Yes — landing page, footer, references, every lesson's provenance panel |
| Original source link provided | Yes — <https://arxiv.org/abs/2610.13455>, linked from the landing page and references |
| Research citations for third-party work | Yes — 16 entries with venue, URL and role in the course |
| Third-party diagrams/datasets/code provenance checked independently | Yes — checked against each project's own LICENSE file or publication record; not redistributed |
| Third-party code reproduced only where the licence permits | Yes — no third-party code is reproduced at all |
| Textbook figures reproduced | No — all diagrams are original SVGs |
| Textbook PDF bundled | No — the application works without it |
| Simulated agents presented as deployed models | No — stated in the footer, in every lab, and on the references page |

# Sources, attribution and licensing

## The source work

This course is derived from a single textbook:

> **Foundations of Large Language Models**
> Tong Xiao and Jingbo Zhu
> NLP Lab, Northeastern University & NiuTrans Research
> arXiv:2501.09223v4 [cs.CL], 8 October 2026 (book dated 9 October 2026)
> <https://arxiv.org/abs/2501.09223>
> DOI: <https://doi.org/10.48550/arXiv.2501.09223>

The revision used to build this course is **v4** — the version present in this
workspace as `2501.09223v4.pdf`, and the current version on arXiv at the time
of writing (v1 was submitted 16 January 2025; v2 on 15 June 2025; v3 on
24 September 2026; v4 on 8 October 2026).

The book is a selection of chapters from the authors' broader introductory NLP
resource, available at <https://github.com/NiuTrans/NLPBook> and
<https://niutrans.github.io/NLPBook>.

## Licence

**The source work is licensed under the Creative Commons Attribution-NonCommercial
4.0 Unported licence (CC BY-NC 4.0).**

The copyright page of the v4 PDF states:

> Copyright © 2021-2026 Tong Xiao and Jingbo Zhu. Licensed under the Creative
> Commons Attribution-NonCommercial 4.0 Unported License (the "License"). You
> may not use this file except in compliance with the License. You may obtain
> a copy of the License at <http://creativecommons.org/licenses/by-nc/4.0/>.

Licence text: <https://creativecommons.org/licenses/by-nc/4.0/legalcode>
Human-readable summary: <https://creativecommons.org/licenses/by-nc/4.0/>

### A note on the licence, because it is commonly mis-stated

Some references describe this book as being under **CC BY 4.0**. The revision
in this workspace is not: the v4 title page and copyright page both say
**Attribution-NonCommercial 4.0**, and the licence URL it prints is
`creativecommons.org/licenses/by-nc/4.0`. The NonCommercial term is a real
restriction — it forbids using the work, or a derivative of it, for commercial
purposes — so this course adopts the stricter, actual terms rather than the
more permissive ones that are sometimes quoted.

The same statement and the same correction appear on the course's own
[Sources page](/#/sources), so a learner reading the site sees the same terms
the repository does.

### What this means for this course

- The course is a **derivative work** of the book: it follows its chapter
  structure, covers its topics in its order, and implements the equations it
  defines.
- The course is therefore released under **CC BY-NC 4.0** as well.
- Attribution is given on every page that uses the book: the landing page, the
  sources page, and the footer of each lesson.
- The course **contains no verbatim reproduction of the textbook**. Every
  explanation, worked example, worked numerical example, diagram, quiz
  question and feedback message in this course was written for this course.
  The textbook's own figures are not reproduced; every figure here is drawn by
  the application from numbers it computes.

### The attributions that apply

> "Foundations of Large Language Models" by Tong Xiao and Jingbo Zhu is
> licensed under CC BY-NC 4.0. This interactive course is an adaptation of that
> work. The explanations, examples, figures and assessments here are original
> to this course; the chapter structure, section references and the equations
> they refer to come from the book.

## How the book maps onto the course

The book's six chapters correspond one-to-one with the six modules. Every
lesson carries source references giving the chapter number, the section number
exactly as printed, the section title, and the printed page in the v4 PDF. The
references are structured data, not prose, and a content test verifies that
every lesson has at least one and that each reference is well formed.

| Book chapter | Section range | Course module | Lessons |
| --- | --- | --- | --- |
| 1 Pre-training | pp. 1–35 | Pre-training | `pretraining-why`, `pretraining-objectives`, `pretraining-bert` |
| 2 Generative Models | pp. 36–94 | Generative Models | `generative-transformer`, `generative-scaling`, `generative-long-context` |
| 3 Prompting | pp. 96–152 | Prompting | `prompting-design`, `prompting-cot`, `prompting-rag` |
| 4 Alignment | pp. 154–201 | Alignment | `alignment-sft`, `alignment-rlhf`, `alignment-dpo` |
| 5 Inference | pp. 203–245 | Inference | `inference-prefill-decode`, `inference-decoding`, `inference-scaling` |
| 6 Reasoning | pp. 247–278 | Reasoning | `reasoning-compute`, `reasoning-training`, `reasoning-evaluation` |

Equations implemented in `src/core`, with the section they come from:

| Topic | Equation | Section | Where |
| --- | --- | --- | --- |
| Scaled dot-product attention | `Att_qkv(Q,K,V) = Softmax(QKᵀ/√d + Mask)V` | §2.1.1 Eq. 2.6 | `core/attention.ts` |
| Multi-head attention | `F(H) = Merge(head₁,…,head_h)W_head` and the per-head projections | §2.1.1 Eq. 2.7–2.11 | `core/transformer.ts` |
| Masked language modelling | `L_MLM(θ) = −Σ_{i∈M} log Pr_θ(x_i | x̃)` | §1.2.2 | lesson `pretraining-bert` |
| Bradley–Terry preference | `Pr(y_a ≻ y_b | x) = σ(r(x,y_a) − r(x,y_b))` | §4.3.2 Eq. 4.35 | `core/alignment.ts` |
| Reward-model loss | `L_r(φ) = −E log Pr(y_a ≻ y_b | x)` | §4.3.2 Eq. 4.36 | `core/alignment.ts` |
| RLHF objective | `θ̃ = argmin_θ E[−r(x,y) + λ(log π_θ − log π_ref)]` | §4.3.3 | lesson `alignment-rlhf` |
| DPO reward re-parameterisation | `r(x,y) = λ log(π_θ/π_ref) + λ log Z(x)` | §4.4.2 Eq. 4.80 | lesson `alignment-dpo` |
| DPO preference probability | `Pr(y_a ≻ y_b | x) = σ(λ[log π_θ(y_a)/π_ref(y_a) − log π_θ(y_b)/π_ref(y_b)])` | §4.4.2 Eq. 4.81 | `core/alignment.ts` |
| DPO loss | `L_DPO(θ) = −E log Pr(y_a ≻ y_b | x)` | §4.4.2 Eq. 4.82 | `core/alignment.ts` |
| Top-k renormalisation | `Pr(y_i) / Σ_{y_j∈V_i} Pr(y_j)` | §5.1.3 Eq. 5.24–5.25 | `core/sampling.ts` |
| Sampling from the filtered pool | `ỹ_i ~ Pr(y_i | ·)` | §5.1.3 Eq. 5.26 | `core/sampling.ts` |
| Top-p candidate pool | `V_i = {y_top1, …, y_topkp}` | §5.1.3 Eq. 5.28 | `core/sampling.ts` |
| Temperature-scaled softmax | `exp(u_i/τ) / Σ exp(u_j/τ)` | §5.1.3 Eq. 5.29 | `core/sampling.ts` |
| KV-cache size bound | `O(L · n_g · d_h · m)` | §2.3.4 (concept in §2.3.3) | `core/inference.ts` |
| Process supervision | per-step reward instead of one path reward | §6.4.2 | `core/reasoning.ts` |

### Corrections made during the build

An independent audit of the core modules against the v4 PDF found three
incorrect citations, which have been fixed:

| Was | Is | Why |
| --- | --- | --- |
| "Eq. 5.13 in §5.1.1" | Eq. 5.13 is in §5.1.2, "A Two-phase Framework"; Eq. 5.7 is in §5.1.1 | §5.1.1 is "Preliminaries" |
| "Bradley–Terry … (§4.3.2, Eq. 4.36 form)" | Eq. 4.35 is the sigmoid identity; Eq. 4.36 is the reward-model loss | §4.3.2 "Training Reward Models" |
| "KV-cache size formula (book §2.3.3)" | the concept is §2.3.3 "Cache and Memory"; the size bound is §2.3.4 "Sharing across Heads and Layers" | the formula is not in §2.3.3 |

## The "How settled is this?" page

The status page is the one part of the course whose sources are **not** the
book. It answers a question the book cannot answer about itself: which of the
claims here have been overtaken by work published since the revision this
course was built from.

- The **settled** half of each module restates what the book establishes. It
  is drawn from the book, and it carries the same section references as the
  lesson it belongs to.
- The **moving** half is drawn from the primary literature — the paper, not a
  survey of it. Every entry gives a link, the venue and year, and one
  sentence on what that source actually shows.

Those papers are cited, not reproduced. The page quotes no paper's text
beyond the title, and the summarising sentences are the course's own. The
page is therefore an editorial judgement made by this course about the
literature, and a reader who disagrees with a judgement can follow the link
and check it.

A content test checks that the sources on that page are well formed, that no
source is cited twice, and that each one names a venue or a year — so a link
cannot be left as a bare anchor.

And a separate command, `npm run check:links`, asks every one of those links
whether it still resolves, and whether a pinned arXiv link has been superseded
by a newer revision of the same paper. A link to a dead page, or to an old
draft of a paper that has since been revised, is the kind of rot that would be
worst on this particular page. The check found two such links the first time
it ran: a data-constrained scaling paper cited at its second revision when the
fifth is current, and a survey of direct preference optimisation cited at its
third revision, published in *TPAMI* in the meantime, when the fourth is
current.

## Third-party dependencies

The course is an original work; it bundles no third-party text, figures or
data from the book. The following software is used under its own licence, and
those licences apply to the bundled artefacts:

| Dependency | Licence | Use |
| --- | --- | --- |
| React, React DOM | MIT | UI runtime |
| React Router | MIT | Routing |
| Vite | MIT | Build tool |
| TypeScript | Apache-2.0 | Type system |
| Tailwind CSS | MIT | Styling |
| KaTeX | MIT | Mathematical typesetting (fonts included under the OFL) |
| Recharts | MIT | Charts |
| Vitest | MIT | Unit testing |
| React Testing Library | MIT | Component testing |
| Playwright | Apache-2.0 | End-to-end testing |
| Oxlint | MIT | Linting |
| Inter, Space Grotesk, JetBrains Mono | OFL-1.1 | Typefaces, bundled as WOFF2 |

No third-party model weights, datasets or corpora are bundled. The toy
vocabulary, the preference dataset, the reasoning step dataset, the toy
document collection and the bigram corpus in `src/core` were all written for
this course.

## Fonts

The bundled typefaces are released under the SIL Open Font License 1.1:
Inter, Space Grotesk (both by their respective authors, via `@fontsource-variable`)
and JetBrains Mono. KaTeX's own fonts are included under the SIL Open Font
License 1.1.

## Figures

Every figure in this course is generated at runtime by the application from
numbers it computes. No figure from the textbook is reproduced, cropped,
traced or adapted.

## Reporting an error

If you believe something here misrepresents the book, please open an issue
with the section number and the claim in question. Corrections to the source
references are treated as defects, because the traceability of the course to
the book is part of its purpose.

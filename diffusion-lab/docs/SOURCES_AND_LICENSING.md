# Sources and licensing

This course is written from six papers. None of them is redistributed: they are cited
by chapter, section and equation, linked to their canonical record, and every figure
in the course is an original plot of a computation made in the browser.

---

## The works cited

### 1. The primary source

**Denoising Diffusion Probabilistic Models**
Jonathan Ho, Ajay Jain, Pieter Abbeel
arXiv:2006.11239 [cs.LG] / NeurIPS 2020
<https://arxiv.org/abs/2006.11239>

Everything the course is *about* comes from here: the forward process and its closed
form, the posterior, the ε-prediction parameterisation, the simplified training
objective, the sampling procedure, the variance schedule, and the progressive-coding
argument.

- **Licence.** The arXiv perpetual, non-exclusive distribution licence. No Creative
  Commons licence is shown on the record.
- **What this course uses.** The definitions, the equations, the schedule's β range, and
  the structure of the argument.
- **What this course does not use.** The paper's figures, its tables of sample-quality
  numbers, and its text. No figure from the paper appears anywhere in the application.

### 2. The deterministic sampler

**Denoising Diffusion Implicit Models**
Jiaming Song, Chenlin Meng, Stefano Ermon
arXiv:2010.02502 [cs.LG] / ICLR 2021
<https://arxiv.org/abs/2010.02502>

The deterministic sampler, and therefore the reason a diffusion model can be sampled in
a few dozen steps instead of a thousand.

- **Licence.** arXiv perpetual, non-exclusive distribution licence.
- **Used for.** The deterministic sampling step, and the claim that a deterministic
  sampler can cut the number of steps without collapsing diversity.
- **Not used.** Any figure or code.

### 3. The cosine schedule

**Improved Denoising Diffusion Probabilistic Models**
Alex Nichol, Prafulla Dhariwal
arXiv:2102.09672 [cs.LG] / ICML 2021
<https://arxiv.org/abs/2102.09672>

The cosine schedule and the learned variances, which is what the schedules module
compares against the original linear schedule.

- **Licence.** arXiv perpetual, non-exclusive distribution licence.
- **Used for.** The definition of the cosine schedule and the claim that a schedule
  should be judged by how it spends its steps.
- **Not used.** Any figure or code.

### 4. Latent diffusion

**High-Resolution Image Synthesis with Latent Diffusion Models**
Robin Rombach, Andreas Blattmann, Dominik Lorenz, Patrick Esser, Björn Ommer
arXiv:2112.10752 [cs.CV] / CVPR 2022
<https://arxiv.org/abs/2112.10752>

- **Licence.** arXiv perpetual, non-exclusive distribution licence.
- **Used for.** The compression that motivates moving the diffusion into an autoencoder's
  latent space, the arithmetic of the saving, and the scaling factor of 0.18215.
- **Not used.** Any figure, any trained model, any dataset.

### 5. Guidance

**Classifier-Free Diffusion Guidance**
Jonathan Ho, Tim Salimans
arXiv:2207.12598 [cs.LG]
<https://arxiv.org/abs/2207.12598>

- **Licence.** arXiv perpetual, non-exclusive distribution licence.
- **Used for.** The guided score, the tilted distribution p(x)·p(c|x)^w, and the
  claim that guidance trades diversity for fidelity.
- **Not used.** Any figure or code.

**Diffusion Models Beat GANs on Image Synthesis**
Prafulla Dhariwal, Alex Nichol
arXiv:2105.05233 [cs.CV] / NeurIPS 2021
<https://arxiv.org/abs/2105.05233>

The classifier-guided alternative, for comparison.

- **Licence.** arXiv perpetual, non-exclusive distribution licence.
- **Not used.** Any figure or code.

### 6. The design space

**Elucidating the Design Space of Diffusion-Based Generative Models**
Tero Karras, Miika Aittala, Timo Aila, Samuli Laine
arXiv:2206.00364 [cs.CV] / NeurIPS 2022
<https://arxiv.org/abs/2206.00364>

- **Licence.** arXiv perpetual, non-exclusive distribution licence.
- **Used for.** The σ parametrisation, the notion of preconditioning, and the
  separation of the choices that matter from the ones that do not.
- **Not used.** Any figure or code.

### 7. The shared core

**`@llm-materials/course-core`**
Original work, part of this collection. MIT licence.

The seeded random number generator, the linear algebra, the statistics, the
Bradley–Terry model, the progress store, the assessment engine and the search — all of
which stand behind the numbers and the questions in this course.

---

## What this course does not do

**It redistributes no source material.** No PDF, no figure, no table, no image, no
dataset and no third-party code from any cited work appears in this repository. Where
the course needs to show something a paper showed — the schedule's β range, the
reported terminal KL, the sample-quality numbers — the number is named, the source is
cited, and the page says plainly that it is quoted rather than computed.

**It ships no trained model.** The denoising network in Laboratory B is a two-layer
perceptron with 32 hidden units, trained from scratch in the browser on a generated
ring of eight Gaussian modes. There is no checkpoint to download, because there is no
checkpoint anywhere in the project.

**It uses no dataset.** Every laboratory operates on a distribution generated by the
course's own code, with the seed shown on screen, so that any figure can be reproduced
exactly.

**It calls nothing.** There is no API key, no network request and no telemetry. The
build is a static bundle that works from the file system.

---

## Figures

Every figure in this course is an original plot of a computation made in the browser,
drawn by the course's own chart code from the numbers the course's own algorithms
return. No figure from any cited work is reproduced, traced or adapted.

The course distinguishes three kinds of number on screen, and says which is which:

| Kind | Example | Statement on screen |
| --- | --- | --- |
| Exact | The forward process, the posterior, the Gaussian KL, the guided score | "This laboratory is exact" |
| Measured | The reconstruction error, the training loss, the sample statistics | "Measured, on …" |
| Quoted | The paper's reported numbers | The source is named next to the number |

---

## A note on versions

An arXiv licence is attached to a specific submission, and it can change between
versions. This course was written against **arXiv:2006.11239**. If you reuse anything
from it, cite the version you used and check that version's licence.

The catalogue of every source across every course in this collection lives in the
workspace at `references/manifest.json`, and is validated by a script that re-reads
every arXiv title live:

```bash
node scripts/validate-sources.mjs --verify
```

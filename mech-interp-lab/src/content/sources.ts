/**
 * The references this course cites, with the licence of each.
 */

export interface CourseReference {
  id: string
  authors: string
  year: number
  title: string
  venue: string
  url: string
  usedFor: string
  licenseNote: string
}

export const REFERENCES: CourseReference[] = [
  {
    id: 'cunningham-2023-sae',
    authors: 'Hoagy Cunningham, Aidan Ewart, Logan Riggs, Robert Huben, Lee Sharkey',
    year: 2023,
    title: 'Sparse Autoencoders Find Highly Interpretable Features in Language Models',
    venue: 'arXiv:2309.08600 [cs.LG] / ICLR 2024',
    url: 'https://arxiv.org/abs/2309.08600',
    usedFor:
      'The primary source of this course: the toy model of superposition, the sparse autoencoder and its objective, the interpretability scoring of a dictionary feature, and the patching procedure adapted to dictionary features.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. No Creative Commons licence is shown on the record; re-check the version-specific terms before redistributing anything derived from the text or figures. Nothing from the paper is reproduced here: every figure in this course is an original plot of a computation made in the browser.',
  },
  {
    id: 'conmyer-2023-circuits',
    authors: 'Arthur Conmy, Augustine N. Mavor-Parker, Aengus Lynch, Stefan Heimersheim, Adrià Garriga-Alonso',
    year: 2023,
    title: 'Towards Automated Circuit Discovery for Mechanistic Interpretability',
    venue: 'arXiv:2304.14997 [cs.LG]',
    url: 'https://arxiv.org/abs/2304.14997',
    usedFor:
      'The four steps of the mechanistic-interpretability workflow, the definition of a circuit, the patching procedure, and the faithfulness score.',
    licenseNote:
      'arXiv perpetual, non-exclusive distribution licence. Re-check the version-specific terms before redistributing. Cited by reference only.',
  },
  {
    id: 'elhage-2021-framework',
    authors: 'Noah Elhage, Tristan Hume, Shan Carter, Scott Ostheim, Scott Linderman and others',
    year: 2021,
    title: 'A Mathematical Framework for Transformer Circuits',
    venue: 'transformer-circuits.pub — a public web publication',
    url: 'https://transformer-circuits.pub/2021/framework.html',
    usedFor:
      'The residual stream, and the vocabulary of nodes, edges and paths that a circuit is made of.',
    licenseNote:
      'A public web publication. The machine-check from this environment was blocked by the site, so the terms have not been verified here; read them on the page itself before reusing any text or figure. The course cites the work and links to it, and reproduces nothing from it.',
  },
  {
    id: 'course-core',
    authors: 'This project',
    year: 2026,
    title: '@llm-materials/course-core',
    venue: 'The shared numerical and assessment core, including the automatic differentiation engine',
    url: 'https://github.com/llm-materials',
    usedFor:
      'The gradients behind the sparse autoencoder, the seeded random number generator, the linear algebra and the assessment engine.',
    licenseNote: 'Original work, released under the MIT licence.',
  },
  {
    id: 'olsson-2022-induction-heads',
    authors:
      'Catherine Olsson, Nelson Elhage, Neel Nanda, Nicholas Joseph, Nova DasSarma, Tom Henighan, Ben Mann, Amanda Askell, Yuntao Bai, Anna Chen, Tom Conerly, Dawn Drain, Deep Ganguli, Zac Hatfield-Dodds, Danny Hernandez, Scott Johnston, Andy Jones, Jackson Kernion, Liane Lovitt, Kamal Ndousse, Dario Amodei, Tom Brown, Jack Clark, Jared Kaplan, Sam McCandlish, Chris Olah',
    year: 2022,
    title: 'In-context Learning and Induction Heads',
    venue: 'arXiv:2209.11895 [cs.LG]',
    url: 'https://arxiv.org/abs/2209.11895',
    usedFor:
      'The induction circuit of the composition module: the previous-token head, the induction head, the [A][B] … [A] definition, and the ablation that tests the composition.',
    licenseNote:
      'CC BY 4.0 (as stated on the arXiv record). The course cites the paper and links to it; the laboratory is an original, hand-wired simulation of the two-head circuit, not a reproduction of any figure or trained model.',
  },
  {
    id: 'wang-2022-ioi',
    authors: 'Kevin Wang, Alexandre Variengien, Arthur Conmy, Buck Shlegeris, Jacob Steinhardt',
    year: 2022,
    title: 'Interpretability in the Wild: a Circuit for Indirect Object Identification in GPT-2 small',
    venue: 'arXiv:2211.00593 [cs.LG] / ICLR 2023',
    url: 'https://arxiv.org/abs/2211.00593',
    usedFor:
      'The name-mover and S-inhibition heads, and the completeness and minimality criteria the IOI circuit is evaluated by.',
    licenseNote:
      'CC BY 4.0 (as stated on the arXiv record). Cited by reference only; the patching laboratory uses the course’s own synthetic circuit with the same two paths, and reports its own numbers.',
  },
]

export const LICENCE_SUMMARY = {
  source: 'The course is written from the papers above and cites them by section. The papers are not redistributed.',
  figures:
    'Every figure in this course is an original plot of a computation made in the browser from the algorithms in the course’s own code. No figure, table or image from any source is reproduced.',
  code:
    'The algorithms are original implementations written for this course: the toy model of superposition, its analytic gradient, the sparse autoencoder, the patching procedure, and the hand-wired induction circuit.',
  data:
    'No dataset is redistributed. The features, the activations and the circuit are all generated by the course’s own code, with the seed shown; the induction laboratory’s sequences are generated the same way.',
  models:
    'No trained model is redistributed and no model is downloaded. The sparse autoencoder in Laboratory B is trained in your browser, from scratch, every time you press the button; the induction circuit in Laboratory D is hand-wired rather than trained, and says so.',
} as const

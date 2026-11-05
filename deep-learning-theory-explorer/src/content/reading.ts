/**
 * Further reading.
 *
 * The monograph is not the end of the story, and a reader who wants the
 * literature needs a map of it. Every entry here is a real paper or talk with a
 * link that resolves; each says what it contributes to the course and where in
 * this application the corresponding idea is used.
 */

export type ReadingGroup = 'foundations' | 'the-monograph' | 'the-ntk' | 'scaling' | 'beyond-the-ntk' | 'practice';

export interface ReadingEntry {
  id: string;
  /** the full citation */
  citation: string;
  /** what it contributes */
  contributes: string;
  /** where the idea appears in this application */
  where: string;
  /**
   * The places in this application where the idea shows up, as links. The
   * sentence above says where; these let a reader go there.
   */
  see: Array<{ label: string; to: string }>;
  year: number;
  url: string;
  group: ReadingGroup;
}

export const READING_GROUPS: Array<{ id: ReadingGroup; name: string; blurb: string }> = [
  {
    id: 'foundations',
    name: 'The foundations',
    blurb: 'The results the monograph is built on, and which it cites.',
  },
  {
    id: 'the-monograph',
    name: 'The monograph and its authors',
    blurb: 'The book, and the overview talk that names the organising principles.',
  },
  {
    id: 'the-ntk',
    name: 'The neural tangent kernel',
    blurb: 'Where the kernel of Chapters 7-10 comes from.',
  },
  {
    id: 'scaling',
    name: 'Scaling laws',
    blurb: 'Why loss falls as a power law in data, parameters and training time — and the kernel view of it.',
  },
  {
    id: 'beyond-the-ntk',
    name: 'Beyond the frozen kernel',
    blurb: 'What has moved since the book was written.',
  },
  {
    id: 'practice',
    name: 'Practice and pedagogy',
    blurb: 'The lectures, and the institutions that teach this material.',
  },
];

export const READING: ReadingEntry[] = [
  {
    id: 'poole-2016',
    citation:
      'Ben Poole, Subhaneil Lahiri, Maithra Raghu, Jascha Sohl-Dickstein and Surya Ganguli, "Exponential expressivity in deep neural networks through transient chaos", NeurIPS 2016, arXiv:1606.05340.',
    contributes:
      'The first clear statement that the Jacobian of a deep network fluctuates exponentially with depth — the phenomenon the monograph analyses with the 1/n expansion.',
    where: 'Lesson 4 (fluctuations), Lesson 7 (universality).',
    see: [
      { label: 'lesson 4, fluctuations', to: '/lessons/fluctuations' },
      { label: 'lesson 7, universality', to: '/lessons/universality' },
      { label: 'laboratory C', to: '/labs/width-depth' },
    ],
    year: 2016,
    url: 'https://arxiv.org/abs/1606.05340',
    group: 'foundations',
  },
  {
    id: 'raghu-2016',
    citation:
      'Maithra Raghu, Ben Poole, Jon Kleinberg, Surya Ganguli and Jascha Sohl-Dickstein, "On the expressive power of deep neural networks", NeurIPS 2017, arXiv:1606.05336.',
    contributes:
      'Expressivity measures that grow exponentially with depth and not with width, and the link between training and the stability of the input-output map.',
    where: 'Lesson 4; the deep-to-width ratio in Laboratory C.',
    see: [
      { label: 'lesson 4, fluctuations', to: '/lessons/fluctuations' },
      { label: 'laboratory C', to: '/labs/width-depth' },
    ],
    year: 2017,
    url: 'https://arxiv.org/abs/1606.05336',
    group: 'foundations',
  },
  {
    id: 'raghu-2017',
    citation:
      'Maithra Raghu, Ben Poole, Jon Kleinberg, Surya Ganguli and Jascha Sohl-Dickstein, "Survey of expressivity in deep neural networks", arXiv:1611.08083.',
    contributes:
      'A survey that unifies the expressivity measures and states the trajectory-length result the monograph connects to.',
    where: 'Lesson 4; the "deep networks are useful anyway" discussion.',
    see: [
      { label: 'lesson 4, fluctuations', to: '/lessons/fluctuations' },
    ],
    year: 2017,
    url: 'https://arxiv.org/abs/1611.08083',
    group: 'foundations',
  },
  {
    id: 'roberts-yaida-2021',
    citation:
      'Daniel A. Roberts and Sho Yaida, "Effective Theory of Deep Neural Networks", invited presentation, International Physics Olympiad, 2021.',
    contributes:
      'The overview in which the authors name the organising principles of the framework: the Principle of Sparsity, of Criticality, of (Layer) Equivalence, of Typicality and of Universality.',
    where: 'The structure of the theory atlas.',
    see: [
      { label: 'the theory atlas', to: '/atlas' },
    ],
    year: 2021,
    url: 'https://www.phys.s.u-tokyo.ac.jp/wp-content/uploads/2021/12/PDLT_IPI2021.pdf',
    group: 'the-monograph',
  },
  {
    id: 'roberts-2021',
    citation:
      'Daniel A. Roberts, Sho Yaida and Boris Hanin, "The Principles of Deep Learning Theory: An Effective Theory Approach to Understanding Neural Networks", arXiv:2106.10165, Cambridge University Press, 2022.',
    contributes:
      'The monograph this application teaches: the kernel recursion, the criticality conditions, the universality classes, the representation group flow, and the effective theory of the neural tangent kernel.',
    where: 'Everything. The source of every equation, figure and laboratory.',
    see: [
      { label: 'the course overview', to: '/' },
      { label: 'the theory atlas', to: '/atlas' },
    ],
    year: 2022,
    url: 'https://arxiv.org/abs/2106.10165',
    group: 'the-monograph',
  },
  {
    id: 'jacot-2018',
    citation:
      'Arthur Jacot, Franck Gabriel and Clément Hongler, "Neural tangent kernel: convergence and generalization in neural networks", NeurIPS 2018, arXiv:1806.07572 (originally titled "On the expressivity of deep neural networks via the neural tangent kernel").',
    contributes:
      'The definition of the neural tangent kernel and the theorem that it stays constant during training at infinite width — the freezing of Chapter 10.',
    where: 'Lesson 9, Laboratory D, the closed-form comparison in the physics of the NTK.',
    see: [
      { label: 'lesson 9, the neural tangent kernel', to: '/lessons/ntk' },
      { label: 'laboratory D', to: '/labs/ntk' },
    ],
    year: 2018,
    url: 'https://arxiv.org/abs/1806.07572',
    group: 'the-ntk',
  },
  {
    id: 'lee-2018',
    citation:
      'Jaehoon Lee, Yasaman Bahri, Roman Novak, Samuel S. Schoenholz, Jeffrey Pennington and Jascha Sohl-Dickstein, "Deep neural networks as Gaussian processes", ICLR 2018, arXiv:1712.01365.',
    contributes:
      'The infinite-width limit of a network as a Gaussian process, and the recursion for its kernel — the object Chapter 5 computes layer by layer.',
    where: 'Lesson 8; the Gaussian-process figure.',
    see: [
      { label: 'lesson 8, Bayesian learning', to: '/lessons/bayesian' },
    ],
    year: 2018,
    url: 'https://arxiv.org/abs/1712.01365',
    group: 'the-ntk',
  },
  {
    id: 'chizat-2019',
    citation:
      'Lénaïc Chizat, Edouard Oyallon and Francis Bach, "On lazy training in differentiable programming", NeurIPS 2020, arXiv:1812.07956.',
    contributes:
      'The identification of "lazy training" as a consequence of a particular scaling rather than of width itself — the distinction the atlas draws when it says the frozen-kernel picture is a starting point.',
    where: 'The atlas entries on the lazy regime and on μP.',
    see: [
      { label: 'the theory atlas', to: '/atlas' },
    ],
    year: 2020,
    url: 'https://arxiv.org/abs/1812.07956',
    group: 'the-ntk',
  },
  {
    id: 'bahri-2021',
    citation:
      'Yasaman Bahri, Ethan Dyer, Jared Kaplan, Jaehoon Lee and Utkarsh Sharma, "Explaining neural scaling laws", arXiv:2102.06701.',
    contributes:
      'A taxonomy of four scaling regimes — variance-limited and resolution-limited, for data and for width — with evidence that the width and dataset exponents are related by a duality in the kernel limit.',
    where: 'The atlas entry on multi-scale adaptive feature learning; the kernel picture in Laboratory D. The scaling laws themselves are not simulated here.',
    see: [
      { label: 'the theory atlas', to: '/atlas' },
      { label: 'laboratory D', to: '/labs/ntk' },
    ],
    year: 2021,
    url: 'https://arxiv.org/abs/2102.06701',
    group: 'scaling',
  },
  {
    id: 'maloney-2022',
    citation:
      'Alexander Maloney, Daniel A. Roberts and James Sully, "A solvable model of neural scaling laws", arXiv:2210.16859.',
    contributes:
      'A joint data-generating and random-feature model solved exactly in the large-data, large-width limit. It reproduces power-law loss, the equiparameterized optimum, and the plateau that appears when the data spectrum runs out.',
    where: 'The atlas entry on multi-scale adaptive feature learning; the defrosting panel in Laboratory D. The solvable model itself is not simulated here.',
    see: [
      { label: 'the theory atlas', to: '/atlas' },
      { label: 'laboratory D', to: '/labs/ntk' },
    ],
    year: 2022,
    url: 'https://arxiv.org/abs/2210.16859',
    group: 'scaling',
  },
  {
    id: 'bordelon-2024',
    citation:
      'Blake Bordelon, Alexander Atanasov and Cengiz Pehlevan, "A dynamical model of neural scaling laws", arXiv:2402.01092.',
    contributes:
      'A random-feature model trained with gradient descent that reproduces the different power laws in training time and model size, the asymmetric compute-optimal rule, and the gradual train-test gap caused by reusing data.',
    where: 'The atlas entry on adaptive kernels; the defrosting panel in Laboratory D. The dynamical model itself is not simulated here.',
    see: [
      { label: 'the theory atlas', to: '/atlas' },
      { label: 'laboratory D', to: '/labs/ntk' },
    ],
    year: 2024,
    url: 'https://arxiv.org/abs/2402.01092',
    group: 'scaling',
  },
  {
    id: 'yang-2021',
    citation:
      'Greg Yang, Edward J. Hu, Igor Babuschkin, Szymon Sidor and colleagues, "Tensor programs V: tuning large neural networks via zero-shot hyperparameter transfer", NeurIPS 2021, arXiv:2203.03466.',
    contributes:
      'The Maximal Update Parametrization, in which the infinite-width limit does learn features — and the observation that the choice of parametrization, not the width alone, decides the regime.',
    where: 'The atlas entry on μP and the standard parametrization.',
    see: [
      { label: 'the theory atlas', to: '/atlas' },
    ],
    year: 2021,
    url: 'https://arxiv.org/abs/2203.03466',
    group: 'beyond-the-ntk',
  },
  {
    id: 'power-2022',
    citation:
      'Alethea Power, Yuri Burda, Harri Edwards, Igor Babuschkin and Vedant Misra, "Grokking: generalization beyond overfitting on small algorithmic datasets", arXiv:2201.02177.',
    contributes:
      'Shows that on small algorithmic datasets, generalization can improve from chance level to perfect long after the training loss has flattened — the delayed-generalization phenomenon the lazy/rich distinction was later used to explain.',
    where: 'The atlas entry on the lazy and rich regimes; the phenomenon is not simulated here.',
    see: [
      { label: 'the theory atlas', to: '/atlas' },
      { label: 'laboratory D', to: '/labs/ntk' },
    ],
    year: 2022,
    url: 'https://arxiv.org/abs/2201.02177',
    group: 'beyond-the-ntk',
  },
  {
    id: 'kumar-2023',
    citation:
      'Tanishq Kumar, Blake Bordelon, Samuel J. Gershman and Cengiz Pehlevan, "Grokking as the transition from lazy to rich training dynamics", arXiv:2310.06110.',
    contributes:
      'Explains grokking as the network first fitting a kernel solution with its initial features and only later learning features; the rate of feature learning and the alignment of the initial features with the target decide whether it happens.',
    where: 'The atlas entry on the lazy and rich regimes; Laboratory E measures the feature drift this account is about, though grokking itself is not simulated here.',
    see: [
      { label: 'the theory atlas', to: '/atlas' },
      { label: 'laboratory E', to: '/labs/representation' },
    ],
    year: 2023,
    url: 'https://arxiv.org/abs/2310.06110',
    group: 'beyond-the-ntk',
  },
  {
    id: 'lauditi-2025',
    citation:
      'Clarissa Lauditi, Blake Bordelon and Cengiz Pehlevan, "Adaptive kernel predictors from feature-learning infinite limits of neural networks", ICML 2025.',
    contributes:
      'The rich infinite-width limit is still a kernel machine, but with a data-dependent kernel — a different object from the frozen one.',
    where: 'The atlas entry on adaptive kernels.',
    see: [
      { label: 'the theory atlas', to: '/atlas' },
    ],
    year: 2025,
    url: 'https://proceedings.mlr.press/v267/lauditi25a.html',
    group: 'beyond-the-ntk',
  },
  {
    id: 'multiscale-2025',
    citation:
      'Noa Rubin, Kirsten Fischer, Javed Lindner, David Dahmen, Inbar Seroussi, Zohar Ringel, Michael Krämer and Moritz Helias, "From kernels to features: a multi-scale adaptive theory of feature learning", arXiv:2502.03210.',
    contributes:
      'A statistical-mechanical account that interpolates between the mean-field and standard scaling regimes, and shows how the two views of feature learning — a kernel rescaling and a directional change of the kernel — fit together.',
    where: 'The atlas entry on multi-scale adaptive feature learning.',
    see: [
      { label: 'the theory atlas', to: '/atlas' },
    ],
    year: 2025,
    url: 'https://arxiv.org/abs/2502.03210',
    group: 'beyond-the-ntk',
  },
  {
    id: 'feature-quality-2025',
    citation:
      'Niclas Alexander Göring, Charles London, Abdurrahman Hadi Erturk, Chris Mingard, Yoonsoo Nam and Ard A. Louis, "Feature learning is decoupled from generalization in high capacity neural networks", arXiv:2507.19680.',
    contributes:
      'Introduces feature quality as the measure of what feature learning buys, and argues that existing theories mostly measure the strength of feature learning rather than the quality of the learned features — so they cannot yet ground a theory of generalization.',
    where: 'The atlas entry on feature quality; the two curves in the feature-drift figure.',
    see: [
      { label: 'the theory atlas', to: '/atlas' },
      { label: 'lesson 10, representation learning', to: '/lessons/representation-learning' },
    ],
    year: 2025,
    url: 'https://arxiv.org/abs/2507.19680',
    group: 'beyond-the-ntk',
  },
  {
    id: 'ntk-depth-2025',
    citation:
      'William St-Arnaud, Margarida Carvalho and Golnoosh Farnadi, "Revisiting the neural tangent kernel: the role of large width and depth", arXiv:2511.07272.',
    contributes:
      'Challenges the two conclusions that the NTK cannot describe large widths or large depths: individual hidden-neuron activations barely move, but the aggregate norm of their deviations does, and scaling depth together with stopping time keeps the output non-trivial.',
    where: 'The atlas entries on the lazy regime and on the depth axis.',
    see: [
      { label: 'the theory atlas', to: '/atlas' },
    ],
    year: 2025,
    url: 'https://arxiv.org/abs/2511.07272',
    group: 'beyond-the-ntk',
  },
  {
    id: 'pdltschool',
    citation:
      'The Princeton Deep Learning Theory Summer School, "Effective Theory of Deep Learning", lectures by Dan Roberts and Sho Yaida, 2021.',
    contributes:
      'The five-lecture structure the authors themselves use: linear models and kernel methods, the quadratic model and nearly-kernel methods, the Principle of Sparsity, the Principle of Criticality, and the optimal aspect ratio.',
    where: 'The suggested path on the prerequisite navigator; the ordering of the lessons.',
    see: [
      { label: 'the prerequisite navigator', to: '/prerequisites' },
      { label: 'the curriculum', to: '/lessons' },
    ],
    year: 2021,
    url: 'https://deeplearningtheory.com/lectures/',
    group: 'practice',
  },
  {
    id: 'pdltsite',
    citation:
      'The companion website for the monograph, deeplearningtheory.com, maintained by the authors.',
    contributes:
      'The authors&rsquo; own summary of the book and of the lecture material, with links to the slides and the recordings.',
    where: 'A good place to start if you want the authors&rsquo; own framing of the ideas.',
    see: [
      { label: 'the course overview', to: '/' },
    ],
    year: 2021,
    url: 'https://deeplearningtheory.com/',
    group: 'practice',
  },
];

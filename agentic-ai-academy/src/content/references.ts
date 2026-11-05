import type { Reference } from '../types/curriculum'

/**
 * References used by the course.
 *
 * License notes were checked independently in October 2026 against each
 * project's own LICENSE file or arXiv licence page (see note field). The course
 * links to these works; it does not redistribute their code or figures.
 */
export const REFERENCES: Reference[] = [
  {
    id: 'van-duijn-2026-agentic-llm',
    authors: 'Max van Duijn, Michiel van der Meer, Aske Plaat, Niki van Stein',
    year: 2026,
    title: 'Agentic Large Language Models',
    venue: 'arXiv:2610.13455v1 (9 October 2026) — the textbook for this course',
    url: 'https://arxiv.org/abs/2610.13455',
    usedFor:
      'Primary source for every lesson: definitions, interaction styles, memory architectures, tools, retrieval, behaviour, advanced topics.',
    licenseNote:
      'arXiv listing shows CC0 1.0 Universal (public domain dedication). We credit the authors on every lesson and keep source references on all textbook-derived material. Version-specific licences can differ; check the arXiv record for the exact version you reuse.',
  },
  {
    id: 'nanochat',
    authors: 'Andrej Karpathy',
    year: 2025,
    title: 'nanochat',
    venue: 'GitHub repository (background for Case Study 1)',
    url: 'https://github.com/karpathy/nanochat',
    usedFor:
      'The training stack that Case Study 1 (Ch. 5) builds on. This course describes the tasks and links out; it does not copy the code.',
    licenseNote: 'MIT License, verified from the repository LICENSE file. Reuse permitted with attribution.',
  },
  {
    id: 'langchain',
    authors: 'LangChain, Inc.',
    year: 2022,
    title: 'LangChain',
    venue: 'GitHub repository / Python package',
    url: 'https://github.com/langchain-ai/langchain',
    usedFor:
      'Framework referenced in Ch. 11 for tool definition and agent construction; the course shows structural pseudo-code only.',
    licenseNote: 'MIT License, verified from the repository LICENSE file.',
  },
  {
    id: 'generative-agents',
    authors: 'Joon Sung Park, Joseph C. O\'Brien, Carrie J. Cai, Meredith Ringel Morris, Percy Liang, Michael S. Bernstein',
    year: 2023,
    title: 'Generative Agents: Interactive Simulacra of Human Behavior',
    venue: 'UIST 2023; reference implementation joonspk-research/generative_agents',
    url: 'https://github.com/joonspk-research/generative_agents',
    usedFor: 'Framework behind Case Study 4 (Ch. 18), simulated societies and the cognitive loop in Ch. 17.',
    licenseNote: 'Apache License 2.0, verified from the repository LICENSE file. Attribution and NOTICE preservation required on reuse.',
  },
  {
    id: 'balrog',
    authors: 'BALROG Team (Davide Paglieri et al.)',
    year: 2024,
    title: 'BALROG: Benchmarking Agentic LLM and VLM Reasoning On Games',
    venue: 'GitHub repository / benchmark',
    url: 'https://github.com/balrog-ai/BALROG',
    usedFor: 'The reasoning-and-reflection case study (Ch. 10): puzzle environments, agents and evaluation.',
    licenseNote: 'MIT License, verified from the repository LICENSE file.',
  },
  {
    id: 'mcp',
    authors: 'Anthropic and contributors',
    year: 2024,
    title: 'Model Context Protocol',
    venue: 'Specification and project repository',
    url: 'https://modelcontextprotocol.io/specification/2025-11-25',
    usedFor: 'Section 11.4: MCP client–server architecture, data layer and transport layer.',
    licenseNote:
      'Mixed licensing in transition: new specification contributions are Apache-2.0, contributions previously made under MIT remain MIT, and documentation excluding specifications is CC-BY-4.0. This course summarises the protocol and links out.',
  },
  {
    id: 'kaplan-2020',
    authors: 'Jared Kaplan, Sam McCandlish, Tom Henighan, Tom B. Brown, et al.',
    year: 2020,
    title: 'Scaling Laws for Neural Language Models',
    venue: 'arXiv:2001.08361',
    url: 'https://arxiv.org/abs/2001.08361',
    usedFor: 'Ch. 4: power-law scaling and the model-size-heavy allocation.',
    licenseNote: 'arXiv.org perpetual, non-exclusive licence 1.0 (arXiv distribution terms; not a Creative Commons licence).',
  },
  {
    id: 'hoffmann-2022',
    authors: 'Jordan Hoffmann, Sebastian Borgeaud, Arthur Mensch, et al.',
    year: 2022,
    title: 'Training Compute-Optimal Large Language Models (Chinchilla)',
    venue: 'arXiv:2203.15556',
    url: 'https://arxiv.org/abs/2203.15556',
    usedFor: 'Ch. 4: compute-optimal allocation, the ≈20 tokens-per-parameter rule, IsoFLOP curves.',
    licenseNote: 'arXiv preprint; consult the arXiv record for the version-specific licence.',
  },
  {
    id: 'wei-2022-cot',
    authors: 'Jason Wei, Xuezhi Wang, Dale Schuurmans, et al.',
    year: 2022,
    title: 'Chain-of-Thought Prompting Elicits Reasoning in Large Language Models',
    venue: 'NeurIPS 2022 / arXiv:2201.11903',
    url: 'https://arxiv.org/abs/2201.11903',
    usedFor: 'Ch. 6 and Ch. 9: chain-of-thought prompting as interaction style C.',
    licenseNote: 'arXiv preprint; consult the arXiv record for the version-specific licence.',
  },
  {
    id: 'yao-2022-react',
    authors: 'Shunyu Yao, Jeffrey Zhao, Dian Yu, et al.',
    year: 2022,
    title: 'ReAct: Synergizing Reasoning and Acting in Language Models',
    venue: 'ICLR 2023 / arXiv:2210.03629',
    url: 'https://arxiv.org/abs/2210.03629',
    usedFor: 'Ch. 6, Ch. 9 and Ch. 11: the reason–act–observe loop.',
    licenseNote: 'arXiv preprint; consult the arXiv record for the version-specific licence.',
  },
  {
    id: 'packer-2023-memgpt',
    authors: 'Charles Packer, Sarah Wooders, Kevin Lin, et al.',
    year: 2023,
    title: 'MemGPT: Towards LLMs as Operating Systems',
    venue: 'arXiv:2310.08560',
    url: 'https://arxiv.org/abs/2310.08560',
    usedFor: 'Ch. 9 §9.3.2.3: explicit memory management with read/write operations.',
    licenseNote: 'arXiv preprint; consult the arXiv record for the version-specific licence.',
  },
  {
    id: 'asai-2023-selfrag',
    authors: 'Akari Asai, Zeqiu Wu, Yizhong Wang, Avirup Sil, Hannaneh Hajishirzi',
    year: 2023,
    title: 'Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection',
    venue: 'ICLR 2024 / arXiv:2310.11511',
    url: 'https://arxiv.org/abs/2310.11511',
    usedFor: 'Ch. 12 §12.4: adaptive retrieval with critique.',
    licenseNote: 'arXiv preprint; consult the arXiv record for the version-specific licence.',
  },
  {
    id: 'press-2022-selfask',
    authors: 'Ofir Press, Muru Zhang, Sewon Min, Ludwig Schmidt, Noah A. Smith, Mike Lewis',
    year: 2022,
    title: 'Measuring and Narrowing the Compositionality Gap in Language Models',
    venue: 'arXiv:2210.03350',
    url: 'https://arxiv.org/abs/2210.03350',
    usedFor: 'Ch. 12 §12.4: question decomposition for multi-hop retrieval.',
    licenseNote: 'arXiv preprint; consult the arXiv record for the version-specific licence.',
  },
  {
    id: 'templeton-2024-sae',
    authors: 'Adly Templeton, Tom Conerly, Jonathan Marcus, et al. (Anthropic)',
    year: 2024,
    title: 'Scaling Monosemanticity: Extracting Interpretable Features from Claude 3 Sonnet',
    venue: 'Transformer Circuits Thread',
    url: 'https://transformer-circuits.pub/2024/scaling-monosemanticity/',
    usedFor: 'Ch. 21 §21.8: sparse autoencoders and dictionary learning for feature discovery.',
    licenseNote: 'Web publication; cited by reference only, not reproduced.',
  },
  {
    id: 'ha-schmidhuber-2018',
    authors: 'David Ha, Jürgen Schmidhuber',
    year: 2018,
    title: 'World Models',
    venue: 'arXiv:1803.10122',
    url: 'https://arxiv.org/abs/1803.10122',
    usedFor: 'Ch. 7 §7.3.5: the origin of world models in model-based reinforcement learning.',
    licenseNote: 'arXiv preprint; consult the arXiv record for the version-specific licence.',
  },
  {
    id: 'fontana-2025-cooperation',
    authors: 'Nicolò Fontana, Francesco Pierri, Luca Maria Aiello, et al.',
    year: 2025,
    title: 'Cooperation and coordination in LLM social dilemmas (as reviewed in Ch. 15)',
    venue: 'Reviewed in the textbook, §15.4.1',
    url: 'https://arxiv.org/abs/2610.13455',
    usedFor: 'Ch. 15: iterated Prisoner\'s Dilemma and coordination findings.',
    licenseNote:
      'Read here through the textbook\'s review. Consult the original publication for authoritative licence terms before reuse.',
  },
  {
    id: 'lewis-2020-rag',
    authors: 'Patrick Lewis, Ethan Perez, Aleksandra Piktus, Fabio Petroni, Vladimir Karpukhin, et al.',
    year: 2020,
    title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks',
    venue: 'NeurIPS 2020 / arXiv:2005.11401',
    url: 'https://arxiv.org/abs/2005.11401',
    usedFor:
      'Ch. 6 §6.2.2 and Ch. 12: the original retrieval-augmented generation recipe — a parametric generator with a non-parametric memory.',
    licenseNote: 'arXiv preprint; consult the arXiv record for the version-specific licence.',
  },
  {
    id: 'liu-2023-lost-in-middle',
    authors: 'Nelson F. Liu, Kevin Lin, John Hewitt, Ashwin Paranjape, Michele Bevilacqua, Fabio Petroni, Percy Liang',
    year: 2023,
    title: 'Lost in the Middle: How Language Models Use Long Contexts',
    venue: 'TACL 2024 / arXiv:2307.03172',
    url: 'https://arxiv.org/abs/2307.03172',
    usedFor:
      'Ch. 9 §9.3.2.2: the measured U-shaped curve — models use the beginning and the end of a long context best, and the middle worst. This is the effect the context-window demonstration reproduces.',
    licenseNote: 'arXiv preprint; consult the arXiv record for the version-specific licence.',
  },
  {
    id: 'mu-2023-gist',
    authors: 'Jesse Mu, Xiang Lisa Li, Noah Goodman',
    year: 2023,
    title: 'Learning to Compress Prompts with Gist Tokens',
    venue: 'NeurIPS 2023 / arXiv:2304.08467',
    url: 'https://arxiv.org/abs/2304.08467',
    usedFor:
      'Ch. 9 §9.3.2.2: learned prompt compression, and the honest caveat that compression necessarily loses nuance.',
    licenseNote: 'arXiv preprint; consult the arXiv record for the version-specific licence.',
  },
  {
    id: 'zhong-2024-memorybank',
    authors: 'Wanjun Zhong, Lianghong Guo, Qiqi Gao, He Ye, Yanlin Wang',
    year: 2024,
    title: 'MemoryBank: Enhancing Large Language Models with Long-Term Memory',
    venue: 'AAAI 2024 / arXiv:2305.10250',
    url: 'https://arxiv.org/abs/2305.10250',
    usedFor:
      'Ch. 9 §9.3.2.3: hierarchical summaries of a user\'s interactions, and memory that is forgotten and reinforced on an Ebbinghaus curve.',
    licenseNote: 'arXiv preprint; consult the arXiv record for the version-specific licence.',
  },
  {
    id: 'zhou-2025-mem1',
    authors: 'Zijian Zhou, Ao Qu, Zhaoxuan Wu, Sunghwan Kim, Alok Prakash, Daniela Rus, et al.',
    year: 2025,
    title: 'Mem1: Learning to Synergize Memory and Reasoning for Efficient Long-Horizon Agents',
    venue: 'arXiv:2506.15841',
    url: 'https://arxiv.org/abs/2506.15841',
    usedFor:
      'Ch. 9 §9.3.2.3: a compact state that is updated after every interaction, so the state does not run out of the context window.',
    licenseNote: 'arXiv preprint; consult the arXiv record for the version-specific licence.',
  },
  {
    id: 'vaswani-2017-attention',
    authors: 'Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Łukasz Kaiser, Illia Polosukhin',
    year: 2017,
    title: 'Attention Is All You Need',
    venue: 'NeurIPS 2017 / arXiv:1706.03762',
    url: 'https://arxiv.org/abs/1706.03762',
    usedFor:
      'Ch. 2 §2.3: the transformer itself. Worth reading for the attention mechanism, and for how little of the paper is about language.',
    licenseNote: 'arXiv preprint; consult the arXiv record for the version-specific licence.',
  },
  {
    id: 'raffel-2020-t5',
    authors: 'Colin Raffel, Noam Shazeer, Adam Roberts, Katherine Lee, Sharan Narang, Michael Matena, Yanqi Zhou, Wei Li, Peter J. Liu',
    year: 2020,
    title: 'Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer',
    venue: 'Journal of Machine Learning Research 21(140)',
    url: 'https://jmlr.org/papers/v21/20-074.html',
    usedFor:
      'Ch. 2: the text-to-text framing that makes pretraining and finetuning one pipeline rather than two, and the multitask mixture it is trained on.',
    licenseNote: 'Journal article; the JMLR page carries the licence terms.',
  },
  {
    id: 'hu-2021-lora',
    authors: 'Edward J. Hu, Yelong Shen, Phillip Wallis, Zeyuan Allen-Zhu, Yuanzhi Li, Shean Wang, Lu Wang, Weizhu Chen',
    year: 2021,
    title: 'LoRA: Low-Rank Adaptation of Large Language Models',
    venue: 'arXiv:2106.09685',
    url: 'https://arxiv.org/abs/2106.09685',
    usedFor:
      'Ch. 3 §3.2.3: the finetuning method that made adaptation practical, and the reason the course treats finetuning as cheap.',
    licenseNote: 'arXiv preprint; consult the arXiv record for the version-specific licence.',
  },
  {
    id: 'rafailov-2024-dpo',
    authors: 'Rafael Rafailov, Archit Sharma, Eric Mitchell, Christopher D. Manning, Stefano Ermon, Chelsea Finn',
    year: 2024,
    title: 'Direct Preference Optimization: Your Language Model Is Secretly a Reward Model',
    venue: 'NeurIPS 2024 / EMNLP 2024',
    url: 'https://aclanthology.org/2024.emnlp-main.1020/',
    usedFor:
      'Ch. 3: the alignment stage without an explicit reward model, and the clearest statement of what RLHF is optimising.',
    licenseNote: 'ACL Anthology; the anthology page carries the licence terms.',
  },
  {
    id: 'chen-2025-agentic-rag-survey',
    authors: 'Shuai Chen et al.',
    year: 2025,
    title: 'Agentic Retrieval-Augmented Generation: A Survey on Agentic RAG',
    venue: 'arXiv:2501.09136',
    url: 'https://arxiv.org/abs/2501.09136',
    usedFor:
      'Ch. 12 §12.6: the survey that maps agentic RAG onto the single-shot pipeline the chapter teaches.',
    licenseNote: 'arXiv preprint; consult the arXiv record for the version-specific licence.',
  },
  {
    id: 'wang-2025-mem-alpha',
    authors: 'Yu Wang, Ryuichi Takanobu, Zhiqi Liang, Yuzhen Mao, Yuanzhe Hu, Julian McAuley, Xiaojian Wu',
    year: 2025,
    title: 'Mem-α: Learning Memory Construction via Reinforcement Learning',
    venue: 'arXiv:2509.25911',
    url: 'https://arxiv.org/abs/2509.25911',
    usedFor:
      'Ch. 9 §9.3.2.3: the learned counterpart to explicit memory management — the agent decides what to remember, trained by reinforcement learning.',
    licenseNote: 'arXiv preprint; consult the arXiv record for the version-specific licence.',
  },
  {
    id: 'guo-2025-deepseek-r1',
    authors: 'Daya Guo, Dejian Yang, Haowei Zhang, Junxiao Song, Ruoyu Zhang, Runxin Xu, et al.',
    year: 2025,
    title: 'DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning',
    venue: 'arXiv:2501.12948',
    url: 'https://arxiv.org/abs/2501.12948',
    usedFor:
      'Ch. 3 and Ch. 23 §23.2.2: reinforcement learning with verifiable rewards, and the case for training on the agent\'s own interaction data.',
    licenseNote: 'arXiv preprint; consult the arXiv record for the version-specific licence.',
  },
  {
    id: 'sprague-2024-cot-or-not',
    authors: 'Zayne Sprague, Fangcong Yin, Juan Diego Rodriguez, Dongwei Jiang, Manya Wadhwa, Prasann Singhal, et al.',
    year: 2024,
    title: 'To CoT or Not to CoT? Chain-of-Thought Helps Mainly on Math and Symbolic Reasoning',
    venue: 'arXiv:2409.12183',
    url: 'https://arxiv.org/abs/2409.12183',
    usedFor:
      'Ch. 23 §23.2.2: the measurement behind the chapter\'s warning that more thinking is not always better.',
    licenseNote: 'arXiv preprint; consult the arXiv record for the version-specific licence.',
  },
  {
    id: 'brohan-2023-rt2',
    authors: 'Anthony Brohan, Noah Brown, Justice Carbajal, Yevgen Chebotar, Xi Chen, Krzysztof Choromanski, et al.',
    year: 2023,
    title: 'RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control',
    venue: 'arXiv:2307.15818',
    url: 'https://arxiv.org/abs/2307.15818',
    usedFor:
      'Ch. 7 and Ch. 23: the earliest of the vision-language-action models, and the clearest statement of what web-scale pretraining buys a robot.',
    licenseNote: 'arXiv preprint; consult the arXiv record for the version-specific licence.',
  },
  {
    id: 'black-2024-pi0',
    authors: 'Kevin Black, Noah Brown, Danny Driess, Adnan Esmail, Michael Equi, Chelsea Finn, Niccolo Fusai, et al.',
    year: 2024,
    title: 'π0: A Vision-Language-Action Flow Model for General Robot Control',
    venue: 'arXiv:2410.24164',
    url: 'https://arxiv.org/abs/2410.24164',
    usedFor:
      'Ch. 23 §23.2.2: a generalist robot policy trained on self-generated action data — the open-problem version of the world-model lesson.',
    licenseNote: 'arXiv preprint; consult the arXiv record for the version-specific licence.',
  },
  {
    id: 'achiam-2024-gpt4',
    authors: 'Josh Achiam, Steven Adler, Sandhini Agarwal, and others at OpenAI',
    year: 2024,
    title: 'GPT-4 Technical Report',
    venue: 'arXiv:2303.08774',
    url: 'https://arxiv.org/abs/2303.08774',
    usedFor:
      'Ch. 23: the frontier the chapter measures itself against, and a rare honest account of what a large model does and does not do.',
    licenseNote: 'arXiv preprint; consult the arXiv record for the version-specific licence.',
  },
]

export const REFERENCE_BY_ID = new Map(REFERENCES.map((reference) => [reference.id, reference]))

export const LICENSE_SUMMARY = {
  textbook:
    'Agentic Large Language Models (arXiv:2610.13455v1) is listed under CC0 1.0. Author credit is preserved throughout this course.',
  thirdPartyCode:
    'No third-party source code, dataset or figure is redistributed in this repository. Where the course needs to reference a project (nanochat, LangChain, BALROG, Generative Agents, MCP), it links to the canonical source and records the licence above.',
  diagrams:
    'All diagrams, visualisations and simulation engines in this project are original SVG/React/TypeScript authored for this course; none are traced from the textbook PDF.',
  pdf:
    'The source PDF is not bundled with the application. Place your own copy at the repository root if you want the lesson reader to link to it.',
} as const

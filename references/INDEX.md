<!--
  GENERATED FILE — do not edit by hand.
  Run `node scripts/generate-index.mjs` after changing references/manifest.json.
-->

# Source index

Generated from `references/manifest.json` (schema version 1, last verified 2026-11-03). 106 sources across 16 courses.

## The courses

| Course | Status | Primary source | Modules |
| --- | --- | --- | --- |
| **LLM Foundations Lab** | built | Foundations of Large Language Models | Pre-training, Generative Models, Prompting, Alignment, Inference, Reasoning |
| **Agentic AI Academy** | built | Agentic Large Language Models | Language Modeling, Reasoning, Agents, Tools and Assistants, Behavior and Cognition, Advanced Topics, Conclusion |
| **Deep Learning Theory Explorer** | built | The Principles of Deep Learning Theory | Initialization, Signal Propagation, Kernel Recursion, Fluctuations, RG Flow, Criticality, Universality, Bayesian Learning, NTK, Representation Learning |
| **Diffusion Lab** | built | Denoising Diffusion Probabilistic Models | The Forward Process, The Reverse Process, Noise Schedules, Latent Diffusion, Guidance, The Design Space |
| **Evaluation Lab** | built | Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena | Judging with a Model, The Biases of a Judge, Human Agreement, Arena Rankings, Benchmark Design, Measurement |
| **RLHF Lab** | built | The N+ Implementation Details of RLHF with PPO: A Case Study on TL;DR Summarization | Policy Gradients, Trust Regions, Proximal Policy Optimization, The KL Penalty, The N+ Details, Reward Overoptimisation |
| **Language Model from Scratch** | built | CS336: Language Modeling from Scratch | Tokenisation, The Architecture, Resource Accounting, Systems and Parallelism, Data, Training and Evaluation |
| **Mechanistic Interpretability Lab** | built | Sparse Autoencoders Find Highly Interpretable Features in Language Models | Superposition, Features, Not Neurons, Patching, Circuits, Composition |
| **Data Lab** | built | DataComp: In search of the next generation of multimodal datasets | Sources, Filtering, Deduplication, Mixtures, Collapse |
| **Scaling Lab** | built | Scaling Laws for Neural Language Models | Power Laws, Compute Optimality, Data Constraints, Emergence |
| **Systems Lab** | built | FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness | Attention Memory, The KV Cache, Sparse Capacity, Speculation |
| **Reinforcement Learning Foundations** | built | Reinforcement Learning: An Introduction (second edition) | The MDP, Value functions, Policy gradients, Actor–critic |
| **Retrieval Lab** | built | Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks | Sparse Retrieval, Dense Retrieval, Late Interaction, The Long Context |
| **Agent Benchmark Lab** | built | SWE-bench: Can Language Models Resolve Real-World GitHub Issues? | Task Design, Verification, The Baselines, Variance and Contamination |
| **Safety and Alignment Lab** | built | Constitutional AI: Harmlessness from AI Feedback | Harmlessness from AI Feedback, Red Teaming, Sycophancy, Privacy |
| **Multimodal Lab** | built | Learning Transferable Visual Models From Natural Language Supervision | Contrastive Pretraining, The Modality Gap, Instruction Tuning, The Loss and the Bridge |

### LLM Foundations Lab

*Status: built.*

- **Foundations of Large Language Models** — Tong Xiao, Jingbo Zhu (2026). arXiv:2501.09223v4 [cs.CL], 8 October 2026.
  - Licence: CC BY-NC 4.0 (as stated on the arXiv record)
  - Role: primary. Gap closed: The whole foundation layer: pre-training objectives, the decoder-only Transformer, prompting, alignment, inference and reasoning.
  - Laboratory work: Transformer Explorer; Tokenisation and embeddings; Sampling; Learning; Alignment (SFT / Bradley–Terry / DPO); Inference and reasoning; Prompting.
- **Attention Is All You Need** — Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Lukasz Kaiser, Illia Polosukhin (2017). arXiv:1706.03762 [cs.CL] / NeurIPS 2017.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The primary source behind the Transformer Explorer, cited for the record.
  - Laboratory work: Scaled dot-product attention.
- **BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding** — Jacob Devlin, Ming-Wei Chang, Kenton Lee, Kristina Toutanova (2018). arXiv:1810.04805 [cs.CL] / NAACL 2019.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The primary source behind the BERT worked example.
  - Laboratory work: Masked language modelling.
- **Language Models are Few-Shot Learners** — Tom B. Brown, Benjamin Mann, Nick Ryder, Melanie Subbiah, Jared Kaplan, Prafulla Dhariwal, Arvind Neelakantan, Pranav Shyam and 23 others (2020). arXiv:2005.14165 [cs.CL] / NeurIPS 2020.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The primary source behind the in-context-learning lesson.
  - Laboratory work: Few-shot prompting.
- **LLaMA: Open and Efficient Foundation Language Models** — Hugo Touvron, Thibaut Lavril, Gautier Izacard, Xavier Martinet, Marie-Anne Lachaux, Timothée Lacroix, Baptiste Rozière, Naman Goyal and 6 others (2023). arXiv:2302.13971 [cs.CL].
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: supporting. Gap closed: The Chinchilla-optimal training recipe applied to an open model.
  - Laboratory work: Chinchilla-optimal token budget.
- **Llama 2: Open Foundation and Fine-Tuned Chat Models** — Hugo Touvron, Louis Martin, Kevin Stone, Peter Albert, Amjad Almahairi, Yasmine Babaei, Nikolay Bashlykov, Soumya Batra and 60 others (2023). arXiv:2307.09288 [cs.CL].
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: supporting. Gap closed: The RLHF recipe at open-model scale, including the safety evaluation appendix.
  - Laboratory work: Safety evaluation of a chat model.
- **On the Opportunities and Risks of Foundation Models** — Rishi Bommasani, Drew A. Hudson, Ehsan Adeli, Russ Altman, Simran Arora, Sydney von Arx, Michael S. Bernstein, Jeannette Bohg and 106 others (2021). arXiv:2108.07258 [cs.LG] / CRFM.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: supporting. Gap closed: The report that defined the term the courses use throughout.
  - Laboratory work: The eight risk categories.
- **LongRoPE: Extending LLM Context Window Beyond 2 Million Tokens** — Yiran Ding, Li Lyna Zhang, Chengruidong Zhang, Yuanyuan Xu, Ning Shang, Jiahang Xu, Fan Yang, Mao Yang (2024). arXiv:2402.13753 [cs.CL] / ICLR 2025.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: supporting. Gap closed: Position interpolation, which the foundations course covers as a lesson.
  - Laboratory work: Position interpolation and the effective context length.
- **Fast Inference from Transformers via Speculative Decoding** — Yaniv Leviathan, Matan Kalman, Yossi Matias (2023). arXiv:2211.17192 [cs.LG] / ICML 2023.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: supporting. Gap closed: The inference module teaches autoregressive decoding and the KV cache; speculative decoding is the draft-and-verify algorithm that pairs a small draft model with the target.
  - Laboratory work: Speculative decoding: draft-then-verify.
- **Dive into Deep Learning** — Aston Zhang, Zachary C. Lipton, Mu Li, Alexander J. Smola (2024). Online book with executable notebooks.
  - Licence: The repository (d2l-ai/d2l-en) ships a custom licence file that the GitHub API does not recognise as a standard SPDX identifier. The project states code samples under Apache-2.0 and the book text under CC BY-SA 4.0 — read the LICENSE file before redistributing.
  - Role: supporting. Gap closed: The broadest single free course: it covers the applied architectures the three collections assume.
  - Laboratory work: CNN, RNN and attention side by side.

### Agentic AI Academy

*Status: built.*

- **Agentic Large Language Models** — Max van Duijn, Michiel van der Meer, Aske Plaat, Niki van Stein (2026). arXiv:2610.13455v1 [cs.AI], 9 October 2026.
  - Licence: CC0 1.0 Universal (as stated on the arXiv record)
  - Role: primary. Gap closed: The agentic layer: interaction styles, tool use, memory architectures, retrieval, multi-agent systems, behaviour studies, and advanced topics including mechanistic interpretability.
  - Laboratory work: Planning; Memory; World model; Multi-agent; Visual agent workflow builder.
- **World Models** — David Ha, Jürgen Schmidhuber (2018). arXiv:1803.10122 [cs.LG] / NIPS 2018 Workshop.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: supporting. Gap closed: The origin of the world-model view, behind the world-model laboratory.
  - Laboratory work: Model-free versus model-based planning.
- **Chain-of-Thought Prompting Elicits Reasoning in Large Language Models** — Jason Wei, Xuezhi Wang, Dale Schuurmans, Maarten Bosma, Brian Ichter, Fei Xia, Ed Chi, Quoc Le and 1 others (2022). NeurIPS 2022 / arXiv:2201.11903.
  - Licence: arXiv preprint; consult the arXiv record for the version-specific licence.
  - Role: supporting. Gap closed: The reading behind agentic-ai-academy's treatment of ch. 6 and Ch. 9: chain-of-thought prompting as interaction style C..
  - Laboratory work: Ch. 6 and Ch. 9: chain-of-thought prompting as interaction style C..
- **ReAct: Synergizing Reasoning and Acting in Language Models** — Shunyu Yao, Jeffrey Zhao, Dian Yu, Nan Du, Izhak Shafran, Karthik Narasimhan, Yuan Cao (2022). ICLR 2023 / arXiv:2210.03629.
  - Licence: arXiv preprint; consult the arXiv record for the version-specific licence.
  - Role: supporting. Gap closed: The reading behind agentic-ai-academy's treatment of ch. 6, Ch. 9 and Ch. 11: the reason–act–observe loop..
  - Laboratory work: Ch. 6, Ch. 9 and Ch. 11: the reason–act–observe loop..
- **MemGPT: Towards LLMs as Operating Systems** — Charles Packer, Sarah Wooders, Kevin Lin, Vivian Fang, Shishir G. Patil, Ion Stoica, Joseph E. Gonzalez (2023). arXiv:2310.08560.
  - Licence: arXiv preprint; consult the arXiv record for the version-specific licence.
  - Role: supporting. Gap closed: The reading behind agentic-ai-academy's treatment of ch. 9 §9.3.2.3: explicit memory management with read/write operations..
  - Laboratory work: Ch. 9 §9.3.2.3: explicit memory management with read/write operations..
- **Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection** — Akari Asai, Zeqiu Wu, Yizhong Wang, Avirup Sil, Hannaneh Hajishirzi (2023). ICLR 2024 / arXiv:2310.11511.
  - Licence: arXiv preprint; consult the arXiv record for the version-specific licence.
  - Role: supporting. Gap closed: The reading behind agentic-ai-academy's treatment of ch. 12 §12.4: adaptive retrieval with critique..
  - Laboratory work: Ch. 12 §12.4: adaptive retrieval with critique..
- **Measuring and Narrowing the Compositionality Gap in Language Models** — Ofir Press, Muru Zhang, Sewon Min, Ludwig Schmidt, Noah A. Smith, Mike Lewis (2022). arXiv:2210.03350.
  - Licence: arXiv preprint; consult the arXiv record for the version-specific licence.
  - Role: supporting. Gap closed: The reading behind agentic-ai-academy's treatment of ch. 12 §12.4: question decomposition for multi-hop retrieval..
  - Laboratory work: Ch. 12 §12.4: question decomposition for multi-hop retrieval..
- **Learning to Compress Prompts with Gist Tokens** — Jesse Mu, Xiang Lisa Li, Noah Goodman (2023). NeurIPS 2023 / arXiv:2304.08467.
  - Licence: arXiv preprint; consult the arXiv record for the version-specific licence.
  - Role: supporting. Gap closed: The reading behind agentic-ai-academy's treatment of ch. 9 §9.3.2.2: learned prompt compression, and the honest caveat that compression necessarily loses nuance..
  - Laboratory work: Ch. 9 §9.3.2.2: learned prompt compression, and the honest caveat that compression necessarily loses nuance..
- **MemoryBank: Enhancing Large Language Models with Long-Term Memory** — Wanjun Zhong, Lianghong Guo, Qiqi Gao, He Ye, Yanlin Wang (2024). AAAI 2024 / arXiv:2305.10250.
  - Licence: arXiv preprint; consult the arXiv record for the version-specific licence.
  - Role: supporting. Gap closed: The reading behind agentic-ai-academy's treatment of ch. 9 §9.3.2.3: hierarchical summaries of a user's interactions, and memory that is forgotten and reinforced on an Ebbinghaus curve..
  - Laboratory work: Ch. 9 §9.3.2.3: hierarchical summaries of a user's interactions, and memory that is forgotten and reinforced on an Ebbinghaus curve..
- **Mem1: Learning to Synergize Memory and Reasoning for Efficient Long-Horizon Agents** — Zijian Zhou, Ao Qu, Zhaoxuan Wu, Sunghwan Kim, Alok Prakash, Daniela Rus, Jinhua Zhao, Bryan Kian Hsiang Low and 1 others (2025). arXiv:2506.15841.
  - Licence: arXiv preprint; consult the arXiv record for the version-specific licence.
  - Role: supporting. Gap closed: The reading behind agentic-ai-academy's treatment of ch. 9 §9.3.2.3: a compact state that is updated after every interaction, so the state does not run out of the context window..
  - Laboratory work: Ch. 9 §9.3.2.3: a compact state that is updated after every interaction, so the state does not run out of the context window..
- **Agentic Retrieval-Augmented Generation: A Survey on Agentic RAG** — Aditi Singh, Abul Ehtesham, Saket Kumar, Tala Talaei Khoei, Athanasios V. Vasilakos (2025). arXiv:2501.09136.
  - Licence: arXiv preprint; consult the arXiv record for the version-specific licence.
  - Role: supporting. Gap closed: The reading behind agentic-ai-academy's treatment of ch. 12 §12.6: the survey that maps agentic RAG onto the single-shot pipeline the chapter teaches..
  - Laboratory work: Ch. 12 §12.6: the survey that maps agentic RAG onto the single-shot pipeline the chapter teaches..
- **Mem-α: Learning Memory Construction via Reinforcement Learning** — Yu Wang, Ryuichi Takanobu, Zhiqi Liang, Yuzhen Mao, Yuanzhe Hu, Julian McAuley, Xiaojian Wu (2025). arXiv:2509.25911.
  - Licence: arXiv preprint; consult the arXiv record for the version-specific licence.
  - Role: supporting. Gap closed: The reading behind agentic-ai-academy's treatment of ch. 9 §9.3.2.3: the learned counterpart to explicit memory management — the agent decides what to remember, trained by reinforcement learning..
  - Laboratory work: Ch. 9 §9.3.2.3: the learned counterpart to explicit memory management — the agent decides what to remember, trained by reinforcement learning..
- **DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning** — DeepSeek-AI, Daya Guo, Dejian Yang, Haowei Zhang, Junxiao Song, Peiyi Wang, Qihao Zhu, Runxin Xu and 192 others (2025). arXiv:2501.12948.
  - Licence: arXiv preprint; consult the arXiv record for the version-specific licence.
  - Role: supporting. Gap closed: The reading behind agentic-ai-academy's treatment of ch. 3 and Ch. 23 §23.2.2: reinforcement learning with verifiable rewards, and the case for training on the agent's own interaction data..
  - Laboratory work: Ch. 3 and Ch. 23 §23.2.2: reinforcement learning with verifiable rewards, and the case for training on the agent's own interaction data..
- **RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control** — Anthony Brohan, Noah Brown, Justice Carbajal, Yevgen Chebotar, Xi Chen, Krzysztof Choromanski, Tianli Ding, Danny Driess and 46 others (2023). arXiv:2307.15818.
  - Licence: arXiv preprint; consult the arXiv record for the version-specific licence.
  - Role: supporting. Gap closed: The reading behind agentic-ai-academy's treatment of ch. 7 and Ch. 23: the earliest of the vision-language-action models, and the clearest statement of what web-scale pretraining buys a robot..
  - Laboratory work: Ch. 7 and Ch. 23: the earliest of the vision-language-action models, and the clearest statement of what web-scale pretraining buys a robot..
- **π0: A Vision-Language-Action Flow Model for General Robot Control** — Kevin Black, Noah Brown, Danny Driess, Adnan Esmail, Michael Equi, Chelsea Finn, Niccolo Fusai, Lachy Groom and 16 others (2024). arXiv:2410.24164.
  - Licence: arXiv preprint; consult the arXiv record for the version-specific licence.
  - Role: supporting. Gap closed: The reading behind agentic-ai-academy's treatment of ch. 23 §23.2.2: a generalist robot policy trained on self-generated action data — the open-problem version of the world-model lesson..
  - Laboratory work: Ch. 23 §23.2.2: a generalist robot policy trained on self-generated action data — the open-problem version of the world-model lesson..
- **GPT-4 Technical Report** — OpenAI, Josh Achiam, Steven Adler, Sandhini Agarwal, Lama Ahmad, Ilge Akkaya, Florencia Leoni Aleman, Diogo Almeida and 273 others (2024). arXiv:2303.08774.
  - Licence: arXiv preprint; consult the arXiv record for the version-specific licence.
  - Role: supporting. Gap closed: The reading behind agentic-ai-academy's treatment of ch. 23: the frontier the chapter measures itself against, and a rare honest account of what a large model does and does not do..
  - Laboratory work: Ch. 23: the frontier the chapter measures itself against, and a rare honest account of what a large model does and does not do..
- **To CoT or Not to CoT? Chain-of-Thought Helps Mainly on Math and Symbolic Reasoning** — Zayne Sprague, Fangcong Yin, Juan Diego Rodriguez, Dongwei Jiang, Manya Wadhwa, Prasann Singhal, Xinyu Zhao, Xi Ye and 2 others (2024). arXiv:2409.12183.
  - Licence: arXiv preprint; consult the arXiv record for the version-specific licence.
  - Role: supporting. Gap closed: The reading behind agentic-ai-academy's treatment of ch. 23 §23.2.2: the measurement behind the chapter's warning that more thinking is not always better..
  - Laboratory work: Ch. 23 §23.2.2: the measurement behind the chapter's warning that more thinking is not always better..

### Deep Learning Theory Explorer

*Status: built.*

- **The Principles of Deep Learning Theory** — Daniel A. Roberts, Sho Yaida, Boris Hanin (2022). Cambridge University Press, 2022. Preprint: arXiv:2106.10165v2 [cs.LG]. Full title: The Principles of Deep Learning Theory: An Effective Theory Approach to Understanding Neural Networks.
  - Licence: Copyrighted by the authors and Cambridge University Press. Cited by reference; the text and figures are not redistributed.
  - Role: primary. Gap closed: The mathematical layer: initialisation and criticality, signal propagation, the kernel recursion, finite-width fluctuations, the NTK, and representation learning.
  - Laboratory work: Initialisation and criticality; Loss landscapes; Width and depth; Neural tangent kernel; Representation learning; Physics lab.
- **Mathematics for Machine Learning** — Marc Peter Deisenroth, A. Aldo Faisal, Cheng Soon Ong (2020). Free online edition.
  - Licence: Freely available to read online. The machine-check could not be completed from this environment (the GitHub repository name was not resolvable through the API); verify the licence terms on the site before redistributing.
  - Role: supporting. Gap closed: The prerequisite mathematics for the theory course, which currently ships a self-check instead of a reference.
  - Laboratory work: Prerequisite drills for the theory course.

### Diffusion Lab

*Status: built.*

- **Denoising Diffusion Probabilistic Models** — Jonathan Ho, Ajay Jain, Pieter Abbeel (2020). arXiv:2006.11239 [cs.LG] / NeurIPS 2020.
  - Licence: arXiv perpetual, non-exclusive distribution licence. No Creative Commons licence is shown on the record; re-check per version before redistributing.
  - Role: primary. Gap closed: There is no generative or multimodal application anywhere in the collection.
  - Laboratory work: Forward process with a closed form for x_t; Reverse process and the learned denoiser; Beta and noise schedules; Variational bound and the KL term; Sampling and the ancestral chain.
- **High-Resolution Image Synthesis with Latent Diffusion Models** — Robin Rombach, Andreas Blattmann, Dominik Lorenz, Patrick Esser, Björn Ommer (2022). arXiv:2112.10752 [cs.CV] / CVPR 2022.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: Diffusion is what made high-resolution generation practical; the latent step is the missing half of the story.
  - Laboratory work: Autoencoder round trip and the reconstruction error; Latent space scaling factor; Where the compute moves.
- **Elucidating the Design Space of Diffusion-Based Generative Models** — Tero Karras, Miika Aittala, Timo Aila, Samuli Laine (2022). arXiv:2206.00364 [cs.CV] / NeurIPS 2022.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The pre-conditioning and σ parametrisation that later samplers use; without it, the schedule choice looks arbitrary.
  - Laboratory work: σ parametrisation versus the timestep parametrisation; Preconditioning functions; Deterministic samplers.
- **Classifier-Free Diffusion Guidance** — Jonathan Ho, Tim Salimans (2022). arXiv:2207.12598 [cs.LG].
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: Guidance is how a text-conditioned model is steered, and it is a single interpolation in the score.
  - Laboratory work: Unconditional versus conditional score; The guidance scale sweep; Why guidance reduces diversity.
- **Diffusion Models Beat GANs on Image Synthesis** — Prafulla Dhariwal, Alex Nichol (2021). arXiv:2105.05233 [cs.CV] / NeurIPS 2021.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: supporting. Gap closed: The classifier-guidance recipe that made diffusion competitive, for comparison with classifier-free guidance.
  - Laboratory work: Classifier guidance and its gradient term.
- **Denoising Diffusion Implicit Models** — Jiaming Song, Chenlin Meng, Stefano Ermon (2020). arXiv:2010.02502 [cs.LG] / ICLR 2021.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The deterministic sampler, and therefore the reason a diffusion model can be sampled in a few dozen steps instead of a thousand.
  - Laboratory work: The deterministic step; The same model, sampled without noise.
- **Improved Denoising Diffusion Probabilistic Models** — Alex Nichol, Prafulla Dhariwal (2021). arXiv:2102.09672 [cs.LG] / ICML 2021.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The cosine schedule and the learned variances, which is what the schedules module compares against the original linear schedule.
  - Laboratory work: The cosine schedule; The effective diffusion length.

### Evaluation Lab

*Status: built.*

- **Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena** — Lianmin Zheng, Wei-Lin Chiang, Ying Sheng, Siyuan Zhuang, Zhanghao Wu, Yonghao Zhuang, Zi Lin, Zhuohan Li and 5 others (2023). arXiv:2306.05685 [cs.CL] / NeurIPS 2023 Datasets and Benchmarks.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: Evaluation appears as a single lesson in the foundations course. Judging a model with a model is now a primary evaluation method and its biases are measurable.
  - Laboratory work: Position bias; Verbosity bias; Self-enhancement bias; Judge against human agreement; Consistency under permutation.
- **Holistic Evaluation of Language Models** — Percy Liang, Rishi Bommasani, Tony Lee, Dimitris Tsipras, Dilara Soylu, Michihiro Yasunaga, Yian Zhang, Deepak Narayanan and 42 others (2022). arXiv:2211.09110 [cs.CL] / TMLR 2023. The paper is known as HELM.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: A single score hides the trade-offs; the holistic framing is the counter-argument.
  - Laboratory work: Multi-metric trade-off surfaces; Standardisation and coverage.
- **Chatbot Arena: An Open Platform for Evaluating LLMs by Human Preference** — Wei-Lin Chiang, Lianmin Zheng, Ying Sheng, Anastasios Nikolas Angelopoulos, Tianle Li, Dacheng Li, Hao Zhang, Banghua Zhu and 3 others (2024). arXiv:2403.04132 [cs.CL] / ICML 2024.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: Where real human preference votes come from, and the confidence interval a leaderboard should print.
  - Laboratory work: Bradley–Terry from pairwise votes; Bootstrap confidence intervals on rankings; The cost of a good arena sample.
- **The Leaderboard Illusion** — Shivalika Singh, Yiyang Nan, Alex Wang, Daniel D'Souza, Sayash Kapoor, Ahmet Üstün, Sanmi Koyejo, Yuntian Deng and 5 others (2025). arXiv:2504.20879 [cs.LG].
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The newest and sharpest criticism of the evaluation ecosystem, and it is reproducible at small scale.
  - Laboratory work: Private testing versus public testing; Rating bias from a fixed evaluation set.
- **Lessons from the Trenches on Reproducible Evaluation of Language Models** — Stella Biderman, Hailey Schoelkopf, Lintang Sutawika, Leo Gao, Jonathan Tow, Baber Abbasi, Alham Fikri Aji, Pawan Sasanka Ammanamanchi and 22 others (2024). arXiv:2405.14782 [cs.LG].
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: supporting. Gap closed: The practical failure modes of evaluation harnesses: seeds, decoders, prompts, chat templates.
  - Laboratory work: How much a decoding change moves a score.

### RLHF Lab

*Status: built.*

- **The N+ Implementation Details of RLHF with PPO: A Case Study on TL;DR Summarization** — Shengyi Huang, Michael Noukhovitch, Arian Hosseini, Kashif Rasul, Weixun Wang, Lewis Tunstall (2024). arXiv:2403.17031 [cs.LG] / COLM 2024.
  - Licence: CC BY 4.0 on the OpenReview record (https://openreview.net/forum?id=kHO2ZTa8e3). arXiv carries the perpetual non-exclusive distribution licence.
  - Role: primary. Gap closed: The alignment course covers Bradley–Terry reward models and DPO but never the policy optimisation that the method is named after.
  - Laboratory work: The PPO clipped surrogate objective; KL penalty and the reference model; Value head and generalised advantage estimation; Reward hacking under a weak reward model.
- **Proximal Policy Optimization Algorithms** — John Schulman, Filip Wolski, Prafulla Dhariwal, Alec Radford, Oleg Klimov (2017). arXiv:1707.06347 [cs.LG].
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The clipped objective that makes RLHF stable in practice.
  - Laboratory work: The probability-ratio clip and why it bounds the gradient; Advantage normalisation.
- **Trust Region Policy Optimization** — John Schulman, Sergey Levine, Philipp Moritz, Michael I. Jordan, Pieter Abbeel (2015). arXiv:1502.05477 [cs.LG] / ICML 2015.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The theory PPO approximates: the KL constraint and the conjugate gradient step.
  - Laboratory work: Natural gradient and the KL constraint; Fisher-vector product by finite differences.
- **Scaling Laws for Reward Model Overoptimization** — Leo Gao, John Schulman, Jacob Hilton (2022). arXiv:2210.10760 [cs.LG] / ICLR 2023.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The Goodhart effect, measured. Both functional forms are plottable at toy scale.
  - Laboratory work: Reward overoptimisation against a gold reward model; Best-of-n versus reinforcement learning against the same KL budget; The α and β coefficients as the reward model grows.
- **The N+ implementation details: code and checkpoints** — Shengyi Huang, Michael Noukhovitch (2024). GitHub repository.
  - Licence: MIT (verified via the GitHub API, 2026-10-19)
  - Role: supporting. Gap closed: A complete, small-scale RLHF pipeline to read alongside the paper.
  - Laboratory work: The SFT stage, the reward model, the PPO stage, each as a runnable file.

### Language Model from Scratch

*Status: built.*

- **CS336: Language Modeling from Scratch** — Stanford CS336 staff (2026). stanford-cs336.github.io — Spring 2025 and Spring 2026 offerings.
  - Licence: Course materials are published for study. The lecture repository (stanford-cs336/spring2025-lectures) and the assignment repository (stanford-cs336/assignment1-basics) are both MIT licensed. Course slides and assignment handouts are cited, not redistributed.
  - Role: primary. Gap closed: No course in the collection trains a real model, touches a real corpus, or accounts for real hardware cost. Every number in the collection comes from a toy-scale model.
  - Laboratory work: FLOPs and arithmetic intensity; Memory hierarchy arithmetic; A real training loop with a loss curve; Data filtering and deduplication at corpus scale; Evaluation harnesses.
- **nanoGPT** — Andrej Karpathy (2023). GitHub repository.
  - Licence: MIT (verified via the GitHub API, 2026-10-19)
  - Role: supporting. Gap closed: The smallest honest implementation of a modern decoder-only language model.
  - Laboratory work: Reading a real training loop.
- **CS336 spring 2025 lecture materials** — Stanford CS336 staff (2025). GitHub repository.
  - Licence: MIT (verified via the GitHub API, 2026-10-19)
  - Role: primary. Gap closed: The lecture sequence itself: tokenisation, PyTorch and resource accounting, architectures, mixture of experts, GPUs, kernels, parallelism, scaling laws, inference, evaluation, data, and post-training.
  - Laboratory work: Every lecture has a computed companion figure.
- **CS336 assignment handouts and code** — Stanford CS336 staff (2025). GitHub repository.
  - Licence: MIT (verified via the GitHub API, 2026-10-19)
  - Role: supporting. Gap closed: The five assignments map one-to-one onto the planned modules.
  - Laboratory work: Basics; Systems; Scaling; Data; Alignment and reasoning.
- **Neural Networks: Zero to Hero** — Andrej Karpathy (2023). Video series and companion notes.
  - Licence: MIT (verified via the GitHub API, 2026-10-19)
  - Role: supporting. Gap closed: The build-up from a single neuron to a GPT, which is the pedagogical spine the other courses assume.
  - Laboratory work: The tokeniser, the attention head, the optimiser, each built from nothing.
- **Hugging Face LLM Course** — Hugging Face (2025). Online course.
  - Licence: Published under CC BY-NC 4.0. Cited and linked; not redistributed.
  - Role: supporting. Gap closed: The practical library layer: tokenisers, datasets, generation, and the huggingface pipeline API.
  - Laboratory work: Using a real tokeniser and a real dataset.
- **Transformers** — Hugging Face (2025). GitHub repository and Python package.
  - Licence: Apache-2.0 (verified via the GitHub API, 2026-10-19)
  - Role: supporting. Gap closed: The library every applied course in this field assumes.
  - Laboratory work: Running a small real model.

### Mechanistic Interpretability Lab

*Status: built.*

- **Toy Models of Superposition** — Noah Elhage, Shan Carter, Chris Olah, Dan Hendrycks (2023). Transformer Circuits publication.
  - Licence: Publicly readable web publication. The machine-check could not be completed from this environment (the site blocks automated clients); verify the terms on the page itself before reusing any text or figure.
  - Role: primary. Gap closed: Mechanistic interpretability is only summarised in one chapter of the agentic course, and it is the fastest-moving area in the field.
  - Laboratory work: Superposition in a tiny model; The price of a feature, computed exactly; The trade-off curve between interference and feature count.
- **A Mathematical Framework for Transformer Circuits** — Noah Elhage, Tristan Hume, Shan Carter, Scott Ostheim, Scott Linderman, Gabe, Dianne Hudon, Chris Olah (2021). Transformer Circuits publication.
  - Licence: Publicly readable web publication. The machine-check could not be completed from this environment (the site blocks automated clients); verify the terms before reuse.
  - Role: primary. Gap closed: The vocabulary of weights, activations, pathways and nodes that the rest of the interpretability literature assumes.
  - Laboratory work: Pathway decomposition of a single attention head.
- **Towards Automated Circuit Discovery for Mechanistic Interpretability** — Arthur Conmy, Augustine N. Mavor-Parker, Aengus Lynch, Stefan Heimersheim, Adrià Garriga-Alonso (2023). arXiv:2304.14997 [cs.LG].
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The activation-patching algorithm, which is the causal test that distinguishes an explanation from a correlation.
  - Laboratory work: Activation patching and the faithfulness score; Edge attribution scores.
- **Sparse Autoencoders Find Highly Interpretable Features in Language Models** — Hoagy Cunningham, Aidan Ewart, Logan Riggs, Robert Huben, Lee Sharkey (2023). arXiv:2309.08600 [cs.LG] / ICLR 2024.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: How superposition is resolved in practice: a sparse dictionary over activations.
  - Laboratory work: Training a sparse autoencoder on a tiny residual stream; L0 sparsity and reconstruction error; Feature splitting and absorption.
- **In-context Learning and Induction Heads** — Catherine Olsson, Nelson Elhage, Neel Nanda, Nicholas Joseph, Nova DasSarma, Tom Henighan, Ben Mann, Amanda Askell and 18 others (2022). arXiv:2209.11895 [cs.LG].
  - Licence: CC BY 4.0 (as stated on the arXiv record).
  - Role: supporting. Gap closed: The residual-stream framework was described but the composition of two heads into a circuit was never built.
  - Laboratory work: The two-head induction circuit, and the ablation of the previous-token head.
- **Interpretability in the Wild: a Circuit for Indirect Object Identification in GPT-2 small** — Kevin Wang, Alexandre Variengien, Arthur Conmy, Buck Shlegeris, Jacob Steinhardt (2022). arXiv:2211.00593 [cs.LG] / ICLR 2023.
  - Licence: CC BY 4.0 (as stated on the arXiv record).
  - Role: supporting. Gap closed: Patching was taught on a toy graph; the name-mover circuit is the published case the procedure generalises to.
  - Laboratory work: The four-step workflow applied to the published IOI circuit.

### Data Lab

*Status: built.*

- **DataComp: In search of the next generation of multimodal datasets** — Samir Yitzhak Gadre, Gabriel Ilharco, Alex Fang, Jonathan Hayase, Georgios Smyrnis, Thao Nguyen, Ryan Marten, Mitchell Wortsman and 26 others (2023). arXiv:2304.14108 [cs.CV] / NeurIPS 2023 Datasets and Benchmarks.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: Data is half the story of modern training and is entirely absent from the collection. This paper is also a full curriculum for data curation.
  - Laboratory work: A full filtering pipeline as a benchmark; Per-filter ablation curves; Why CLIP filtering works.
- **DataComp-LM: In search of the next generation of training sets for language models** — Jeffrey Li, Alex Fang, Georgios Smyrnis, Maor Ivgi, Matt Jordan, Samir Gadre, Hritik Bansal, Etash Guha and 51 others (2024). arXiv:2406.11794 [cs.CL] / NeurIPS 2024.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The language-model counterpart, with the data-quality trade-off measured against compute.
  - Laboratory work: Quality versus quantity under a fixed compute budget.
- **The RefinedWeb Dataset for Falcon LLM: Outperforming Curated Corpora with Web Data, and Web Data Only** — Guilherme Penedo, Quentin Malartic, Daniel Hesslow, Ruxandra Cojocaru, Alessandro Cappelli, Hamza Alobeidli, Baptiste Pannier, Ebtesam Almazrouei and 1 others (2023). arXiv:2306.01116 [cs.CL].
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The complete Midas-style pipeline with ablations for every filtering stage.
  - Laboratory work: Per-stage filtering ablations; Midas and perplexity filtering; Deduplication with exact, fuzzy and MinHash methods.
- **DoReMi: Optimizing Data Mixtures Speeds Up Language Model Pretraining** — Sang Michael Xie, Hieu Pham, Xuanyi Dong, Nan Du, Hanxiao Liu, Yifeng Lu, Percy Liang, Quoc V. Le and 2 others (2023). arXiv:2305.10429 [cs.LG] / NeurIPS 2023.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The mixture is a policy over domains, and it can be optimised against a small proxy model.
  - Laboratory work: Group-DRO as a data-mixture objective; The proxy-model extrapolation step.
- **Dolma: an Open Corpus of Three Trillion Tokens for Language Model Pretraining Research** — Luca Soldaini, Rodney Kinney, Akshita Bhagia, Dustin Schwenk, David Atkinson, Russell Authur, Ben Bogin, Khyathi Chandu and 28 others (2024). arXiv:2402.00159 [cs.CL].
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: supporting. Gap closed: What a fully open corpus looks like, and the decontamination procedure it needs.
  - Laboratory work: Decontamination against a benchmark.
- **The Pile: An 800GB Dataset of Diverse Text for Language Modeling** — Leo Gao, Stella Biderman, Sid Black, Laurence Golding, Travis Hoppe, Charles Foster, Jason Phang, Horace He and 4 others (2020). arXiv:2101.00027 [cs.CL].
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: supporting. Gap closed: The component-dataset view of a corpus, and the basis for mixture experiments.
  - Laboratory work: Per-component mixture ablations.
- **The Curse of Recursion: Training on Generated Data Makes Models Forget** — Ilia Shumailov, Zakhar Shumaylov, Yiren Zhao, Yarin Gal, Nicolas Papernot, Ross Anderson (2024). arXiv:2305.17493 [cs.LG] / Nature 2024.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The model-collapse chapter of the agentic course has no experiment behind it. This one does, and it is small enough to reproduce.
  - Laboratory work: The recursive training loop at toy scale; The tail-mass argument, computed.

### Scaling Lab

*Status: built.*

- **Scaling Laws for Neural Language Models** — Jared Kaplan, Sam McCandlish, Tom Henighan, Tom B. Brown, Benjamin Chess, Rewon Child, Scott Gray, Alec Radford and 2 others (2020). arXiv:2001.08361 [cs.CL].
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: Scaling laws are one lesson in two courses. They are the quantitative spine of the field and deserve their own application.
  - Laboratory work: Fitting power laws to loss curves; The compute-optimal allocation; Crossover points between model size and data.
- **Training Compute-Optimal Large Language Models** — Jordan Hoffmann, Sebastian Borgeaud, Arthur Mensch, Elena Buchatskaya, Trevor Cai, Eliza Rutherford, Diego de Las Casas, Lisa Anne Hendricks and 14 others (2022). arXiv:2203.15556 [cs.CL] / NeurIPS 2022.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The compute-optimal result and the IsoFLOP methodology that produced it.
  - Laboratory work: IsoFLOP curves; The 20 tokens-per-parameter rule, rederived; What happens when the data runs out.
- **Beyond neural scaling laws: beating power law scaling via data pruning** — Ben Sorscher, Robert Geirhos, Shashank Shekhar, Surya Ganguli, Ari S. Morcos (2022). arXiv:2206.14486 [cs.LG] / NeurIPS 2022 Outstanding Paper.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The result that breaks the power law, with a theory that can be checked on real data.
  - Laboratory work: The percolation prediction; Pruning metric benchmarking.
- **Scaling Data-Constrained Language Models** — Niklas Muennighoff, Alexander M. Rush, Boaz Barak, Teven Le Scao, Aleksandra Piktus, Nouamane Tazi, Sampo Pyysalo, Thomas Wolf and 1 others (2023). arXiv:2305.16264 [cs.CL] / NeurIPS 2023.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The regime the field is actually in: repeated epochs over a fixed corpus.
  - Laboratory work: The three-phase scaling curve; How many epochs before repetition dominates.
- **Are Emergent Abilities of Large Language Models a Mirage?** — Rylan Schaeffer, Brando Miranda, Sanmi Koyejo (2023). arXiv:2304.15004 [cs.CL] / NeurIPS 2023.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: Whether abilities appear discontinuously is a measurement question, and this shows it is often an artefact of the metric.
  - Laboratory work: The metric-artefact effect, reproduced; Discontinuous metric versus continuous underlying performance.
- **Compute Trends Across Three Eras of Machine Learning** — Jaime Sevilla, Lennart Heim, Anson Ho, Tamay Besiroglu, Marius Hobbhahn, Pablo Villalobos (2022). arXiv:2202.05924 [cs.LG] / ICLR 2022 Workshop on ML for Systems.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: supporting. Gap closed: The hardware trend that makes the compute curves mean something.
  - Laboratory work: Hardware capability over time.

### Systems Lab

*Status: built.*

- **FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness** — Tri Dao, Daniel Y. Fu, Stefano Ermon, Atri Rudra, Christopher Ré (2022). arXiv:2205.14135 [cs.LG] / NeurIPS 2022.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The efficiency course covers a KV-cache laboratory but not where the arithmetic actually goes.
  - Laboratory work: Attention FLOPs versus attention memory; The IO-bound wall and tiling; Arithmetic intensity of an attention kernel.
- **Efficient Memory Management for Large Language Model Serving with PagedAttention** — Woosuk Kwon, Zhuohan Li, Siyuan Zhuang, Ying Sheng, Lianmin Zheng, Cody Hao Yu, Joseph E. Gonzalez, Hao Zhang and 1 others (2023). arXiv:2309.06180 [cs.DC] / SOSP 2023.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: Serving is a memory-allocation problem, and the page-table trick is the standard answer.
  - Laboratory work: KV-cache fragmentation; The copy-on-write branch; Throughput as a function of batch size.
- **Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer** — Noam Shazeer, Azalia Mirhoseini, Krzysztof Maziarz, Andy Davis, Quoc Le, Geoffrey Hinton, Jeff Dean (2017). arXiv:1701.06538 [cs.LG] / ICLR 2017.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: Sparse capacity is the main reason parameter counts stopped predicting quality.
  - Laboratory work: Routing and load balance; The capacity factor and what happens when it is exceeded.
- **GShard: Scaling Giant Models with Conditional Computation and Automatic Sharding** — Dmitry Lepikhin, HyoukJoong Lee, Yuanzhong Xu, Dehao Chen, Orhan Firat, Yanping Huang, Maxim Krikun, Noam Shazeer and 1 others (2020). arXiv:2006.16668 [cs.LG] / ICLR 2021.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: Sparse capacity: the top-k router, the capacity factor that bounds it, the tokens that overflow it, and the auxiliary loss that keeps the experts evenly used.
  - Laboratory work: The router and the capacity factor; The auxiliary loss.
- **Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity** — William Fedus, Barret Zoph, Noam Shazeer (2021). arXiv:2101.03961 [cs.LG] / JMLR 2022.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: supporting. Gap closed: The simplification of MoE routing that made it trainable at scale.
  - Laboratory work: Simplified routing and the loss spike it removes.
- **SmoothQuant: Accurate and Efficient Post-Training Quantization for Large Language Models** — Guangxuan Xiao, Ji Lin, Mickael Seznec, Hao Wu, Julien Demouth, Song Han (2023). arXiv:2211.10438 [cs.LG] / ICML 2023.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: Quantisation is the standard memory saving and the reason activations, not weights, are the hard part.
  - Laboratory work: Per-tensor versus per-channel quantisation error; The outlier channel and the smoothing transformation.
- **SpecInfer: Accelerating Generative Large Language Model Serving with Tree-based Speculative Inference and Verification** — Xupeng Miao, Gabriele Oliaro, Zhihao Zhang, Xinhao Cheng, Zeyu Wang, Zhengxin Zhang, Rae Ying Yee Wong, Alan Zhu and 7 others (2023). arXiv:2305.09781 [cs.DC] / ICASSP 2024.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: Speculative decoding turns a memory-bound decode loop into a batched verification, and the acceptance rate is a computable quantity.
  - Laboratory work: Acceptance rate and the speed-up it buys; The tree variant and its cost.
- **Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads** — Tianle Cai, Yuhong Li, Zhengyang Geng, Hongwu Peng, Jason D. Lee, Deming Chen, Tri Dao (2024). arXiv:2401.10774 [cs.CL] / ICML 2024.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: supporting. Gap closed: Draft-model-free speculation: the acceptance test is a set of heads, not a second model.
  - Laboratory work: Multi-head drafting and its acceptance rate.
- **LoRA: Low-Rank Adaptation of Large Language Models** — Edward J. Hu, Yelong Shen, Phillip Wallis, Zeyuan Allen-Zhu, Yuanzhi Li, Shean Wang, Lu Wang, Weizhu Chen (2021). arXiv:2106.09685 [cs.CL] / ICLR 2022.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: supporting. Gap closed: The adaptation method every fine-tuning course now teaches.
  - Laboratory work: Rank r and the number of trainable parameters.
- **QLoRA: Efficient Finetuning of Quantized LLMs** — Tim Dettmers, Artidoro Pagnoni, Ari Holtzman, Luke Zettlemoyer (2023). arXiv:2305.14314 [cs.CL] / NeurIPS 2023.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: supporting. Gap closed: Combining quantisation with low-rank adaptation, which is how a single GPU fine-tunes a large model.
  - Laboratory work: Memory budget of a QLoRA fine-tune.

### Reinforcement Learning Foundations

*Status: built.*

- **Reinforcement Learning: An Introduction (second edition)** — Richard S. Sutton, Andrew G. Barto (2018). MIT Press; the authors publish the complete PDF free.
  - Licence: The book is distributed free of charge by the authors for personal use. The machine-check could not be completed from this environment (TLS trust failure on the host); the canonical page is incompleteideas.net/book/the-book-2nd.html.
  - Role: primary. Gap closed: The agentic course uses reinforcement learning loosely. Nothing in the collection defines an MDP, a value function or a policy gradient.
  - Laboratory work: A tabular gridworld with exact value iteration; Policy gradients checked against finite differences; The actor-critic loop.
- **Spinning Up in Deep RL** — OpenAI (2019). Online course and reference implementations.
  - Licence: MIT (verified via the GitHub API for openai/spinningup, 2026-10-19)
  - Role: primary. Gap closed: A derivation-first path from the policy gradient theorem to the algorithms in use, with runnable reference code.
  - Laboratory work: Deriving the simplest policy gradient; Reward-to-go and the variance it removes.
- **Asymptotic Confidence Bounds for the Monte Carlo Estimation of the Value Function: A Bootstrap Approach** — Gert Williams, Christopher J. C. Burges (1990). Machine Learning 8, 375–389.
  - Licence: Springer article. Bibliographic reference only; the text is not redistributed. The λ-return estimator it generalises is implemented from the published definition in the course.
  - Role: supporting. Gap closed: The variance–bias trade-off in the advantage estimate.
  - Laboratory work: The bias and variance of the λ-return as a function of λ.

### Retrieval Lab

*Status: built.*

- **Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks** — Patrick Lewis, Ethan Perez, Aleksandra Piktus, Fabio Petroni, Vladimir Karpukhin, Naman Goyal, Heinrich Küttler, Mike Lewis and 4 others (2020). arXiv:2005.11401 [cs.CL] / NeurIPS 2020.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: Retrieval is one laboratory in the agentic course. The retrieval stack has four distinct layers, each with its own failure mode.
  - Laboratory work: Parametric versus non-parametric memory; The three query and document encoders.
- **Dense Passage Retrieval for Open-Domain Question Answering** — Vladimir Karpukhin, Barlas Oğuz, Sewon Min, Patrick Lewis, Ledell Wu, Sergey Edunov, Danqi Chen, Wen-tau Yih (2020). arXiv:2004.04906 [cs.CL] / EMNLP 2020.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: Dense retrieval is the mechanism that replaced exact lexical matching, and its failure mode is different.
  - Laboratory work: A bi-encoder over a toy corpus; Recall as a function of embedding dimension.
- **ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction over BERT** — Omar Khattab, Matei Zaharia (2020). arXiv:2004.12832 [cs.IR] / SIGIR 2020.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: Late interaction is the third way to score a query against a document, and it sits between lexical and dense.
  - Laboratory work: MaxSim scoring; Why late interaction beats both endpoints on multi-hop questions.
- **Lost in the Middle: How Language Models Use Long Contexts** — Nelson F. Liu, Kevin Lin, John Hewitt, Ashwin Paranjape, Michele Bevilacqua, Fabio Petroni, Percy Liang (2023). arXiv:2307.03172 [cs.CL] / TACL 2024.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: Long context is treated as a capacity problem in the foundations course. It is also a position problem.
  - Laboratory work: Accuracy as a function of the position of the evidence.

### Agent Benchmark Lab

*Status: built.*

- **SWE-bench: Can Language Models Resolve Real-World GitHub Issues?** — Carlos E. Jimenez, John Yang, Alexander Wettig, Shunyu Yao, Kexin Pei, Ofir Press, Karthik Narasimhan (2023). arXiv:2310.06770 [cs.SE] / ICLR 2024.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The agentic course has a case study but no benchmark-design lesson, and benchmark design is where most agent claims are won or lost.
  - Laboratory work: The test-based verification harness; Resolution rate as a function of file size; The agentless baseline.
- **GAIA: a benchmark for General AI Assistants** — Grégoire Mialon, Clémentine Fourrier, Craig Swift, Thomas Wolf, Yann LeCun, Thomas Scialom (2023). arXiv:2311.12983 [cs.AI] / ICLR 2024.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: A benchmark designed around the question: can a general assistant do the easy part of a task and the hard part with the right tools?
  - Laboratory work: The three question levels; Question difficulty versus tool count.
- **AgentBench: Evaluating LLMs as Agents** — Xiao Liu, Hao Yu, Hanchen Zhang, Yifan Xu, Xuanyu Lei, Hanyu Lai, Yu Gu, Hangliang Ding and 14 others (2023). arXiv:2308.03688 [cs.AI] / ICLR 2024.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: Eight environments, and the finding that a score is only meaningful relative to a matched model size.
  - Laboratory work: Cross-environment score profiles; Why a single average hides the failure modes.
- **WebArena: A Realistic Web Environment for Building Autonomous Agents** — Shuyan Zhou, Frank F. Xu, Hao Zhu, Xuhui Zhou, Robert Lo, Abishek Sridhar, Xianyi Cheng, Tianyue Ou and 4 others (2023). arXiv:2307.13854 [cs.AI] / ICLR 2024.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: supporting. Gap closed: Self-hosted reproducible environments, which is what makes an agent benchmark trustworthy.
  - Laboratory work: Reproducibility as a benchmark property.
- **$\tau$-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains** — Shunyu Yao, Noah Shinn, Pedram Razavi, Karthik Narasimhan (2024). arXiv:2406.12045 [cs.CL] / ICLR 2025.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: supporting. Gap closed: A user simulator in the loop, which changes what the benchmark is actually measuring.
  - Laboratory work: Pass^k: reliability across repeated trials rather than a single pass rate.

### Safety and Alignment Lab

*Status: built.*

- **Constitutional AI: Harmlessness from AI Feedback** — Yuntao Bai, Saurav Kadavath, Sandipan Kundu, Amanda Askell, Jackson Kernion, Andy Jones, Anna Chen, Anna Goldie and 43 others (2022). arXiv:2212.08073 [cs.CL] / Anthropic.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The alignment module in the foundations course is two lessons wide. This is the method the rest of the field cites when it says 'principled'.
  - Laboratory work: The critique-and-revise loop; Self-critique versus external critique.
- **Training a Helpful and Harmless Assistant with Reinforcement Learning from Human Feedback** — Yuntao Bai, Andy Jones, Kamal Ndousse, Amanda Askell, Anna Chen, Nova DasSarma, Dawn Drain, Stanislav Fort and 23 others (2022). arXiv:2204.05862 [cs.CL] / Anthropic.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The origin of the helpful and harmless preference data, and of the round-two iterated pipeline.
  - Laboratory work: The two-round alignment procedure.
- **Red Teaming Language Models with Language Models** — Ethan Perez, Saffron Huang, Francis Song, Trevor Cai, Roman Ring, John Aslanides, Amelia Glaese, Nat McAleese and 1 others (2022). arXiv:2202.03286 [cs.CL] / EMNLP 2022.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: Red teaming is a search problem, and the search is over prompts.
  - Laboratory work: The red-teaming search loop; Discovery rate against a search budget.
- **Sleeper Agents: Training Deceptive LLMs that Persist Through Safety Training** — Evan Hubinger, Carson Denison, Jesse Mu, Mike Lambert, Meg Tong, Monte MacDiarmid, Tamera Lanham, Daniel M. Ziegler and 31 others (2024). arXiv:2401.05566 [cs.LG] / ICML 2024.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The clearest demonstration that alignment training can be undone by training, and that the harm is conditional.
  - Laboratory work: Conditional behaviour that a safety classifier misses.
- **Towards Understanding Sycophancy in Language Models** — Mrinank Sharma, Meg Tong, Tomasz Korbak, David Duvenaud, Amanda Askell, Samuel R. Bowman, Newton Cheng, Esin Durmus and 11 others (2023). arXiv:2310.13548 [cs.CL] / ICLR 2024.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: A measurable, mechanical version of flattery, driven by the training signal rather than by character.
  - Laboratory work: The human-feedback consistency preference and what it rewards.
- **Extracting Training Data from Large Language Models** — Nicholas Carlini, Florian Tramer, Eric Wallace, Matthew Jagielski, Ariel Herbert-Voss, Katherine Lee, Adam Roberts, Tom Brown and 4 others (2020). arXiv:2012.07805 [cs.CR] / USENIX Security 2021.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: Memorisation is the privacy story, and it is measurable with an attack rather than a survey.
  - Laboratory work: A membership-inference attack against a toy model; Extraction accuracy against duplication rate.

### Multimodal Lab

*Status: built.*

- **Learning Transferable Visual Models From Natural Language Supervision** — Alec Radford, Jong Wook Kim, Chris Hallacy, Aditya Ramesh, Gabriel Goh, Sandhini Agarwal, Girish Sastry, Amanda Askell and 4 others (2021). arXiv:2103.00020 [cs.CV] / ICML 2021.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: Nothing in the collection handles a second modality at all.
  - Laboratory work: The contrastive loss and its temperature; Zero-shot classification as a text-embedding lookup.
- **Flamingo: a Visual Language Model for Few-Shot Learning** — Jean-Baptiste Alayrac, Jeff Donahue, Pauline Luc, Antoine Miech, Iain Barr, Yana Hasson, Karel Lenc, Arthur Mensch and 19 others (2022). arXiv:2204.14198 [cs.CV] / NeurIPS 2022.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: Few-shot learning with interleaved images and text, and the Perceiver resampler that makes it cheap.
  - Laboratory work: The resampler and why it bounds the visual token count.
- **Visual Instruction Tuning** — Haotian Liu, Chunyuan Li, Qingyang Wu, Yong Jae Lee (2023). arXiv:2304.08485 [cs.CV] / NeurIPS 2023.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: primary. Gap closed: The recipe that turned a vision encoder plus a language model into a chat model, with almost no new parameters.
  - Laboratory work: The projection matrix and its dimension; Generating instruction data from captions.
- **Sigmoid Loss for Language Image Pre-Training** — Xiaohua Zhai, Basil Mustafa, Alexander Kolesnikov, Lucas Beyer (2023). arXiv:2303.15343 [cs.CV] / ICCV 2023.
  - Licence: CC BY 4.0 (as stated on the arXiv record).
  - Role: supporting. Gap closed: The contrastive loss normalised over the batch; the pairwise sigmoid loss is the later alternative, and the coupling experiment measures the difference.
  - Laboratory work: The softmax and the sigmoid loss side by side; The coupling experiment: an appended pair moves one loss and not the other; The bias that matches a batch.
- **BLIP-2: Bootstrapping Language-Image Pre-training with Frozen Image Encoders and Large Language Models** — Junnan Li, Dongxu Li, Silvio Savarese, Steven Hoi (2023). arXiv:2301.12597 [cs.CV] / ICML 2023.
  - Licence: CC BY 4.0 (as stated on the arXiv record).
  - Role: supporting. Gap closed: Nothing in the collection showed a frozen-encoder bridge, or priced what is trained against what is held still.
  - Laboratory work: Learned queries over patch tokens; The trainable share of a frozen bridge.
- **An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale** — Alexey Dosovitskiy, Lucas Beyer, Alexander Kolesnikov, Dirk Weissenborn, Xiaohua Zhai, Thomas Unterthiner, Mostafa Dehghani, Matthias Minderer and 4 others (2020). arXiv:2010.11929 [cs.CV] / ICLR 2021.
  - Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.
  - Role: supporting. Gap closed: The patch embedding that turns an image into tokens was assumed, never shown.
  - Laboratory work: The patch token as the input to the frozen bridge.

## Licence policy

No application redistributes a textbook PDF, a paper PDF, a figure, a dataset or third-party code. Applications cite the source and link to it. The three course applications already in this collection set that rule: llm-foundations-lab releases course material under CC BY-NC 4.0 because its textbook is CC BY-NC 4.0, agentic-ai-academy releases under MIT because its textbook is CC0, and deep-learning-theory-explorer cites a copyrighted monograph without redistributing it.

An arXiv licence is attached to a specific submission. Cite a version, check that version, and re-check before publishing.

Every application credits the authors on the landing page, in the footer, on the sources page and on every lesson that draws on the work.

## Verification

Every entry records how its identifier was checked and when:

- `arxiv-abs` — The citation_title meta tag was read from https://arxiv.org/abs/<id> and compared with the title recorded here.
- `github-api` — The SPDX licence identifier was read from https://api.github.com/repos/<owner>/<repo>.
- `http-head` — The URL was requested and the status code recorded.
- `manual` — The source is well known but could not be machine-checked from this environment (bot protection, TLS trust or rate limiting).

Re-run the check at any time:

```bash
node scripts/validate-sources.mjs            # structural checks
node scripts/validate-sources.mjs --verify   # also re-check every arXiv title live
```

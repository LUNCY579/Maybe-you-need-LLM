/**
 * What this course shares with the rest of the collection.
 *
 * This file is generated. `tools/readCollection.mjs` writes it from the
 * collection's own catalogue, and the build runs that script, so it cannot
 * fall behind the collection it describes.
 *
 * Do not edit it by hand. Edit the collection's catalogue and run:
 *
 *   node tools/readCollection.mjs
 */

/** A course in the collection. */
export interface CollectionCourse {
  id: string
  title: string
  /** The modules the course is made of. */
  modules: string[]
  /** One line: what the course is about. */
  summary: string
}

/** A course that builds on this one, and why. */
export interface CollectionSuccessor extends CollectionCourse {
  /** Why this course comes after this one. */
  reason: string
}

/** An idea the collection teaches in more than one place. */
export interface CollectionConcept {
  id: string
  term: string
  summary: string
  /** The other courses that teach it. */
  alsoIn: string[]
}

export const COLLECTION_COURSES: CollectionCourse[] = [
  {
    "id": "llm-foundations-lab",
    "title": "LLM Foundations Lab",
    "modules": [
      "Pre-training",
      "Generative Models",
      "Prompting",
      "Alignment",
      "Inference",
      "Reasoning"
    ],
    "summary": "What a language model is, what it is trained on, and how it is steered."
  },
  {
    "id": "agentic-ai-academy",
    "title": "Agentic AI Academy",
    "modules": [
      "Language Modeling",
      "Reasoning",
      "Agents",
      "Tools and Assistants",
      "Behavior and Cognition",
      "Advanced Topics",
      "Conclusion"
    ],
    "summary": "The layer above the model: memory, tools, planning and action."
  },
  {
    "id": "deep-learning-theory-explorer",
    "title": "Deep Learning Theory Explorer",
    "modules": [
      "Initialization",
      "Signal Propagation",
      "Kernel Recursion",
      "Fluctuations",
      "RG Flow",
      "Criticality",
      "Universality",
      "Bayesian Learning",
      "NTK",
      "Representation Learning"
    ],
    "summary": "Why generalisation happens at all, and what the theory says about it."
  },
  {
    "id": "diffusion-lab",
    "title": "Diffusion Lab",
    "modules": [
      "The Forward Process",
      "The Reverse Process",
      "Noise Schedules",
      "Latent Diffusion",
      "Guidance",
      "The Design Space"
    ],
    "summary": "Generative modelling, where the training objective is the noise itself."
  },
  {
    "id": "evaluation-lab",
    "title": "Evaluation Lab",
    "modules": [
      "Judging with a Model",
      "The Biases of a Judge",
      "Human Agreement",
      "Arena Rankings",
      "Benchmark Design",
      "Measurement"
    ],
    "summary": "How language models are evaluated, and how the numbers are gamed."
  },
  {
    "id": "rlhf-lab",
    "title": "RLHF Lab",
    "modules": [
      "Policy Gradients",
      "Trust Regions",
      "Proximal Policy Optimization",
      "The KL Penalty",
      "The N+ Details",
      "Reward Overoptimisation"
    ],
    "summary": "The alignment recipe, and what the details of the implementation do."
  },
  {
    "id": "lm-from-scratch",
    "title": "Language Model from Scratch",
    "modules": [
      "Tokenisation",
      "The Architecture",
      "Resource Accounting",
      "Systems and Parallelism",
      "Data",
      "Training and Evaluation"
    ],
    "summary": "The transformer, the tokeniser and the optimiser, each built from nothing."
  },
  {
    "id": "mech-interp-lab",
    "title": "Mechanistic Interpretability Lab",
    "modules": [
      "Superposition",
      "Features, Not Neurons",
      "Patching",
      "Circuits",
      "Composition"
    ],
    "summary": "What a model computes, and how you would know."
  },
  {
    "id": "data-lab",
    "title": "Data Lab",
    "modules": [
      "Sources",
      "Filtering",
      "Deduplication",
      "Mixtures",
      "Collapse"
    ],
    "summary": "The data, and what it does to the model."
  },
  {
    "id": "scaling-lab",
    "title": "Scaling Lab",
    "modules": [
      "Power Laws",
      "Compute Optimality",
      "Data Constraints",
      "Emergence"
    ],
    "summary": "How the loss falls, and what follows from it."
  },
  {
    "id": "systems-lab",
    "title": "Systems Lab",
    "modules": [
      "Attention Memory",
      "The KV Cache",
      "Sparse Capacity",
      "Speculation"
    ],
    "summary": "Where the time and the memory go, and what the hardware does with them."
  },
  {
    "id": "rl-foundations",
    "title": "Reinforcement Learning Foundations",
    "modules": [
      "The MDP",
      "Value functions",
      "Policy gradients",
      "Actor–critic"
    ],
    "summary": "What an agent is trying to do, and how you would check the answer."
  },
  {
    "id": "retrieval-lab",
    "title": "Retrieval Lab",
    "modules": [
      "Sparse Retrieval",
      "Dense Retrieval",
      "Late Interaction",
      "The Long Context"
    ],
    "summary": "Finding the document that answers the question."
  },
  {
    "id": "agent-bench-lab",
    "title": "Agent Benchmark Lab",
    "modules": [
      "Task Design",
      "Verification",
      "The Baselines",
      "Variance and Contamination"
    ],
    "summary": "What a benchmark actually measures, and how precisely it is known."
  },
  {
    "id": "safety-lab",
    "title": "Safety and Alignment Lab",
    "modules": [
      "Harmlessness from AI Feedback",
      "Red Teaming",
      "Sycophancy",
      "Privacy"
    ],
    "summary": "How a harmlessness claim is measured, and what the measurement is worth."
  },
  {
    "id": "multimodal-lab",
    "title": "Multimodal Lab",
    "modules": [
      "Contrastive Pretraining",
      "The Modality Gap",
      "Instruction Tuning",
      "The Loss and the Bridge"
    ],
    "summary": "Two modalities, one space, and the gap between them."
  }
]

export const COLLECTION_NEXT: CollectionSuccessor[] = []

export const COLLECTION_SHARED_CONCEPTS: CollectionConcept[] = [
  {
    "id": "interpretability",
    "term": "Interpretability",
    "summary": "The attempt to say what a model computes, in terms a person can check.",
    "alsoIn": [
      "mech-interp-lab",
      "llm-foundations-lab"
    ]
  },
  {
    "id": "agent-loop",
    "term": "The agent loop",
    "summary": "The cycle of observation, thought, action and observation again.",
    "alsoIn": [
      "rlhf-lab"
    ]
  },
  {
    "id": "retrieval",
    "term": "Retrieval",
    "summary": "Finding the documents that are worth reading.",
    "alsoIn": [
      "retrieval-lab",
      "llm-foundations-lab"
    ]
  }
]

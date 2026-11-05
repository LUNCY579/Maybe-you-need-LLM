/**
 * A real dataset: the opening of *Moby-Dick*.
 *
 * The laboratory on tokenisation uses a generated corpus for the merge
 * procedure, because a generated corpus has a structure you can point at. It
 * also uses this: a real book, in real English, with the spelling and the
 * punctuation of its edition. The two are there to be compared — a tokeniser
 * that only ever sees `word17 word3` learns nothing about how a tokeniser
 * behaves on a text somebody actually wrote.
 *
 * The text is Herman Melville's, published in 1851 and in the public domain.
 * This excerpt is Chapter 1, "Loomings", reflowed to one line per paragraph,
 * from the Project Gutenberg electronic edition (eBook #2701). Project
 * Gutenberg's licence covers its electronic edition; the underlying text is
 * public domain. The provenance is repeated in `src/content/sources.ts`.
 */

export interface RealDocument {
  /** The paragraph's position in the chapter. */
  id: number
  title: string
  text: string
}

export const REAL_DATASET = {
  title: 'Moby-Dick; or, The Whale — Chapter 1, “Loomings”',
  author: 'Herman Melville',
  year: 1851,
  edition: 'Project Gutenberg eBook #2701',
  url: 'https://www.gutenberg.org/ebooks/2701',
  licence: 'Public domain in the United States',
  note: 'The first five paragraphs, reflowed to one line per paragraph.',
  documents: [
    'Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen and regulating the circulation. Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul; whenever I find myself involuntarily pausing before coffin warehouses, and bringing up the rear of every funeral I meet; and especially whenever my hypos get such an upper hand of me, that it requires a strong moral principle to prevent me from deliberately stepping into the street, and methodically knocking people’s hats off—then, I account it high time to get to sea as soon as I can. This is my substitute for pistol and ball. With a philosophical flourish Cato throws himself upon his sword; I quietly take to the ship. There is nothing surprising in this. If they but knew it, almost all men in their degree, some time or other, cherish very nearly the same feelings towards the ocean with me.',
    'There now is your insular city of the Manhattoes, belted round by wharves as Indian isles by coral reefs—commerce surrounds it with her surf. Right and left, the streets take you waterward. Its extreme downtown is the battery, where that noble mole is washed by waves, and cooled by breezes, which a few hours previous were out of sight of land. Look at the crowds of water-gazers there.',
    'Circumambulate the city of a dreamy Sabbath afternoon. Go from Corlears Hook to Coenties Slip, and from thence, by Whitehall, northward. What do you see?—Posted like silent sentinels all around the town, stand thousands upon thousands of mortal men fixed in ocean reveries. Some leaning against the spiles; some seated upon the pier-heads; some looking over the bulwarks of ships from China; some high aloft in the rigging, as if striving to get a still better seaward peep. But these are all landsmen; of week days pent up in lath and plaster—tied to counters, nailed to benches, clinched to desks. How then is this? Are the green fields gone? What do they here?',
    'But look! here come more crowds, pacing straight for the water, and seemingly bound for a dive. Strange! Nothing will content them but the extremest limit of the land; loitering under the shady lee of yonder warehouses will not suffice. No. They must get just as nigh the water as they possibly can without falling in. And there they stand—miles of them—leagues. Inlanders all, they come from lanes and alleys, streets and avenues—north, east, south, and west. Yet here they all unite. Tell me, does the magnetic virtue of the needles of the compasses of all those ships attract them thither?',
    'Once more. Say you are in the country; in some high land of lakes. Take almost any path you please, and ten to one it carries you down in a dale, and leaves you there by a pool in the stream. There is magic in it. Let the most absent-minded of men be plunged in his deepest reveries—stand that man on his legs, set his feet a-going, and he will infallibly lead you to water, if water there be in all that region. Should you ever be athirst in the great American desert, try this experiment, if your caravan happen to be supplied with a metaphysical professor. Yes, as every one knows, meditation and water are wedded for ever.',
  ],
} as const

/** The excerpt as documents, each paragraph its own document. */
export function realDocuments(): RealDocument[] {
  return REAL_DATASET.documents.map((text, id) => ({
    id,
    title: `paragraph ${id + 1}`,
    text,
  }))
}

/** The whole excerpt as one string, with a blank line between paragraphs. */
export function datasetText(documents: RealDocument[] = realDocuments()): string {
  return documents.map((document) => document.text).join('\n\n')
}

export interface CorpusSplit {
  documents: RealDocument[]
  /** The characters in the split. */
  bytes: number
}

/**
 * Split the corpus into a training part and a validation part, by document.
 *
 * The split is by document rather than by character so that no sentence is
 * half in one split and half in the other. It is a toy split — five paragraphs
 * cannot support a real measurement — but it is the shape a real one has.
 */
export function splitCorpus(
  documents: RealDocument[],
  validationFraction: number,
): { training: CorpusSplit; validation: CorpusSplit } {
  const boundary = Math.max(1, Math.round(documents.length * (1 - validationFraction)))
  const training = documents.slice(0, boundary)
  const validation = documents.slice(boundary)
  return {
    training: { documents: training, bytes: datasetText(training).length },
    validation: { documents: validation, bytes: datasetText(validation).length },
  }
}

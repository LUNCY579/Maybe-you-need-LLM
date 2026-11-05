/**
 * The lesson guides.
 *
 * Each lesson has one idea that readers most often get wrong, and one question
 * they should be able to answer in their own words before moving on. This is
 * teaching material, not a summary of the paper: the misconception is stated
 * in the form it usually takes, and the self-check names the mechanism the
 * lesson is actually about.
 *
 * The content test requires a guide for every lesson, and no guide for a
 * lesson that does not exist.
 */

export interface LessonGuide {
  /** The form the mistake usually takes, in one or two sentences. */
  misconception: string
  /** A question to answer aloud, which the lesson's own numbers can settle. */
  selfCheck: string
}

export const GUIDES: Record<string, LessonGuide> = {
  'the-contrastive-objective': {
    misconception:
      'The negatives look chosen, and they are not: for an image in a batch of B, the other B − 1 captions are the negatives, and the loss is a cross-entropy over that row. Nothing in the objective is a margin, and nothing in it needs a class label — which is why the next lesson is about the batch rather than the data.',
    selfCheck:
      'Take the image in pair 3 of a batch of 8. Where do its seven negatives come from, and what would the same loss look like with a batch of one pair?',
  },
  'the-data-and-the-batch': {
    misconception:
      'More data and a larger batch are two different purchases. A larger batch gives more negatives per step and a lower-variance estimate of the same loss; more pairs give the encoders more variety to fit, which is a change in the data rather than in the estimator. The laboratory separates them, because the retrieval curves they produce are not the same curve.',
    selfCheck:
      'If you doubled the batch and halved the number of steps, which part of the objective changes, and which part of the data does not?',
  },
  'the-modality-gap': {
    misconception:
      'The gap is often read as a defect, and it is not: the two sets of embeddings sit in separate regions of the shared space, and the paired image and caption are still the closest pair. A retrieval can be perfect while every image is closer to other images than to its own caption, and that is exactly what the laboratory shows.',
    selfCheck:
      'How can the retrieval be correct when every image is nearer to the other images than to its caption?',
  },
  'zero-shot': {
    misconception:
      'Zero-shot does not mean without text. The class names are embedded with the text encoder, so the classifier is a lookup against a set of captions — and the prompt template is part of that set. Change the template and you have changed the classifier, which is why the laboratory reports the accuracy per template.',
    selfCheck:
      'When an image is classified into five classes, what exactly is compared with what, and where do the five text vectors come from?',
  },
  'the-instruction-recipe': {
    misconception:
      'The projection is usually described as if it turned an image into tokens. It does not: it is a learned linear map that changes the width of a visual token, not the number of tokens. The count is set earlier, by the encoder and the patch grid, and the bridge or the resampler is what bounds it later.',
    selfCheck:
      'Which stage teaches the model to read an image, and which stage teaches it to answer an instruction about one? What does the projection change?',
  },
  'the-alignment-tax': {
    misconception:
      'The tax is not forgetting, and it is not a defect of the method: it is the loss on the original task, measured before and after the tuning, on the same evaluation. A method can gain a great deal on instructions and still pay a large tax, and the ratio is the number to shop for rather than either quantity alone.',
    selfCheck:
      'What do you measure, on which task, before and after, to obtain the tax — and why does a gain on instructions not bound it?',
  },
  'the-sigmoid-loss': {
    misconception:
      'The sigmoid loss is not a softmax with a different temperature. It removes the normalisation over the batch entirely, so a pair’s loss no longer contains a term from every other pair, and it adds a bias whose initial value encodes the negative-to-positive ratio. That bias is what makes the loss work at the batch sizes the method is used at.',
    selfCheck:
      'Why does appending an unrelated pair leave one pair’s sigmoid loss unchanged while the softmax loss of its row moves?',
  },
  'the-frozen-bridge': {
    misconception:
      'Frozen means no gradient and no update — not unused. The frozen image encoder’s patch tokens are the input the learned queries read, so the encoder is doing all of the visual work; what is not trained is the encoder itself. For the same reason the trainable share is not the compute share.',
    selfCheck:
      'Which parameters receive a gradient in BLIP-2, and why does widening the bridge leave the frozen parameter count unchanged?',
  },
  'the-resampler': {
    misconception:
      'The resampler is not a truncation and not an average: it has a fixed set of learned latents that attend to every visual token, so one vector comes out per latent whatever the resolution. The bound is structural — the language model reads the latents, not the patches — and that is why it holds for more images as well as for larger ones.',
    selfCheck:
      'If the image resolution doubles, what happens to the number of tokens going into the resampler, and to the number coming out?',
  },
}

/** The guide for a lesson, if one is written. */
export function guideFor(lessonId: string): LessonGuide | undefined {
  return GUIDES[lessonId]
}

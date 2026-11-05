import {
  CriticalityFigure,
  FeatureDriftFigure,
  FluctuationFigure,
  GpPosteriorFigure,
  HelperFunctionFigure,
  LinearProfileFigure,
  NonGaussianityFigure,
  NtkClosedFormFigure,
  PowerLawFigure,
  SusceptibilityFigure,
} from './figures';

const FIGURES: Record<string, () => JSX.Element> = {
  criticality: CriticalityFigure,
  'linear-profile': LinearProfileFigure,
  'power-law': PowerLawFigure,
  fluctuation: FluctuationFigure,
  susceptibility: SusceptibilityFigure,
  'helper-function': HelperFunctionFigure,
  'non-gaussianity': NonGaussianityFigure,
  'ntk-closed-form': NtkClosedFormFigure,
  'feature-drift': FeatureDriftFigure,
  'gp-posterior': GpPosteriorFigure,
};

export const FIGURE_IDS = Object.keys(FIGURES);

/**
 * A live figure inside a lesson.
 *
 * The figure is a real computation, not an illustration: it calls the same
 * quadrature and recursion code the laboratories use, so the picture next to a
 * sentence and the numbers in the laboratory can never disagree.
 */
export function LessonFigure({ id }: { id: string }) {
  const Figure = FIGURES[id];
  if (!Figure) {
    return (
      <div className="my-3 rounded-md border border-signal-red/40 bg-signal-red/10 p-3 text-[12.5px] text-signal-red">
        Unknown lesson figure “{id}”.
      </div>
    );
  }
  return (
    <div className="my-4">
      <Figure />
    </div>
  );
}

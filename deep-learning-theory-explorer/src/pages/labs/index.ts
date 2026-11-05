import type { ComponentType } from 'react';
import { PhysicsLab } from './PhysicsLab';
import { InitializationLab } from './InitializationLab';
import { LandscapeLab } from './LandscapeLab';
import { WidthDepthLab } from './WidthDepthLab';
import { NtkLab } from './NtkLab';
import { RepresentationLab } from './RepresentationLab';
import { DrillsLab } from './DrillsLab';

/**
 * The laboratory screens, keyed by registry id.
 *
 * `src/content/labs.ts` says which laboratories exist and what each one
 * answers for; this is the other half of the join — the component that is
 * actually mounted. A registry entry without a key here is a link to nothing,
 * and a screen without a registry entry is a room with no door; both are
 * checked in `tests/lab-registry.test.ts`.
 */
export const LAB_SCREENS: Record<string, ComponentType> = {
  physics: PhysicsLab,
  initialization: InitializationLab,
  landscape: LandscapeLab,
  widthdepth: WidthDepthLab,
  ntk: NtkLab,
  representation: RepresentationLab,
  drills: DrillsLab,
};

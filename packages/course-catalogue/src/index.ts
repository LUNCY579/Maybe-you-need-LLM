export { CATALOGUE, default as catalogue } from './catalogue'
export {
  parseManifest,
  ManifestError,
  orderedApps,
  sourcesOfApp,
  appsOfSource,
  builtApps,
} from './manifest'
export type { CatalogueManifest, CatalogueApp, CatalogueSource, SourceKind } from './manifest'

export {
  LEARNING_PATH,
  startingCourses,
  nextCourses,
  prerequisitesOf,
  successorsOf,
  depthOf,
  layersOf,
  findPathCycle,
} from './paths'
export type { LearningPath, PathEdge } from './paths'

export { CONCEPTS, conceptsOfCourse, sharedConcepts, conceptById, overlapBetween } from './concepts'
export type { Concept } from './concepts'

export {
  buildCatalogueIndex,
  buildLessonIndex,
  searchCatalogue,
  collectionDocuments,
  CATALOGUE_SEARCH_OPTIONS,
} from './search'
export type { CatalogueDocument, CatalogueKind } from './search'

export { SharedConcepts } from './SharedConcepts'
export {
  CourseList,
  LearningPathView,
  PathEdges,
  ConceptIndex,
  SourceList,
  CatalogueSearch,
  CollectionLinks,
  courseSources,
} from './components'

import { Fragment, cloneElement, isValidElement, type ReactNode } from 'react'
import { findConceptMatches } from '../../content/concepts'
import { ConceptTerm } from './ConceptTerm'

/**
 * Automatic linking of course concepts inside lesson prose.
 *
 * A term is linked at its first mention in a section, the way a textbook
 * defines a term the first time it appears. Linking every mention would be
 * noise; linking none would leave the reader to hunt through the glossary.
 *
 * The walk descends into ordinary markup but leaves code, keyboard input and
 * preformatted text alone, because there a term is a literal token rather than
 * a concept being discussed.
 */
const SKIP_TAGS = new Set(['code', 'pre', 'kbd', 'samp', 'textarea'])

function annotateText(text: string, linked: Set<string>): ReactNode {
  const matches = findConceptMatches(text, linked)
  if (matches.length === 0) return text

  const pieces: ReactNode[] = []
  let cursor = 0
  matches.forEach((match, index) => {
    if (match.start > cursor) pieces.push(text.slice(cursor, match.start))
    pieces.push(
      <ConceptTerm key={`${match.id}-${index}`} id={match.id}>
        {text.slice(match.start, match.end)}
      </ConceptTerm>,
    )
    linked.add(match.id)
    cursor = match.end
  })
  if (cursor < text.length) pieces.push(text.slice(cursor))
  return <Fragment>{pieces}</Fragment>
}

/**
 * Walk a React tree and decorate the plain-text parts of it.
 *
 * `linked` accumulates the terms already annotated, so that each term is
 * linked once per section.
 */
export function annotateConcepts(node: ReactNode, linked: Set<string>): ReactNode {
  if (node === null || node === undefined || typeof node === 'boolean') return node
  if (typeof node === 'string') return annotateText(node, linked)
  if (typeof node === 'number') return node
  if (Array.isArray(node)) {
    return node.map((child, index) => (
      <Fragment key={index}>{annotateConcepts(child, linked)}</Fragment>
    ))
  }
  if (!isValidElement(node)) return node

  const type = node.type
  if (typeof type === 'string' && SKIP_TAGS.has(type)) return node

  const children = (node.props as { children?: ReactNode }).children
  if (children === undefined) return node

  const annotated = annotateConcepts(children, linked)
  if (annotated === children) return node
  return cloneElement(node, undefined, annotated)
}

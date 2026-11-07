import type { ReactNode } from 'react'

/**
 * The reading edition.
 *
 * Every course's compiled textbook ships with the hub, one directory over
 * from every course. These helpers turn a lesson into the address of its
 * own section in that book, so a reader can carry a lesson around — on a
 * train, on paper — and still be reading the same lesson.
 */

/** The books live beside the hub, which is where the collection's cross-links already point. */
export const TEXTBOOK_BASE = '../hub/textbooks/'

/**
 * The slug rule the textbook compiler applies to its headings, kept here so a
 * link made in the application lands on the heading the book printed.
 */
export function textbookSlug(text: string): string {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')

}

/** The address of one lesson inside its course's textbook. */
export function textbookLessonHref(
  appId: string,
  lesson: { number?: number; title: string },
): string {
  const heading =
    lesson.number === undefined ? lesson.title : `Lesson ${lesson.number}. ${lesson.title}`
  return `${TEXTBOOK_BASE}${appId}.html#${textbookSlug(heading)}`
}

/** The link itself, for a lesson page. */
export function TextbookLink({
  appId,
  lesson,
  children,
}: {
  appId: string
  lesson: { number?: number; title: string }
  children?: ReactNode
}): ReactNode {
  return (
    <p className="lesson-textbook">
      <a href={textbookLessonHref(appId, lesson)}>
        {children ?? 'This lesson in the textbook'} <span aria-hidden="true">→</span>
      </a>
    </p>
  )
}

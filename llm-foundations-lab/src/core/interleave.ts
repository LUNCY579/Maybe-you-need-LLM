/**
 * Interleaving.
 *
 * Studying one topic at a time — all the attention questions, then all the
 * softmax questions — is *blocked* practice. Interleaving means mixing the
 * topics, so that each question asks the reader to work out which rule applies
 * before they can work out the answer.
 *
 * The evidence is unusually clean for this. Rohrer, Dedrick and Hartwig (2015)
 * and Rohrer, Dedrick, Stershic and Cheung (2020) found that interleaved
 * practice beat blocked practice on a delayed test of mathematics, and Faria
 * and Yan (2022) found the same for secondary-school science: students who
 * had been quizzed with interleaved questions scored 63% on a delayed test,
 * against 54% for the same concepts quizzed in blocked order.
 *
 * The mechanism is discrimination. Blocked practice lets the reader recognise
 * "this is the softmax question" from the surrounding material, so they never
 * have to work out which procedure the problem calls for. Interleaved practice
 * takes that cue away, and the practice goes on the discrimination the reader
 * would need in a real situation.
 *
 * There is a cost, and it is worth stating. Interleaved practice feels
 * harder, and readers report it as harder, because the cue really has been
 * taken away. It is not a sign that the material is being taught badly. A
 * course that interleaves and never says so will be read as a badly designed
 * course.
 */

/**
 * Mix a list so that no two neighbours come from the same group.
 *
 * The groups are the buckets — the lessons, the modules, the topics. The
 * result keeps the *within-group* order of the input, so the questions of a
 * lesson are still in their authored order when they are next to each other;
 * it only changes which lesson each question sits beside.
 *
 * The algorithm is the one that is usually called a "round-robin shuffle":
 * the groups are laid out in rows and then read down the columns, with the
 * rows offset so that the first group is not always the same length. A
 * deferred sort is not used because it would put the largest group first and
 * leave the reader with a run of the same topic at the end.
 *
 * Groups larger than the others are dealt out over several passes, so a
 * lesson with eight questions does not monopolise the first eight positions.
 */
export function interleave<T>(items: T[], groupOf: (item: T) => string): T[] {
  if (items.length < 2) return [...items]

  // The groups, in the order their first item appears.
  const groups: T[][] = []
  const index = new Map<string, number>()
  for (const item of items) {
    const key = groupOf(item)
    const at = index.get(key)
    if (at === undefined) {
      index.set(key, groups.length)
      groups.push([item])
    } else {
      groups[at].push(item)
    }
  }
  if (groups.length < 2) return [...items]

  // Read down the columns: the first question of each group, then the second
  // of each group, and so on.
  const result: T[] = []
  const longest = Math.max(...groups.map((group) => group.length))
  for (let row = 0; row < longest; row++) {
    for (const group of groups) {
      const item = group[row]
      if (item !== undefined) result.push(item)
    }
  }
  return result
}

/**
 * How many times the same group appears in a row.
 *
 * A whole run of the same group is the thing interleaving exists to prevent,
 * so this is the number to watch: it should be 1 for a well-mixed list.
 */
export function longestRun<T>(items: T[], groupOf: (item: T) => string): number {
  let longest = 0
  let current = 0
  let previous: string | null = null
  for (const item of items) {
    const key = groupOf(item)
    current = key === previous ? current + 1 : 1
    previous = key
    if (current > longest) longest = current
  }
  return longest
}

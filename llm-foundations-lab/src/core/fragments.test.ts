import { describe, expect, it } from 'vitest'
import { appendFragment, fragmentAddress, fragmentOf } from './fragments'

/**
 * Fragments inside a hash router.
 *
 * The bug these protect against is the one that was actually there: a link to
 * a heading on a page replaced the route instead of adding to it, and the
 * reader was taken out of the course to a page saying the address was not
 * part of it.
 */

describe('the fragment of a hash-routed address', () => {
  it('is empty when the address has no second hash', () => {
    expect(fragmentOf('#/lessons/attention')).toBe('')
    expect(fragmentOf('#/')).toBe('')
    expect(fragmentOf('')).toBe('')
  })

  it('is what follows the second hash', () => {
    expect(fragmentOf('#/lessons/attention#scaling')).toBe('scaling')
    expect(fragmentOf('#/status#inference')).toBe('inference')
  })

  it('is read the same whether or not the address starts with a hash', () => {
    expect(fragmentOf('/lessons/attention#scaling')).toBe('scaling')
  })

  it('keeps a fragment that itself contains a hash', () => {
    // A section id is never allowed to contain a hash, but if one did, the
    // reader would want the whole of it rather than the first piece.
    expect(fragmentOf('#/status#a#b')).toBe('a#b')
  })

  it('reads the form the router gives, where the route is already off the front', () => {
    // The router's own location.hash for "/#/status#alignment" is
    // "#alignment" rather than "#/status#alignment". Both have to read the
    // same, or a link that names a section lands at the top of the page.
    expect(fragmentOf('#alignment')).toBe('alignment')
    expect(fragmentOf('#scaling')).toBe('scaling')
  })

  it('is empty for the router form of an address with no fragment', () => {
    expect(fragmentOf('#')).toBe('')
  })
})

describe('appending a fragment to a route', () => {
  it('keeps the route and adds the fragment', () => {
    expect(appendFragment('#/lessons/attention', 'scaling')).toBe('#/lessons/attention#scaling')
  })

  it('does not touch the route', () => {
    const result = appendFragment('#/lessons/attention', 'scaling')
    expect(result.startsWith('#/lessons/attention')).toBe(true)
  })

  it('accepts a fragment written with its own hash', () => {
    expect(appendFragment('#/lessons/attention', '#scaling')).toBe('#/lessons/attention#scaling')
  })

  it('accepts a route written without its hash', () => {
    expect(appendFragment('/lessons/attention', 'scaling')).toBe('#/lessons/attention#scaling')
  })

  it('does not add a second hash to an address that already has a fragment', () => {
    expect(appendFragment('#/lessons/attention#scaling', 'decoding')).toBe(
      '#/lessons/attention#decoding',
    )
  })

  it('leaves the address alone when there is no fragment to add', () => {
    expect(appendFragment('#/lessons/attention', '')).toBe('#/lessons/attention')
  })

  it('does not leave a trailing hash behind', () => {
    expect(appendFragment('#/lessons/attention#', 'scaling')).toBe('#/lessons/attention#scaling')
  })
})

describe('the full address of a fragment', () => {
  it('keeps the path and the query string', () => {
    expect(fragmentAddress('/', '', '#/playground', 'sampling')).toBe('/#/playground#sampling')
    expect(fragmentAddress('/', '?lab=sampling', '#/playground', 'sampling')).toBe(
      '/?lab=sampling#/playground#sampling',
    )
  })

  it('round-trips through the fragment reader', () => {
    const address = fragmentAddress('/', '', '#/lessons/attention', 'scaling')
    expect(fragmentOf(address.slice(address.indexOf('#')))).toBe('scaling')
  })
})

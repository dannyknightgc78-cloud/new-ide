import test from 'node:test'
import assert from 'node:assert/strict'
import { matchPerformers } from './aesthetics.js'

const sample = [
  { slug: 'goth-queen', stageName: 'Goth Queen', aestheticTags: ['gothic', 'horror'], published: true },
  { slug: 'camp-icon', stageName: 'Camp Icon', aestheticTags: ['camp', 'comedy'], published: true },
  { slug: 'fashionista', stageName: 'Fashionista', aestheticTags: ['high-fashion', 'pageant'], published: true },
  { slug: 'hidden', stageName: 'Hidden', aestheticTags: ['gothic'], published: false },
]

test('matchPerformers returns overlap by aesthetic tags', () => {
  const matches = matchPerformers(sample, ['gothic', 'camp'], 2)
  assert.equal(matches.length, 2)
  assert.ok(matches.some((p) => p.slug === 'goth-queen'))
  assert.ok(matches.some((p) => p.slug === 'camp-icon'))
  assert.ok(!matches.some((p) => p.slug === 'hidden'))
})

test('matchPerformers returns empty for no tags', () => {
  assert.deepEqual(matchPerformers(sample, [], 3), [])
})

export const AESTHETIC_TAGS = [
  { id: 'gothic', label: 'Gothic', emoji: '🖤' },
  { id: 'camp', label: 'Camp', emoji: '💅' },
  { id: 'high-fashion', label: 'High Fashion', emoji: '👠' },
  { id: 'comedy', label: 'Comedy Queen', emoji: '😂' },
  { id: 'horror', label: 'Horror', emoji: '🩸' },
  { id: 'pageant', label: 'Pageant', emoji: '👑' },
  { id: 'punk', label: 'Punk', emoji: '⚡' },
  { id: 'burlesque', label: 'Burlesque', emoji: '🎭' },
  { id: 'androgyny', label: 'Androgyny', emoji: '✨' },
  { id: 'drag-king', label: 'Drag King', emoji: '🤴' },
]

export function listAesthetics() {
  return AESTHETIC_TAGS
}

export function matchPerformers(performers, selectedTagIds, count = 3) {
  const tags = new Set(selectedTagIds)
  if (!tags.size) return []

  const scored = performers
    .filter((p) => p.published !== false)
    .map((p) => {
      const performerTags = p.aestheticTags || []
      const overlap = performerTags.filter((t) => tags.has(t)).length
      return { performer: p, overlap, jitter: Math.random() }
    })
    .filter((row) => row.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || b.jitter - a.jitter)

  const pool = scored.slice(0, Math.max(count * 3, count))
  const picks = []
  const used = new Set()

  for (const row of pool) {
    if (picks.length >= count) break
    if (used.has(row.performer.slug)) continue
    used.add(row.performer.slug)
    picks.push(row.performer)
  }

  return picks
}

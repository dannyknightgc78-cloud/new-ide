import { customAlphabet } from 'nanoid'

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8)

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function publicPerformer(p) {
  return {
    slug: p.slug,
    stageName: p.stageName,
    pronouns: p.pronouns || null,
    city: p.city || null,
    bio: p.bio || '',
    aestheticTags: p.aestheticTags || [],
    links: p.links || {},
    tipUrl: p.tipUrl || null,
    acceptsBookings: p.acceptsBookings !== false,
    createdAt: p.createdAt,
  }
}

async function loadPerformers(readJson) {
  const data = await readJson('performers.json', { performers: [] })
  return data.performers
}

async function savePerformers(readJson, writeJson, performers) {
  await writeJson('performers.json', { performers })
}

async function listPerformers(readJson) {
  const performers = await loadPerformers(readJson)
  return performers.filter((p) => p.published !== false).map(publicPerformer)
}

async function getPerformer(readJson, slug) {
  const performers = await loadPerformers(readJson)
  const found = performers.find((p) => p.slug === slug && p.published !== false)
  return found ? publicPerformer(found) : null
}

async function createPerformer(readJson, writeJson, input) {
  const performers = await loadPerformers(readJson)
  const baseSlug = slugify(input.stageName)
  if (!baseSlug) throw new Error('stageName required')

  let slug = baseSlug
  let n = 2
  while (performers.some((p) => p.slug === slug)) {
    slug = `${baseSlug}-${n++}`
  }

  const performer = {
    id: nanoid(),
    slug,
    stageName: input.stageName.trim(),
    pronouns: input.pronouns?.trim() || '',
    city: input.city?.trim() || '',
    bio: input.bio?.trim() || '',
    aestheticTags: Array.isArray(input.aestheticTags) ? input.aestheticTags : [],
    links: input.links || {},
    tipUrl: input.tipUrl?.trim() || '',
    bookingEmail: input.bookingEmail?.trim() || '',
    acceptsBookings: input.acceptsBookings !== false,
    published: input.published !== false,
    createdAt: new Date().toISOString(),
  }

  performers.push(performer)
  await savePerformers(readJson, writeJson, performers)
  return publicPerformer(performer)
}

export {
  createPerformer,
  getPerformer,
  listPerformers,
  loadPerformers,
  publicPerformer,
}

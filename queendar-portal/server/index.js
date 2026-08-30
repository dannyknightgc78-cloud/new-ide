import 'dotenv/config'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { aiHealth, aiConfigured, mapVibeToTags } from './ai.js'
import { listAesthetics, matchPerformers } from './aesthetics.js'
import { createBooking } from './bookings.js'
import { createPerformer, getPerformer, listPerformers, loadPerformers } from './performers.js'
import { telegramConfigured } from './notify.js'
import { opsConfigured, tunnelHeal, tunnelStatus } from './ops.js'
import { ensureOwner, loginOwner, readOwnerToken } from './owner.js'
import { readJson, writeJson } from './store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = Number(process.env.PORT || 3011)
const PUBLIC = path.join(__dirname, '../public')
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || ''
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://queendar.com'

app.use(express.json())
app.use(express.static(PUBLIC))

function requireAdmin(req, res, next) {
  if (!ADMIN_API_KEY) {
    return res.status(503).json({ error: 'ADMIN_API_KEY not configured' })
  }
  const key = req.get('x-admin-key') || ''
  if (key !== ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

app.get('/api/health', async (_req, res) => {
  let ai = { ok: false, backend: 'cloudit-gpu' }
  if (aiConfigured()) {
    try {
      ai = { ok: true, backend: 'cloudit-gpu', ...(await aiHealth()) }
    } catch (e) {
      ai = { ok: false, backend: 'cloudit-gpu', error: e.message }
    }
  }
  res.json({
    ok: true,
    service: 'queendar-portal',
    publicUrl: PUBLIC_URL,
    telegram: telegramConfigured(),
    nimbus: { ok: false, ops: opsConfigured(), bot: '@NimbusOpsbot' },
    admin: Boolean(ADMIN_API_KEY),
    ops: opsConfigured(),
    ai,
  })
})

app.get('/api/ops/tunnels', requireAdmin, async (_req, res) => {
  try {
    res.json(await tunnelStatus())
  } catch (e) {
    res.status(e.status || 502).json({ ok: false, error: e.message, detail: e.body })
  }
})

app.post('/api/ops/tunnels/heal', requireAdmin, async (_req, res) => {
  try {
    res.json(await tunnelHeal())
  } catch (e) {
    res.status(e.status || 502).json({ ok: false, error: e.message, detail: e.body })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim()
    const password = String(req.body?.password || '')
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password required' })
    }
    const result = await loginOwner(readJson, username, password)
    if (!result) return res.status(401).json({ error: 'Invalid username or password.' })
    res.json({ token: result.token, user: { username: result.username } })
  } catch (e) {
    res.status(500).json({ error: 'Sign in failed' })
  }
})

app.get('/api/me', async (req, res) => {
  const header = req.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const username = readOwnerToken(token)
  if (!username) return res.status(401).json({ error: 'Unauthorized' })
  res.json({ username, app: 'queendar' })
})

app.get('/login', (_req, res) => {
  res.sendFile(path.join(PUBLIC, 'login.html'))
})

app.get('/api/aesthetics', (_req, res) => {
  res.json({ aesthetics: listAesthetics() })
})

app.get('/api/performers', async (_req, res) => {
  try {
    const performers = await listPerformers(readJson)
    res.json({ performers })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/performers/:slug', async (req, res) => {
  try {
    const performer = await getPerformer(readJson, req.params.slug)
    if (!performer) return res.status(404).json({ error: 'Not found' })
    res.json({ performer })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/performers', requireAdmin, async (req, res) => {
  try {
    if (!req.body?.stageName) {
      return res.status(400).json({ error: 'stageName required' })
    }
    const performer = await createPerformer(readJson, writeJson, req.body)
    res.status(201).json({ performer })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.post('/api/match/vibe', async (req, res) => {
  try {
    const vibe = String(req.body?.vibe || '').trim()
    if (!vibe) return res.status(400).json({ error: 'vibe required' })
    const tagIds = listAesthetics().map((t) => t.id)
    const tags = await mapVibeToTags(vibe, tagIds)
    const count = Math.min(Number(req.body?.count) || 3, 6)
    const performers = await loadPerformers(readJson)
    const matches = matchPerformers(performers, tags, count).map((p) => ({
      slug: p.slug,
      stageName: p.stageName,
      city: p.city,
      aestheticTags: p.aestheticTags,
      bio: p.bio?.slice(0, 160) || '',
    }))
    res.json({ matches, tags, vibe, ai: true })
  } catch (e) {
    console.error('[queendar] vibe match error:', e.message)
    res.status(503).json({ error: e.message })
  }
})

app.post('/api/match', async (req, res) => {
  try {
    const tags = Array.isArray(req.body?.tags) ? req.body.tags : []
    const count = Math.min(Number(req.body?.count) || 3, 6)
    const performers = await loadPerformers(readJson)
    const matches = matchPerformers(performers, tags, count).map((p) => ({
      slug: p.slug,
      stageName: p.stageName,
      city: p.city,
      aestheticTags: p.aestheticTags,
      bio: p.bio?.slice(0, 160) || '',
    }))
    res.json({ matches, tags })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/bookings', async (req, res) => {
  try {
    const { performerSlug, name, email, eventDate, venue, message } = req.body || {}
    if (!performerSlug || !name || !email) {
      return res.status(400).json({ error: 'performerSlug, name, and email required' })
    }

    const performer = await getPerformer(readJson, performerSlug)
    if (!performer) return res.status(404).json({ error: 'Performer not found' })
    if (!performer.acceptsBookings) {
      return res.status(400).json({ error: 'Performer is not accepting bookings' })
    }

    const result = await createBooking(readJson, writeJson, {
      performer,
      inquiry: { name, email, eventDate, venue, message },
    })
    res.status(201).json(result)
  } catch (e) {
    console.error('[queendar] booking error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.get('/p/:slug', (_req, res) => {
  res.sendFile(path.join(PUBLIC, 'profile.html'))
})

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(PUBLIC, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`[queendar] listening on :${PORT}`)
  console.log(`[queendar] public URL: ${PUBLIC_URL}`)
  const ownerUser = process.env.OWNER_USER
  const ownerPass = process.env.OWNER_PASS
  if (ownerUser && ownerPass) {
    ensureOwner(readJson, writeJson, { username: ownerUser, password: ownerPass })
      .then((o) => console.log(`[queendar] owner ready: ${o.username}`))
      .catch((e) => console.error('[queendar] owner setup failed:', e.message))
  }
})

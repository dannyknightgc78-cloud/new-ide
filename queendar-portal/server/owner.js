import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto'

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 32).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':')
  if (!salt || !hash) return false
  const next = scryptSync(password, salt, 32)
  const prev = Buffer.from(hash, 'hex')
  if (next.length !== prev.length) return false
  return timingSafeEqual(prev, next)
}

function tokenSecret() {
  return process.env.OWNER_TOKEN_SECRET || process.env.ADMIN_API_KEY || 'queendar-owner'
}

export function signOwnerToken(username) {
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000
  const payload = Buffer.from(JSON.stringify({ u: username, exp })).toString('base64url')
  const sig = createHmac('sha256', tokenSecret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function readOwnerToken(token) {
  const [payload, sig] = String(token || '').split('.')
  if (!payload || !sig) return null
  const expected = createHmac('sha256', tokenSecret()).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!data?.u || Number(data.exp) < Date.now()) return null
    return data.u
  } catch {
    return null
  }
}

export async function ensureOwner(readJson, writeJson, { username, password } = {}) {
  const data = await readJson('owner.json', { username: 'dannygc', passwordHash: '' })
  if (username) data.username = String(username).trim()
  if (password) data.passwordHash = hashPassword(password)
  await writeJson('owner.json', { username: data.username, passwordHash: data.passwordHash })
  return { username: data.username, hasPassword: Boolean(data.passwordHash) }
}

export async function loginOwner(readJson, username, password) {
  const data = await readJson('owner.json', { username: '', passwordHash: '' })
  const user = String(username || '').trim()
  if (!data.username || !data.passwordHash) return null
  if (user !== data.username) return null
  if (!verifyPassword(password, data.passwordHash)) return null
  return { username: data.username, token: signOwnerToken(data.username) }
}

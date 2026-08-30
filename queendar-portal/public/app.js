const tagGrid = document.getElementById('tag-grid')
const matchBtn = document.getElementById('match-btn')
const clearBtn = document.getElementById('clear-btn')
const matchResults = document.getElementById('match-results')
const rosterGrid = document.getElementById('roster-grid')
const rosterEmpty = document.getElementById('roster-empty')
const vibeInput = document.getElementById('vibe-input')
const vibeBtn = document.getElementById('vibe-btn')

const selected = new Set()
let aesthetics = []

async function loadAesthetics() {
  const res = await fetch('/api/aesthetics')
  const data = await res.json()
  aesthetics = data.aesthetics || []
  renderTags()
}

function renderTags() {
  tagGrid.innerHTML = ''
  for (const tag of aesthetics) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'tag-btn' + (selected.has(tag.id) ? ' selected' : '')
    btn.textContent = `${tag.emoji} ${tag.label}`
    btn.addEventListener('click', () => {
      if (selected.has(tag.id)) {
        selected.delete(tag.id)
      } else if (selected.size < 3) {
        selected.add(tag.id)
      }
      renderTags()
      matchBtn.disabled = selected.size === 0
    })
    tagGrid.appendChild(btn)
  }
}

clearBtn.addEventListener('click', () => {
  selected.clear()
  renderTags()
  matchBtn.disabled = true
  matchResults.hidden = true
  matchResults.innerHTML = ''
})

matchBtn.addEventListener('click', async () => {
  matchBtn.disabled = true
  matchBtn.textContent = 'Consulting the oracle…'
  try {
    const res = await fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: [...selected], count: 3 }),
    })
    const data = await res.json()
    renderMatches(data.matches || [], data.tags)
  } finally {
    matchBtn.disabled = selected.size === 0
    matchBtn.textContent = 'Reveal my matches'
  }
})

vibeBtn.addEventListener('click', async () => {
  const vibe = vibeInput.value.trim()
  if (!vibe) return
  vibeBtn.disabled = true
  vibeBtn.textContent = 'Queen is reading your aura…'
  try {
    const res = await fetch('/api/match/vibe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vibe, count: 3 }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'AI match failed')
    selected.clear()
    for (const tag of data.tags || []) selected.add(tag)
    renderTags()
    matchBtn.disabled = selected.size === 0
    renderMatches(data.matches || [], data.tags, data.vibe)
  } catch (err) {
    matchResults.hidden = false
    matchResults.innerHTML = `<p class="sub status err">${escapeHtml(err.message)}</p>`
  } finally {
    vibeBtn.disabled = false
    vibeBtn.textContent = 'Mystery match from vibe'
  }
})

function renderMatches(matches, tags = [], vibe = '') {
  matchResults.hidden = false
  const hint = vibe
    ? `<p class="sub">AI read your vibe as: ${escapeHtml((tags || []).join(', ') || 'unknown')}</p>`
    : ''
  if (!matches.length) {
    matchResults.innerHTML = `${hint}<p class="sub">No matches yet — seed some performers or try different tags.</p>`
    return
  }
  matchResults.innerHTML =
    hint +
    matches
    .map(
      (p, i) => `
      <article class="card" style="animation-delay:${i * 0.1}s">
        <h3>${escapeHtml(p.stageName)}</h3>
        <p class="meta">${escapeHtml(p.city || 'Location TBA')}</p>
        <p class="bio">${escapeHtml(p.bio || '')}</p>
        <a class="btn btn-ghost" href="/p/${encodeURIComponent(p.slug)}">View portfolio →</a>
      </article>`
    )
    .join('')
}

async function loadRoster() {
  const res = await fetch('/api/performers')
  const data = await res.json()
  const performers = data.performers || []
  rosterEmpty.hidden = performers.length > 0
  rosterEmpty.textContent = performers.length
    ? ''
    : 'No performers yet. Add one via the admin API.'
  rosterGrid.innerHTML = performers
    .map(
      (p) => `
      <a class="roster-card" href="/p/${encodeURIComponent(p.slug)}">
        <strong>${escapeHtml(p.stageName)}</strong>
        <div class="meta">${escapeHtml(p.city || '')}</div>
      </a>`
    )
    .join('')
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

loadAesthetics()
loadRoster()

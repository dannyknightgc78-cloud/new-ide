const slug = window.location.pathname.replace(/^\/p\//, '').replace(/\/$/, '')
const stageName = document.getElementById('stage-name')
const profileMeta = document.getElementById('profile-meta')
const profileChips = document.getElementById('profile-chips')
const profileBio = document.getElementById('profile-bio')
const profileActions = document.getElementById('profile-actions')
const bookingPanel = document.getElementById('booking-panel')
const bookingForm = document.getElementById('booking-form')
const bookingStatus = document.getElementById('booking-status')
const profileError = document.getElementById('profile-error')

let performer = null

async function loadProfile() {
  const res = await fetch(`/api/performers/${encodeURIComponent(slug)}`)
  if (!res.ok) {
    profileError.hidden = false
    profileError.textContent = 'Performer not found.'
    stageName.textContent = 'Not found'
    return
  }
  const data = await res.json()
  performer = data.performer
  document.title = `${performer.stageName} — Queendar`
  stageName.textContent = performer.stageName
  const meta = [performer.pronouns, performer.city].filter(Boolean).join(' · ')
  profileMeta.textContent = meta
  profileBio.textContent = performer.bio || ''
  profileChips.innerHTML = (performer.aestheticTags || [])
    .map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
    .join('')

  profileActions.innerHTML = ''
  if (performer.tipUrl) {
    const tip = document.createElement('a')
    tip.className = 'btn btn-primary'
    tip.href = performer.tipUrl
    tip.target = '_blank'
    tip.rel = 'noopener'
    tip.textContent = 'Tip / Support'
    profileActions.appendChild(tip)
  }
  for (const [key, url] of Object.entries(performer.links || {})) {
    if (!url) continue
    const link = document.createElement('a')
    link.className = 'btn btn-ghost'
    link.href = url
    link.target = '_blank'
    link.rel = 'noopener'
    link.textContent = key
    profileActions.appendChild(link)
  }

  if (performer.acceptsBookings) {
    bookingPanel.hidden = false
  }
}

bookingForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  bookingStatus.className = 'status'
  bookingStatus.textContent = 'Sending…'
  const fd = new FormData(bookingForm)
  const body = Object.fromEntries(fd.entries())
  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ performerSlug: slug, ...body }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed')
    bookingStatus.className = 'status ok'
    bookingStatus.textContent = 'Inquiry sent. The performer will be in touch.'
    bookingForm.reset()
  } catch (err) {
    bookingStatus.className = 'status err'
    bookingStatus.textContent = err.message
  }
})

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

loadProfile()

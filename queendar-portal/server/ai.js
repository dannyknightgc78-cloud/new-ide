// Default: Hostman → cloudit-gpu coder tunnel (:18001). Trooper Ollama retired.
const BASE = (
  process.env.AI_BASE_URL ||
  process.env.OLLAMA_BASE_URL ||
  'http://host.docker.internal:18001/v1'
).replace(/\/$/, '')
const TIMEOUT = Number(process.env.AI_TIMEOUT_MS || 120000)
const MODEL = process.env.AI_MODEL || process.env.OLLAMA_MODEL || 'nemotron-3.5-lightning:latest'

export function aiConfigured() {
  return Boolean(BASE)
}

async function pickModel() {
  if (MODEL) return MODEL
  const res = await fetch(`${BASE}/models`, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`AI models ${res.status}`)
  const data = await res.json()
  const models = (data.data || []).map((m) => m.id).filter(Boolean)
  if (!models.length) throw new Error('No AI model available on cloudit-gpu')
  const preferred = models.find((id) => /Qwen3-Coder|qwen|llama|gemma|mistral/i.test(id) && !/embed|llava/i.test(id))
  return preferred || models.find((id) => !/embed|llava/i.test(id)) || models[0]
}

function extractMessageText(choice) {
  const msg = choice?.message || {}
  const content = String(msg.content || '').trim()
  if (content) return content
  // Nemotron-style models often spend low max_tokens entirely on reasoning.
  const reasoning = String(msg.reasoning || msg.reasoning_content || '').trim()
  return reasoning
}

function heuristicVibeTags(vibe, tagIds) {
  const allowed = new Set(tagIds)
  const text = String(vibe || '').toLowerCase()
  const hits = []
  for (const id of tagIds) {
    const needle = id.replace(/-/g, ' ')
    if (text.includes(id) || text.includes(needle)) hits.push(id)
  }
  const aliases = [
    [/goth|dark|noir|vampire/i, 'gothic'],
    [/fashion|glam|couture|runway/i, 'high-fashion'],
    [/funny|comedy|campy|shade/i, 'camp'],
    [/horror|scary|blood/i, 'horror'],
    [/punk|riot|spike/i, 'punk'],
    [/pageant|crown|sash/i, 'pageant'],
    [/burlesque|cabaret|fan.?dance/i, 'burlesque'],
    [/andro|gender.?bend/i, 'androgyny'],
    [/king|masc/i, 'drag-king'],
    [/comedy|stand.?up/i, 'comedy'],
  ]
  for (const [re, id] of aliases) {
    if (re.test(text) && allowed.has(id) && !hits.includes(id)) hits.push(id)
  }
  return hits.filter((t) => allowed.has(t)).slice(0, 3)
}

export async function chatCompletion({ system, user, maxTokens = 400, temperature = 0.5 }) {
  const model = await pickModel()
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
      temperature,
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`AI ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  return { model, text: extractMessageText(data.choices?.[0]) || '' }
}

export async function mapVibeToTags(vibe, tagIds) {
  const system = `You map fan vibes to drag aesthetic tags. Reply with ONLY a JSON array of 1-3 tag ids from this list: ${tagIds.join(', ')}. No markdown.`
  try {
    const { text } = await chatCompletion({
      system,
      user: `Fan vibe: ${vibe}`,
      maxTokens: 512,
      temperature: 0.3,
    })
    const parsed = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || text)
    if (Array.isArray(parsed)) {
      const allowed = new Set(tagIds)
      const tags = parsed.filter((t) => allowed.has(t)).slice(0, 3)
      if (tags.length) return tags
    }
  } catch (e) {
    console.warn('[queendar] mapVibeToTags AI failed:', e.message)
  }
  return heuristicVibeTags(vibe, tagIds)
}

export async function aiHealth() {
  const res = await fetch(`${BASE}/models`, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`AI health ${res.status}`)
  const data = await res.json()
  const models = (data.data || []).map((m) => m.id).filter(Boolean)
  return { base: BASE, models, model: MODEL || models[0] || null }
}

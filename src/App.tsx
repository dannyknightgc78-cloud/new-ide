import { Color, midpointColor } from './palette'
import { useEffect, useMemo, useState } from 'react'
import {
  CodeTypeCamera,
  CodeTypeNFC,
  compressURL,
  encodePayload,
  generateWithTemplate,
  parseHexColor,
  renderSvg,
  templates,
  type Palette,
  type Template,
} from 'appclipcode'
import './App.css'

type CodeType = typeof CodeTypeCamera | typeof CodeTypeNFC
type ColorMode = 'template' | 'custom'
type PreviewBg = 'auto' | 'light' | 'dark' | 'checkered'
type ExportFormat = 'svg' | 'png'
type PresetId = 'queendar' | 'trial-sticky' | 'custom'

interface Preset {
  id: PresetId
  title: string
  blurb: string
  url: string
  codeType: CodeType
  colorMode: ColorMode
  templateIndex: number
  foreground: string
  background: string
  third: string
  useCustomThird: boolean
  fileName: string
  badge: string
}

const PRESETS: Preset[] = [
  {
    id: 'queendar',
    title: 'Queendar',
    blurb: 'Main App Clip for queendar.com — camera scan style.',
    url: 'https://queendar.com',
    codeType: CodeTypeCamera,
    colorMode: 'custom',
    templateIndex: 0,
    foreground: 'C9A84C',
    background: '080808',
    third: 'E8C96A',
    useCustomThird: true,
    fileName: 'queendar-app-clip',
    badge: 'Camera',
  },
  {
    id: 'trial-sticky',
    title: '7-day Premium Sticky',
    blurb: 'NFC sticky for a 7-day QueenDar Plus / premium trial.',
    url: 'https://queendar.com/trial/7-day',
    codeType: CodeTypeNFC,
    colorMode: 'custom',
    templateIndex: 14,
    foreground: 'FFFFFF',
    background: '7C3AED',
    third: '9D5CF5',
    useCustomThird: true,
    fileName: 'queendar-7day-premium-sticky',
    badge: 'NFC sticky',
  },
]

const STORAGE_KEY = 'queendar-appclip-settings'

interface Settings {
  presetId: PresetId
  url: string
  templateIndex: number
  colorMode: ColorMode
  foreground: string
  background: string
  third: string
  useCustomThird: boolean
  codeType: CodeType
  previewBg: PreviewBg
  previewScale: number
  exportFormat: ExportFormat
  fileName: string
}

function settingsFromPreset(preset: Preset): Settings {
  return {
    presetId: preset.id,
    url: preset.url,
    templateIndex: preset.templateIndex,
    colorMode: preset.colorMode,
    foreground: preset.foreground,
    background: preset.background,
    third: preset.third,
    useCustomThird: preset.useCustomThird,
    codeType: preset.codeType,
    previewBg: 'auto',
    previewScale: 100,
    exportFormat: 'svg',
    fileName: preset.fileName,
  }
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return settingsFromPreset(PRESETS[0])
    return { ...settingsFromPreset(PRESETS[0]), ...JSON.parse(raw) }
  } catch {
    return settingsFromPreset(PRESETS[0])
  }
}

function normalizeHex(value: string): string {
  return value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6).toUpperCase()
}

function findThirdColor(foreground: Color, background: Color): Color {
  for (const template of templates()) {
    if (sameRgb(template.foreground, foreground) && sameRgb(template.background, background)) {
      return template.third
    }
    if (sameRgb(template.foreground, background) && sameRgb(template.background, foreground)) {
      return template.third
    }
  }
  return midpointColor(foreground, background)
}

function sameRgb(a: Color, b: Color): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b
}

function templateSwatch(template: Template) {
  return {
    fg: template.foreground.hex(),
    bg: template.background.hex(),
  }
}

function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [copied, setCopied] = useState<'svg' | 'url' | null>(null)

  const {
    presetId,
    url,
    templateIndex,
    colorMode,
    foreground,
    background,
    third,
    useCustomThird,
    codeType,
    previewBg,
    previewScale,
    exportFormat,
    fileName,
  } = settings

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
      ...(key !== 'presetId' ? { presetId: 'custom' as const } : null),
    }))
  }

  function applyPreset(preset: Preset) {
    setSettings((prev) => ({
      ...settingsFromPreset(preset),
      previewBg: prev.previewBg,
      previewScale: prev.previewScale,
      exportFormat: prev.exportFormat,
    }))
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const paletteTemplates = useMemo(() => templates(), [])

  const { svg, error, palette } = useMemo(() => {
    const trimmed = url.trim()
    if (!trimmed) {
      return { svg: null, error: 'Enter an https:// URL to generate a code.', palette: null }
    }

    try {
      if (colorMode === 'template') {
        const result = generateWithTemplate(trimmed, templateIndex, { type: codeType })
        const template = paletteTemplates.find((item) => item.index === templateIndex) ?? null
        return { svg: result, error: null, palette: template }
      }

      const fg = parseHexColor(foreground)
      const bg = parseHexColor(background)
      const thirdColor = useCustomThird ? parseHexColor(third) : findThirdColor(fg, bg)
      const customPalette: Palette = {
        foreground: fg,
        background: bg,
        third: thirdColor,
      }
      const compressed = compressURL(trimmed)
      const bits = encodePayload(compressed)
      return {
        svg: renderSvg(bits, customPalette, trimmed, codeType),
        error: null,
        palette: customPalette,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to generate code.'
      return { svg: null, error: message, palette: null }
    }
  }, [
    url,
    colorMode,
    templateIndex,
    foreground,
    background,
    third,
    useCustomThird,
    codeType,
    paletteTemplates,
  ])

  const stageStyle = useMemo(() => {
    if (previewBg === 'light') return { background: '#f5ead0' }
    if (previewBg === 'dark') return { background: '#080808' }
    if (previewBg === 'checkered') {
      return {
        backgroundImage:
          'linear-gradient(45deg, #1a1a1a 25%, transparent 25%), linear-gradient(-45deg, #1a1a1a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a1a 75%), linear-gradient(-45deg, transparent 75%, #1a1a1a 75%)',
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
        backgroundColor: '#111111',
      }
    }
    if (palette) {
      return {
        background: `radial-gradient(circle at top, ${palette.background.hex()}55, transparent 55%), #0e0e0e`,
      }
    }
    return undefined
  }, [previewBg, palette])

  async function copyText(kind: 'svg' | 'url') {
    if (!svg) return
    const value =
      kind === 'svg' ? svg : `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
    await navigator.clipboard.writeText(value)
    setCopied(kind)
    window.setTimeout(() => setCopied(null), 1600)
  }

  async function download() {
    if (!svg) return
    const base = (fileName.trim() || 'app-clip-code').replace(/[^\w.-]+/g, '-')

    if (exportFormat === 'svg') {
      triggerDownload(new Blob([svg], { type: 'image/svg+xml' }), `${base}.svg`)
      return
    }

    const pngBlob = await svgToPngBlob(svg, previewScale / 100)
    triggerDownload(pngBlob, `${base}.png`)
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-copy">
          <p className="brand">Queendar</p>
          <h1>App Clip Codes</h1>
          <p className="subtitle">
            Two ready-to-print codes: the main Queendar clip, and an NFC sticky for the 7-day
            premium trial. Tweak colors, logo style, and export SVG or PNG.
          </p>
        </div>
      </header>

      <section className="preset-row">
        {PRESETS.map((preset) => {
          const active = presetId === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              className={`preset-card${active ? ' active' : ''}`}
              onClick={() => applyPreset(preset)}
            >
              <span className="preset-badge">{preset.badge}</span>
              <strong>{preset.title}</strong>
              <span>{preset.blurb}</span>
              <code>{preset.url}</code>
            </button>
          )
        })}
      </section>

      <main className="layout">
        <section className="panel controls">
          <label className="field">
            <span>Invocation URL</span>
            <input
              type="url"
              value={url}
              onChange={(event) => update('url', event.target.value)}
              placeholder="https://queendar.com/..."
              spellCheck={false}
            />
          </label>

          <fieldset className="field">
            <legend>Code type</legend>
            <div className="segmented">
              <button
                type="button"
                className={codeType === CodeTypeCamera ? 'active' : ''}
                onClick={() => update('codeType', CodeTypeCamera)}
              >
                Camera
              </button>
              <button
                type="button"
                className={codeType === CodeTypeNFC ? 'active' : ''}
                onClick={() => update('codeType', CodeTypeNFC)}
              >
                NFC sticky
              </button>
            </div>
          </fieldset>

          <fieldset className="field">
            <legend>Colors</legend>
            <div className="segmented">
              <button
                type="button"
                className={colorMode === 'template' ? 'active' : ''}
                onClick={() => update('colorMode', 'template')}
              >
                Templates
              </button>
              <button
                type="button"
                className={colorMode === 'custom' ? 'active' : ''}
                onClick={() => update('colorMode', 'custom')}
              >
                Custom
              </button>
            </div>
          </fieldset>

          {colorMode === 'template' ? (
            <div className="template-grid">
              {paletteTemplates.map((template) => {
                const swatch = templateSwatch(template)
                const selected = templateIndex === template.index
                return (
                  <button
                    key={template.index}
                    type="button"
                    className={`template-chip${selected ? ' selected' : ''}`}
                    aria-label={`Template ${template.index}`}
                    aria-pressed={selected}
                    onClick={() => update('templateIndex', template.index)}
                  >
                    <span
                      className="template-preview"
                      style={{ background: swatch.bg, color: swatch.fg }}
                    >
                      {template.index}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="custom-colors">
              <ColorField
                label="Foreground"
                value={foreground}
                onChange={(value) => update('foreground', value)}
              />
              <ColorField
                label="Background"
                value={background}
                onChange={(value) => update('background', value)}
              />
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={useCustomThird}
                  onChange={(event) => update('useCustomThird', event.target.checked)}
                />
                <span>Override third accent color</span>
              </label>
              {useCustomThird && (
                <ColorField
                  label="Third"
                  value={third}
                  onChange={(value) => update('third', value)}
                />
              )}
            </div>
          )}

          <div className="advanced">
            <h3>Export &amp; preview</h3>

            <label className="field">
              <span>Preview background</span>
              <select
                value={previewBg}
                onChange={(event) => update('previewBg', event.target.value as PreviewBg)}
              >
                <option value="auto">Match code</option>
                <option value="light">Cream</option>
                <option value="dark">Queendar black</option>
                <option value="checkered">Checkered</option>
              </select>
            </label>

            <label className="field">
              <span>Preview / PNG scale ({previewScale}%)</span>
              <input
                type="range"
                min={50}
                max={200}
                step={10}
                value={previewScale}
                onChange={(event) => update('previewScale', Number(event.target.value))}
              />
            </label>

            <label className="field">
              <span>Download filename</span>
              <input
                type="text"
                value={fileName}
                onChange={(event) => update('fileName', event.target.value)}
                spellCheck={false}
              />
            </label>

            <fieldset className="field">
              <legend>Export format</legend>
              <div className="segmented">
                <button
                  type="button"
                  className={exportFormat === 'svg' ? 'active' : ''}
                  onClick={() => update('exportFormat', 'svg')}
                >
                  SVG
                </button>
                <button
                  type="button"
                  className={exportFormat === 'png' ? 'active' : ''}
                  onClick={() => update('exportFormat', 'png')}
                >
                  PNG
                </button>
              </div>
            </fieldset>
          </div>

          <p className="hint">
            App Clip Codes only accept a narrow subset of <code>https://</code> URLs and must fit
            in a 128-bit payload.
          </p>
        </section>

        <section className="panel preview">
          <div className="preview-header">
            <h2>Live preview</h2>
            <div className="preview-actions">
              <button type="button" className="ghost" onClick={() => copyText('svg')} disabled={!svg}>
                {copied === 'svg' ? 'Copied' : 'Copy SVG'}
              </button>
              <button type="button" className="ghost" onClick={() => copyText('url')} disabled={!svg}>
                {copied === 'url' ? 'Copied' : 'Copy data URL'}
              </button>
              <button type="button" className="download" onClick={download} disabled={!svg}>
                Download {exportFormat.toUpperCase()}
              </button>
            </div>
          </div>

          <div className={`preview-stage${error ? ' has-error' : ''}`} style={stageStyle}>
            {svg ? (
              <div
                className="code-preview"
                style={{ width: `${Math.min(22, 22 * (previewScale / 100))}rem` }}
                dangerouslySetInnerHTML={{ __html: svg }}
                aria-label="Generated App Clip Code"
              />
            ) : (
              <div className="preview-placeholder">
                <div className="placeholder-ring" />
                <p>{error ?? 'Enter a valid URL to preview your code.'}</p>
              </div>
            )}
          </div>

          {svg && error === null && (
            <div className="meta">
              <p className="success-note">
                {presetId === 'queendar'
                  ? 'Queendar main code ready.'
                  : presetId === 'trial-sticky'
                    ? '7-day premium sticky code ready.'
                    : 'Custom code ready.'}
              </p>
              {palette && (
                <div className="palette-dots" aria-label="Active palette">
                  <span style={{ background: palette.foreground.hex() }} title="Foreground" />
                  <span style={{ background: palette.background.hex() }} title="Background" />
                  <span style={{ background: palette.third.hex() }} title="Third" />
                </div>
              )}
            </div>
          )}
          {error && svg === null && <p className="error-note">{error}</p>}
        </section>
      </main>

      <footer className="footer">
        <p>
          Queendar App Clip generator for Hostman. Built with{' '}
          <a href="https://github.com/rs/appclipcode" target="_blank" rel="noreferrer">
            appclipcode
          </a>
          . Not affiliated with Apple Inc.
        </p>
      </footer>
    </div>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="color-field">
      <span>{label}</span>
      <div className="color-input">
        <input
          type="color"
          value={`#${value.slice(0, 6).padEnd(6, '0')}`}
          onChange={(event) => onChange(event.target.value.replace('#', '').toUpperCase())}
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(normalizeHex(event.target.value))}
          spellCheck={false}
        />
      </div>
    </label>
  )
}

function triggerDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

async function svgToPngBlob(svg: string, scale: number): Promise<Blob> {
  const size = Math.round(1024 * scale)
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  try {
    const image = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')
    context.drawImage(image, 0, 0, size, size)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result)
        else reject(new Error('PNG export failed'))
      }, 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to rasterize SVG'))
    image.src = src
  })
}

export default App

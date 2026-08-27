import fs from 'fs/promises'
import path from 'path'

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function readJson(file, fallback) {
  await ensureDataDir()
  const filePath = path.join(DATA_DIR, file)
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch (e) {
    if (e.code === 'ENOENT') {
      await writeJson(file, fallback)
      return structuredClone(fallback)
    }
    throw e
  }
}

async function writeJson(file, data) {
  await ensureDataDir()
  const filePath = path.join(DATA_DIR, file)
  const tmp = `${filePath}.tmp`
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  await fs.rename(tmp, filePath)
}

export { DATA_DIR, readJson, writeJson }

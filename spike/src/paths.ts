import { mkdir, readdir, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isSupportedImage } from './image.js'

const here = dirname(fileURLToPath(import.meta.url))

export const SPIKE_ROOT = resolve(here, '..')
export const FIXTURES_DIR = join(SPIKE_ROOT, 'fixtures', 'private')
export const RESULTS_DIR = join(SPIKE_ROOT, 'results')

export interface Fixture {
  /** Имя без расширения: "001" */
  id: string
  imagePath: string
  expectedPath: string
}

export async function ensureDirs(): Promise<void> {
  await mkdir(FIXTURES_DIR, { recursive: true })
  await mkdir(RESULTS_DIR, { recursive: true })
}

export async function listFixtures(): Promise<Fixture[]> {
  await ensureDirs()

  const entries = await readdir(FIXTURES_DIR, { withFileTypes: true })

  return entries
    .filter((e) => e.isFile() && isSupportedImage(e.name))
    .map((e) => {
      const id = e.name.slice(0, e.name.lastIndexOf('.'))
      return {
        id,
        imagePath: join(FIXTURES_DIR, e.name),
        expectedPath: join(FIXTURES_DIR, `${id}.expected.json`),
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Короткая метка набора моделей — часть ключа кэша.
 *
 * Без неё прогон того же чека на другой модели вернул бы результат
 * предыдущей, и сравнение моделей молча не работало бы.
 */
export function modelTag(models: string[]): string {
  const primary = models[0] ?? 'none'
  return primary
    .replace(/:free$/, '-free')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .toLowerCase()
}

/**
 * Имя файла результата включает вариант, версию промпта, модель и хеш
 * изображения. Каждая составляющая, изменившись, обесценивает кэш —
 * иначе после правки промпта или смены модели вернулся бы старый ответ.
 */
export function resultPath(
  fixtureId: string,
  kind: string,
  promptVersion: string,
  models: string[],
  sourceSha256: string,
): string {
  const name = [
    fixtureId,
    kind,
    promptVersion,
    modelTag(models),
    sourceSha256.slice(0, 8),
    'json',
  ].join('.')
  return join(RESULTS_DIR, name)
}

export interface StoredResult {
  fixtureId: string
  kind: string
  promptVersion: string
  modelTag: string
  requestedModels: string[]
  sourceSha256: string
  runAt: string
  ok: boolean
  model: string
  jsonMode: string
  attempts: number
  durationMs: number
  costMicros: number
  error?: string
  data: unknown
  raw: unknown
  ocrText?: string
}

/** Читает все сохранённые прогоны. Используется для сравнения моделей. */
export async function listResults(): Promise<StoredResult[]> {
  await ensureDirs()
  const entries = await readdir(RESULTS_DIR, { withFileTypes: true })
  const results: StoredResult[] = []

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    try {
      const parsed = JSON.parse(await readFile(join(RESULTS_DIR, entry.name), 'utf8'))
      if (parsed && typeof parsed === 'object' && 'fixtureId' in parsed) {
        results.push(parsed as StoredResult)
      }
    } catch {
      // повреждённый файл результата пропускаем
    }
  }

  return results
}

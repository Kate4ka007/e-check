import { mkdir, readdir } from 'node:fs/promises'
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
 * Имя файла результата включает вариант, версию промпта и хеш изображения.
 *
 * Хеш в имени означает, что подменённое изображение не подхватит чужой
 * результат, а версия промпта — что после правки промпта прогон выполнится
 * заново, а не вернёт старый ответ из кэша.
 */
export function resultPath(
  fixtureId: string,
  kind: string,
  promptVersion: string,
  sourceSha256: string,
): string {
  return join(RESULTS_DIR, `${fixtureId}.${kind}.${promptVersion}.${sourceSha256.slice(0, 8)}.json`)
}

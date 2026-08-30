/**
 * Создаёт заготовку разметки для каждого чека, у которого её ещё нет.
 *
 *   pnpm annotate            пустые шаблоны
 *   pnpm annotate -- --from-result vision
 *
 * Второй режим заполняет шаблон ответом модели, чтобы вы правили, а не
 * набирали с нуля. Экономит время, но искажает измерение: глядя на готовый
 * ответ, легко пропустить ошибку, которую заметили бы при наборе вручную.
 *
 * Для первых чеков лучше набрать руками. Режим --from-result имеет смысл
 * позже, когда набор растёт, а порядок ошибок уже понятен.
 */
import { access, readFile, writeFile } from 'node:fs/promises'
import { listFixtures, resultPath } from './paths.js'
import { PROMPT_VERSION } from './prompt.js'
import { prepareImage } from './image.js'
import type { ParsedReceipt } from './schema.js'

const EMPTY_TEMPLATE: ParsedReceipt = {
  merchantName: null,
  purchasedAt: null,
  purchasedTime: null,
  currency: null,
  items: [],
  subtotal: null,
  taxTotal: null,
  discountTotal: null,
  total: null,
}

const EXAMPLE_COMMENT = {
  _README: [
    'Заполните поля так, как напечатано на чеке. Это эталон, с которым',
    'сравнивается ответ модели, поэтому важна точность.',
    '',
    'Суммы — строкой, ровно как на чеке: "2,78", а не 2.78 и не 278.',
    'Дата — YYYY-MM-DD. Валюта — три буквы ISO: EUR, PLN, USD.',
    'Если поля на чеке нет — оставьте null.',
    '',
    'В items включайте только строки чека: товары, скидки отдельной строкой,',
    'залог за тару. Итоги, налоговую разбивку и реквизиты не включайте.',
    '',
    'lineType: ITEM | DISCOUNT | DEPOSIT | DEPOSIT_RETURN | FEE',
    'unit: PCS | KG | G | L | ML | M',
    'categorySlug: groceries | restaurants | household | transport | health |',
    '              personal_care | clothing | electronics | entertainment |',
    '              services | other',
    '',
    'Пример позиции:',
    '{ "name": "MILCH 3,5%", "lineType": "ITEM", "quantity": "1", "unit": "PCS",',
    '  "unitPrice": "1,29", "totalPrice": "1,29", "categorySlug": "groceries" }',
    '',
    'Пример весового товара:',
    '{ "name": "TOMATEN", "lineType": "ITEM", "quantity": "0,532", "unit": "KG",',
    '  "unitPrice": "2,99", "totalPrice": "1,59", "categorySlug": "groceries" }',
    '',
    'Эту строку _README можно удалить.',
  ],
}

const exists = async (path: string) => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function main() {
  const args = process.argv.slice(2)
  const fromResultIndex = args.indexOf('--from-result')
  const fromResult = fromResultIndex !== -1 ? args[fromResultIndex + 1] : undefined
  const overwrite = args.includes('--overwrite')

  const fixtures = await listFixtures()

  if (fixtures.length === 0) {
    console.error(
      'Не найдено изображений в spike/fixtures/private/\n' +
        'Положите туда фотографии чеков и запустите снова.',
    )
    process.exit(1)
  }

  let created = 0
  let skipped = 0

  for (const fixture of fixtures) {
    if (!overwrite && (await exists(fixture.expectedPath))) {
      skipped++
      console.log(`  ${fixture.id}  разметка уже есть, пропускаю`)
      continue
    }

    let body: unknown = { ...EXAMPLE_COMMENT, ...EMPTY_TEMPLATE }

    if (fromResult) {
      const image = await prepareImage(fixture.imagePath)
      const path = resultPath(fixture.id, fromResult, PROMPT_VERSION, image.sourceSha256)
      try {
        const stored = JSON.parse(await readFile(path, 'utf8')) as { data: ParsedReceipt | null }
        if (stored.data) {
          body = { ...EXAMPLE_COMMENT, ...stored.data }
          console.log(`  ${fixture.id}  заполнено ответом модели — ПРОВЕРЬТЕ КАЖДОЕ ПОЛЕ`)
        }
      } catch {
        console.log(`  ${fixture.id}  результата прогона нет, создаю пустой шаблон`)
      }
    }

    await writeFile(fixture.expectedPath, JSON.stringify(body, null, 2), 'utf8')
    created++
    if (!fromResult) console.log(`  ${fixture.id}  создан пустой шаблон`)
  }

  console.log(`\nСоздано: ${created}, пропущено: ${skipped}`)
  console.log(`\nЗаполните файлы *.expected.json в spike/fixtures/private/, затем: pnpm score\n`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

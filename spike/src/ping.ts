/**
 * Проверяет ключ и доступность моделей одним дешёвым текстовым запросом.
 *
 *   pnpm ping                                     модели из VISION_MODELS
 *   pnpm ping -- openai/gpt-4o-mini google/x:free произвольный список
 *
 * Полезно перед прогоном: отделяет «модель недоступна» от «промпт плохой».
 */
import OpenAI from 'openai'
import { config } from './config.js'
import { OPENROUTER_BASE_URL } from './constants.js'

const client = new OpenAI({
  apiKey: config.OPENROUTER_API_KEY,
  baseURL: OPENROUTER_BASE_URL,
  timeout: 60_000,
  maxRetries: 0,
})

async function ping(model: string) {
  const startedAt = Date.now()
  try {
    // usage.include — расширение OpenRouter: возвращает фактическую стоимость.
    // Передаётся в теле запроса, а не в options: options.body заменил бы тело целиком.
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
      // С запасом: модели с рассуждением тратят бюджет на размышление
      // и при малом лимите возвращают пустой ответ.
      max_tokens: 200,
      temperature: 0,
      usage: { include: true },
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming)

    const usage = completion.usage as (OpenAI.CompletionUsage & { cost?: number }) | undefined
    const cost = usage?.cost ?? 0
    const reply = completion.choices[0]?.message?.content?.trim().slice(0, 20) ?? '<пусто>'

    console.log(
      `  ok    ${model.padEnd(46)} ${String(Date.now() - startedAt).padStart(5)}мс  ` +
        `${cost === 0 ? 'бесплатно' : `$${cost.toFixed(6)}`}  "${reply}"`,
    )
    return true
  } catch (error) {
    const status = (error as { status?: number }).status
    const message = (error as Error).message
    const reason =
      status === 401
        ? 'ключ отклонён'
        : status === 403
          ? 'запрещено — вероятно, политика данных в настройках OpenRouter'
          : status === 402
            ? 'нужно пополнить баланс'
            : status === 404
              ? 'модель недоступна'
              : status === 429
                ? 'лимит запросов'
                : message.slice(0, 60)
    console.log(`  FAIL  ${model.padEnd(46)} ${reason}`)
    return false
  }
}

async function main() {
  const models = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const list = models.length > 0 ? models : config.VISION_MODELS

  if (list.length === 0) {
    console.error('\nНечего проверять. Укажите модели аргументом или заполните VISION_MODELS.\n')
    process.exit(1)
  }

  console.log(`\nПроверка ${list.length} моделей:\n`)

  let alive = 0
  for (const model of list) {
    if (await ping(model)) alive++
  }

  console.log(`\nДоступно: ${alive} из ${list.length}\n`)
  if (alive === 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

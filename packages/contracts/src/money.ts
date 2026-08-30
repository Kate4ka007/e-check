/**
 * Деньги — всегда целое число минорных единиц, см. ADR-0006.
 *
 * Число с плавающей точкой здесь недопустимо: 0.1 + 0.2 не равно 0.3,
 * а чек из сорока позиций складывается сорок раз.
 */

/** Валюты без дробной части. Список ISO 4217, только встречающиеся на практике. */
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'HUF', 'TWD'])

/** Валюты с тремя знаками после запятой. */
const THREE_DECIMAL = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'OMR', 'TND', 'LYD'])

export function currencyExponent(currency: string | null | undefined): number {
  if (!currency) return 2
  const code = currency.toUpperCase()
  if (ZERO_DECIMAL.has(code)) return 0
  if (THREE_DECIMAL.has(code)) return 3
  return 2
}

/**
 * Переводит сумму, напечатанную на чеке, в минорные единицы.
 *
 * Разделители на чеках непредсказуемы: "1 234,50", "1,234.50", "1234.5".
 * Последний разделитель считается десятичным, все предыдущие —
 * группировкой разрядов. Возвращает null, если разобрать не удалось:
 * молча подставленный ноль исказил бы сверку сумм.
 */
export function parseMoneyToMinor(
  raw: string | null | undefined,
  currency: string | null | undefined,
): number | null {
  if (raw === null || raw === undefined) return null

  const text = raw.trim()
  if (text === '') return null

  const negative = text.startsWith('-') || text.startsWith('−')
  const digitsAndSeparators = text.replace(/[^\d.,]/g, '')
  if (digitsAndSeparators === '') return null

  const lastComma = digitsAndSeparators.lastIndexOf(',')
  const lastDot = digitsAndSeparators.lastIndexOf('.')
  const decimalAt = Math.max(lastComma, lastDot)

  let integerPart: string
  let fractionPart: string

  if (decimalAt === -1) {
    integerPart = digitsAndSeparators
    fractionPart = ''
  } else {
    const tail = digitsAndSeparators.slice(decimalAt + 1)
    // Три цифры после разделителя — это скорее всего разряды, а не копейки:
    // "1.234" на чеке означает тысячу двести тридцать четыре.
    if (tail.length === 3 && digitsAndSeparators.length > 4) {
      integerPart = digitsAndSeparators
      fractionPart = ''
    } else {
      integerPart = digitsAndSeparators.slice(0, decimalAt)
      fractionPart = tail
    }
  }

  const digits = integerPart.replace(/[^\d]/g, '')
  if (digits === '' && fractionPart === '') return null

  const exponent = currencyExponent(currency)
  const normalizedFraction = fractionPart.replace(/[^\d]/g, '').slice(0, exponent).padEnd(exponent, '0')

  const minor = Number(digits || '0') * 10 ** exponent + Number(normalizedFraction || '0')
  if (!Number.isFinite(minor)) return null

  return negative ? -minor : minor
}

/** Минорные единицы в строку без символа валюты: 12817 → "128.17". */
export function formatMinor(minor: number, currency: string | null | undefined): string {
  const exponent = currencyExponent(currency)
  const negative = minor < 0
  const absolute = Math.abs(minor)

  if (exponent === 0) return `${negative ? '-' : ''}${absolute}`

  const unit = 10 ** exponent
  const whole = Math.floor(absolute / unit)
  const fraction = String(absolute % unit).padStart(exponent, '0')

  return `${negative ? '-' : ''}${whole}.${fraction}`
}

/** Для отображения: 12817 BYN → "128,17 BYN" по правилам локали. */
export function formatMoney(
  minor: number | null | undefined,
  currency: string | null | undefined,
  locale = 'ru-RU',
): string {
  if (minor === null || minor === undefined) return '—'

  const exponent = currencyExponent(currency)
  const value = minor / 10 ** exponent

  if (!currency) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
    }).format(value)
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
    }).format(value)
  } catch {
    // Неизвестный код валюты Intl отвергает исключением
    return `${formatMinor(minor, currency)} ${currency}`
  }
}

/**
 * Количество хранится строкой: 0.532 в виде числа с плавающей точкой
 * теряет точность, а количество участвует в сверке сумм.
 */
export function parseQuantity(raw: string | null | undefined): number {
  if (!raw) return 1
  const normalized = raw.replace(',', '.').replace(/[^\d.]/g, '')
  const value = Number.parseFloat(normalized)
  return Number.isFinite(value) ? value : 1
}

/**
 * Перевод денежных строк с чека в минорные единицы.
 *
 * Модель возвращает то, что напечатано ("2,78", "1 234.50", "-0,25").
 * Разбор и умножение выполняет код — см. ADR-0006 и Принцип 3.
 */

/** Валюты, у которых число знаков после запятой отличается от двух. */
const EXPONENT_OVERRIDES: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  ISK: 0,
  HUF: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  JOD: 3,
  TND: 3,
}

export function currencyExponent(currency: string | null): number {
  if (!currency) return 2
  return EXPONENT_OVERRIDES[currency.toUpperCase()] ?? 2
}

/**
 * Разбирает денежную строку в минорные единицы.
 *
 * Отдельно обрабатывается неоднозначность разделителей: "1.234" — это
 * тысяча двести тридцать четыре в немецком формате или одна целая
 * двести тридцать четыре тысячных. Решается по количеству цифр после
 * разделителя: ровно три цифры и отсутствие второго разделителя означают
 * разделитель тысяч, если валюта двузначная.
 */
export function parseMoneyToMinor(raw: string | null, currency: string | null): number | null {
  if (raw === null) return null

  const exponent = currencyExponent(currency)
  let s = raw
    .trim()
    .replace(/\s/g, '')
    .replace(/[€$£₽zł]/gi, '')
  if (s === '') return null

  const negative = s.startsWith('-')
  if (negative) s = s.slice(1)

  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  const sepIndex = Math.max(lastDot, lastComma)

  let integerPart: string
  let fractionPart: string

  if (sepIndex === -1) {
    integerPart = s
    fractionPart = ''
  } else {
    const tail = s.slice(sepIndex + 1)
    const hasBothSeparators = lastDot !== -1 && lastComma !== -1
    const looksLikeThousands = !hasBothSeparators && tail.length === 3 && exponent === 2

    if (looksLikeThousands) {
      integerPart = s.replace(/[.,]/g, '')
      fractionPart = ''
    } else {
      integerPart = s.slice(0, sepIndex).replace(/[.,]/g, '')
      fractionPart = tail
    }
  }

  if (!/^\d*$/.test(integerPart) || !/^\d*$/.test(fractionPart)) return null
  if (integerPart === '' && fractionPart === '') return null

  const paddedFraction = fractionPart.padEnd(exponent, '0').slice(0, exponent)
  const minor = Number(integerPart || '0') * 10 ** exponent + Number(paddedFraction || '0')

  if (!Number.isSafeInteger(minor)) return null
  return negative ? -minor : minor
}

export function parseQuantity(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.')
  const value = Number(normalized)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function formatMinor(minor: number | null, currency: string | null): string {
  if (minor === null) return '—'
  const exponent = currencyExponent(currency)
  const value = minor / 10 ** exponent
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency ?? 'EUR',
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(value)
}

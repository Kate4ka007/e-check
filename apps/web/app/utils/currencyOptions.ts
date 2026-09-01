/**
 * Каталог валют для селектов в UI.
 *
 * API принимает любой ISO-4217 код из трёх букв; этот список — только
 * варианты в формах, не доменное ограничение.
 */
export const CURRENCY_CODES = ['BYN', 'EUR', 'USD', 'PLN', 'RUB', 'UAH', 'GBP', 'CZK'] as const

export const currencyOptions: Array<{ label: string; value: string }> = CURRENCY_CODES.map(
  (code) => ({
    label: code,
    value: code,
  }),
)

import { ru, type TranslationKey } from '~/i18n/ru'

const dictionary: Record<string, string> = ru

/**
 * Перевод по ключу. Неизвестный ключ возвращается как есть — в интерфейсе
 * это заметно сразу, в отличие от пустой строки.
 */
export function t(key: TranslationKey | (string & {}), params?: Record<string, string | number>) {
  const template = dictionary[key] ?? key
  if (!params) return template

  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}

export function useT() {
  return { t }
}

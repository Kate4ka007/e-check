/**
 * Компактные поля на узком экране.
 *
 * size="xs" у Nuxt UI всё ещё даёт ~14px — для плотной таблицы
 * позиций на телефоне нужно явно 12px через ui.base.
 */
export const inputUi = {
  base: 'text-xs py-1 px-2 min-h-7 lg:text-sm lg:min-h-8 lg:py-1.5 lg:px-2.5',
}

export const inputUiRight = {
  base: 'text-xs py-1 px-1.5 min-h-7 text-right lg:text-sm lg:min-h-8 lg:py-1.5 lg:px-2.5',
}

export const selectUi = {
  base: 'w-full',
  trigger: 'text-xs py-1 px-2 min-h-7 lg:text-sm lg:min-h-8 lg:py-1.5 lg:px-2.5',
  value: 'text-xs truncate lg:text-sm',
  item: 'text-xs lg:text-sm',
  itemLabel: 'text-xs lg:text-sm',
}

export const textareaUi = {
  base: 'text-xs py-1.5 px-2 lg:text-sm lg:py-2 lg:px-2.5',
}

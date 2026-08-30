/**
 * Словарь интерфейса.
 *
 * Тексты вынесены в ключи, а не написаны в шаблонах: перевод в планах,
 * а переименовывать разбросанные по компонентам строки поздно. Полноценный
 * модуль i18n не подключён намеренно — приложение за логином, префиксы
 * локали в маршрутах не нужны, и словаря с функцией подстановки достаточно.
 */
export const ru = {
  'app.title': 'Чеки',

  'nav.dashboard': 'Сводка',
  'nav.receipts': 'Чеки',
  'nav.analytics': 'Аналитика',
  'nav.settings': 'Настройки',
  'nav.add': 'Добавить чек',

  'category.groceries': 'Продукты',
  'category.restaurants': 'Кафе и рестораны',
  'category.household': 'Дом и хозяйство',
  'category.transport': 'Транспорт',
  'category.health': 'Здоровье',
  'category.personal_care': 'Уход за собой',
  'category.clothing': 'Одежда',
  'category.electronics': 'Техника',
  'category.entertainment': 'Развлечения',
  'category.services': 'Услуги',
  'category.other': 'Прочее',
  'category.uncategorized': 'Без категории',

  'lineType.ITEM': 'Товар',
  'lineType.DISCOUNT': 'Скидка',
  'lineType.DEPOSIT': 'Залог за тару',
  'lineType.DEPOSIT_RETURN': 'Возврат залога',
  'lineType.FEE': 'Сбор',

  'unit.PCS': 'шт',
  'unit.KG': 'кг',
  'unit.G': 'г',
  'unit.L': 'л',
  'unit.ML': 'мл',
  'unit.M': 'м',

  'receipt.review.title': 'Проверка чека',
  'receipt.review.subtitleScan': 'Распознано моделью. Проверьте и поправьте, что нужно.',
  'receipt.review.subtitleManual': 'Ручной ввод. Заполните то, что есть на чеке.',

  'receipt.field.merchant': 'Магазин',
  'receipt.field.purchasedAt': 'Дата',
  'receipt.field.purchasedTime': 'Время',
  'receipt.field.currency': 'Валюта',
  'receipt.field.total': 'Итого',
  'receipt.field.subtotal': 'Сумма до скидок',
  'receipt.field.taxTotal': 'Налог',
  'receipt.field.discountTotal': 'Скидки',
  'receipt.field.note': 'Заметка',

  'receipt.field.merchantPlaceholder': 'Название как на чеке',
  'receipt.field.notePlaceholder': 'Для чего эта покупка, если нужно помнить',

  'receipt.items.title': 'Позиции',
  'receipt.items.empty': 'Ни одной позиции. Можно сохранить только итоговую сумму.',
  'receipt.items.add': 'Добавить позицию',
  'receipt.items.remove': 'Удалить позицию',
  'receipt.items.name': 'Название',
  'receipt.items.quantity': 'Кол-во',
  'receipt.items.unitPrice': 'Цена',
  'receipt.items.total': 'Сумма',
  'receipt.items.category': 'Категория',
  'receipt.items.type': 'Тип строки',
  'receipt.items.newName': 'Новая позиция',

  'receipt.sum.matches': 'Сумма позиций сходится с итогом',
  'receipt.sum.mismatch': 'Сумма позиций расходится с итогом',
  'receipt.sum.mismatchHint':
    'Так бывает при округлениях и скидках на весь чек. Сохранить можно и так.',
  'receipt.sum.noTotal': 'Итоговая сумма не указана',
  'receipt.sum.items': 'позиции',
  'receipt.sum.total': 'итог',
  'receipt.sum.difference': 'разница',

  'receipt.confidence.low': 'Модель не уверена в этом поле',
  'receipt.confidence.legend': 'Подсвечены поля, в которых модель не уверена',

  'receipt.source.USER': 'Исправлено вручную',
  'receipt.source.AI': 'Распознано моделью',
  'receipt.source.OCR': 'Распознано моделью',

  'receipt.image.zoomIn': 'Увеличить',
  'receipt.image.zoomOut': 'Уменьшить',
  'receipt.image.rotate': 'Повернуть',
  'receipt.image.reset': 'Исходный размер',
  'receipt.image.missing': 'Изображения нет',
  'receipt.image.show': 'Показать чек',
  'receipt.image.hide': 'Скрыть чек',

  'receipt.action.save': 'Сохранить',
  'receipt.action.confirm': 'Подтвердить',
  'receipt.action.saving': 'Сохраняем…',
  'receipt.action.saved': 'Сохранено',
  'receipt.action.discard': 'Отменить правки',

  'receipt.status.DRAFT': 'Черновик',
  'receipt.status.CONFIRMED': 'Подтверждён',
  'receipt.status.ARCHIVED': 'В архиве',

  'processing.PENDING': 'В очереди',
  'processing.PROCESSING': 'Читаем чек…',
  'processing.COMPLETED': 'Распознан',
  'processing.FAILED': 'Не удалось прочитать',
  'processing.MANUAL': 'Введён вручную',

  'common.notSet': 'не указано',
  'common.cancel': 'Отмена',
  'common.of': 'из',
} as const

export type TranslationKey = keyof typeof ru

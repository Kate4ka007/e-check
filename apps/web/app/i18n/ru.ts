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
  'processing.SKIPPED': 'Введён вручную',
  'processing.stage.PREPARING': 'Готовим изображение…',
  'processing.stage.EXTRACTING': 'Извлекаем данные…',
  'processing.stage.NORMALIZING': 'Проверяем результат…',
  'processing.failedHint': 'Не удалось распознать чек. Можно попробовать ещё раз или ввести данные вручную.',
  'processing.timeout': 'Обработка занимает больше обычного. Чек появится в списке, когда распознавание завершится.',

  'common.notSet': 'не указано',
  'common.cancel': 'Отмена',
  'common.of': 'из',

  'auth.login.title': 'Вход',
  'auth.login.subtitle': 'Войдите, чтобы продолжить работу с чеками.',
  'auth.login.action': 'Войти',
  'auth.login.noAccount': 'Нет аккаунта?',
  'auth.login.registerLink': 'Зарегистрироваться',

  'auth.register.title': 'Регистрация',
  'auth.register.subtitle': 'Создайте аккаунт для учёта расходов.',
  'auth.register.action': 'Создать аккаунт',
  'auth.register.hasAccount': 'Уже есть аккаунт?',
  'auth.register.loginLink': 'Войти',
  'auth.register.timezoneHint': 'Часовой пояс: {timezone}',

  'auth.field.email': 'Email',
  'auth.field.password': 'Пароль',
  'auth.field.passwordHint': 'Не короче 10 символов',
  'auth.field.baseCurrency': 'Валюта по умолчанию',

  'auth.action.logout': 'Выйти',

  'auth.error.invalidCredentials': 'Неверный email или пароль',
  'auth.error.emailTaken': 'Этот email уже занят',
  'auth.error.sessionExpired': 'Сессия истекла — войдите снова',
  'auth.error.sessionRevoked': 'Сессия отозвана — войдите снова',
  'auth.error.unauthenticated': 'Нужно войти в аккаунт',
  'auth.error.passwordTooWeak': 'Пароль слишком слабый',
  'auth.error.registrationDisabled': 'Регистрация временно закрыта',
  'auth.error.validationFailed': 'Проверьте введённые данные',
  'auth.error.internal': 'Что-то пошло не так. Попробуйте позже.',

  'upload.title': 'Новый чек',
  'upload.subtitle': 'Сфотографируйте или выберите изображение чека.',
  'upload.pickFile': 'Выбрать файл',
  'upload.camera': 'Камера',
  'upload.manualEntry': 'Ввести данные вручную без распознавания',
  'upload.action': 'Загрузить',
  'upload.uploading': 'Загружаем…',
  'upload.backToList': 'К списку чеков',
  'upload.success.title': 'Чек загружен',
  'upload.success.description':
    'Файл сохранён. После распознавания можно проверить данные на экране чека.',
  'upload.processingDone': 'Чек распознан. Можно проверить данные перед сохранением.',
  'upload.openReceipt': 'Открыть чек',
  'upload.error.internal': 'Не удалось загрузить чек. Попробуйте позже.',
  'upload.error.fileMissing': 'Выберите файл',
  'upload.error.fileTooLarge': 'Файл слишком большой',
  'upload.error.fileTypeUnsupported': 'Формат файла не поддерживается',
  'upload.error.imageInvalid': 'Не удалось прочитать изображение',
  'upload.error.idempotency': 'Повтор запроса с другими данными',
  'upload.error.rateLimit': 'Слишком много загрузок. Подождите немного.',
} as const

export type TranslationKey = keyof typeof ru

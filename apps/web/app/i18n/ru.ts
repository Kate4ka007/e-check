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

  'landing.eyebrow': 'Учёт расходов по чекам',
  'landing.titleLine1': 'Сфотографируйте чек —',
  'landing.titleLine2': 'мы разберём',
  'landing.titleHighlight': 'покупку',
  'landing.subtitleLine1': 'Загрузите фото или введите данные вручную,',
  'landing.subtitleLine2': 'проверьте распознанные поля и сохраните расходы в одном месте.',
  'landing.hasAccount': 'Уже есть аккаунт?',
  'landing.action.demo': 'Посмотреть демо',
  'landing.action.login': 'Войти',
  'landing.action.register': 'Регистрация',
  'landing.action.registerFree': 'Создать аккаунт бесплатно',
  'landing.action.back': 'На главную',
  'landing.features.title': 'После первого чека',
  'landing.feature.scan.title': 'Распознавание',
  'landing.feature.scan.description':
    'Модель достаёт магазин, дату, позиции и итог. Неуверенные поля помечаются — их видно до сохранения.',
  'landing.feature.review.title': 'Сверка сумм',
  'landing.feature.review.description':
    'Сумма позиций сверяется с итогом чека. Любую строку можно поправить, пока расход не попал в учёт.',
  'landing.feature.track.title': 'История',
  'landing.feature.track.description':
    'Подтверждённые чеки в списке: поиск и фильтры по дате, категории и магазину.',
  'landing.feature.analytics.title': 'Сводка',
  'landing.feature.analytics.description':
    'Сколько потратили за период и как это выглядит на фоне предыдущего.',
  'landing.feature.charts.title': 'Графики',
  'landing.feature.charts.description':
    'Динамика расходов и разбивка по категориям и магазинам. Суммы сходятся с чеками.',
  'landing.feature.categories.title': 'Категории',
  'landing.feature.categories.description':
    'Позиции раскладываются по категориям: продукты, кафе, транспорт и остальные.',
  'landing.cta.title': 'Готовы начать?',
  'landing.cta.description':
    'Создайте аккаунт и сохраните первый чек. Аналитика появится сама — по подтверждённым покупкам.',
  'landing.footer': 'Чеки — личный учёт расходов',

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
  'receipt.list.emptyTitle': 'Пока нет чеков',
  'receipt.list.emptyDescription': 'Загрузите фото чека — мы распознаем его и сохраним здесь.',
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

  'receipt.source.USER': 'Вы изменили это поле',
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
  'receipt.action.confirming': 'Подтверждаем…',
  'receipt.action.confirmed': 'Подтверждено',
  'receipt.action.discard': 'Отменить правки',
  'receipt.confirm.warningsTitle': 'Чек сохранён с предупреждениями',
  'receipt.confirm.sumMismatch': 'Сумма позиций расходится с итогом на {amount} коп.',
  'receipt.error.saveFailed': 'Не удалось сохранить изменения',
  'receipt.error.confirmFailed': 'Не удалось подтвердить чек',
  'receipt.error.incomplete': 'Заполните обязательные поля: дата, валюта и итог',

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
  'processing.failedHint':
    'Не удалось распознать чек. Можно попробовать ещё раз или ввести данные вручную.',
  'processing.retry': 'Повторить распознавание',
  'processing.timeout':
    'Обработка занимает больше обычного. Чек появится в списке, когда распознавание завершится.',
  'processing.alreadyRunning': 'Чек уже обрабатывается',

  'common.notSet': 'не указано',
  'common.cancel': 'Отмена',
  'common.of': 'из',

  'tour.next': 'Далее',
  'tour.back': 'Назад',
  'tour.finish': 'Понятно',

  'auth.login.title': 'Вход',
  'auth.login.subtitle': 'Войдите, чтобы продолжить работу с чеками.',
  'auth.login.action': 'Войти',
  'auth.login.noAccount': 'Нет аккаунта?',
  'auth.login.registerLink': 'Зарегистрироваться',
  'auth.login.demoLink': 'Посмотреть демо без регистрации',

  'demo.title': 'Демо: проверка чека',
  'demo.subtitle':
    'Попробуйте отредактировать распознанный чек. Это учебный пример — данные не сохраняются.',
  'demo.banner': 'Демо-режим',
  'demo.action.register': 'Зарегистрироваться',
  'demo.notice.save': 'В демо правки не сохраняются. Зарегистрируйтесь, чтобы вести учёт чеков.',
  'demo.notice.confirm':
    'Подтверждение доступно после регистрации — тогда чек попадёт в ваш список расходов.',

  'demo.tour.start': 'Обучение',
  'demo.tour.welcome.title': 'Добро пожаловать',
  'demo.tour.welcome.description':
    'Краткий тур покажет, как проверять чек после распознавания: что можно править и зачем нужны кнопки внизу.',
  'demo.tour.image.title': 'Фото чека',
  'demo.tour.image.description':
    'Слева — изображение чека. На телефоне его можно свернуть, чтобы освободить место для полей.',
  'demo.tour.fields.title': 'Шапка чека',
  'demo.tour.fields.description':
    'Магазин, дата, валюта и итог редактируются свободно. Распознавание — черновик, решение всегда за вами.',
  'demo.tour.sumCheck.title': 'Сверка суммы',
  'demo.tour.sumCheck.description':
    'Сумма позиций сравнивается с итогом. Расхождение — повод проверить, а не запрет на сохранение.',
  'demo.tour.items.title': 'Позиции',
  'demo.tour.items.description':
    'Можно менять названия, количество, цены и категории. Жёлтая иконка — модель не уверена в позиции.',
  'demo.tour.actions.title': 'Сохранить и подтвердить',
  'demo.tour.actions.description':
    '«Сохранить» фиксирует правки черновика. «Подтвердить» — когда данные верны и чек готов к учёту.',
  'demo.tour.register.title': 'Готовы начать?',
  'demo.tour.register.description':
    'Зарегистрируйтесь, загрузите свой чек и пройдите тот же сценарий с сохранением данных.',

  'auth.register.title': 'Регистрация',
  'auth.register.subtitle': 'Создайте аккаунт для учёта расходов.',
  'auth.register.action': 'Создать аккаунт',
  'auth.register.hasAccount': 'Уже есть аккаунт?',
  'auth.register.loginLink': 'Войти',
  'auth.register.demoLink': 'Сначала посмотреть демо',
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
  'upload.manualEntry': 'Не распознавать — заполнить данные с фото вручную',
  'upload.createWithoutPhoto': 'Ввести чек без фото',
  'upload.or': 'или',
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

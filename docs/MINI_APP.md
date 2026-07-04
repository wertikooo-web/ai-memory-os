# Telegram Mini App

Этот документ описывает будущую Telegram Mini App для AI Memory OS. На текущем этапе мы не строим полноценный frontend. Цель документа - заранее зафиксировать роль Mini App, границы API и то, как не продублировать бизнес-логику Telegram-бота.

## Текущее состояние проекта

Сейчас проект уже имеет рабочий Telegram MVP:

- `src/telegram/bot.ts` - Telegram interface layer: команды, обработчики текста, голоса и inline-кнопки.
- `src/memory/*` - Memory Core: пользователи, события, записи, OpenCycles, reclassify, удаление и закрытие циклов.
- `src/input/*` - Input Normalization: единая точка для будущих источников входа.
- `src/ai/*` - AI layer: классификация входа, Natural Intent, транскрибация, будущий Morning Focus.
- `src/db/prisma.ts` и `prisma/schema.prisma` - доступ к Supabase/Postgres через Prisma.

Что уже можно переиспользовать для Mini App:

- чтение открытых циклов через `listOpenCycles(userId)`;
- закрытие цикла через `closeOpenCycleById` / будущий `markCycleDone`;
- чтение контекстов через `listLifeEvents(userId)`;
- безопасное удаление `MemoryItem` через `deleteMemoryItemByIdForUser`;
- будущую сборку Today View и Morning Focus поверх тех же OpenCycles.

Что сейчас слишком привязано к Telegram bot:

- форматирование ответов пользователю;
- Telegram inline-кнопки;
- скачивание voice-файла из Telegram;
- callback handlers.

Эту логику не нужно переносить в Mini App. Mini App должен работать через API, а API должен вызывать Memory Core.

## Главный принцип

Telegram Bot и Telegram Mini App должны использовать одно ядро:

```text
Telegram Bot
  -> Memory Core
  -> Supabase/Postgres

Telegram Mini App
  -> API
  -> Memory Core
  -> Supabase/Postgres
```

Бот остается быстрым каналом capture:

- текст;
- голос;
- фото позже;
- ссылки позже;
- быстрые команды.

Mini App становится визуальным интерфейсом для снижения mental load:

- увидеть день;
- увидеть главный фокус;
- отсортировать открытые циклы;
- закрыть выполненное;
- перенести в контекст;
- увидеть перегрузку;
- настроить Morning Focus.

Mini App не должен превращаться в отдельный продукт с отдельной логикой памяти.

## Рекомендуемая структура проекта

Сейчас проект не является монорепо. Поэтому не нужно резко переходить на структуру `apps/telegram-bot`, `apps/mini-app`, `apps/api`.

Безопасный следующий шаг:

```text
src/
  api/
    server.ts
    auth.ts
    routes/
      today.ts
      cycles.ts
      contexts.ts
      settings.ts
  memory/
    views.ts
    cycles.ts
    contexts.ts
    focus.ts
  telegram/
    bot.ts

web/
  miniapp/
    index.html
    src/
      main.ts
      api.ts
      views/
        TodayView.ts
        OpenCyclesView.ts
        ContextsView.ts
```

Почему так:

- текущая структура не ломается;
- Telegram bot остается на месте;
- API появляется как тонкий слой поверх Memory Core;
- Mini App можно собрать отдельно, когда появится готовность;
- позже, если проект вырастет, можно перейти к `apps/` без миграции бизнес-логики.

Пока можно создать только документацию. Код `src/api` и `web/miniapp` стоит добавлять отдельным маленьким шагом.

## Shared Logic

Mini App и Bot должны использовать одни и те же функции Memory Core.

Минимальный список reusable functions:

```ts
buildTodayView(userId: string): Promise<TodayView>
getOpenCycles(userId: string): Promise<OpenCycle[]>
getContexts(userId: string): Promise<Context[]>
markCycleDone(userId: string, cycleId: string): Promise<OpenCycle>
postponeCycle(userId: string, cycleId: string, date: Date): Promise<OpenCycle>
moveCycleToContext(userId: string, cycleId: string, contextId: string): Promise<OpenCycle>
buildMorningFocus(userId: string): Promise<MorningFocus>
```

Первый практичный рефакторинг позже:

```text
src/memory/views.ts
```

Туда можно вынести `buildTodayView(userId)`, который будет читать OpenCycles и Contexts, но не будет знать ничего о Telegram или Mini App.

## Минимальный API

API нужен не как отдельный backend-продукт, а как тонкий слой доступа Mini App к Memory Core.

Первый набор endpoints:

```text
GET  /api/today
GET  /api/cycles
GET  /api/contexts
POST /api/cycles/:id/done
POST /api/cycles/:id/postpone
POST /api/cycles/:id/move
GET  /api/settings
POST /api/settings
```

### GET /api/today

Возвращает Today View:

```json
{
  "date": "2026-07-04",
  "mentalLoad": {
    "openCycles": 124,
    "status": "В голове тише: 124 цикла сохранены"
  },
  "mainFocus": null,
  "today": [],
  "later": [],
  "offloaded": [],
  "contexts": []
}
```

На первом этапе `mainFocus` может быть `null` или простым правилом без LLM.

### GET /api/cycles

Возвращает открытые циклы пользователя:

```json
{
  "items": [
    {
      "id": "...",
      "type": "TASK",
      "title": "Написать письмо в ЖЭК",
      "context": "Дом",
      "urgency": 3,
      "importance": 4,
      "energy": 2,
      "dueDate": null
    }
  ]
}
```

### GET /api/contexts

Возвращает LifeEvents/contexts:

```json
{
  "items": [
    {
      "id": "...",
      "name": "Inbox",
      "memoryItemsCount": 42,
      "openCyclesCount": 12
    }
  ]
}
```

### POST /api/cycles/:id/done

Закрывает OpenCycle через `closedAt`.

Важно: API не должен доверять id из клиента. Он обязан проверять `userId`.

### POST /api/cycles/:id/move

Будущий endpoint для переноса цикла в контекст.

Пока у `OpenCycle` есть строковое поле `context`, но нет строгой связи с `LifeEvent`. Перед полноценным move нужно решить, связываем ли OpenCycle с LifeEvent через `lifeEventId`.

## Telegram Mini App Authentication

Telegram Mini App передает backend-у `initData`.

Правильный поток:

```text
Mini App opens inside Telegram
  -> window.Telegram.WebApp.initData
  -> API request with Authorization-like header or body field
  -> backend validates initData signature using BOT_TOKEN
  -> backend extracts Telegram user id
  -> getOrCreateUser by telegramId
  -> API works only inside this user scope
```

Что обязательно проверить на backend:

- подпись `initData`;
- `auth_date`, чтобы не принимать очень старые данные;
- наличие `user.id`;
- соответствие Telegram user id существующему `User.telegramId`;
- все запросы к данным фильтруются по `userId`.

На этом этапе реализацию auth можно оставить как TODO, но архитектурно Mini App нельзя подключать к API без проверки `initData`.

## UX Concept

Главный экран Mini App - Today View.

Цель экрана: не показать человеку 125 дел, а снизить ощущение перегруза.

Структура:

```text
Header
  Сегодня
  дата
  короткий статус: "В голове тише: 124 цикла сохранены"

Section: Главный фокус дня
  1 главный элемент или пустое состояние

Section: Сделать сегодня
  3-5 элементов максимум

Section: Если останется время
  3-5 элементов

Section: Можно не держать в голове
  сохраненные циклы, которые не требуют внимания сегодня

Section: Контексты
  Inbox, Дом, Покупки, AI Memory OS, VoiceBridge...

Bottom actions
  Добавить мысль
  Открыть бота
```

Важное UX-правило:

Mini App не должен показывать весь хаос сразу. Если у пользователя 125 открытых циклов, первый экран должен показать 3-7 реально важных вещей и дать ощущение контроля.

## Что не делать сейчас

Не делать сейчас:

- полноценный frontend;
- сложный дизайн;
- drag-and-drop;
- графики ради графиков;
- email/password auth;
- Supabase Auth;
- отдельный backend-сервис;
- Docker;
- Redis;
- workers;
- отдельную мобильную app;
- переписывание Telegram bot под монорепо.

## Минимальный следующий шаг

Следующий технический шаг после этой документации:

1. Создать `src/memory/views.ts`.
2. Реализовать `buildTodayView(userId)` без LLM.
3. Переиспользовать `listOpenCycles` и `listLifeEvents`.
4. Добавить простой API endpoint `GET /api/today` через минимальный HTTP server.
5. Пока не делать frontend, только проверить JSON.

Это даст Mini App-ready backend без преждевременного UI.

## Риски

1. Дублирование логики между bot и Mini App.

Решение: все операции с памятью должны жить в `src/memory`, а не в `src/telegram` или будущем `web/miniapp`.

2. Преждевременный frontend.

Решение: сначала API и shared functions, потом простой Today View.

3. Непроверенный Telegram initData.

Решение: не открывать API без backend-валидации подписи.

4. Перегрузка пользователя списками.

Решение: Today View должен показывать ограниченный набор фокусов, а не все OpenCycles.

5. Слабая модель контекстов.

Решение: перед move-to-context решить, должен ли `OpenCycle` ссылаться на `LifeEvent` через `lifeEventId`, а не только хранить строку `context`.
## Morning Focus Builder

Morning Focus Builder - это ядро будущего Today View.

Он уже должен жить не в Mini App и не в Telegram bot, а в Memory Core:

```text
src/memory/morningFocus.ts
```

Функция:

```ts
buildMorningFocus(userId: string): Promise<MorningFocusView>
```

Возвращает:

- главный фокус дня;
- сделать сегодня;
- если останется время;
- можно не держать в голове;
- mental load status;
- объяснение выбора.

Mini App не должен сам ранжировать OpenCycles. Он должен получить готовый Today View из API:

```text
GET /api/today
  -> buildMorningFocus(userId)
  -> JSON для Mini App
```

Первый builder может быть rule-based. Это правильно для MVP: так легче понять, почему система выбрала именно эти циклы. LLM можно добавить позже как второй слой, но он не должен скрывать базовую логику ранжирования.
# AI Memory OS

AI Memory OS — персональная внешняя память человека.

Цель проекта — создать систему, куда человек может отправлять фрагменты своей жизни, работы и мыслей, а затем быстро возвращать контекст: что происходило, о чем шла речь, какие были идеи, обещания, решения, файлы и ссылки.

Это не AI-диктофон, не заметочник, не CRM и не файловое хранилище.

## Главная идея

Человек мыслит не отдельными файлами, а событиями, проектами, людьми, встречами, поездками и рабочими контекстами.

Поэтому главная сущность продукта — `LifeEvent`.

`LifeEvent` может быть:

- проектом;
- встречей;
- поездкой;
- темой;
- рабочим контекстом;
- человеком;
- периодом жизни;
- цепочкой решений или идей.

Внутри `LifeEvent` хранятся отдельные записи — `MemoryItem`.

## Первый интерфейс

Первым интерфейсом является Telegram.

Позже могут появиться:

- Web;
- Mobile;
- Voice Pendant;
- Smart Watch;
- API.

Все интерфейсы должны работать через единое ядро памяти — `Memory Core`.

## Current MVP Status

MVP Checkpoint 1 готов. Railway deploy подтвержден: бот работает постоянно без запуска с локального компьютера.

Сейчас работает:

- Telegram bot запускается через long polling локально и на Railway;
- `/start` активирует бота;
- текстовые сообщения сохраняются в Supabase/Postgres;
- пользователь создается или находится по Telegram ID;
- `LifeEvent` с названием `Inbox` создается или находится автоматически;
- каждое текстовое сообщение сохраняется как `MemoryItem` внутри `Inbox`;
- `/events` показывает список событий;
- `/last` показывает последнюю сохраненную запись;
- `/delete_last` удаляет последнюю запись текущего пользователя;
- голосовые сообщения пока не транскрибируются, бот отвечает заглушкой.

Проверенный поток:

```text
Telegram -> grammY bot -> Memory Core -> Prisma -> Supabase/Postgres
```

Пока не добавлено:

- OpenAI;
- транскрибация;
- embeddings;
- поиск;
- summary;
- Redis;
- workers;
- Docker;
- web app;
- mobile app.

## MVP Architecture

Минимальная схема MVP:

```text
Telegram bot -> Memory Core -> Supabase/Postgres -> Search/Recall
```

На первом этапе:

- Railway будет использоваться для деплоя;
- Supabase используется только как PostgreSQL-база;
- Prisma работает через `DATABASE_URL`;
- OpenAI будет подключен позже для транскрибации, анализа и поиска;
- Redis, workers, Docker, web app и mobile app не добавляются.

## Environment

Создай файл `.env` в корне проекта:

```text
D:\AI\ai-memory-os\.env
```

Пример:

```env
BOT_TOKEN="telegram_bot_token_from_botfather"
DATABASE_URL="postgresql://postgres.project_id:database_password@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require"
```

Важно:

- `BOT_TOKEN` берется у Telegram BotFather;
- `DATABASE_URL` берется в Supabase Connect как connection string;
- для Supabase используем pooler connection string, а не direct IPv6 host;
- `.env` не коммитится в Git.

## Запуск локально

Перейди в папку проекта:

```powershell
cd D:\AI\ai-memory-os
```

Установи зависимости:

```powershell
npm install
```

Примени миграции Prisma к Supabase/Postgres:

```powershell
npx.cmd prisma migrate deploy
```

Собери проект:

```powershell
npm.cmd run build
```

Запусти бота:

```powershell
npm.cmd start
```

Окно PowerShell должно оставаться открытым. Пока процесс работает, Telegram bot отвечает.

На этой Windows-машине надежнее использовать `npm.cmd`, потому что обычный `npm` в PowerShell может упереться в Execution Policy.

## Деплой на Railway

Railway используется только для запуска Node.js Telegram bot. Supabase остается отдельной PostgreSQL-базой и подключается через `DATABASE_URL`.

Текущий MVP работает через Telegram long polling. Это самый простой вариант для первого этапа: нам не нужен webhook, публичный HTTP endpoint или отдельный web server.

Что должно быть в Railway Variables:

```text
BOT_TOKEN
DATABASE_URL
```

Секреты нельзя хранить в Git и нельзя вставлять в документацию. Они должны лежать только в `.env` локально и в Variables на Railway.

Базовые команды Railway CLI:

```powershell
npx.cmd @railway/cli status
```

Показывает, к какому Railway project/service подключена текущая папка.

```powershell
npx.cmd @railway/cli variable set BOT_TOKEN --stdin --skip-deploys
npx.cmd @railway/cli variable set DATABASE_URL --stdin --skip-deploys
```

Добавляет переменные окружения. Значение переменной передается через stdin, чтобы не печатать токены в командной строке.

```powershell
npx.cmd @railway/cli up -y --detach --message "Deploy with env vars"
```

Загружает текущую версию проекта на Railway.

```powershell
npx.cmd @railway/cli logs --lines 100
```

Показывает последние логи сервиса.

Важно: при long polling должен работать только один экземпляр бота. Если одновременно запущены локальный бот и Railway bot, Telegram может вернуть ошибку `409 Conflict`. Перед проверкой Railway останови локальный `npm.cmd start`.

Текущий статус: Railway deploy подтвержден, бот отвечает из облака.

## Команды бота

```text
/start
```

Активирует бота и показывает кнопки.

```text
/events
```

Показывает список событий.

```text
/last
```

Показывает последнюю сохраненную запись.

```text
/delete_last
```

Удаляет последнюю запись текущего пользователя.

Любое обычное текстовое сообщение сохраняется в `Inbox`.

## Документация

- [PROJECT.md](docs/PROJECT.md) — что мы строим;
- [PRINCIPLES.md](docs/PRINCIPLES.md) — конституция проекта;
- [VISION.md](docs/VISION.md) — каким продукт должен стать;
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — архитектура MVP;
- [ROADMAP.md](docs/ROADMAP.md) — этапы развития;
- [AGENTS.md](docs/AGENTS.md) — правила для AI-агентов;
- [DECISIONS.md](docs/DECISIONS.md) — принятые архитектурные решения;
- [GLOSSARY.md](docs/GLOSSARY.md) — словарь терминов.

## Принцип разработки

Сначала делаем маленький, стабильный MVP для ежедневного использования одним человеком.

Не усложняем архитектуру заранее.
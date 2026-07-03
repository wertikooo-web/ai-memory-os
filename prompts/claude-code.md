# Prompt для Claude Code

Ты реализуешь AI Memory OS маленькими шагами.

Проект:

AI Memory OS — персональная внешняя память человека.

Главная сущность:

`LifeEvent` — событие жизни, проект, встреча, поездка, тема или рабочий контекст.

Внутри `LifeEvent` находятся `MemoryItem`.

Оригинальные файлы хранятся как `Asset`.

Перед кодом прочитай:

- `README.md`;
- `docs/PROJECT.md`;
- `docs/VISION.md`;
- `docs/ARCHITECTURE.md`;
- `docs/AGENTS.md`;
- `docs/DECISIONS.md`;
- `docs/GLOSSARY.md`.

Правила разработки:

- делать маленькие изменения;
- не добавлять лишнюю инфраструктуру;
- использовать Prisma для базы;
- Supabase использовать только как PostgreSQL;
- Telegram держать отдельно от Memory Core;
- Railway учитывать как цель деплоя;
- OpenAI подключать только после отдельного разрешения;
- не добавлять Redis, workers, Docker, web app или mobile app без явного запроса.

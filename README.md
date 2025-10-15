# SPEC-1 Telegram Presence Tracker

Полный стек для отслеживания статуса online/offline в Telegram: Telethon‑сборщик, FastAPI‑бекенд, PostgreSQL/Redis и Next.js‑дашборд.

---

## 1. Пререквизиты

- Docker Desktop / Docker Engine + Docker Compose v2
- Telegram API credentials (https://my.telegram.org/apps)
- Аккаунт‑сборщик должен иметь отслеживаемых пользователей в контактах и видеть их last seen

---

## 2. Быстрый старт

1. **Скопируйте и заполните окружение**

   ```bash
   cp ops/docker/.env.example ops/docker/.env
   ```

   Заполните `TG_API_ID`, `TG_API_HASH`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Этот файл в git не добавляем.

2. **Запустите базовые сервисы и примените миграции**

   ```bash
   docker compose --env-file ops/docker/.env -f ops/docker/docker-compose.yml up -d postgres redis
   docker compose --env-file ops/docker/.env -f ops/docker/docker-compose.yml run --rm api alembic upgrade head
   ```

3. **Один раз авторизуйте Telethon**

   ```bash
   docker compose --env-file ops/docker/.env -f ops/docker/docker-compose.yml run --rm collector python -m collector.login
   ```

   Введите номер телефона и код/пароль. Сессия сохранится в volume `sessions`.

4. **Запустите весь стек**

   ```bash
   docker compose --env-file ops/docker/.env -f ops/docker/docker-compose.yml up -d
   ```

5. **Доступы**
   - UI: http://localhost:3000
   - REST API/Swagger: http://localhost:8000/docs

---

## 3. Добавление нового пользователя

1. Откройте Swagger → **Authorize** → введите `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
2. Выполните `POST /auth/token`, скопируйте `access_token`.
3. `POST /tracked`:
   ```json
   {
     "tg_user_id": 123456789,
     "username": "example_user",
     "display_name": "Example User",
     "consent_basis": "oral",
     "tz": "Europe/Kyiv"
   }
   ```
4. Откройте UI, найдите пользователя в поиске. После смены статуса collector сохранит событие; графики и таблицы обновляются автоматически (UI перезапрашивает данные каждые 15 секунд).

⚠️ Если статус не фиксируется — проверьте, что:

- этот `tg_user_id` действительно принадлежит человеку;
- он в контактах аккаунта коллектора и разрешил видеть last seen;
- в логах collector’а (`docker compose … logs -f collector`) появляются `online_detected` / `offline_detected`.

---

## 4. Команды администратора

| Действие                       | Команда                                                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Запустить/пересобрать сервис   | `docker compose --env-file ops/docker/.env -f ops/docker/docker-compose.yml up -d --build <service>`                                                                                       |
| Остановить всё                 | `docker compose --env-file ops/docker/.env -f ops/docker/docker-compose.yml down`                                                                                                          |
| Проверить события в БД         | `docker compose --env-file ops/docker/.env -f ops/docker/docker-compose.yml exec postgres psql -U postgres -c "SELECT tg_user_id, status, ts FROM status_event ORDER BY ts DESC LIMIT 5;"` |
| Резервное копирование Postgres | `ops/backup/backup.sh` (воспользуйтесь cron/Task Scheduler)                                                                                                                                |

---

## 5. Структура проекта

```
collector/        Telethon userbot + фоновые задачи
api/              FastAPI + SQLAlchemy + Alembic
web/              Next.js 14 App Router + TailwindCSS + ECharts
common/           Общие конфигурации, ORM-модели, вспомогалки
migrations/       Alembic миграции
ops/docker/       Dockerfile’ы, compose, .env.example
ops/backup/       Скрипты резервного копирования
tests/            Pytest (конфиг/заготовки)
```

---

## 6. Рекомендации перед публикацией

- Убедитесь, что `ops/docker/.env` не попал в git (`git status` → только `.env.example`).
- При необходимости обновите секреты через `docker compose up -d --build api collector`.
- Проверьте, что collector пишет события без ошибок (простой способ — зайти/выйти из Telegram отслеживаемым пользователем и посмотреть логи).

Удачного деплоя!🚀

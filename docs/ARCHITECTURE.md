# UZ DRONE AI — план разработки и архитектура

## 1. Концепция продукта

UZ DRONE AI — профессиональная AI Drone Platform для FPV-дронов, видеонаблюдения, поиска объектов, телеметрии, миссий и аналитики в реальном времени. Интерфейс полностью русскоязычный и выполнен в стиле military / cyberpunk / tactical / futuristic с тёмными стеклянными панелями, неоновыми акцентами и плавными переходами.

## 2. Структура каталогов

```text
backend/
  app/
    api/              # REST API маршруты
    core/             # конфигурация, безопасность JWT
    db/               # подключение SQLAlchemy
    models/           # ORM модели PostgreSQL
    schemas/          # Pydantic DTO
    services/         # бизнес-логика, AI, телеметрия, миссии
    websocket/        # realtime WebSocket хаб
    main.py           # FastAPI приложение
frontend/
  src/
    api/              # клиент API и WebSocket
    components/       # UI компоненты дашборда
    styles/           # Tailwind стили
    App.tsx           # главное окно платформы
    main.tsx          # точка входа React
  public/             # статические файлы
docs/
  ARCHITECTURE.md     # архитектура, БД, API, связи компонентов
```

## 3. Схема базы данных

### users
- `id` — UUID, первичный ключ
- `email` — уникальный логин оператора
- `hashed_password` — хэш пароля
- `role` — роль оператора
- `created_at` — дата создания

### drones
- `id` — UUID
- `name` — имя борта
- `status` — состояние борта
- `lat`, `lng` — GPS координаты
- `created_at` — дата регистрации

### telemetry
- `id` — UUID
- `drone_id` — FK на drones
- `speed`, `altitude`, `battery`, `signal`, `distance`, `heading`
- `lat`, `lng`
- `created_at`

### detections
- `id` — UUID
- `drone_id` — FK на drones
- `label` — тип цели
- `confidence` — вероятность
- `bbox` — координаты рамки `[x, y, w, h]`
- `snapshot_url` — путь к снимку
- `created_at`

### targets
- `id` — UUID
- `detection_id` — FK на detections
- `priority` — приоритет цели
- `status` — состояние цели
- `lat`, `lng`
- `created_at`

### missions
- `id` — UUID
- `name` — название миссии
- `status` — draft/running/stopped/completed
- `route` — JSON маршрут
- `created_at`, `started_at`, `finished_at`

### logs
- `id` — UUID
- `level` — info/warning/error
- `category` — flight/detection/system/mission
- `message` — текст события
- `created_at`

### photo_searches
- `id` — UUID
- `filename` — сохранённое фото
- `status` — processing/completed/failed
- `matches` — JSON совпадения
- `created_at`

## 4. API документация

### Auth
- `POST /api/auth/login` — получить JWT токен оператора.

### Drones
- `GET /api/drones` — список дронов.
- `GET /api/drones/{drone_id}` — карточка дрона.

### Telemetry
- `GET /api/telemetry/latest` — последние показатели скорости, высоты, батареи, GPS, сигнала, дистанции и курса.
- `GET /api/telemetry/history` — исторические точки для графиков.

### AI
- `GET /api/ai/detections` — последние обнаружения YOLO/OpenCV.
- `POST /api/ai/analyze-frame` — анализ кадра.
- `POST /api/ai/photo-search` — загрузка фото, сохранение и запуск поиска совпадений.

### Missions
- `GET /api/missions` — история миссий.
- `POST /api/missions` — создание миссии.
- `POST /api/missions/{mission_id}/start` — запуск миссии.
- `POST /api/missions/{mission_id}/stop` — остановка миссии.

### Logs
- `GET /api/logs` — журнал полётов, обнаружений, ошибок и предупреждений.

### Realtime
- `WS /ws/live` — поток телеметрии, FPS, задержки, обнаружений и статуса видеопотока.

## 5. Связи между компонентами

1. FPV-дрон отправляет видеопоток и телеметрию на backend.
2. FastAPI принимает REST-команды и realtime-подключения WebSocket.
3. OpenCV извлекает кадры, YOLOv8 выполняет детекцию объектов.
4. SQLAlchemy сохраняет пользователей, дроны, телеметрию, цели, миссии, поиски и логи в PostgreSQL.
5. WebSocket публикует live-события в React UI.
6. React показывает центральный LIVE DRONE FEED, карту Leaflet, AI-модуль, телеметрию, миссии, аналитику и логи.
7. JWT защищает операторские API и обеспечивает расширение для ролей.

## 6. Этапы реализации

1. Создать документацию архитектуры, БД, API и связей.
2. Реализовать backend: FastAPI, SQLAlchemy модели, JWT, REST API, WebSocket, AI service и mock-realtime режим.
3. Реализовать frontend: React, TypeScript, TailwindCSS, Framer Motion, Recharts, Leaflet и русскоязычный premium dashboard.
4. Добавить Docker Compose для PostgreSQL, backend и frontend.
5. Проверить синтаксис Python и TypeScript-сборку, затем подготовить коммит и Pull Request.

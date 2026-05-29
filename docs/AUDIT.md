# UZ DRONE AI — критический аудит реализации

## Короткий вывод

Текущий проект является качественным демонстрационным прототипом интерфейса и API-каркаса, но не является полноценной production-ready drone/AI системой. Реальных интеграций с FPV-дроном, видеопотоком, YOLO inference, трекингом человека по фото, миссиями автопилота и persistent-бизнес-логикой почти нет. Большая часть realtime-данных, телеметрии, детекций, маршрутов, логов и UI-состояний генерируется симуляторами или статическими массивами.

## Критичные факты

1. Реального видеопотока нет: frontend рисует псевдо-видеопанель CSS/HTML, а backend не принимает RTSP/WebRTC/GStreamer/MAVLink stream.
2. Реального YOLO-обнаружения нет: `AIDroneService` только проверяет наличие пакетов `ultralytics` и `cv2`, но не загружает модель, не принимает кадр и не запускает inference.
3. Реального поиска человека по фото нет: фото сохраняется, затем возвращаются заранее заданные совпадения без feature extraction, embeddings, re-identification или сравнения с видеопотоком.
4. Frontend не подключается к backend API или WebSocket: экран работает от локальной функции `demoUpdate`.
5. JWT login небезопасен: токен выдаётся любому email/password, если поля непустые; таблица пользователей и хэши паролей не используются.
6. Миссии хранятся в in-memory словаре и теряются при перезапуске backend.
7. Большинство REST endpoints возвращает симулированные или статические данные.
8. PostgreSQL-схема описана и ORM-модели есть, но фактически persistent-хранилище используется только в endpoint поиска по фото.
9. Типизация frontend искусственно ослаблена через `src/types.d.ts`, где внешние библиотеки объявлены как `any`; это скрывает реальные проблемы типов.
10. Docker Compose задаёт сервисы, но backend стартует без миграций, healthcheck/retry ожидания БД и production-ready конфигурации.

## Детальная таблица статусов

| Функция | Статус | Реальная или заглушка | Что нужно доделать |
|---|---|---|---|
| Архитектурная документация | Работает как документация | Реальная документация, не функциональность | Добавить ADR, sequence diagrams, threat model, deployment topology, SLA/SLO и план интеграции с реальным дроном |
| FastAPI приложение | Частично работает | Реальный FastAPI shell | Добавить lifecycle readiness, structured logging, error handling, versioned API, auth dependencies на защищённых endpoints |
| `/health` | Работает | Реальный простой endpoint | Проверять БД, AI-модель, WebSocket hub, storage и очередь кадров |
| PostgreSQL/SQLAlchemy подключение | Частично работает | Реальная ORM/сессия, но почти не используется | Добавить Alembic migrations, seed users/drones, transactions, repositories, индексы, constraints, retry подключения |
| ORM-модели users/drones/telemetry/detections/targets/missions/logs/photo_searches | Описаны | Реальная схема на уровне кода | Подключить все endpoints к БД, добавить миграции, audit fields, foreign-key cascade policy, validated enums |
| JWT login `/api/auth/login` | Endpoint отвечает | Заглушка безопасности | Искать пользователя в БД, проверять bcrypt hash, выдавать refresh/access tokens, добавить RBAC и protected routes |
| Список дронов `/api/drones` | Endpoint отвечает | Симулятор/заглушка | Читать зарегистрированные дроны из БД, показывать реальные статусы подключения и hardware metadata |
| Детали дрона `/api/drones/{id}` | Endpoint отвечает | Заглушка | Валидировать существование дрона в БД и возвращать реальные параметры борта |
| Последняя телеметрия `/api/telemetry/latest` | Endpoint отвечает | Симулятор | Подключить MAVLink/DroneKit/MAVSDK/serial/UDP telemetry ingestion и хранить точки в БД/time-series storage |
| История телеметрии `/api/telemetry/history` | Endpoint отвечает | Симулятор | Возвращать реальные исторические точки с фильтрами по drone_id/time range/downsampling |
| WebSocket `/ws/live` | Работает технически | Симулятор realtime | Подключить реальный ingest pipeline, broadcast manager, backpressure, auth, подписки по drone_id, бинарные кадры или ссылки на stream |
| Центральный LIVE DRONE FEED | Визуально отображается | UI-заглушка | Встроить реальный видеоплеер WebRTC/HLS/MJPEG/RTSP relay, overlay canvas, fullscreen API, reconnection logic |
| AI-рамки объектов на видео | Визуально отображаются | Демонстрационная отрисовка | Рисовать bbox из реального inference результата, синхронизировать bbox с размером кадра и latency compensation |
| FPS/задержка/разрешение | Отображаются | Симулятор | Измерять реальные параметры stream pipeline и inference pipeline |
| AI detections `/api/ai/detections` | Endpoint отвечает | Симулятор | Читать реальные detections из БД/stream processor, добавить фильтры и confidence thresholds |
| `/api/ai/analyze-frame` | Endpoint отвечает | Демонстрационная AI-заглушка | Принимать изображение/кадр, загрузить YOLOv8 модель, выполнить inference, вернуть bbox/classes/confidence и сохранить результат |
| Наличие YOLOv8 | Зависимость указана | Не является реальной интеграцией | Добавить model registry, weights path, device selection CPU/GPU, warmup, batch/stream inference, NMS config |
| Наличие OpenCV | Зависимость указана | Не является реальной обработкой видео | Добавить frame capture, preprocessing, resize/letterbox, color conversion, tracking, encoding snapshots |
| Поиск по фото `/api/ai/photo-search` | Фото сохраняется и запись создаётся | Смешано: сохранение реальное, поиск заглушка | Реализовать detector + face/person ReID embeddings, vector DB, сравнение с detections/video frames, privacy/security checks |
| Реальный поиск человека по фото | Не реализован | Заглушка | Нужны person detection, ReID-модель, feature extraction, индекс, thresholding, объяснение совпадений и UI результатов |
| Миссии `/api/missions` | Endpoint отвечает | In-memory заглушка | Хранить миссии в БД, валидировать маршрут, интегрировать с автопилотом, waypoint upload, state machine, cancellation safety |
| Запуск/остановка миссии | Меняет статус в памяти | Заглушка | Отправлять команды дрону, подтверждать ack, отслеживать execution state, fail-safe и emergency stop |
| Логи `/api/logs` | Endpoint отвечает | Статические данные | Писать реальные system/flight/AI/security events в БД/log backend, добавить уровни, фильтры, correlation_id |
| Leaflet-карта | Отображается в UI | Реальная библиотека с демо-данными | Подключить реальные координаты, маршруты, POI, targets из backend/WebSocket, offline tiles для полевых условий |
| Телеметрические карточки UI | Отображаются | Симулятор через frontend `demoUpdate` | Получать данные из WebSocket/API, показывать stale/offline state, единицы измерения и аварийные пороги |
| Аналитические графики | Отображаются | Симулятор через frontend `demoUpdate` | Строить графики из реальной истории телеметрии и детекций, добавить временные фильтры и экспорт |
| Левая навигация | Кнопки переключают активный раздел | Частично реальная UI-навигация | Сделать отдельные полноценные экраны для Видео/Поиск/Миссии/Настройки/Логи, routing и deep links |
| Кнопки `Запуск миссии` и `Стоп` | Отображаются | Заглушка UI | Привязать к API миссий, добавить подтверждения, состояние загрузки, обработку ошибок и безопасность emergency stop |
| Frontend API-клиент | Отсутствует | Не реализовано | Создать HTTP client, WebSocket client, auth storage, retry/reconnect, typed DTO без `any` |
| Интеграция frontend с WebSocket | Отсутствует | Не реализовано | Подключить `/ws/live`, заменить `demoUpdate`, обрабатывать reconnect, heartbeat, auth token и drone_id |
| TypeScript типизация | Компилируется локально | Частично фиктивная | Убрать глобальные `any` declarations, установить типы библиотек, включить строгие проверки без заглушек |
| Docker Compose | Описан | Реальная базовая оркестрация | Добавить healthchecks, wait-for-db, volumes для uploads, GPU/runtime profile для AI, production build frontend |
| README | Есть | Реальная документация запуска | Явно маркировать demo/simulator режим и описать недостающие production-интеграции |

## Ответы на контрольные вопросы

### 1. Какие функции являются реальными

- FastAPI приложение, маршрутизация, Swagger, CORS и `/health` существуют как реальный backend-каркас.
- SQLAlchemy модели и сессия созданы как реальная ORM-основа.
- Сохранение загруженного фото на диск и запись `PhotoSearch` в БД выполняются реально при доступной БД.
- Leaflet, Recharts, Framer Motion, TailwindCSS используются в frontend как реальные UI-библиотеки.
- Docker Compose реально описывает PostgreSQL, backend и frontend сервисы.

### 2. Какие функции работают через симулятор

- Телеметрия backend и frontend.
- AI detections backend и frontend.
- WebSocket realtime stream.
- FPS, latency, resolution.
- Маршрут дрона.
- Аналитика графиков.

### 3. Какие функции являются заглушками

- JWT login и авторизация пользователей.
- Дроны и детали дрона.
- Миссии и команды start/stop.
- Логи.
- LIVE DRONE FEED как реальный видеопоток.
- Поиск человека по фото.
- YOLO/OpenCV inference pipeline.
- Frontend API/WebSocket integration.

### 4. Какие API endpoint работают полностью

Полностью в production-смысле — ни один бизнес-endpoint не работает полностью. Технически отвечают: `/health`, `/api/auth/login`, `/api/drones`, `/api/drones/{id}`, `/api/telemetry/latest`, `/api/telemetry/history`, `/api/ai/detections`, `/api/ai/analyze-frame`, `/api/ai/photo-search`, `/api/missions`, `/api/missions/{id}/start`, `/api/missions/{id}/stop`, `/api/logs`, `/ws/live`. Из них только `/health` можно считать честно завершённым простым endpoint; `/api/ai/photo-search` частично реален только в сохранении файла и записи результата.

### 5. Какие части AI являются настоящими

Настоящей AI-логики практически нет. Реальным является только наличие зависимостей `ultralytics`, `opencv-python-headless` в requirements и runtime-проверка доступности модулей. Это не выполняет inference и не доказывает работоспособность AI.

### 6. Какие части AI являются демонстрационными

- Все detections генерируются `detection_batch()`.
- `/api/ai/analyze-frame` возвращает случайные FPS/latency и симулированные detections.
- `/api/ai/photo-search` возвращает фиксированные совпадения.
- UI bbox и список целей строятся из локального demo state.

### 7. Есть ли реальная интеграция видеопотока

Нет. Нет RTSP/WebRTC/HLS/MJPEG ingestion, нет frame capture, нет video relay, нет stream player. LIVE DRONE FEED — визуальный макет.

### 8. Есть ли реальное обнаружение объектов YOLO

Нет. YOLOv8 не загружается, модельные веса не указаны, кадры не передаются, inference не вызывается, bbox не вычисляются моделью.

### 9. Есть ли реальный поиск человека по фото

Нет. Файл сохраняется, но совпадения являются статическими объектами. Нет детекции человека на фото, embeddings, ReID, vector search, сравнения с видеопотоком или доказательной базы совпадений.

## Приоритетный план доведения до реальной системы

1. Убрать demo-only frontend state и подключить API/WebSocket client.
2. Реализовать реальный video ingestion: RTSP/WebRTC relay, frame extractor, latency metrics.
3. Реализовать YOLOv8 inference service: загрузка weights, обработка кадров, GPU/CPU mode, сохранение detections.
4. Реализовать persistent telemetry ingestion через MAVLink/MAVSDK/DroneKit и хранение в БД/time-series.
5. Реализовать полноценную авторизацию: users table, hashed passwords, roles, protected endpoints.
6. Перенести missions/logs/drones/targets из памяти/статики в БД.
7. Реализовать photo search через person detection + ReID embeddings + vector index.
8. Добавить тесты API, unit-тесты сервисов, e2e-тесты UI и Docker healthchecks.
9. Убрать `any` type declarations и восстановить строгую TypeScript-типизацию.
10. Обозначить в README demo-режим и production roadmap, чтобы не вводить пользователей в заблуждение.

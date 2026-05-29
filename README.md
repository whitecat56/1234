# UZ DRONE AI

Профессиональная AI Drone Platform для управления FPV-дронами, анализа видеопотока в реальном времени, поиска объектов, миссий, телеметрии, карты, аналитики и логов.

## Возможности

- Русскоязычный интерфейс в стиле military / cyberpunk / tactical / futuristic.
- LIVE DRONE FEED с AI-рамками, FPS, задержкой и разрешением.
- Левая навигация: Главная, Видео, Карта, Поиск, Миссии, Телеметрия, Аналитика, Настройки, Логи.
- AI-модуль с обнаруженными объектами, вероятностью, временем, целями и журналом событий.
- Leaflet-карта с позицией дрона, маршрутом, точками интереса и сохранёнными целями.
- FastAPI backend с REST API, WebSocket realtime, JWT, SQLAlchemy и PostgreSQL.
- AI-сервис для YOLOv8/OpenCV и fallback-симуляции в dev-среде.

## Быстрый старт

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- Swagger: http://localhost:8000/docs

## Локальный запуск backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Локальный запуск frontend

```bash
cd frontend
npm install
npm run dev
```

## Архитектура

Полное проектирование, схема БД, API и связи компонентов описаны в `docs/ARCHITECTURE.md`.

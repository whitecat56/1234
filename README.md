# UZ DRONE AI

Профессиональная AI Drone Platform для управления FPV-дронами, анализа видеопотока в реальном времени, поиска объектов, миссий, телеметрии, карты, аналитики и логов.

## Возможности

- Русскоязычный интерфейс в стиле military / cyberpunk / tactical / futuristic.
- LIVE DRONE FEED показывает реальный поток с локальной веб-камеры через Local Camera Mode.
- Левая навигация: Главная, Видео, Карта, Поиск, Миссии, Телеметрия, Аналитика, Настройки, Логи.
- AI-модуль с обнаруженными объектами, вероятностью, временем, целями и журналом событий.
- Leaflet-карта с позицией дрона, маршрутом, точками интереса и сохранёнными целями.
- FastAPI backend с REST API, WebSocket realtime, JWT, SQLAlchemy и PostgreSQL.
- Local Camera Mode: отдельный host-процесс читает веб-камеру ноутбука через OpenCV VideoCapture(0) и передаёт кадры в backend по WebSocket.

## Быстрый старт

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- Swagger: http://localhost:8000/docs


## Local Camera Mode

Docker на Windows обычно не видит веб-камеру ноутбука как `/dev/video*`, поэтому камера запускается отдельным процессом на Windows-хосте и отправляет кадры в backend.

1. Запустите инфраструктуру:

```bash
docker compose up --build
```

2. На Windows-хосте установите зависимости для camera client:

```bash
py -m pip install opencv-python websockets
```

3. На Windows-хосте из корня проекта запустите Local Camera Mode:

```bash
py local_camera_client.py --url ws://localhost:8000/ws/camera --camera 0
```

4. Откройте frontend: http://localhost:5173. Реальное изображение с камеры должно появиться в блоке `LIVE DRONE FEED`. Если камера или host client недоступны, frontend показывает `CAMERA OFFLINE`.

Проверка backend WebSocket:

- frontend получает кадры из `ws://localhost:8000/ws/live`;
- host camera client отправляет кадры в `ws://localhost:8000/ws/camera`;
- для другой камеры используйте `--camera 1`, `--camera 2` и т.д.

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

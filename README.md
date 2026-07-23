# GameClub Aktash Manager

A complete local admin system for GameClub Aktash with React 19, TypeScript, Vite, Tailwind CSS, FastAPI, SQLAlchemy, JWT authentication, and SQLite.

## Features
- Administrator and Employee roles (employees can access Sales only).
- Product CRUD with images, barcode, category, purchase/selling price, quantity, low-stock warnings, search and filters.
- Sales workflow that decreases stock, records sale items, revenue, profit, and history.
- Dashboard, analytics charts, calendar reports, action history, employee management, settings, database backup/restore, Excel import/export.
- All data is stored locally in `backend/gameclub_aktash.db`.

## Requirements
- Python 3.11+
- Node.js 20+

## Backend setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn main:app --reload
```
The API runs at http://localhost:8000 and initializes SQLite automatically.

## Frontend setup
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173.

## Default login
- Username: `admin`
- Password: `admin123`

Change this password from Employees after first login.

## API overview
- `POST /api/login`
- `GET/POST /api/products`, `PUT/DELETE /api/products/{id}`
- `POST /api/sales`, `GET /api/sales`
- `GET /api/dashboard`
- `GET /api/history`
- `GET /api/analytics`
- `GET /api/calendar`
- `GET/POST/PUT/DELETE /api/employees`
- `GET/PUT /api/settings`
- `GET /api/settings/backup`, `POST /api/settings/restore`
- `GET /api/settings/export`, `POST /api/settings/import`

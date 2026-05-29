from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.session import get_db
from app.models import Mission, PhotoSearch
from app.schemas.domain import LoginRequest, MissionCreate, MissionRead, PhotoSearchRead, Token
from app.services.ai_service import ai_service
from app.services.simulator import BASE_LAT, BASE_LNG, detection_batch, history_points, latest_telemetry

router = APIRouter(prefix="/api")

MISSIONS: dict[UUID, Mission] = {}


@router.post("/auth/login", response_model=Token, tags=["Авторизация"])
def login(payload: LoginRequest) -> Token:
    if not payload.email or not payload.password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверные учетные данные")
    return Token(access_token=create_access_token(payload.email))


@router.get("/drones", tags=["Дроны"])
def drones() -> list[dict]:
    return [{"id": str(uuid4()), "name": "UZ-FPV-01", "status": "active", "lat": BASE_LAT, "lng": BASE_LNG}]


@router.get("/drones/{drone_id}", tags=["Дроны"])
def drone_detail(drone_id: UUID) -> dict:
    return {"id": str(drone_id), "name": "UZ-FPV-01", "status": "active", "lat": BASE_LAT, "lng": BASE_LNG}


@router.get("/telemetry/latest", tags=["Телеметрия"])
def telemetry_latest() -> dict:
    return latest_telemetry(8)


@router.get("/telemetry/history", tags=["Телеметрия"])
def telemetry_history() -> list[dict]:
    return history_points()


@router.get("/ai/detections", tags=["AI"])
def detections() -> list[dict]:
    return detection_batch()


@router.post("/ai/analyze-frame", tags=["AI"])
async def analyze_frame() -> dict:
    return await ai_service.analyze_frame()


@router.post("/ai/photo-search", response_model=PhotoSearchRead, tags=["AI"])
async def photo_search(file: UploadFile = File(...), db: Session = Depends(get_db)) -> PhotoSearch:
    result = await ai_service.save_and_search_photo(file)
    search = PhotoSearch(filename=result["filename"], status=result["status"], matches=result["matches"])
    db.add(search)
    db.commit()
    db.refresh(search)
    return search


@router.get("/missions", response_model=list[MissionRead], tags=["Миссии"])
def list_missions() -> list[Mission]:
    if not MISSIONS:
        mission_id = uuid4()
        MISSIONS[mission_id] = Mission(
            id=mission_id,
            name="Патруль периметра Север-1",
            status="draft",
            route=[{"lat": BASE_LAT, "lng": BASE_LNG}, {"lat": BASE_LAT + 0.01, "lng": BASE_LNG + 0.008}],
            created_at=datetime.now(UTC),
        )
    return list(MISSIONS.values())


@router.post("/missions", response_model=MissionRead, tags=["Миссии"])
def create_mission(payload: MissionCreate) -> Mission:
    mission = Mission(id=uuid4(), name=payload.name, route=payload.route, status="draft", created_at=datetime.now(UTC))
    MISSIONS[mission.id] = mission
    return mission


@router.post("/missions/{mission_id}/start", response_model=MissionRead, tags=["Миссии"])
def start_mission(mission_id: UUID) -> Mission:
    mission = MISSIONS.get(mission_id)
    if mission is None:
        raise HTTPException(status_code=404, detail="Миссия не найдена")
    mission.status = "running"
    mission.started_at = datetime.now(UTC)
    return mission


@router.post("/missions/{mission_id}/stop", response_model=MissionRead, tags=["Миссии"])
def stop_mission(mission_id: UUID) -> Mission:
    mission = MISSIONS.get(mission_id)
    if mission is None:
        raise HTTPException(status_code=404, detail="Миссия не найдена")
    mission.status = "stopped"
    mission.finished_at = datetime.now(UTC)
    return mission


@router.get("/logs", tags=["Логи"])
def logs() -> list[dict]:
    now = datetime.now(UTC)
    return [
        {"level": "info", "category": "flight", "message": "Дрон вышел на маршрут патрулирования", "created_at": now},
        {"level": "warning", "category": "detection", "message": "Цель с высокой вероятностью обнаружена в секторе A-7", "created_at": now},
        {"level": "info", "category": "system", "message": "WebSocket канал стабилен, задержка ниже 40 мс", "created_at": now},
    ]

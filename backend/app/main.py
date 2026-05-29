from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.core.config import settings
from app.db.session import Base, engine
from app.models import Detection, Drone, LogEntry, Mission, PhotoSearch, Target, Telemetry, User
from app.websocket.live import router as websocket_router

_ = (Detection, Drone, LogEntry, Mission, PhotoSearch, Target, Telemetry, User)

app = FastAPI(title=settings.app_name, version="1.0.0", description="AI Drone Platform для FPV, телеметрии, поиска и миссий")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/health", tags=["Система"])
def health() -> dict[str, str]:
    return {"status": "ok", "product": settings.app_name}


app.include_router(api_router)
app.include_router(websocket_router)

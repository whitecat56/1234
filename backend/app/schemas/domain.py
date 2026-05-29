from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class DroneRead(BaseModel):
    id: UUID
    name: str
    status: str
    lat: float
    lng: float

    model_config = {"from_attributes": True}


class TelemetryRead(BaseModel):
    speed: float
    altitude: float
    battery: float
    signal: float
    distance: float
    heading: float
    lat: float
    lng: float
    created_at: datetime


class DetectionRead(BaseModel):
    label: str
    confidence: float
    bbox: dict
    snapshot_url: str | None = None
    created_at: datetime


class MissionCreate(BaseModel):
    name: str
    route: list[dict]


class MissionRead(BaseModel):
    id: UUID
    name: str
    status: str
    route: list[dict]
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None

    model_config = {"from_attributes": True}


class LogRead(BaseModel):
    level: str
    category: str
    message: str
    created_at: datetime


class PhotoSearchRead(BaseModel):
    id: UUID
    filename: str
    status: str
    matches: list[dict]
    created_at: datetime

    model_config = {"from_attributes": True}

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(50), default="operator")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Drone(Base):
    __tablename__ = "drones"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), index=True)
    status: Mapped[str] = mapped_column(String(50), default="active")
    lat: Mapped[float] = mapped_column(Float, default=41.3111)
    lng: Mapped[float] = mapped_column(Float, default=69.2797)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    telemetry: Mapped[list["Telemetry"]] = relationship(back_populates="drone")
    detections: Mapped[list["Detection"]] = relationship(back_populates="drone")


class Telemetry(Base):
    __tablename__ = "telemetry"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drone_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("drones.id"))
    speed: Mapped[float] = mapped_column(Float)
    altitude: Mapped[float] = mapped_column(Float)
    battery: Mapped[float] = mapped_column(Float)
    signal: Mapped[float] = mapped_column(Float)
    distance: Mapped[float] = mapped_column(Float)
    heading: Mapped[float] = mapped_column(Float)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    drone: Mapped[Drone] = relationship(back_populates="telemetry")


class Detection(Base):
    __tablename__ = "detections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drone_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("drones.id"))
    label: Mapped[str] = mapped_column(String(120))
    confidence: Mapped[float] = mapped_column(Float)
    bbox: Mapped[dict] = mapped_column(JSONB)
    snapshot_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    drone: Mapped[Drone] = relationship(back_populates="detections")
    targets: Mapped[list["Target"]] = relationship(back_populates="detection")


class Target(Base):
    __tablename__ = "targets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    detection_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("detections.id"))
    priority: Mapped[str] = mapped_column(String(30), default="medium")
    status: Mapped[str] = mapped_column(String(30), default="tracked")
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    detection: Mapped[Detection] = relationship(back_populates="targets")


class Mission(Base):
    __tablename__ = "missions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(30), default="draft")
    route: Mapped[list[dict]] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class LogEntry(Base):
    __tablename__ = "logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    level: Mapped[str] = mapped_column(String(30))
    category: Mapped[str] = mapped_column(String(50))
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PhotoSearch(Base):
    __tablename__ = "photo_searches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(30), default="processing")
    matches: Mapped[list[dict]] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

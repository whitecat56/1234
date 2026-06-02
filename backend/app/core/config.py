from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "UZ DRONE AI"
    database_url: str = "postgresql+psycopg://uzdrone:uzdrone@localhost:5432/uzdrone"
    jwt_secret: str = "replace-with-production-secret"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 720
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    uploads_dir: str = "uploads"
    yolo_model: str = "yolov8n.pt"
    detection_confidence: float = 0.35
    camera_offline_after_seconds: float = 5.0

    model_config = SettingsConfigDict(env_file=".env", env_prefix="UZ_DRONE_")


settings = Settings()

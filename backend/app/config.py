from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    APP_NAME: str = "SkyGuardian AI"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    HOST: str = "0.0.0.0"
    PORT: int = 8000

    POSTGRES_USER: str = "skyguardian"
    POSTGRES_PASSWORD: str = "skyguardian_secret_pass"
    POSTGRES_DB: str = "skyguardiandb"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str = "postgresql+psycopg://skyguardian:skyguardian_secret_pass@localhost:5432/skyguardiandb"

    JWT_SECRET: str = "dev_secret_key_skyguardian_ai_2026_super_secure_32bytes"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    LLM_PROVIDER: str = "mock"
    LLM_MODEL: str = "gemini-1.5-flash"
    LLM_API_KEY: Optional[str] = "mock_key"

    TAVILY_API_KEY: Optional[str] = "mock_key"

    FLIGHT_PROVIDER: str = "mock"
    FLIGHT_API_KEY: Optional[str] = "mock_key"
    USE_MOCK_FLIGHTS: bool = True

    WEATHER_PROVIDER: str = "mock"
    WEATHER_API_KEY: Optional[str] = "mock_key"

    # RAG (Retrieval-Augmented Generation) Settings
    RAG_ENABLED: bool = True
    RAG_TOP_K: int = 3
    RAG_SIMILARITY_THRESHOLD: float = 0.40
    RAG_CHUNK_SIZE: int = 600
    RAG_CHUNK_OVERLAP: int = 80
    RAG_MAX_CONTEXT_LENGTH: int = 3000
    EMBEDDING_PROVIDER: str = "mock"  # "mock", "gemini", "openai"
    EMBEDDING_MODEL: str = "models/text-embedding-004"
    KNOWLEDGE_STORE_BACKEND: str = "memory"  # "memory", "pgvector"
    KNOWLEDGE_CACHE_SIZE: int = 256

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

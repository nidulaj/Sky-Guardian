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
    ADMIN_REGISTRATION_SECRET: str = "skyguardian_admin_secret_2026"

    LLM_PROVIDER: str = "mock"
    LLM_MODEL: str = "gemini-1.5-flash"
    LLM_API_KEY: Optional[str] = "mock_key"

    GEMINI_API_KEY: Optional[str] = None
    VOICE_ENABLED: bool = True
    VOICE_MODEL: str = "gemini-2.5-flash"
    VOICE_TTS_MODEL: str = "gemini-3.8-flash-tts"
    VOICE_TTS_VOICE: str = "Kore"
    VOICE_TIMEOUT_SECONDS: float = 45.0

    TAVILY_API_KEY: Optional[str] = "mock_key"

    FLIGHT_PROVIDER: str = "mock"
    FLIGHT_API_KEY: Optional[str] = "mock_key"
    USE_MOCK_FLIGHTS: bool = True

    # Live search failures never fall back to sample itineraries.
    ALTERNATIVE_PROVIDER: str = "auto"
    RANKING_CONFIG_PATH: Optional[str] = None

    # Options: mock (deterministic demo data), open_meteo (live forecast, no API key needed)
    WEATHER_PROVIDER: str = "mock"
    WEATHER_API_KEY: Optional[str] = "mock_key"
    OPEN_METEO_BASE_URL: str = "https://api.open-meteo.com/v1/forecast"
    WEATHER_TIMEOUT_SECONDS: float = 8.0
    WEATHER_CACHE_TTL_SECONDS: int = 600

    # Outer safety timeout per agent step; longer than the providers' own timeouts
    # (alternative search 20 s, weather 8 s) so those can report their own warnings first.
    AGENT_TIMEOUT_SECONDS: float = 30.0

    # None = <repo>/config/risk.yaml (built-in defaults when that file is absent)
    RISK_CONFIG_PATH: Optional[str] = None

    # RAG (Retrieval-Augmented Generation) Settings
    RAG_ENABLED: bool = True
    RAG_TOP_K: int = 3
    RAG_SIMILARITY_THRESHOLD: float = 0.40
    RAG_CHUNK_SIZE: int = 600
    RAG_CHUNK_OVERLAP: int = 80
    RAG_MAX_CONTEXT_LENGTH: int = 3000
    EMBEDDING_PROVIDER: str = "mock"  # "mock", "gemini", "openai"
    EMBEDDING_MODEL: str = "models/text-embedding-004"
    KNOWLEDGE_STORE_BACKEND: str = "pgvector"  # "memory", "pgvector"
    KNOWLEDGE_CACHE_SIZE: int = 256
    # Supabase & Storage Settings
    SUPABASE_URL: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_STORAGE_BUCKET: str = "rag-documents"

    @property
    def clean_supabase_url(self) -> Optional[str]:
        if not self.SUPABASE_URL:
            return None
        url = self.SUPABASE_URL.strip().rstrip("/")
        if url.endswith("/rest/v1"):
            url = url[:-len("/rest/v1")].rstrip("/")
        return url

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

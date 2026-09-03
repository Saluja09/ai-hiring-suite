from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    hunar_api_key: str = ""
    hunar_base_url: str = "https://api.voice.hunar.ai/external/v1"
    public_base_url: str = ""
    llm_provider: str = "none"
    groq_api_key: str = ""
    gemini_api_key: str = ""
    pdl_api_key: str = ""
    pdl_demo_phone: str = "+918837518407"
    database_url: str = "sqlite:///./app.db"
    cors_origins: str = "*"
    reconciler_interval_seconds: int = 30


@lru_cache
def get_settings() -> Settings:
    return Settings()

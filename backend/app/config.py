from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All app settings, loaded from the .env file."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "sqlite:///./hr_hiring.db"

    # Azure OpenAI (used by the AI agents)
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""
    azure_openai_deployment: str = "gpt-4o"

    # Vapi (voice screening calls, Agent 2 Stage 2.2). Secret: backend only.
    vapi_private_key: str = ""

    # Resume uploads
    upload_dir: str = "uploads"
    max_upload_mb: int = 5

    # The website address that is allowed to call this API (CORS)
    frontend_origin: str = "http://localhost:3000"

    # Login (JWT). The secret key has no default on purpose: the app won't start without it.
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480  # 8 hours


# One shared settings object for the whole app
settings = Settings()

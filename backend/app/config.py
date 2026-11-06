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

    # Resume uploads
    upload_dir: str = "uploads"
    max_upload_mb: int = 5


# One shared settings object for the whole app
settings = Settings()
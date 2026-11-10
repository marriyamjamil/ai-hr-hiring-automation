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

    # The company that uses this system (Agent 2 introduces it on the screening call)
    company_name: str = "our company"
    company_about: str = ""

    # Resume uploads
    upload_dir: str = "uploads"
    max_upload_mb: int = 5

    # The website address that is allowed to call this API (CORS)
    frontend_origin: str = "http://localhost:3000"

    # Email (Agent 3, step 8): Gmail sends the Outbox emails.
    # SMTP_PASSWORD is the 16-letter Gmail App Password (secret: only in .env).
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    email_from_name: str = ""  # empty = "<COMPANY_NAME> Careers"
    email_sending_enabled: bool = False  # False = emails only wait in the Outbox (safe testing)

    # Login (JWT). The secret key has no default on purpose: the app won't start without it.
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480  # 8 hours


# One shared settings object for the whole app
settings = Settings()

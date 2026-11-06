from fastapi import FastAPI

from app import models  # noqa: F401  (importing this registers the tables)
from app.config import settings
from app.database import Base, engine
from app.routers import jobs

# Create all tables in the database if they don't exist yet
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI HR Hiring Automation API",
    description="Backend for the AI-powered hiring workflow",
    version="0.1.0",
)

# Connect the routers (groups of endpoints)
app.include_router(jobs.router)


@app.get("/", tags=["System"])
def home():
    return {"message": "AI HR Hiring Automation API is running"}


@app.get("/health", tags=["System"])
def health_check():
    # Shows whether settings loaded, without ever showing the secret values
    return {
        "status": "ok",
        "database": settings.database_url.split(":")[0],
        "ai_configured": bool(settings.azure_openai_endpoint and settings.azure_openai_api_key),
    }
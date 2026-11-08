from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  (importing this registers the tables)
from app.config import settings
from app.database import Base, engine
from app.routers import auth, candidates, jobs, users

# Create all tables in the database if they don't exist yet
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI HR Hiring Automation API",
    description="Backend for the AI-powered hiring workflow",
    version="0.1.0",
)

# Allow only our website to call this API from the browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect the routers (groups of endpoints)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(jobs.router)
app.include_router(candidates.router)


@app.get("/", tags=["System"])
def home():
    return {"message": "AI HR Hiring Automation API is running"}


@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "ok",
        "database": settings.database_url.split(":")[0],
        "ai_configured": bool(settings.azure_openai_endpoint and settings.azure_openai_api_key),
    }
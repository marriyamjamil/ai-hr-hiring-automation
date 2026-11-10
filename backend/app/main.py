import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  (importing this registers the tables)
from app.config import settings
from app.database import Base, engine
from app.mailer import email_sender_loop
from app.routers import (
    auth,
    booking,
    candidates,
    interview,
    interviewers,
    jobs,
    outbox,
    scheduling,
    screening,
    users,
)

# Create all tables in the database if they don't exist yet
Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 📨 Start the Gmail sender in the background (it sends new Outbox emails every few seconds)
    sender = asyncio.create_task(email_sender_loop())
    yield
    sender.cancel()


app = FastAPI(
    title="AI HR Hiring Automation API",
    description="Backend for the AI-powered hiring workflow",
    version="0.1.0",
    lifespan=lifespan,
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
app.include_router(screening.router)
app.include_router(interview.router)
app.include_router(interviewers.router)
app.include_router(scheduling.router)
app.include_router(booking.router)
app.include_router(outbox.router)


@app.get("/", tags=["System"])
def home():
    return {"message": "AI HR Hiring Automation API is running"}


@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "ok",
        "database": settings.database_url.split(":")[0],
        "ai_configured": bool(settings.azure_openai_endpoint and settings.azure_openai_api_key),
        "email_sending": settings.email_sending_enabled and bool(settings.smtp_user and settings.smtp_password),
    }
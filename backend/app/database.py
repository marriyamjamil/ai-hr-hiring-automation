from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

# check_same_thread=False is needed only for SQLite when used with FastAPI
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

# SQLite can't create folders: make sure the database's folder exists
# (on Azure the database lives in /home/data, which survives restarts)
if settings.database_url.startswith("sqlite"):
    db_file = make_url(settings.database_url).database
    if db_file and db_file != ":memory:":
        Path(db_file).parent.mkdir(parents=True, exist_ok=True)

# The engine is the connection to the database (address comes from .env)
engine = create_engine(settings.database_url, connect_args=connect_args)

# A "session" is one conversation with the database (read / save / update)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


# Every table class will inherit from Base, so SQLAlchemy knows it is a table
class Base(DeclarativeBase):
    pass


# Opens a session for one request and always closes it afterwards
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
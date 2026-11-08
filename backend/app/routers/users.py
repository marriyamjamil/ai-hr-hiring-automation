from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models import User
from app.schemas import UserCreate, UserOut
from app.security import hash_password

# Only admins can see or create accounts (there is no public sign-up)
router = APIRouter(
    prefix="/api/users",
    tags=["Users"],
    dependencies=[Depends(require_roles("admin"))],
)


# 👥 List all accounts
@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.scalars(select(User).order_by(User.id)).all()


# ➕ Create a new HR / manager / admin account
@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(user_in: UserCreate, db: Session = Depends(get_db)):
    email = user_in.email.strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )
    user = User(
        name=user_in.name.strip(),
        email=email,
        password_hash=hash_password(user_in.password),
        role=user_in.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
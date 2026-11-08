from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import TokenOut, UserOut
from app.security import create_access_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["Auth"])


# 🔑 Log in with email + password → get a pass (token)
@router.post("/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Log in. Put your EMAIL in the 'username' field."""
    email = form.username.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    # Same message for "no such email" and "wrong password", so attackers can't guess emails
    if user is None or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    return TokenOut(access_token=create_access_token(user.id, user.role))


# 🙋 Who am I? (the website uses this to show your name and role)
@router.get("/me", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_user)):
    """The logged-in user's own details."""
    return current_user
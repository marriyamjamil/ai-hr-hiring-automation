import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import decode_access_token

# Tells FastAPI where to log in; also adds the "Authorize" button on /docs
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """Find the logged-in user from their pass, or refuse with 401."""
    not_logged_in = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not logged in or session expired.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise not_logged_in

    user = db.get(User, user_id)
    if user is None:
        raise not_logged_in
    return user


def require_roles(*roles: str):
    """Allow only users with one of these roles, e.g. require_roles("admin", "hr")."""

    def check_role(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to do this.",
            )
        return user

    return check_role
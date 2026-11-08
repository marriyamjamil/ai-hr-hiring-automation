"""
Create the first admin account.

Run once from the backend folder:
    python create_admin.py
"""

from getpass import getpass

from sqlalchemy import select

from app import models  # noqa: F401  (registers the tables)
from app.database import Base, SessionLocal, engine
from app.models import User
from app.security import hash_password


def main():
    Base.metadata.create_all(bind=engine)

    name = input("Admin name: ").strip()
    email = input("Admin email: ").strip().lower()
    password = getpass("Password (8-72 characters, hidden while you type): ")

    if not name or "@" not in email:
        print("❌ Please enter a name and a valid email.")
        return
    if not 8 <= len(password) <= 72:
        print("❌ Password must be 8-72 characters.")
        return
    if password != getpass("Repeat password: "):
        print("❌ Passwords do not match.")
        return

    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == email)):
            print("❌ A user with this email already exists.")
            return
        db.add(User(name=name, email=email, password_hash=hash_password(password), role="admin"))
        db.commit()

    print(f"✅ Admin account created for {email}")


if __name__ == "__main__":
    main()
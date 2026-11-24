import math
import os
from datetime import timedelta
import jwt
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from .db import get_db
from .models import AdminUser, LoginAttempt
from .security import clean_email, create_token, decode_token, hash_password, now, password_problems, verify_password
MAX_FAILURES = 5
LOCK_SECONDS = max(30, int(os.getenv("LOGIN_LOCKOUT_SECONDS", "60")))  # how long an email is locked after too many wrong attempts (default 1 minute)
router = APIRouter(prefix="/api/auth", tags=["auth"])
BAD = HTTPException(401, "Incorrect email or password.", headers={"WWW-Authenticate": "Bearer"})

def admin_only(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> AdminUser:
    """Every admin route depends on this: a valid, unexpired token for an active Admin whose password has not changed since."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Please sign in.", headers={"WWW-Authenticate": "Bearer"})
    try:
        claims = decode_token(authorization[7:].strip())
        user = db.get(AdminUser, int(claims["sub"]))
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(401, "Your session has ended. Please sign in again.", headers={"WWW-Authenticate": "Bearer"}) from None
    if not user or not user.is_active or user.token_version != claims["tv"]:
        raise HTTPException(401, "Your session has ended. Please sign in again.", headers={"WWW-Authenticate": "Bearer"})
    return user

def check_lock(db: Session, email: str) -> LoginAttempt | None:
    a = db.get(LoginAttempt, email)
    if a and a.locked_until and a.locked_until > now():
        secs = max(1, math.ceil((a.locked_until - now()).total_seconds()))
        wait = f"{secs} second{'s' if secs != 1 else ''}" if secs <= 90 else f"{math.ceil(secs / 60)} minutes"
        raise HTTPException(429, f"Too many failed attempts. Try again in {wait}.")
    return a

def record_failure(db: Session, email: str, a: LoginAttempt | None):
    if not a:
        a = LoginAttempt(email=email, failures=0); db.add(a)
    a.failures = (a.failures if not (a.locked_until and a.locked_until <= now()) else 0) + 1
    a.locked_until = now() + timedelta(seconds=LOCK_SECONDS) if a.failures >= MAX_FAILURES else None
    db.commit()

def clear_failures(db: Session, a: LoginAttempt | None):
    if a:
        db.delete(a); db.commit()

class LoginIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=128)

def token_out(user: AdminUser) -> dict:
    token, seconds = create_token(user.id, user.email, user.token_version)
    return {"access_token": token, "token_type": "bearer", "expires_in": seconds, "email": user.email}

@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    try:
        email = clean_email(body.email)
    except ValueError:
        raise HTTPException(422, "Enter a complete email address, like name@company.com.") from None
    attempt = check_lock(db, email)
    user = db.scalar(select(AdminUser).where(AdminUser.email == email))
    ok = verify_password(user.password_hash if user and user.is_active else None, body.password)
    if not ok:
        record_failure(db, email, attempt)
        raise BAD
    clear_failures(db, attempt)
    user.last_login_at = now(); db.commit()
    return token_out(user)

@router.get("/me")
def me(user: AdminUser = Depends(admin_only)):
    return {"email": user.email}

@router.post("/refresh")
def refresh(user: AdminUser = Depends(admin_only)):
    return token_out(user)

class ChangeIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=1, max_length=128)

@router.post("/change-password")
def change_password(body: ChangeIn, user: AdminUser = Depends(admin_only), db: Session = Depends(get_db)):
    attempt = check_lock(db, user.email)
    if not verify_password(user.password_hash, body.current_password):
        record_failure(db, user.email, attempt)
        raise HTTPException(400, "The current password is not correct.")
    clear_failures(db, attempt)
    if body.new_password == body.current_password:
        raise HTTPException(422, "The new password must be different from the current one.")
    problems = password_problems(body.new_password, user.email)
    if problems:
        raise HTTPException(422, "The new password needs: " + "; ".join(problems) + ".")
    user.password_hash = hash_password(body.new_password)
    user.token_version += 1  # signs out every other session
    db.commit()
    return token_out(user)
